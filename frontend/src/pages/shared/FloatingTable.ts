import { Node } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import {
  CONTENT_INSET, DEFAULT_OFFSET, type AnchorMode, type FloatingLayer,
  commitPlacement, createAnchor, layerZIndex, placeInLayer, resolvePageTop,
  selectNodeAt, toNumber, trackPointer, watchReflow,
} from './floatingObject';

export type CellAlign = 'left' | 'center' | 'right' | 'justify';

export interface TableCell {
  html: string;
  align: CellAlign;
}

export interface TableAttrs {
  anchor: AnchorMode;
  left: number;
  top: number;
  width: number;
  height: number | null;
  cells: TableCell[][];
  colWidths: number[] | null;
  rowHeights: (number | null)[] | null;
  borderColor: string;
  borderWidth: number;
  fontSize: string | null;
  layer: FloatingLayer;
}

const MIN_WIDTH = 60;
// An empty printed cell collapses to padding+borders (~6px); the editor must
// allow the same floor so rows can be made as small as they render.
const MIN_ROW_HEIGHT = 6;
const MIN_COL_PERCENT = 5;
const ALIGNS: CellAlign[] = ['left', 'center', 'right', 'justify'];
const RESIZE_DIRECTIONS = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as const;

export function createCells(rows: number, cols: number): TableCell[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({ html: '', align: 'left' as CellAlign })));
}

function normalize(attrs: Record<string, unknown>): TableAttrs {
  const cells = Array.isArray(attrs.cells) && attrs.cells.length > 0 ? (attrs.cells as TableCell[][]) : createCells(2, 2);
  return {
    anchor: attrs.anchor === 'text' ? 'text' : 'page',
    left: toNumber(attrs.left) ?? DEFAULT_OFFSET,
    top: toNumber(attrs.top) ?? DEFAULT_OFFSET,
    width: Math.max(MIN_WIDTH, toNumber(attrs.width) ?? 400),
    height: toNumber(attrs.height),
    cells,
    colWidths: Array.isArray(attrs.colWidths) ? (attrs.colWidths as number[]) : null,
    rowHeights: Array.isArray(attrs.rowHeights)
      ? (attrs.rowHeights as unknown[]).map((v) => toNumber(v))
      : null,
    borderColor: (attrs.borderColor as string) || '#000000',
    borderWidth: Math.max(0, toNumber(attrs.borderWidth) ?? 1),
    fontSize: (attrs.fontSize as string) || null,
    layer: attrs.layer === 'behind' ? 'behind' : 'front',
  };
}

function columnCount(a: TableAttrs): number {
  return Math.max(1, ...a.cells.map((row) => row.length));
}

// Column widths in percent; falls back to equal columns when missing or mismatched.
export function resolveColWidths(a: TableAttrs): number[] {
  const cols = columnCount(a);
  if (a.colWidths && a.colWidths.length === cols) return a.colWidths;
  return Array.from({ length: cols }, () => 100 / cols);
}

export function isInvisibleBorder(a: Pick<TableAttrs, 'borderColor' | 'borderWidth'>): boolean {
  return a.borderWidth === 0 || a.borderColor === 'transparent';
}

function cellStyle(a: TableAttrs, cell: TableCell): string {
  const align = ALIGNS.includes(cell.align) ? cell.align : 'left';
  return [
    `border: ${a.borderWidth}px solid ${a.borderColor}`,
    'padding: 2px 6px',
    `text-align: ${align}`,
    'vertical-align: top',
    'overflow-wrap: anywhere',
  ].join('; ');
}

function tableStyle(a: TableAttrs): string {
  return [
    'width: 100%',
    'border-collapse: collapse',
    'table-layout: fixed',
    a.height ? `height: ${a.height}px` : '',
  ].filter(Boolean).join('; ');
}

// Cell content is edited through contentEditable, so keep only the formatting the
// toolbar can produce (bold/italic/underline, line breaks) plus inserted variables.
const ALLOWED_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'BR', 'DIV', 'P', 'SPAN']);

