import { Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import TextAlign from '@tiptap/extension-text-align';
import {
  DocxSerializer,
  defaultNodes,
  defaultMarks,
  type NodeSerializer,
  type MarkSerializer,
} from 'prosemirror-docx';
import {
  Packer,
  AlignmentType,
  HeadingLevel,
  type IRunOptions,
  type IParagraphOptions,
} from 'docx';
import { saveAs } from 'file-saver';
import { FontSize, FontFamily, LineHeight, TextTransform } from '@/pages/shared/ConstanciaEditor';

// ── Node serializers ──
// Map Tiptap's camelCase node names to prosemirror-docx's snake_case defaults,
// and add custom handlers that read Tiptap's paragraph/heading attributes.

const tiptapNodes: NodeSerializer = {
  ...defaultNodes,
  // Tiptap uses camelCase names
  hardBreak: defaultNodes.hard_break,
  codeBlock: defaultNodes.code_block,
  bulletList: defaultNodes.bullet_list,
  orderedList: defaultNodes.ordered_list,
  listItem: defaultNodes.list_item,
  horizontalRule: defaultNodes.horizontal_rule,

  // Custom paragraph handler — reads textAlign and lineHeight attrs from Tiptap
  paragraph(state, node) {
    const textAlign = node.attrs.textAlign;
    const lineHeight = node.attrs.lineHeight;

    const opts: IParagraphOptions = {};
    if (textAlign === 'center') opts.alignment = AlignmentType.CENTER;
    else if (textAlign === 'right') opts.alignment = AlignmentType.RIGHT;
    else if (textAlign === 'justify') opts.alignment = AlignmentType.JUSTIFIED;

    // line-height: docx uses "line" in 240ths of a line (240 = single)
    if (lineHeight) {
      const lh = parseFloat(lineHeight);
      if (!isNaN(lh)) {
        opts.spacing = { line: Math.round(lh * 240), lineRule: 'auto' };
      }
    }

    state.addParagraphOptions(opts);
    state.renderInline(node);
    state.closeBlock(node);
  },

  // Custom heading handler — same as paragraph + heading level
  heading(state, node) {
    const textAlign = node.attrs.textAlign;
    const lineHeight = node.attrs.lineHeight;

    const opts: IParagraphOptions = {};
    if (textAlign === 'center') opts.alignment = AlignmentType.CENTER;
    else if (textAlign === 'right') opts.alignment = AlignmentType.RIGHT;
    else if (textAlign === 'justify') opts.alignment = AlignmentType.JUSTIFIED;

    if (lineHeight) {
      const lh = parseFloat(lineHeight);
      if (!isNaN(lh)) {
        opts.spacing = { line: Math.round(lh * 240), lineRule: 'auto' };
      }
    }

    const heading = [
      HeadingLevel.HEADING_1,
      HeadingLevel.HEADING_2,
      HeadingLevel.HEADING_3,
      HeadingLevel.HEADING_4,
      HeadingLevel.HEADING_5,
      HeadingLevel.HEADING_6,
    ][node.attrs.level - 1];

    state.addParagraphOptions(opts);
    state.renderInline(node);
    state.closeBlock(node, { heading });
  },
};

// ── Mark serializers ──
// Add textStyle mark that reads color, fontSize, fontFamily, textTransform from Tiptap attrs.

// Convert CSS color (rgb(), rgba(), hex, named) to 6-digit hex for docx
function cssColorToHex(color: string): string | undefined {
  if (!color) return undefined;
  // Already hex
  const hexMatch = color.match(/^#?([0-9a-fA-F]{6})$/);
  if (hexMatch) return hexMatch[1].toUpperCase();
  const hexShort = color.match(/^#?([0-9a-fA-F]{3})$/);
  if (hexShort) {
    const [, r, g, b] = hexShort;
    return `${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  // rgb(r, g, b) or rgba(r, g, b, a)
  const rgbMatch = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1]).toString(16).padStart(2, '0');
    const g = parseInt(rgbMatch[2]).toString(16).padStart(2, '0');
    const b = parseInt(rgbMatch[3]).toString(16).padStart(2, '0');
    return `${r}${g}${b}`.toUpperCase();
  }
  return undefined;
}

const tiptapMarks: MarkSerializer = {
  ...defaultMarks,
  underline() {
    return { underline: {} };
  },
  textStyle(state, node, mark): IRunOptions {
    const opts: IRunOptions = {};
    const color = mark.attrs?.color;
    if (color) {
      const hex = cssColorToHex(color);
      if (hex) opts.color = hex;
    }

    const fontSize = mark.attrs?.fontSize;
    if (fontSize) {
      // Tiptap stores font size as CSS string like "12pt" or "14px"
      const ptMatch = String(fontSize).match(/([\d.]+)pt/i);
      const pxMatch = String(fontSize).match(/([\d.]+)px/i);
      if (ptMatch) {
        opts.size = Math.round(parseFloat(ptMatch[1]) * 2); // docx uses half-points
      } else if (pxMatch) {
        // Convert px to pt (1pt = 1.333px)
        opts.size = Math.round((parseFloat(pxMatch[1]) / 1.333) * 2);
      }
    }

    const fontFamily = mark.attrs?.fontFamily;
    if (fontFamily) {
      // Extract first font name from CSS font-family string
      const fontMatch = String(fontFamily).match(/['"]?([^'",]+)['"]?/);
      if (fontMatch) opts.font = fontMatch[1].trim();
    }

    const textTransform = mark.attrs?.textTransform;
    if (textTransform === 'uppercase') opts.allCaps = true;

    return opts;
  },
};

// ── Main export function ──

export async function exportConstanciaToDocx(html: string, filename = 'constancia.docx'): Promise<void> {
  // Create a temporary Tiptap editor to parse the HTML into a ProseMirror doc
  const editor = new Editor({
    extensions: [
      StarterKit.configure({ link: { openOnClick: false } }),
      TextStyle,
      Color,
      FontSize,
      FontFamily,
      TextTransform,
      LineHeight,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: html,
  });

  try {
    const doc = editor.state.doc;

    const serializer = new DocxSerializer(tiptapNodes, tiptapMarks);

    const wordDoc = serializer.serialize(doc, {
      getImageBuffer: () => new Uint8Array(0), // placeholder for images
      sections: [{
        properties: {
          page: {
            size: { width: 12240, height: 15840 }, // Letter size in twips (8.5" x 11")
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }, // 1 inch = 1440 twips
          },
        },
      }],
    });

    const blob = await Packer.toBlob(wordDoc);
    saveAs(blob, filename);
  } finally {
    editor.destroy();
  }
}
