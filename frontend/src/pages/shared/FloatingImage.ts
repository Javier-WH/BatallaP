import { mergeAttributes, Node } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { NodeSelection } from '@tiptap/pm/state';

export type ImageWrapMode = 'inline' | 'left' | 'right' | 'front' | 'behind';

// Modes that take the image out of the text flow and anchor it to the page.
const FLOATING_MODES: ImageWrapMode[] = ['front', 'behind'];

const DEFAULT_OFFSET = 96;

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    image: {
      setImage: (options: { src: string; alt?: string; title?: string }) => ReturnType;
      setImageWrap: (wrap: ImageWrapMode) => ReturnType;
    };
  }
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : parseFloat(String(value));
  return Number.isNaN(parsed) ? null : parsed;
}

function isFloating(wrap: string): boolean {
  return FLOATING_MODES.includes(wrap as ImageWrapMode);
}

// Builds the inline style used when the document is rendered outside the editor
// (stored template, preview and printed PDF).
export function buildImageStyle(attrs: Record<string, unknown>): string {
  const wrap = (attrs.wrap as ImageWrapMode) || 'inline';
  const styles: string[] = [];

  if (wrap === 'left') styles.push('float: left', 'margin: 0 12px 6px 0');
  if (wrap === 'right') styles.push('float: right', 'margin: 0 0 6px 12px');

  if (isFloating(wrap)) {
    styles.push('position: absolute');
    styles.push(`z-index: ${wrap === 'front' ? 30 : 0}`);
    styles.push(`top: ${toNumber(attrs.top) ?? DEFAULT_OFFSET}px`);
    styles.push(`left: ${toNumber(attrs.left) ?? DEFAULT_OFFSET}px`);
  }

  const width = toNumber(attrs.width);
  const height = toNumber(attrs.height);
  if (width) styles.push(`width: ${width}px`);
  if (height) styles.push(`height: ${height}px`);

  return styles.join('; ');
}

