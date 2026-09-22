import { mergeAttributes } from '@tiptap/core';
import type { Editor } from '@tiptap/core';
import type { DOMOutputSpec, Node as PMNode } from '@tiptap/pm/model';
import { NodeSelection } from '@tiptap/pm/state';
import type { ViewMutationRecord } from '@tiptap/pm/view';
import { HorizontalRule } from '@tiptap/extension-horizontal-rule';
import {
  Table,
  TableRow,
  TableHeader,
  TableCell,
  createColGroup,
  updateColumns,
} from '@tiptap/extension-table';

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : parseFloat(String(value));
  return Number.isNaN(parsed) ? null : parsed;
}

// ── Floating blocks ──
// Lines and tables can leave the text flow (`float` attr). While floating, the
// node view renders the element absolutely positioned inside the page content
// box. Coordinates are relative to `.constancia-content` in the editor, which
// matches `.constancia-preview` in preview/print output.

const FLOAT_DEFAULTS = { top: 96, left: 96 };

const floatAttributes = {
  float: {
    default: false,
    parseHTML: (element: HTMLElement) =>
      element.getAttribute('data-float') === '1' || element.style.position === 'absolute',
    renderHTML: (attributes: Record<string, unknown>) =>
      attributes.float ? { 'data-float': '1' } : {},
  },
  floatTop: {
    default: null as number | null,
    parseHTML: (element: HTMLElement) =>
      element.getAttribute('data-float')
        ? toNumber(element.getAttribute('data-float-top')) ?? toNumber(element.style.top)
        : null,
    renderHTML: (attributes: Record<string, unknown>) =>
      attributes.float && attributes.floatTop != null
        ? { 'data-float-top': attributes.floatTop }
        : {},
  },
  floatLeft: {
    default: null as number | null,
    parseHTML: (element: HTMLElement) =>
      element.getAttribute('data-float')
        ? toNumber(element.getAttribute('data-float-left')) ?? toNumber(element.style.left)
        : null,
    renderHTML: (attributes: Record<string, unknown>) =>
      attributes.float && attributes.floatLeft != null
        ? { 'data-float-left': attributes.floatLeft }
        : {},
  },
  floatWidth: {
    default: null as number | null,
    parseHTML: (element: HTMLElement) =>
      element.getAttribute('data-float')
        ? toNumber(element.getAttribute('data-float-width')) ?? toNumber(element.style.width)
        : null,
    renderHTML: (attributes: Record<string, unknown>) =>
      attributes.float && attributes.floatWidth != null
        ? { 'data-float-width': attributes.floatWidth }
        : {},
  },
};

// Inline style emitted into stored HTML so floating blocks stay positioned in
// the preview, print output and any re-parse of the document.
function buildFloatStyle(attrs: Record<string, unknown>): string {
  if (!attrs.float) return '';
  const parts = [
    'position: absolute',
    'z-index: 20',
    `top: ${toNumber(attrs.floatTop) ?? FLOAT_DEFAULTS.top}px`,
    `left: ${toNumber(attrs.floatLeft) ?? FLOAT_DEFAULTS.left}px`,
  ];
  const width = toNumber(attrs.floatWidth);
  if (width) parts.push(`width: ${width}px`);
  return parts.join('; ');
}

interface FloatInner {
  inner: HTMLElement;
  contentDOM?: HTMLElement;
  sync?: (node: PMNode) => void;
}

