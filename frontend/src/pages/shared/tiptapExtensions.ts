import { Extension } from '@tiptap/react';
import TextAlign from '@tiptap/extension-text-align';

// Custom TextAlign extension that handles list alignment
export const CustomTextAlign = TextAlign.extend({
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          textAlign: {
            default: 'left',
            parseHTML: element => {
              if (element.classList.contains('text-align-center')) return 'center';
              if (element.classList.contains('text-align-right')) return 'right';
              return element.style.textAlign || 'left';
            },
            renderHTML: attributes => {
              if (!attributes.textAlign || attributes.textAlign === 'left') {
                return {};
              }
              return {
                class: `text-align-${attributes.textAlign}`,
              };
            },
          },
        },
      },
    ];
  },
});

// Custom FontSize extension
export const FontSize = Extension.create({
  name: 'fontSize',

  addOptions() {
    return {
      types: ['textStyle'],
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: element => element.style.fontSize.replace(/['"]+/g, ''),
            renderHTML: attributes => {
              if (!attributes.fontSize) {
                return {};
              }
              return {
                style: `font-size: ${attributes.fontSize}`,
              };
            },
          },
        },
      },
    ];
  },
});