export const FloatingImage = Node.create({
  name: 'image',
  inline: true,
  group: 'inline',
  draggable: false,
  selectable: true,

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
      title: { default: null },
      wrap: {
        default: 'inline',
        parseHTML: (element) => element.getAttribute('data-wrap') || 'inline',
        renderHTML: (attributes) =>
          attributes.wrap && attributes.wrap !== 'inline' ? { 'data-wrap': attributes.wrap } : {},
      },
      width: {
        default: null,
        parseHTML: (element) => toNumber(element.getAttribute('data-width')) ?? toNumber(element.style.width),
        renderHTML: (attributes) => (attributes.width ? { 'data-width': attributes.width } : {}),
      },
      height: {
        default: null,
        parseHTML: (element) => toNumber(element.getAttribute('data-height')) ?? toNumber(element.style.height),
        renderHTML: (attributes) => (attributes.height ? { 'data-height': attributes.height } : {}),
      },
      top: {
        default: null,
        parseHTML: (element) => toNumber(element.getAttribute('data-top')) ?? toNumber(element.style.top),
        renderHTML: (attributes) => (attributes.top != null ? { 'data-top': attributes.top } : {}),
      },
      left: {
        default: null,
        parseHTML: (element) => toNumber(element.getAttribute('data-left')) ?? toNumber(element.style.left),
        renderHTML: (attributes) => (attributes.left != null ? { 'data-left': attributes.left } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'img[src]' }];
  },

  renderHTML({ HTMLAttributes, node }) {
    const style = buildImageStyle(node.attrs);
    return ['img', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, style ? { style } : {})];
  },

  addCommands() {
    return {
      setImage:
        (options) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: options }),
      setImageWrap:
        (wrap) =>
        ({ state, chain }) => {
          const { from } = state.selection;
          const node = state.doc.nodeAt(from);
          if (!node || node.type.name !== this.name) return false;

          const attrs: Record<string, unknown> = { wrap };
          // Give floating images a starting anchor the first time they leave the flow.
          if (isFloating(wrap) && node.attrs.top == null && node.attrs.left == null) {
            attrs.top = DEFAULT_OFFSET;
            attrs.left = DEFAULT_OFFSET;
          }
          return chain().updateAttributes(this.name, attrs).run();
        },
    };
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      let currentNode: ProseMirrorNode = node;
      let interacting = false;
      let pendingFrame = 0;

      // Stays in the text flow so ProseMirror can map positions.
      const anchor = document.createElement('span');
      anchor.className = 'fimg-anchor';

      const box = document.createElement('span');
      box.className = 'fimg-box';

      const img = document.createElement('img');
      img.draggable = false;
      box.appendChild(img);

      (['nw', 'ne', 'sw', 'se'] as const).forEach((direction) => {
        const handle = document.createElement('span');
        handle.className = `fimg-handle fimg-handle-${direction}`;
        handle.dataset.direction = direction;
        box.appendChild(handle);
      });

      // The view is not mounted yet while node views are built for the initial content.
      const getPage = (): HTMLElement | null => {
        try {
          return editor.view.dom.closest('.constancia-page') as HTMLElement | null;
        } catch {
          return null;
        }
      };

      const getLayer = (wrap: ImageWrapMode): HTMLElement | null => {
        const page = getPage();
        if (!page) return null;
        return page.querySelector<HTMLElement>(
          wrap === 'behind' ? '.constancia-layer-behind' : '.constancia-layer-front',
        );
      };

      const commit = (attrs: Record<string, unknown>) => {
        const pos = typeof getPos === 'function' ? getPos() : undefined;
        if (pos === undefined) return;
        editor
          .chain()
          .command(({ tr }) => {
            tr.setNodeMarkup(pos, undefined, { ...currentNode.attrs, ...attrs });
            // setNodeMarkup drops the node selection, so restore it to keep handles visible.
            tr.setSelection(NodeSelection.create(tr.doc, pos));
            return true;
          })
          .run();
      };

      const render = (next: ProseMirrorNode) => {
        currentNode = next;
        const wrap: ImageWrapMode = next.attrs.wrap || 'inline';

        if (img.getAttribute('src') !== next.attrs.src) img.src = next.attrs.src || '';
        img.alt = next.attrs.alt || '';

        const width = toNumber(next.attrs.width);
        const height = toNumber(next.attrs.height);
        img.style.width = width ? `${width}px` : '';
        img.style.height = height ? `${height}px` : '';

        box.dataset.wrap = wrap;

        if (isFloating(wrap)) {
          const layer = getLayer(wrap);
          if (layer) {
            if (box.parentElement !== layer) layer.appendChild(box);
          } else if (!pendingFrame) {
            // Layers are not in the DOM yet; retry once the editor is mounted.
            pendingFrame = requestAnimationFrame(() => {
              pendingFrame = 0;
              render(currentNode);
            });
          }
          box.style.position = 'absolute';
          box.style.float = '';
          box.style.top = `${toNumber(next.attrs.top) ?? DEFAULT_OFFSET}px`;
          box.style.left = `${toNumber(next.attrs.left) ?? DEFAULT_OFFSET}px`;
          anchor.classList.add('fimg-anchor-detached');
        } else {
          if (box.parentElement !== anchor) anchor.appendChild(box);
          box.style.position = '';
          box.style.top = '';
          box.style.left = '';
          box.style.float = wrap === 'left' ? 'left' : wrap === 'right' ? 'right' : '';
          anchor.classList.remove('fimg-anchor-detached');
        }
      };

      const selectSelf = () => {
        const pos = typeof getPos === 'function' ? getPos() : undefined;
        if (pos === undefined) return;
        editor.chain().setNodeSelection(pos).run();
      };

      box.addEventListener('mousedown', (event) => {
        const target = event.target as HTMLElement;
        if (target.dataset.direction) return;

        // Keep ProseMirror from replacing the node selection with a text selection.
        event.preventDefault();
        selectSelf();

        if (!isFloating(currentNode.attrs.wrap || 'inline')) return;

        const page = getPage();
        if (!page) return;

        interacting = true;

        const pageRect = page.getBoundingClientRect();
        const boxRect = box.getBoundingClientRect();
        const grabX = event.clientX - boxRect.left;
        const grabY = event.clientY - boxRect.top;

        const onMove = (moveEvent: MouseEvent) => {
          box.style.left = `${moveEvent.clientX - pageRect.left - grabX}px`;
          box.style.top = `${moveEvent.clientY - pageRect.top - grabY}px`;
        };

        const onUp = () => {
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
          interacting = false;
          commit({ left: Math.round(parseFloat(box.style.left)), top: Math.round(parseFloat(box.style.top)) });
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });

      box.querySelectorAll<HTMLElement>('.fimg-handle').forEach((handle) => {
        handle.addEventListener('mousedown', (event) => {
          event.preventDefault();
          event.stopPropagation();
          selectSelf();
          interacting = true;

          const direction = handle.dataset.direction || 'se';
          const startX = event.clientX;
          const startRect = img.getBoundingClientRect();
          const ratio = startRect.width > 0 ? startRect.height / startRect.width : 1;

          const onMove = (moveEvent: MouseEvent) => {
            const delta = moveEvent.clientX - startX;
            const signed = direction.includes('w') ? -delta : delta;
            const width = Math.max(24, Math.round(startRect.width + signed));
            img.style.width = `${width}px`;
            img.style.height = `${Math.round(width * ratio)}px`;
          };

          const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            interacting = false;
            commit({
              width: Math.round(parseFloat(img.style.width)),
              height: Math.round(parseFloat(img.style.height)),
            });
          };

          document.addEventListener('mousemove', onMove);
          document.addEventListener('mouseup', onUp);
        });
      });

      render(node);

      return {
        dom: anchor,
        update: (updatedNode) => {
          if (updatedNode.type !== currentNode.type) return false;
          render(updatedNode);
          return true;
        },
        selectNode: () => box.classList.add('is-selected'),
        deselectNode: () => box.classList.remove('is-selected'),
        stopEvent: (event) => {
          if (interacting) return true;
          const target = event.target as HTMLElement | null;
          if (target && box.contains(target)) {
            return event.type === 'mousedown' || event.type === 'mouseup' || event.type === 'click';
          }
          return false;
        },
        ignoreMutation: () => true,
        destroy: () => {
          if (pendingFrame) cancelAnimationFrame(pendingFrame);
          box.remove();
        },
      };
    };
  },
});

export default FloatingImage;
