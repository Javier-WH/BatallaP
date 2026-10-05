import type { Editor } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { NodeSelection, type Selection } from '@tiptap/pm/state';

// Shared plumbing for page-anchored objects (lines, tables) in the constancia editor.
// Each object keeps a zero-height anchor in the document flow so ProseMirror can map it,
// while its visible box lives in one of the page layers, so moving it never reflows text.

export type FloatingLayer = 'front' | 'behind';

// 'text': the object follows the paragraph it is anchored to (top is an offset from
//         that paragraph), so it stays next to it when variables change the text length.
// 'page': the object is pinned to fixed page coordinates.
export type AnchorMode = 'text' | 'page';

export const DEFAULT_OFFSET = 96;

// Page padding: text-anchored objects sit inside the content box, so their stored
// page-relative "left" is shifted by this inset when rendered in the text flow.
export const CONTENT_INSET = 'var(--constancia-margin, 1in)';

const FLOATING_TYPES = new Set(['floatingLine', 'floatingTable']);

export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : parseFloat(String(value));
  return Number.isNaN(parsed) ? null : parsed;
}

export function layerZIndex(layer: FloatingLayer): number {
  return layer === 'behind' ? 0 : 30;
}

export function resolvePos(getPos: unknown): number | undefined {
  return typeof getPos === 'function' ? (getPos as () => number | undefined)() : undefined;
}

// The view is not mounted yet while node views are built for the initial content.
export function getPage(editor: Editor): HTMLElement | null {
  try {
    return editor.view.dom.closest('.constancia-page') as HTMLElement | null;
  } catch {
    return null;
  }
}

export function getLayer(editor: Editor, layer: FloatingLayer): HTMLElement | null {
  const page = getPage(editor);
  if (!page) return null;
  return page.querySelector<HTMLElement>(
    layer === 'behind' ? '.constancia-layer-behind' : '.constancia-layer-front',
  );
}

export function createAnchor(): HTMLElement {
  const anchor = document.createElement('div');
  anchor.className = 'fobj-anchor';
  anchor.contentEditable = 'false';
  return anchor;
}

// Writes attrs back to the node and keeps it selected so its handles stay visible.
export function commitNodeAttrs(
  editor: Editor,
  getPos: unknown,
  node: ProseMirrorNode,
  patch: Record<string, unknown>,
): void {
  const pos = resolvePos(getPos);
  if (pos === undefined) return;
  const changed = Object.entries(patch).some(
    ([key, value]) => JSON.stringify(node.attrs[key]) !== JSON.stringify(value),
  );
  if (!changed) return;
  editor
    .chain()
    .command(({ tr }) => {
      tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...patch });
      tr.setSelection(NodeSelection.create(tr.doc, pos));
      return true;
    })
    .run();
}

// focusEditor=false keeps the DOM focus where it is (e.g. inside a table cell).
export function selectNodeAt(editor: Editor, getPos: unknown, focusEditor = true): void {
  const pos = resolvePos(getPos);
  if (pos === undefined) return;
  const chain = editor.chain();
  if (focusEditor) chain.focus(undefined, { scrollIntoView: false });
  chain.setNodeSelection(pos).run();
}

// Reports pointer deltas relative to the mousedown position until the button is released.
export function trackPointer(
  start: MouseEvent,
  onMove: (dx: number, dy: number, event: MouseEvent) => void,
  onEnd: () => void,
): void {
  const move = (event: MouseEvent) => onMove(event.clientX - start.clientX, event.clientY - start.clientY, event);
  const up = () => {
    document.removeEventListener('mousemove', move);
    document.removeEventListener('mouseup', up);
    onEnd();
  };
  document.addEventListener('mousemove', move);
  document.addEventListener('mouseup', up);
}

// Moves the box into its layer; returns false while the layers are not mounted yet.
export function placeInLayer(editor: Editor, box: HTMLElement, layer: FloatingLayer): boolean {
  const target = getLayer(editor, layer);
  if (!target) return false;
  if (box.parentElement !== target) target.appendChild(box);
  return true;
}

// Vertical position of an element relative to the page box.
export function pageOffsetTop(editor: Editor, element: Element | null): number | null {
  const page = getPage(editor);
  if (!page || !element || !element.isConnected) return null;
  return element.getBoundingClientRect().top - page.getBoundingClientRect().top;
}

// Page-relative top of a node given its anchor element (the zero-height div in the text flow).
export function resolvePageTop(editor: Editor, anchor: Element, attrs: { top?: unknown; anchor?: unknown }): number {
  const top = toNumber(attrs.top) ?? DEFAULT_OFFSET;
  if (attrs.anchor !== 'text') return top;
  return (pageOffsetTop(editor, anchor) ?? 0) + top;
}

