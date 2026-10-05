import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { anchorTargets } from './floatingObject';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    anchorHighlight: {
      /** Shows / hides the anchor highlight of every floating object (not only the selected one). */
      toggleAnchorHighlight: () => ReturnType;
    };
  }
  interface Storage {
    anchorHighlight: { showAll: boolean };
  }
}

/**
 * Editor-only highlight of the text block each floating object (line, table, image) is
 * anchored to: always for the selected object, and for every object while `showAll` is on
 * (toggled from the toolbar). Decorations never reach the saved HTML, the preview or the PDF.
 */
export const AnchorHighlight = Extension.create({
  name: 'anchorHighlight',

  addStorage() {
    return { showAll: false };
  },

  addCommands() {
    return {
      // The chain dispatches the transaction afterwards, which re-evaluates the decorations.
      toggleAnchorHighlight: () => () => {
        this.storage.showAll = !this.storage.showAll;
        return true;
      },
    };
  },

  addProseMirrorPlugins() {
    const storage = this.storage;
    return [
      new Plugin({
        key: new PluginKey('anchorHighlight'),
        props: {
          decorations(state) {
            const targets = anchorTargets(state.doc, state.selection, storage.showAll);
            if (targets.length === 0) return null;
            return DecorationSet.create(
              state.doc,
              targets.flatMap(({ pos, selected }) => {
                const node = state.doc.nodeAt(pos);
                if (!node) return [];
                return [Decoration.node(pos, pos + node.nodeSize, {
                  class: selected ? 'fobj-anchor-target is-selected' : 'fobj-anchor-target',
                })];
              }),
            );
          },
        },
      }),
    ];
  },
});

export default AnchorHighlight;