// Shared node-view shell for floating blocks: keeps a zero-height anchor in the
// document flow while the box (rendered inside it) is absolutely positioned.
// Editable content (tables) drags via the grip bar; atom blocks (lines) drag
// from anywhere on the box.
function createFloatingBlockView(
  node: PMNode,
  editor: Editor,
  getPos: () => number | undefined,
  createInner: () => FloatInner,
  options: { dragAnywhere?: boolean; boxClass?: string } = {},
) {
  let currentNode = node;
  let interacting = false;

  const anchor = document.createElement('div');
  anchor.className = 'fblk-anchor';
  const box = document.createElement('div');
  box.className = `fblk-box${options.boxClass ? ` ${options.boxClass}` : ''}`;
  anchor.appendChild(box);

  const { inner, contentDOM, sync } = createInner();
  box.appendChild(inner);

  const grip = document.createElement('div');
  grip.className = 'fblk-grip';
  box.appendChild(grip);

  const handles = (['e', 'se'] as const).map((direction) => {
    const handle = document.createElement('span');
    handle.className = `fblk-handle fblk-handle-${direction}`;
    box.appendChild(handle);
    return handle;
  });

  const getSpace = (): HTMLElement | null => {
    try {
      return editor.view.dom.closest('.constancia-content') as HTMLElement | null;
    } catch {
      return null;
    }
  };

  const commit = (attrs: Record<string, unknown>) => {
    const pos = typeof getPos === 'function' ? getPos() : undefined;
    if (pos === undefined) return;
    editor
      .chain()
      .command(({ tr }) => {
        tr.setNodeMarkup(pos, undefined, { ...currentNode.attrs, ...attrs });
        // setNodeMarkup drops the node selection; restore it so handles stay visible.
        tr.setSelection(NodeSelection.create(tr.doc, pos));
        return true;
      })
      .run();
  };

  const render = (next: PMNode) => {
    currentNode = next;
    sync?.(next);
    const floating = !!next.attrs.float;
    anchor.classList.toggle('fblk-anchor-floating', floating);
    box.classList.toggle('fblk-floating', floating);
    if (floating) {
      box.style.top = `${toNumber(next.attrs.floatTop) ?? FLOAT_DEFAULTS.top}px`;
      box.style.left = `${toNumber(next.attrs.floatLeft) ?? FLOAT_DEFAULTS.left}px`;
      const width = toNumber(next.attrs.floatWidth);
      box.style.width = width ? `${width}px` : '';
    } else {
      box.style.top = '';
      box.style.left = '';
      box.style.width = '';
    }
  };

  const selectSelf = () => {
    const pos = typeof getPos === 'function' ? getPos() : undefined;
    if (pos === undefined) return;
    editor.chain().setNodeSelection(pos).run();
  };

  const startDrag = (event: MouseEvent) => {
    if (!currentNode.attrs.float) return;
    const space = getSpace();
    if (!space) return;
    interacting = true;

    const spaceRect = space.getBoundingClientRect();
    const boxRect = box.getBoundingClientRect();
    const grabX = event.clientX - boxRect.left;
    const grabY = event.clientY - boxRect.top;

    const onMove = (moveEvent: MouseEvent) => {
      box.style.left = `${moveEvent.clientX - spaceRect.left - grabX}px`;
      box.style.top = `${moveEvent.clientY - spaceRect.top - grabY}px`;
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      interacting = false;
      commit({
        floatLeft: Math.round(parseFloat(box.style.left)),
        floatTop: Math.round(parseFloat(box.style.top)),
      });
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  grip.addEventListener('mousedown', (event) => {
    event.preventDefault();
    event.stopPropagation();
    selectSelf();
    startDrag(event);
  });

  if (options.dragAnywhere) {
    box.addEventListener('mousedown', (event) => {
      const target = event.target as HTMLElement;
      if (target === grip || handles.includes(target)) return;
      event.preventDefault();
      selectSelf();
      startDrag(event);
    });
  }

  handles.forEach((handle) => {
    handle.addEventListener('mousedown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      selectSelf();
      if (!currentNode.attrs.float) return;
      interacting = true;

      const startX = event.clientX;
      const startWidth = box.getBoundingClientRect().width;

      const onMove = (moveEvent: MouseEvent) => {
        const width = Math.max(48, Math.round(startWidth + (moveEvent.clientX - startX)));
        box.style.width = `${width}px`;
      };

      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        interacting = false;
        commit({ floatWidth: Math.round(parseFloat(box.style.width)) });
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  });

  render(node);

  return {
    dom: anchor,
    contentDOM,
    update: (updatedNode: PMNode) => {
      if (updatedNode.type !== currentNode.type) return false;
      render(updatedNode);
      return true;
    },
    selectNode: () => box.classList.add('is-selected'),
    deselectNode: () => box.classList.remove('is-selected'),
    stopEvent: (event: Event) => {
      if (interacting) return true;
      const target = event.target as HTMLElement | null;
      if (target && (target === grip || handles.includes(target))) return true;
      // Atom blocks swallow their own mouse events so the click selects the node.
      if (!contentDOM && target && box.contains(target)) {
        return event.type === 'mousedown' || event.type === 'mouseup' || event.type === 'click';
      }
      return false;
    },
    ignoreMutation: (mutation: ViewMutationRecord) =>
      !contentDOM ||
      !(contentDOM === (mutation.target as HTMLElement) || contentDOM.contains(mutation.target as HTMLElement)),
    destroy: () => {
      box.remove();
    },
  };
}

// ── Line (horizontal rule) ──
// Configurable thickness (pt), color and style, plus floating positioning.
// Attributes render as inline styles so they survive HTML storage, the
// preview/print stylesheet, and are readable by the DOCX exporter.
export const RuledLine = HorizontalRule.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      ...floatAttributes,
      thickness: {
        default: 1,
        parseHTML: (element: HTMLElement) => {
          const fromStyle = parseFloat(element.style.borderTopWidth || '');
          if (Number.isFinite(fromStyle) && fromStyle > 0) return fromStyle;
          const fromAttr = parseFloat(element.getAttribute('data-thickness') || '');
          return Number.isFinite(fromAttr) && fromAttr > 0 ? fromAttr : 1;
        },
        renderHTML: (attributes: Record<string, unknown>) => ({
          'data-thickness': String(attributes.thickness),
          style: `border-top-width: ${attributes.thickness}pt`,
        }),
      },
      lineColor: {
        default: '#000000',
        parseHTML: (element: HTMLElement) => element.style.borderTopColor || '#000000',
        renderHTML: (attributes: Record<string, unknown>) => ({
          style: `border-top-color: ${attributes.lineColor}`,
        }),
      },
      lineStyle: {
        default: 'solid',
        parseHTML: (element: HTMLElement) => element.style.borderTopStyle || 'solid',
        renderHTML: (attributes: Record<string, unknown>) => ({
          style: `border-top-style: ${attributes.lineStyle}`,
        }),
      },
    };
  },

  renderHTML({ node, HTMLAttributes }) {
    const floatStyle = buildFloatStyle(node.attrs);
    return [
      'hr',
      mergeAttributes(
        this.options.HTMLAttributes,
        HTMLAttributes,
        floatStyle ? { style: floatStyle } : {},
      ),
    ];
  },

  addNodeView() {
    return ({ node, editor, getPos }) =>
      createFloatingBlockView(
        node,
        editor,
        getPos,
        () => {
          const hr = document.createElement('hr');
          return {
            inner: hr,
            sync: (next) => {
              hr.style.borderTopWidth = `${toNumber(next.attrs.thickness) ?? 1}pt`;
              hr.style.borderTopStyle = String(next.attrs.lineStyle || 'solid');
              hr.style.borderTopColor = String(next.attrs.lineColor || '#000000');
              hr.style.width = '100%';
              hr.style.margin = '0';
            },
          };
        },
        { dragAnywhere: true, boxClass: 'fblk-box-line' },
      );
  },
});