// The top-level text block the object should follow: the last one starting at or
// above pageTop (i.e. the paragraph the object overlaps), or the first block.
export function findAnchorBlock(editor: Editor, pageTop: number): { pos: number; top: number } | null {
  const blocks: { pos: number; top: number }[] = [];
  editor.state.doc.forEach((child, offset) => {
    if (FLOATING_TYPES.has(child.type.name)) return;
    // Floating images also sit on a zero-height anchor; only inline ones count as text.
    if (child.type.name === 'image' && (child.attrs.wrap === 'front' || child.attrs.wrap === 'behind')) return;
    const top = pageOffsetTop(editor, editor.view.nodeDOM(offset) as Element | null);
    if (top !== null) blocks.push({ pos: offset, top });
  });
  const above = blocks.filter((block) => block.top <= pageTop + 1);
  return above[above.length - 1] ?? blocks[0] ?? null;
}

// Commits a position/size change. For text-anchored objects, pageTop is converted into an
// offset from the object's anchor point:
//  - already text-anchored: the anchor the user chose is KEPT (even a plain click, which ends
//    like a zero-length drag, must not re-anchor it to whatever is under the object);
//  - switching from "fixed on page": the anchor moves right before the block under the object.
export function commitPlacement(
  editor: Editor,
  getPos: unknown,
  node: ProseMirrorNode,
  patch: Record<string, unknown> & { pageTop?: number },
): void {
  const { pageTop, ...rest } = patch;
  const anchorMode = (rest.anchor ?? node.attrs.anchor) as AnchorMode;
  if (pageTop === undefined) {
    commitNodeAttrs(editor, getPos, node, rest);
    return;
  }
  if (anchorMode !== 'text') {
    commitNodeAttrs(editor, getPos, node, { ...rest, top: Math.round(pageTop) });
    return;
  }

  const pos = resolvePos(getPos);
  if (pos === undefined) return;

  if (node.attrs.anchor === 'text') {
    const anchorTop = pageOffsetTop(editor, editor.view.nodeDOM(pos) as Element | null);
    if (anchorTop === null) return;
    commitNodeAttrs(editor, getPos, node, { ...rest, top: Math.round(pageTop - anchorTop) });
    return;
  }

  const target = findAnchorBlock(editor, pageTop);
  if (!target) return;

  const attrs = { ...node.attrs, ...rest, top: Math.round(pageTop - target.top) };
  placeBeforeBlock(editor, pos, node, attrs, target.pos);
}

// Moves a floating node so its anchor sits right before the block at `targetPos`.
function placeBeforeBlock(
  editor: Editor,
  pos: number,
  node: ProseMirrorNode,
  attrs: Record<string, unknown>,
  targetPos: number,
): void {
  const nodeEnd = pos + node.nodeSize;
  if (targetPos === nodeEnd) {
    commitNodeAttrs(editor, () => pos, node, attrs);
    return;
  }
  editor
    .chain()
    .command(({ tr }) => {
      tr.delete(pos, nodeEnd);
      const insertAt = tr.mapping.map(targetPos);
      tr.insert(insertAt, node.type.create(attrs));
      tr.setSelection(NodeSelection.create(tr.doc, insertAt));
      return true;
    })
    .run();
}

// ── Anchor targets: which text block an object follows ──────────────────────────────

const isFloatingBlock = (node: ProseMirrorNode) => FLOATING_TYPES.has(node.type.name);
const isFloatingImage = (node: ProseMirrorNode) =>
  node.type.name === 'image' && (node.attrs.wrap === 'front' || node.attrs.wrap === 'behind');

export interface AnchorBlock {
  /** Document offset of the block (what the anchor is inserted before). */
  pos: number;
  /** 1-based position among the text blocks, as shown to the user. */
  number: number;
  label: string;
  textblock: boolean;
}

/** Every block a floating object could be anchored to (floating objects themselves excluded). */
export function listAnchorBlocks(doc: ProseMirrorNode): AnchorBlock[] {
  const blocks: AnchorBlock[] = [];
  doc.forEach((child, offset) => {
    if (isFloatingBlock(child)) return;
    const text = child.textContent.replace(/\s+/g, ' ').trim();
    const excerpt = text.length > 40 ? `${text.slice(0, 40)}…` : text;
    const kind = child.isTextblock ? ''
      : child.type.name === 'bulletList' ? 'Lista · '
        : child.type.name === 'orderedList' ? 'Lista numerada · '
          : 'Bloque · ';
    blocks.push({ pos: offset, number: blocks.length + 1, label: `${kind}${excerpt || '(vacío)'}`, textblock: child.isTextblock });
  });
  return blocks;
}

/** The block a line/table at `pos` is anchored to: the next text block after it (else the last before). */
export function floatingAnchorBlockPos(doc: ProseMirrorNode, pos: number): number | null {
  const found = { before: null as number | null, after: null as number | null };
  let seen = false;
  doc.forEach((child, offset) => {
    if (offset === pos) { seen = true; return; }
    if (isFloatingBlock(child)) return;
    if (!seen) found.before = offset;
    else if (found.after === null) found.after = offset;
  });
  return found.after ?? found.before;
}