export function sanitizeCellHtml(html: string): string {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstElementChild;
  if (!root) return '';
  const walk = (element: Element) => {
    Array.from(element.children).forEach((child) => {
      walk(child);
      if (!ALLOWED_TAGS.has(child.tagName)) {
        child.replaceWith(...Array.from(child.childNodes));
        return;
      }
      Array.from(child.attributes).forEach((attr) => {
        const keep = child.tagName === 'SPAN' && (attr.name === 'data-variable' || attr.name === 'style');
        if (!keep) child.removeAttribute(attr.name);
      });
    });
  };
  walk(root);
  // Chrome appends bogus <br>s when an editable cell is blurred — a trailing
  // run of <br>s (optionally inside empty trailing blocks) is an editing
  // artifact that inflates the row, so it is dropped from the stored markup.
  const stripTrailingBreaks = (element: Element) => {
    for (;;) {
      while (element.lastElementChild?.tagName === 'BR') element.lastElementChild.remove();
      const last = element.lastElementChild;
      if (!last || (last.tagName !== 'DIV' && last.tagName !== 'P')) return;
      stripTrailingBreaks(last);
      if (last.textContent?.trim() || last.children.length > 0) return;
      last.remove();
    }
  };
  stripTrailingBreaks(root);
  const clean = root.innerHTML;
  // A lone <br> is what browsers leave behind in an emptied cell.
  return clean === '<br>' ? '' : clean;
}

// Builds the <table> used both for the stored HTML (preview/PDF) and the editor canvas.
function buildTable(a: TableAttrs, onCell?: (td: HTMLTableCellElement, row: number, col: number) => void) {
  const table = document.createElement('table');
  table.setAttribute('style', tableStyle(a));
  const colgroup = document.createElement('colgroup');
  const cols = resolveColWidths(a).map((width) => {
    const col = document.createElement('col');
    col.style.width = `${width}%`;
    colgroup.appendChild(col);
    return col;
  });
  table.appendChild(colgroup);
  const tbody = document.createElement('tbody');
  const colTotal = columnCount(a);
  const cellEls = a.cells.map((row, r) => {
    const tr = document.createElement('tr');
    const rowHeight = a.rowHeights?.[r];
    if (rowHeight) tr.style.height = `${rowHeight}px`;
    tbody.appendChild(tr);
    return Array.from({ length: colTotal }, (_, c) => {
      const cell = row[c] ?? { html: '', align: 'left' as CellAlign };
      const td = document.createElement('td');
      td.dataset.align = cell.align;
      td.setAttribute('style', cellStyle(a, cell));
      // Sanitize here too: legacy templates may carry bogus <br>s saved by an
      // editable cell, and this function also builds the preview/print markup.
      td.innerHTML = sanitizeCellHtml(cell.html);
      onCell?.(td, r, c);
      tr.appendChild(td);
      return td;
    });
  });
  table.appendChild(tbody);
  return { table, cols, cellEls };
}

// ── Row / column operations used by the editor toolbar ──

export function addTableRow(attrs: Record<string, unknown>, afterRow?: number): Partial<TableAttrs> {
  const a = normalize(attrs);
  const index = afterRow === undefined ? a.cells.length : afterRow + 1;
  const cells = a.cells.slice();
  cells.splice(index, 0, createCells(1, columnCount(a))[0]);
  // The new row gets an auto height; explicit heights of the others are kept.
  const rowHeights = a.rowHeights
    ? [...a.rowHeights.slice(0, index), null, ...a.rowHeights.slice(index)]
    : null;
  return { cells, rowHeights, height: a.height ? a.height + Math.round(a.height / a.cells.length) : null };
}

