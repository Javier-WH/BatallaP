import { Node } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import {
  CONTENT_INSET, DEFAULT_OFFSET, type AnchorMode, type FloatingLayer,
  commitPlacement, createAnchor, layerZIndex, placeInLayer,
  resolvePageTop, selectNodeAt, toNumber, trackPointer, watchReflow,
} from './floatingObject';

export type LineOrientation = 'horizontal' | 'vertical';
export type LineStyle = 'solid' | 'dashed' | 'dotted';

export interface LineAttrs {
  orientation: LineOrientation;
  anchor: AnchorMode;
  left: number;
  top: number;
  length: number;
  thickness: number;
  color: string;
  lineStyle: LineStyle;
  layer: FloatingLayer;
}

// Transparent grab margin around the stroke so thin lines are easy to pick up.
const HIT = 6;
const MIN_LENGTH = 16;

function normalize(attrs: Record<string, unknown>): LineAttrs {
  return {
    orientation: attrs.orientation === 'vertical' ? 'vertical' : 'horizontal',
    anchor: attrs.anchor === 'text' ? 'text' : 'page',
    left: toNumber(attrs.left) ?? DEFAULT_OFFSET,
    top: toNumber(attrs.top) ?? DEFAULT_OFFSET,
    length: Math.max(MIN_LENGTH, toNumber(attrs.length) ?? 200),
    thickness: Math.max(1, toNumber(attrs.thickness) ?? 1),
    color: (attrs.color as string) || '#000000',
    lineStyle: (['solid', 'dashed', 'dotted'].includes(attrs.lineStyle as string) ? attrs.lineStyle : 'solid') as LineStyle,
    layer: attrs.layer === 'behind' ? 'behind' : 'front',
  };
}

// Stroke geometry shared by the stored HTML (preview/PDF) and the editor node view.
function strokeStyle(a: LineAttrs): string {
  const horizontal = a.orientation === 'horizontal';
  return [
    'box-sizing: content-box',
    `width: ${horizontal ? a.length : 0}px`,
    `height: ${horizontal ? 0 : a.length}px`,
    `${horizontal ? 'border-top' : 'border-left'}: ${a.thickness}px ${a.lineStyle} ${a.color}`,
    'margin: 0',
    'padding: 0',
  ].join('; ');
}

const dataAttr = (name: string, fallback: string | number | null) => ({
  default: fallback,
  parseHTML: (element: HTMLElement) => element.getAttribute(`data-${name}`) ?? fallback,
  renderHTML: () => ({}),
});