/** Blocks to highlight: the selected object's anchor, plus all of them when `showAll`. */
export function anchorTargets(
  doc: ProseMirrorNode,
  selection: Selection,
  showAll: boolean,
): { pos: number; selected: boolean }[] {
  const targets = new Map<number, boolean>();
  const mark = (pos: number | null, selected: boolean) => {
    if (pos === null) return;
    targets.set(pos, (targets.get(pos) ?? false) || selected);
  };

  if (selection instanceof NodeSelection) {
    const node = selection.node;
    if (isFloatingBlock(node) && node.attrs.anchor === 'text') {
      mark(floatingAnchorBlockPos(doc, selection.from), true);
    } else if (isFloatingImage(node) && node.attrs.anchor === 'text' && selection.$from.depth >= 1) {
      mark(selection.$from.before(1), true);
    }
  }

  if (showAll) {
    doc.forEach((child, offset) => {
      if (isFloatingBlock(child)) {
        if (child.attrs.anchor === 'text') mark(floatingAnchorBlockPos(doc, offset), false);
      } else if (child.isTextblock) {
        let hasAnchoredImage = false;
        child.forEach((inline) => {
          if (isFloatingImage(inline) && inline.attrs.anchor === 'text') hasAnchoredImage = true;
        });
        if (hasAnchoredImage) mark(offset, false);
      }
    });
  }

  return [...targets].map(([pos, selected]) => ({ pos, selected }));
}

/**
 * Re-anchors a line/table to another block without moving it on the page: its offset is
 * recomputed relative to the new block.
 */
export function reanchorFloating(editor: Editor, pos: number, node: ProseMirrorNode, targetPos: number): void {
  const anchorDom = editor.view.nodeDOM(pos) as Element | null;
  const blockTop = pageOffsetTop(editor, editor.view.nodeDOM(targetPos) as Element | null);
  if (!anchorDom || blockTop === null) return;
  const pageTop = resolvePageTop(editor, anchorDom, node.attrs);
  placeBeforeBlock(editor, pos, node, { ...node.attrs, anchor: 'text', top: Math.round(pageTop - blockTop) }, targetPos);
}

// Switches the selected floating object between "follows the text" and "fixed on page"
// without moving it visually.
export function setAnchorMode(editor: Editor, mode: AnchorMode): void {
  const { selection } = editor.state;
  if (!(selection instanceof NodeSelection) || !FLOATING_TYPES.has(selection.node.type.name)) return;
  const node = selection.node;
  const current: AnchorMode = node.attrs.anchor === 'text' ? 'text' : 'page';
  if (current === mode) return;
  const anchor = editor.view.nodeDOM(selection.from) as Element | null;
  const pageTop = anchor ? resolvePageTop(editor, anchor, node.attrs) : toNumber(node.attrs.top) ?? DEFAULT_OFFSET;
  commitPlacement(editor, () => selection.from, node, { anchor: mode, pageTop });
}

// Inserts a floating node anchored to the paragraph under the cursor (never splitting
// it) and places it just below the cursor line.
export function insertFloatingNode(editor: Editor, type: string, attrs: Record<string, unknown>): void {
  const { state } = editor;
  const { $from, from } = state.selection;
  const pos = $from.depth > 0 ? $from.before(1) : from;

  let top = 24;
  const page = getPage(editor);
  if (page) {
    try {
      const rect = page.getBoundingClientRect();
      // Caret height at the block start equals the block's top edge.
      const blockTop = editor.view.coordsAtPos(pos).top - rect.top;
      const coords = editor.view.coordsAtPos(from);
      top = Math.round(coords.bottom - rect.top - blockTop + 8);
    } catch {
      top = 24;
    }
  }

  editor
    .chain()
    .focus(undefined, { scrollIntoView: false })
    .insertContentAt(pos, { type, attrs: { anchor: 'text', top, ...attrs } })
    .setNodeSelection(pos)
    .run();
}

// Keeps a node view's box aligned with its anchor while the text above it reflows.
export function watchReflow(editor: Editor, onReflow: () => void): () => void {
  let frame = 0;
  let observeFrame = 0;
  let observer: ResizeObserver | null = null;
  const schedule = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      onReflow();
    });
  };
  // The view may not be mounted yet (editor.view throws until then); retry per frame.
  const observe = () => {
    observeFrame = 0;
    try {
      const dom = editor.view.dom;
      observer = new ResizeObserver(schedule);
      observer.observe(dom);
    } catch {
      observeFrame = requestAnimationFrame(observe);
    }
  };
  editor.on('transaction', schedule);
  observe();
  schedule();
  return () => {
    if (frame) cancelAnimationFrame(frame);
    if (observeFrame) cancelAnimationFrame(observeFrame);
    editor.off('transaction', schedule);
    observer?.disconnect();
  };
}