export function removeTableRow(attrs: Record<string, unknown>, row?: number): Partial<TableAttrs> | null {
  const a = normalize(attrs);
  if (a.cells.length <= 1) return null;
  const index = row ?? a.cells.length - 1;
  const cells = a.cells.filter((_, r) => r !== index);
  const rowHeights = a.rowHeights ? a.rowHeights.filter((_, r) => r !== index) : null;
  return { cells, rowHeights, height: a.height ? Math.max(MIN_ROW_HEIGHT * cells.length, a.height - Math.round(a.height / a.cells.length)) : null };
}

export function addTableColumn(attrs: Record<string, unknown>, afterCol?: number): Partial<TableAttrs> {
  const a = normalize(attrs);
  const cols = columnCount(a);
  const index = afterCol === undefined ? cols : afterCol + 1;
  const cells = a.cells.map((row) => {
    const next = row.slice();
    next.splice(index, 0, { html: '', align: 'left' });
    return next;
  });
  // The new column takes an equal share; existing columns shrink proportionally.
  const share = 100 / (cols + 1);
  const colWidths = resolveColWidths(a).map((w) => w * (1 - share / 100));
  colWidths.splice(index, 0, share);
  return { cells, colWidths };
}

export function removeTableColumn(attrs: Record<string, unknown>, col?: number): Partial<TableAttrs> | null {
  const a = normalize(attrs);
  const cols = columnCount(a);
  if (cols <= 1) return null;
  const index = col ?? cols - 1;
  const cells = a.cells.map((row) => row.filter((_, c) => c !== index));
  const remaining = resolveColWidths(a).filter((_, c) => c !== index);
  const total = remaining.reduce((sum, w) => sum + w, 0) || 1;
  return { cells, colWidths: remaining.map((w) => (w / total) * 100) };
}

// ── Active cell: lets the editor toolbar format text inside a table cell ──

interface ActiveCell {
  owner: HTMLElement;
  td: HTMLTableCellElement;
  row: number;
  col: number;
  range: Range | null;
  setAlign: (align: CellAlign) => void;
}

let activeCell: ActiveCell | null = null;

if (typeof document !== 'undefined') {
  document.addEventListener('selectionchange', () => {
    if (!activeCell) return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (activeCell.td.contains(range.commonAncestorContainer)) activeCell.range = range.cloneRange();
  });
}

export function clearActiveCell(): void {
  activeCell = null;
}

export function getActiveCellPosition(): { row: number; col: number } | null {
  return activeCell && activeCell.td.isConnected ? { row: activeCell.row, col: activeCell.col } : null;
}

function restoreCellSelection(): boolean {
  if (!activeCell || !activeCell.td.isConnected) {
    activeCell = null;
    return false;
  }
  activeCell.td.focus();
  const selection = window.getSelection();
  if (activeCell.range && selection) {
    selection.removeAllRanges();
    selection.addRange(activeCell.range);
  }
  return true;
}

export function formatActiveCell(command: 'bold' | 'italic' | 'underline'): boolean {
  if (!restoreCellSelection()) return false;
  document.execCommand('styleWithCSS', false, 'false');
  document.execCommand(command);
  return true;
}

export function alignActiveCell(align: CellAlign): boolean {
  if (!activeCell || !activeCell.td.isConnected) return false;
  activeCell.setAlign(align);
  return true;
}

export function insertIntoActiveCell(html: string): boolean {
  if (!restoreCellSelection()) return false;
  document.execCommand('insertHTML', false, html);
  return true;
}

// Applies an inline style to the cell selection (or the whole cell when the
// caret is collapsed) by wrapping it in a <span> — the only tag whose style
// survives sanitizeCellHtml. Covers what execCommand can't: font family/size,
// color and text-transform.
export function styleActiveCell(style: Record<string, string>): boolean {
  if (!restoreCellSelection()) return false;
  const td = activeCell!.td;
  const selection = window.getSelection();
  const range = selection && selection.rangeCount > 0 && td.contains(selection.getRangeAt(0).commonAncestorContainer)
    ? selection.getRangeAt(0)
    : null;
  const span = document.createElement('span');
  Object.entries(style).forEach(([prop, value]) => span.style.setProperty(prop, value));
  if (!range || range.collapsed) {
    while (td.firstChild) span.appendChild(td.firstChild);
    td.appendChild(span);
  } else {
    try {
      range.surroundContents(span);
    } catch {
      // The range partially selects elements — wrap its extracted contents.
      span.appendChild(range.extractContents());
      range.insertNode(span);
    }
  }
  // Commit through the same path as typing so the change is stored in the node.
  td.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
}