export const FloatingLine = Node.create({
  name: 'floatingLine',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      orientation: dataAttr('orientation', 'horizontal'),
      anchor: dataAttr('anchor', 'page'),
      left: dataAttr('left', DEFAULT_OFFSET),
      top: dataAttr('top', DEFAULT_OFFSET),
      length: dataAttr('length', 200),
      thickness: dataAttr('thickness', 1),
      color: dataAttr('color', '#000000'),
      lineStyle: dataAttr('line-style', 'solid'),
      layer: dataAttr('layer', 'front'),
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-float="line"]', priority: 60 }];
  },

  renderHTML({ node }) {
    const a = normalize(node.attrs);
    const data = {
      'data-float': 'line',
      'data-anchor': a.anchor,
      'data-orientation': a.orientation,
      'data-left': a.left,
      'data-top': a.top,
      'data-length': a.length,
      'data-thickness': a.thickness,
      'data-color': a.color,
      'data-line-style': a.lineStyle,
      'data-layer': a.layer,
    };
    // Text-anchored objects live in the text flow: a zero-height wrapper whose
    // position follows the paragraph, plus an absolutely placed inner stroke.
    if (a.anchor === 'text') {
      return ['div', { ...data, style: 'position: relative; height: 0; overflow: visible' },
        ['div', {
          'data-float-inner': '',
          // Behind-text needs a negative z-index here: the inner box lives inside the
          // content stacking context, so 0 would still paint above the text.
          style: `position: absolute; left: calc(${a.left}px - ${CONTENT_INSET}); top: ${a.top}px; z-index: ${a.layer === 'behind' ? -1 : layerZIndex(a.layer)}; ${strokeStyle(a)}`,
        }],
      ];
    }
    return ['div', {
      ...data,
      style: `position: absolute; left: ${a.left}px; top: ${a.top}px; z-index: ${layerZIndex(a.layer)}; ${strokeStyle(a)}`,
    }];
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      let current: ProseMirrorNode = node;
      let pendingFrame = 0;

      const anchor = createAnchor();
      const box = document.createElement('div');
      box.className = 'fobj-box fline-box';
      const stroke = document.createElement('div');
      stroke.className = 'fline';
      box.appendChild(stroke);

      const makeHandle = (end: 'start' | 'end') => {
        const handle = document.createElement('span');
        handle.className = 'fobj-handle';
        handle.dataset.end = end;
        box.appendChild(handle);
        return handle;
      };
      const startHandle = makeHandle('start');
      const endHandle = makeHandle('end');

      const paint = (a: LineAttrs, pageTop: number) => {
        const horizontal = a.orientation === 'horizontal';
        const along = a.length;
        const across = a.thickness;
        box.dataset.orientation = a.orientation;
        box.style.left = `${a.left - HIT}px`;
        box.style.top = `${pageTop - HIT}px`;
        box.style.width = `${(horizontal ? along : across) + HIT * 2}px`;
        box.style.height = `${(horizontal ? across : along) + HIT * 2}px`;
        stroke.setAttribute('style', `position: absolute; left: ${HIT}px; top: ${HIT}px; ${strokeStyle(a)}`);

        const center = `calc(50% - 5px)`;
        const cursor = horizontal ? 'ew-resize' : 'ns-resize';
        [startHandle, endHandle].forEach((handle) => { handle.style.cursor = cursor; });
        if (horizontal) {
          Object.assign(startHandle.style, { left: `${HIT - 5}px`, top: center });
          Object.assign(endHandle.style, { left: `${HIT + along - 5}px`, top: center });
        } else {
          Object.assign(startHandle.style, { top: `${HIT - 5}px`, left: center });
          Object.assign(endHandle.style, { top: `${HIT + along - 5}px`, left: center });
        }
      };

      let dragging = false;
      const reposition = () => {
        if (!dragging) paint(normalize(current.attrs), resolvePageTop(editor, anchor, current.attrs));
      };

      const render = (next: ProseMirrorNode) => {
        current = next;
        const a = normalize(next.attrs);
        if (!placeInLayer(editor, box, a.layer) && !pendingFrame) {
          // Layers are not in the DOM yet; retry once the editor is mounted.
          pendingFrame = requestAnimationFrame(() => {
            pendingFrame = 0;
            render(current);
          });
        }
        reposition();
      };

      const commit = (patch: Partial<LineAttrs> & { pageTop?: number }) =>
        commitPlacement(editor, getPos, current, patch);

      box.addEventListener('mousedown', (event) => {
        if ((event.target as HTMLElement).dataset.end) return;
        event.preventDefault();
        selectNodeAt(editor, getPos);
        const start = normalize(current.attrs);
        const startTop = resolvePageTop(editor, anchor, start);
        let next = start;
        let nextTop = startTop;
        dragging = true;
        trackPointer(event, (dx, dy) => {
          next = { ...start, left: Math.round(start.left + dx) };
          nextTop = Math.round(startTop + dy);
          paint(next, nextTop);
        }, () => {
          dragging = false;
          commit({ left: next.left, pageTop: nextTop });
        });
      });

      [startHandle, endHandle].forEach((handle) => {
        handle.addEventListener('mousedown', (event) => {
          event.preventDefault();
          event.stopPropagation();
          selectNodeAt(editor, getPos);
          const start = normalize(current.attrs);
          const startTop = resolvePageTop(editor, anchor, start);
          const horizontal = start.orientation === 'horizontal';
          const fromStart = handle.dataset.end === 'start';
          let next = start;
          let nextTop = startTop;
          dragging = true;
          trackPointer(event, (dx, dy) => {
            const delta = horizontal ? dx : dy;
            const length = Math.max(MIN_LENGTH, Math.round(start.length + (fromStart ? -delta : delta)));
            next = { ...start, length };
            // Dragging the start handle keeps the far end fixed.
            if (fromStart) {
              const shift = start.length - length;
              if (horizontal) next.left = start.left + shift;
              else nextTop = startTop + shift;
            }
            paint(next, nextTop);
          }, () => {
            dragging = false;
            commit({ left: next.left, pageTop: nextTop, length: next.length });
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
        deselectNode: () => box.classList.remove('is-selected'),
        ignoreMutation: () => true,
        destroy: () => {
          stopReflow();
          if (pendingFrame) cancelAnimationFrame(pendingFrame);
          box.remove();
        },
      };
    };
  },
});

export default FloatingLine;