// ── Tables ──
// Shared border-width attribute for table cells/header cells (points).
const cellBorderAttributes = {
  borderWidth: {
    default: null as number | null,
    parseHTML: (element: HTMLElement) => {
      const width = parseFloat(element.style.borderWidth || element.style.borderTopWidth || '');
      return Number.isFinite(width) && width > 0 ? width : null;
    },
    renderHTML: (attributes: Record<string, unknown>) =>
      attributes.borderWidth ? { style: `border-width: ${attributes.borderWidth}pt` } : {},
  },
};

export const ConstanciaTableHeader = TableHeader.extend({
  addAttributes() {
    return { ...this.parent?.(), ...cellBorderAttributes };
  },
});

export const ConstanciaTableCell = TableCell.extend({
  addAttributes() {
    return { ...this.parent?.(), ...cellBorderAttributes };
  },
});

// Table with floating support. The custom node view replicates TableView's
// structure (colgroup + tbody contentDOM) so column resizing keeps working —
// extension node views take precedence over the columnResizing plugin's View.
export const ConstanciaTable = Table.extend({
  addAttributes() {
    return { ...this.parent?.(), ...floatAttributes };
  },

  renderHTML({ node, HTMLAttributes }) {
    const { colgroup, tableWidth, tableMinWidth } = createColGroup(
      node,
      this.options.cellMinWidth,
    );
    const { style: userStyles, ...rest } = HTMLAttributes as Record<string, unknown> & {
      style?: string;
    };
    const floatStyle = buildFloatStyle(node.attrs);
    let style: string;
    if (floatStyle) {
      style = userStyles ? `${floatStyle}; ${userStyles}` : floatStyle;
    } else {
      style =
        userStyles || (tableWidth ? `width: ${tableWidth}` : `min-width: ${tableMinWidth}`);
    }
    return [
      'table',
      mergeAttributes(this.options.HTMLAttributes, rest, style ? { style } : {}),
      ...(colgroup ? [colgroup] : []),
      ['tbody', 0],
    ] as DOMOutputSpec;
  },

  addNodeView() {
    const cellMinWidth = this.options.cellMinWidth;
    return ({ node, editor, getPos }) =>
      createFloatingBlockView(
        node,
        editor,
        getPos,
        () => {
          const table = document.createElement('table');
          const colgroup = document.createElement('colgroup');
          const tbody = document.createElement('tbody');
          table.appendChild(colgroup);
          table.appendChild(tbody);
          return {
            inner: table,
            contentDOM: tbody,
            sync: (next) => updateColumns(next, colgroup, table, cellMinWidth),
          };
        },
        { boxClass: 'fblk-box-table' },
      );
  },
});

// Table extensions shared by the editor and the DOCX export parser so both
// resolve the exact same schema.
export const constanciaTableExtensions = [
  ConstanciaTable.configure({ resizable: true }),
  TableRow,
  ConstanciaTableHeader,
  ConstanciaTableCell,
];