// ── Node ──

const dataAttr = (name: string, fallback: string | number | null) => ({
  default: fallback,
  parseHTML: (element: HTMLElement) => element.getAttribute(`data-${name}`) ?? fallback,
  renderHTML: () => ({}),
});

export const FloatingTable = Node.create({
  name: 'floatingTable',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      anchor: dataAttr('anchor', 'page'),
      left: dataAttr('left', DEFAULT_OFFSET),
      top: dataAttr('top', DEFAULT_OFFSET),
      width: dataAttr('width', 400),
      height: dataAttr('height', null),
      borderColor: dataAttr('border-color', '#000000'),
      borderWidth: dataAttr('border-width', 1),
      fontSize: dataAttr('font-size', null),
      layer: dataAttr('layer', 'front'),
      rowHeights: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const heights = Array.from(element.querySelectorAll('tr')).map((tr) => {
            const h = parseFloat(tr.style.height);
            return Number.isNaN(h) ? null : h;
          });
          return heights.some((h) => h !== null) ? heights : null;
        },
        renderHTML: () => ({}),
      },
      cells: {
        default: createCells(2, 2),
        parseHTML: (element: HTMLElement) => {
          const rows = Array.from(element.querySelectorAll('tr')).map((tr) =>
            Array.from(tr.querySelectorAll('td')).map((td) => ({
              html: td.innerHTML,
              align: (ALIGNS.includes(td.dataset.align as CellAlign) ? td.dataset.align : 'left') as CellAlign,
            })),
          );
          return rows.length > 0 ? rows : createCells(2, 2);
        },
        renderHTML: () => ({}),
      },
      colWidths: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const widths = Array.from(element.querySelectorAll('col')).map((col) => parseFloat(col.style.width));
          return widths.length > 0 && widths.every((w) => !Number.isNaN(w)) ? widths : null;
        },
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-float="table"]', priority: 60 }];
  },

  renderHTML({ node }) {
    const a = normalize(node.attrs);
    const wrapper = document.createElement('div');
    const data: Record<string, string | number | null> = {
      float: 'table',
      anchor: a.anchor,
      layer: a.layer,
      left: a.left,
      top: a.top,
      width: a.width,
      height: a.height,
      'border-color': a.borderColor,
      'border-width': a.borderWidth,
      'font-size': a.fontSize,
    };
    Object.entries(data).forEach(([key, value]) => {
      if (value !== null) wrapper.setAttribute(`data-${key}`, String(value));
    });
    if (a.anchor === 'text') {
      // The wrapper follows its paragraph; the inner box keeps the page-relative offset.
      wrapper.setAttribute('style', 'position: relative; height: 0; overflow: visible');
      const inner = document.createElement('div');
      inner.setAttribute('data-float-inner', '');
      inner.setAttribute('style', [
        'position: absolute',
        `left: calc(${a.left}px - ${CONTENT_INSET})`,
        `top: ${a.top}px`,
        `width: ${a.width}px`,
        // Negative so "behind" objects stay under the text inside the content flow.
        `z-index: ${a.layer === 'behind' ? -1 : layerZIndex(a.layer)}`,
        a.fontSize ? `font-size: ${a.fontSize}` : '',
      ].filter(Boolean).join('; '));
      inner.appendChild(buildTable(a).table);
      wrapper.appendChild(inner);
      return wrapper;
    }
    wrapper.setAttribute('style', [
      'position: absolute',
      `left: ${a.left}px`,
      `top: ${a.top}px`,
      `width: ${a.width}px`,
      `z-index: ${layerZIndex(a.layer)}`,
      a.fontSize ? `font-size: ${a.fontSize}` : '',
    ].filter(Boolean).join('; '));
    wrapper.appendChild(buildTable(a).table);
    return wrapper;
  },

  onFocus() {
    // Typing in the main text means no table cell is being edited anymore.
    clearActiveCell();
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      let current: ProseMirrorNode = node;
      let pendingFrame = 0;
      let structureKey = '';
      let tableEl: HTMLTableElement | null = null;
      let colEls: HTMLTableColElement[] = [];
      let cellEls: HTMLTableCellElement[][] = [];

      const anchor = createAnchor();
      const box = document.createElement('div');
      box.className = 'fobj-box ftable-box';

      const grip = document.createElement('div');
      grip.className = 'ftable-grip';
      grip.title = 'Arrastrar para mover la tabla';
      grip.textContent = '⠿';
      box.appendChild(grip);

      const host = document.createElement('div');
      host.className = 'ftable-host';
      box.appendChild(host);

      const resizers = document.createElement('div');
      resizers.className = 'ftable-col-resizers';
      box.appendChild(resizers);

      const rowResizers = document.createElement('div');
      rowResizers.className = 'ftable-row-resizers';
      box.appendChild(rowResizers);

      const attrs = () => normalize(current.attrs);
      const commit = (patch: Partial<TableAttrs> & { pageTop?: number }) =>
        commitPlacement(editor, getPos, current, patch);

      const updateCell = (row: number, col: number, patch: Partial<TableCell>) => {
        const a = attrs();
        commit({
          cells: a.cells.map((cells, r) => cells.map((cell, c) => (r === row && c === col ? { ...cell, ...patch } : cell))),
        });
      };

      const commitCellHtml = (row: number, col: number): string => {
        const td = cellEls[row]?.[col];
        if (!td) return '';
        const html = sanitizeCellHtml(td.innerHTML);
        if (attrs().cells[row]?.[col]?.html !== html) updateCell(row, col, { html });
        return html;
      };

      let cellMenu: HTMLElement | null = null;
      const closeCellMenu = () => {
        cellMenu?.remove();
        cellMenu = null;
      };

      const openCellMenu = (event: MouseEvent, row: number, col: number) => {
        event.preventDefault();
        event.stopPropagation();
        closeCellMenu();
        const a = attrs();
        const cols = columnCount(a);
        const entries: [string, (() => void) | null][] = [
          ['Insertar fila arriba', () => commit(addTableRow(current.attrs, row - 1))],
          ['Insertar fila abajo', () => commit(addTableRow(current.attrs, row))],
          ['Eliminar fila', a.cells.length > 1 ? () => commit(removeTableRow(current.attrs, row) ?? {}) : null],
          ['Insertar columna a la izquierda', () => commit(addTableColumn(current.attrs, col - 1))],
          ['Insertar columna a la derecha', () => commit(addTableColumn(current.attrs, col))],
          ['Eliminar columna', cols > 1 ? () => commit(removeTableColumn(current.attrs, col) ?? {}) : null],
        ];
        const menu = document.createElement('div');
        menu.className = 'ftable-menu';
        entries.forEach(([label, action]) => {
          const item = document.createElement('button');
          item.type = 'button';
          item.className = 'ftable-menu-item';
          item.textContent = label;
          item.disabled = !action;
          item.addEventListener('mousedown', (click) => {
            click.preventDefault();
            click.stopPropagation();
            action?.();
            closeCellMenu();
          });
          menu.appendChild(item);
        });
        menu.style.left = `${event.clientX}px`;
        menu.style.top = `${event.clientY}px`;
        document.body.appendChild(menu);
        cellMenu = menu;
        setTimeout(() => {
          document.addEventListener('mousedown', closeCellMenu, { once: true });
          document.addEventListener('scroll', closeCellMenu, { once: true, capture: true });
        });
      };

      const wireCell = (td: HTMLTableCellElement, row: number, col: number) => {
        // An empty editable cell forces a caret line (~1 line-height) that a
        // printed cell never has. Cells stay non-editable while empty and get
        // contentEditable on click — blur drops it again if nothing was typed,
        // so the editor shows the same collapsed rows the preview prints.
        td.contentEditable = td.innerHTML.trim() !== '' ? 'true' : 'false';
        // Chrome appends bogus <br>s on blur; the last input snapshot (or the
        // content at focus time if nothing was typed) is the truthful markup,
        // so it is what gets committed and painted back.
        let lastInputHtml: string | null = null;
        td.addEventListener('mousedown', (event) => {
          // Clicking a cell places the caret; it must not start a table drag.
          event.stopPropagation();
          // Set before the default action runs so the caret can land even in a
          // cell that was non-editable a moment ago.
          td.contentEditable = 'true';
        });
        td.addEventListener('contextmenu', (event) => openCellMenu(event, row, col));
        td.addEventListener('focus', () => {
          lastInputHtml = td.innerHTML;
          if (activeCell?.td !== td) {
            activeCell = { owner: box, td, row, col, range: null, setAlign: (align) => updateCell(row, col, { align }) };
          }
          selectNodeAt(editor, getPos, false);
        });
        td.addEventListener('input', () => { lastInputHtml = commitCellHtml(row, col); });
        td.addEventListener('blur', () => {
          if (lastInputHtml !== null) td.innerHTML = lastInputHtml;
          // Commit and paint back the sanitized markup so bogus <br>s Chrome
          // injected on blur never reach the DOM nor the stored template.
          const html = commitCellHtml(row, col);
          td.innerHTML = html;
          if (html === '') {
            td.innerHTML = '';
            td.contentEditable = 'false';
          }
        });
        td.addEventListener('paste', (event) => {
          event.preventDefault();
          document.execCommand('insertText', false, event.clipboardData?.getData('text/plain') ?? '');
        });
        td.addEventListener('keydown', (event) => {
          if (event.key !== 'Tab') return;
          event.preventDefault();
          const flat = cellEls.flat();
          const next = flat[flat.indexOf(td) + (event.shiftKey ? -1 : 1)];
          if (next) {
            // An empty cell is non-editable, so enable it before focusing.
            next.contentEditable = 'true';
            next.focus();
          }
        });
      };

      const paintColumns = (widths: number[]) => {
        colEls.forEach((col, i) => { col.style.width = `${widths[i]}%`; });
        resizers.innerHTML = '';
        let offset = 0;
        widths.slice(0, -1).forEach((width, i) => {
          offset += width;
          const bar = document.createElement('div');
          bar.className = 'ftable-col-resizer';
          bar.style.left = `${offset}%`;
          bar.addEventListener('mousedown', (event) => startColumnResize(event, i));
          resizers.appendChild(bar);
        });
        // Column drags reflow cell text, so row boundaries can move mid-drag.
        paintRows();
      };

      // Row-boundary handles are measured from the rendered rows so they track
      // text wrapping, not just the stored heights.
      const paintRows = () => {
        rowResizers.innerHTML = '';
        if (!tableEl || !box.isConnected) return;
        const boxRect = box.getBoundingClientRect();
        cellEls.slice(0, -1).forEach((row, i) => {
          const tr = row[0]?.parentElement;
          if (!tr) return;
          const bar = document.createElement('div');
          bar.className = 'ftable-row-resizer';
          bar.style.top = `${tr.getBoundingClientRect().bottom - boxRect.top}px`;
          bar.addEventListener('mousedown', (event) => startRowResize(event, i));
          rowResizers.appendChild(bar);
        });
      };

      const applyRowHeights = (heights: (number | null)[]) => {
        cellEls.forEach((row, r) => {
          const tr = row[0]?.parentElement;
          if (tr) tr.style.height = heights[r] ? `${heights[r]}px` : '';
        });
      };

      const startRowResize = (event: MouseEvent, index: number) => {
        event.preventDefault();
        event.stopPropagation();
        selectNodeAt(editor, getPos);
        const a = attrs();
        // The drag snapshots the rendered heights — whatever the user sees is
        // what becomes explicit (auto rows get their measured height).
        const startHeights = cellEls.map(
          (row) => row[0]?.parentElement?.getBoundingClientRect().height || MIN_ROW_HEIGHT,
        );
        const fixedTotal = a.height !== null;
        const pair = (startHeights[index] ?? 0) + (startHeights[index + 1] ?? 0);
        let heights = startHeights;
        trackPointer(event, (_dx, dy) => {
          heights = startHeights.slice();
          if (fixedTotal && index + 1 < heights.length) {
            // Fixed-height table: a taller row borrows space from the next one.
            const upper = Math.min(Math.max(startHeights[index] + dy, MIN_ROW_HEIGHT), pair - MIN_ROW_HEIGHT);
            heights[index] = upper;
            heights[index + 1] = pair - upper;
          } else {
            heights[index] = Math.max(MIN_ROW_HEIGHT, startHeights[index] + dy);
          }
          applyRowHeights(heights);
          paintRows();
        }, () => commit({ rowHeights: heights.map((h) => Math.round(h)) }));
      };

      const startColumnResize = (event: MouseEvent, index: number) => {
        event.preventDefault();
        event.stopPropagation();
        selectNodeAt(editor, getPos);
        const start = resolveColWidths(attrs());
        const boxWidth = box.getBoundingClientRect().width || 1;
        const pair = start[index] + start[index + 1];
        let widths = start;
        trackPointer(event, (dx) => {
          const left = Math.min(Math.max(start[index] + (dx / boxWidth) * 100, MIN_COL_PERCENT), pair - MIN_COL_PERCENT);
          widths = start.slice();
          widths[index] = left;
          widths[index + 1] = pair - left;
          paintColumns(widths);
        }, () => commit({ colWidths: widths.map((w) => Math.round(w * 100) / 100) }));
      };

      const paintBox = (a: TableAttrs, pageTop: number) => {
        box.style.left = `${a.left}px`;
        box.style.top = `${pageTop}px`;
        box.style.width = `${a.width}px`;
        box.style.fontSize = a.fontSize ?? '';
        if (tableEl) tableEl.style.height = a.height ? `${a.height}px` : '';
      };

      let dragging = false;
      const reposition = () => {
        if (!dragging) paintBox(attrs(), resolvePageTop(editor, anchor, current.attrs));
      };

      const render = (next: ProseMirrorNode) => {
        current = next;
        const a = attrs();
        if (!placeInLayer(editor, box, a.layer) && !pendingFrame) {
          pendingFrame = requestAnimationFrame(() => {
            pendingFrame = 0;
            render(current);
          });
        }

        const key = `${a.cells.length}x${columnCount(a)}`;
        if (key !== structureKey || !tableEl) {
          structureKey = key;
          if (activeCell?.owner === box) activeCell = null;
          const built = buildTable(a, wireCell);
          host.replaceChildren(built.table);
          tableEl = built.table;
          colEls = built.cols;
          cellEls = built.cellEls;
        } else {
          tableEl.setAttribute('style', tableStyle(a));
          cellEls.forEach((row, r) => {
            const tr = row[0]?.parentElement;
            if (tr) {
              const h = a.rowHeights?.[r];
              tr.style.height = h ? `${h}px` : '';
            }
            row.forEach((td, c) => {
              const cell = a.cells[r]?.[c] ?? { html: '', align: 'left' as CellAlign };
              td.dataset.align = cell.align;
              td.setAttribute('style', cellStyle(a, cell));
              // Never rewrite the cell being typed in, or the caret would jump.
              if (document.activeElement !== td) {
                const clean = sanitizeCellHtml(cell.html);
                if (td.innerHTML !== clean) td.innerHTML = clean;
                // Keep the editable state in sync (e.g. after "vaciar celda").
                td.contentEditable = cell.html !== '' ? 'true' : 'false';
              }
            });
          });
        }

        box.classList.toggle('ftable-ghost', isInvisibleBorder(a));
        paintColumns(resolveColWidths(a));
        reposition();
      };

      grip.addEventListener('mousedown', (event) => {
        event.preventDefault();
        event.stopPropagation();
        selectNodeAt(editor, getPos);
        const start = attrs();
        const startTop = resolvePageTop(editor, anchor, current.attrs);
        let left = start.left;
        let top = startTop;
        dragging = true;
        trackPointer(event, (dx, dy) => {
          left = Math.round(start.left + dx);
          top = Math.round(startTop + dy);
          box.style.left = `${left}px`;
          box.style.top = `${top}px`;
        }, () => {
          dragging = false;
          commit({ left, pageTop: top });
        });
      });

      RESIZE_DIRECTIONS.forEach((direction) => {
        const handle = document.createElement('span');
        handle.className = `fobj-handle fobj-handle-${direction}`;
        box.appendChild(handle);
        handle.addEventListener('mousedown', (event) => {
          event.preventDefault();
          event.stopPropagation();
          selectNodeAt(editor, getPos);
          const a = attrs();
          const minHeight = MIN_ROW_HEIGHT * a.cells.length;
          const start = {
            left: a.left,
            top: resolvePageTop(editor, anchor, current.attrs),
            width: a.width,
            height: a.height ?? Math.round(host.getBoundingClientRect().height),
          };
          const resizesHeight = direction.includes('n') || direction.includes('s');
          let next = { ...start };
          dragging = true;
          trackPointer(event, (dx, dy) => {
            next = { ...start };
            if (direction.includes('e')) next.width = Math.max(MIN_WIDTH, start.width + dx);
            if (direction.includes('w')) {
              next.width = Math.max(MIN_WIDTH, start.width - dx);
              next.left = start.left + (start.width - next.width);
            }
            if (direction.includes('s')) next.height = Math.max(minHeight, start.height + dy);
            if (direction.includes('n')) {
              next.height = Math.max(minHeight, start.height - dy);
              next.top = start.top + (start.height - next.height);
            }
            next = {
              left: Math.round(next.left),
              top: Math.round(next.top),
              width: Math.round(next.width),
              height: Math.round(next.height),
            };
            paintBox({ ...a, ...next, height: resizesHeight ? next.height : a.height }, next.top);
            // Explicit row heights scale with the table so the proportions hold.
            if (resizesHeight && a.rowHeights) {
              const factor = next.height / start.height;
              applyRowHeights(a.rowHeights.map((h) => (h === null ? null : h * factor)));
              paintRows();
            }
          }, () => {
            dragging = false;
            commit({
              left: next.left,
              pageTop: next.top,
              width: next.width,
              height: resizesHeight ? next.height : a.height,
              rowHeights: resizesHeight && a.rowHeights
                ? a.rowHeights.map((h) => (h === null ? null : Math.max(MIN_ROW_HEIGHT, Math.round((h * next.height) / start.height))))
                : a.rowHeights,
            });
          });
        });
      });

      const stopReflow = watchReflow(editor, reposition);
      render(node);

      return {
        dom: anchor,
        update: (updated) => {
          if (updated.type !== current.type) return false;
          render(updated);
          return true;
        },
        selectNode: () => box.classList.add('is-selected'),
        deselectNode: () => {
          box.classList.remove('is-selected');
          if (activeCell?.owner === box) activeCell = null;
        },
        ignoreMutation: () => true,
        destroy: () => {
          stopReflow();
          closeCellMenu();
          if (pendingFrame) cancelAnimationFrame(pendingFrame);
          if (activeCell?.owner === box) activeCell = null;
          box.remove();
        },
      };
    };
  },
});

export default FloatingTable;
