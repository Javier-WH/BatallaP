import React, { useCallback, useState } from 'react';
import { useEditor, EditorContent, Extension } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import TextAlign from '@tiptap/extension-text-align';
import { FloatingImage } from './FloatingImage';
import type { ImageWrapMode } from './FloatingImage';
import { FloatingLine } from './FloatingLine';
import {
  FloatingTable, createCells, addTableRow, removeTableRow, addTableColumn, removeTableColumn,
  getActiveCellPosition, formatActiveCell, alignActiveCell, insertIntoActiveCell, clearActiveCell,
} from './FloatingTable';
import type { CellAlign } from './FloatingTable';
import { insertFloatingNode, setAnchorMode } from './floatingObject';
import type { AnchorMode } from './floatingObject';
import { CONSTANCIA_PAGE_CSS, CONSTANCIA_PAGE_STYLE } from './constanciaPage';
import { Button, Space, Select, Dropdown, Upload, Popover, InputNumber, message } from 'antd';
import {
  BoldOutlined, ItalicOutlined, UnderlineOutlined,
  UnorderedListOutlined, OrderedListOutlined,
  AlignLeftOutlined, AlignCenterOutlined, AlignRightOutlined, MenuOutlined,
  UndoOutlined, RedoOutlined, LinkOutlined,
  PlusOutlined, PictureOutlined, LineOutlined, TableOutlined, DeleteOutlined,
  InsertRowBelowOutlined, InsertRowRightOutlined, DeleteRowOutlined, DeleteColumnOutlined,
  SelectOutlined,
} from '@ant-design/icons';

// Custom FontSize extension (same as DashboardEditor)
export const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() { return { types: ['textStyle'] }; },
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        fontSize: {
          default: null,
          parseHTML: element => element.style.fontSize.replace(/['"]+/g, ''),
          renderHTML: attributes => {
            if (!attributes.fontSize) return {};
            return { style: `font-size: ${attributes.fontSize}` };
          },
        },
      },
    }];
  },
});

// Custom FontFamily extension
export const FontFamily = Extension.create({
  name: 'fontFamily',
  addOptions() { return { types: ['textStyle'] }; },
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        fontFamily: {
          default: null,
          parseHTML: element => element.style.fontFamily?.replace(/['"]+/g, ''),
          renderHTML: attributes => {
            if (!attributes.fontFamily) return {};
            return { style: `font-family: ${attributes.fontFamily}` };
          },
        },
      },
    }];
  },
});

// Custom LineHeight extension (applies to paragraphs and headings)
export const LineHeight = Extension.create({
  name: 'lineHeight',
  addOptions() { return { types: ['paragraph', 'heading'] }; },
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        lineHeight: {
          default: null,
          parseHTML: element => element.style.lineHeight || null,
          renderHTML: attributes => {
            if (!attributes.lineHeight) return {};
            return { style: `line-height: ${attributes.lineHeight}` };
          },
        },
      },
    }];
  },
});

// Custom TextIndent extension (first-line indent, applies to paragraphs and headings)
export const TextIndent = Extension.create({
  name: 'textIndent',
  addOptions() { return { types: ['paragraph', 'heading'] }; },
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        textIndent: {
          default: null,
          parseHTML: element => element.style.textIndent || null,
          renderHTML: attributes => {
            if (!attributes.textIndent) return {};
            return { style: `text-indent: ${attributes.textIndent}` };
          },
        },
      },
    }];
  },
});

// Custom TextTransform extension (uppercase, lowercase, capitalize)
export const TextTransform = Extension.create({
  name: 'textTransform',
  addOptions() { return { types: ['textStyle'] }; },
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        textTransform: {
          default: null,
          parseHTML: element => element.style.textTransform || null,
          renderHTML: attributes => {
            if (!attributes.textTransform) return {};
            return { style: `text-transform: ${attributes.textTransform}` };
          },
        },
      },
    }];
  },
});

export { FloatingImage, FloatingLine, FloatingTable };
export type { ImageWrapMode };

// Word-style grid to choose the rows × columns of a new table, plus numeric fields
// for sizes the grid does not cover (grade certificates need 13+ rows).
const TableSizePicker: React.FC<{ onPick: (rows: number, cols: number) => void }> = ({ onPick }) => {
  const [hover, setHover] = useState<[number, number]>([0, 0]);
  const [rows, setRows] = useState(4);
  const [cols, setCols] = useState(3);
  const size = 8;
  return (
    <div>
      <div
        style={{ display: 'grid', gridTemplateColumns: `repeat(${size}, 18px)`, gap: 2 }}
        onMouseLeave={() => setHover([0, 0])}
      >
        {Array.from({ length: size * size }, (_, i) => {
          const row = Math.floor(i / size) + 1;
          const col = (i % size) + 1;
          const on = row <= hover[0] && col <= hover[1];
          return (
            <div
              key={i}
              onMouseEnter={() => setHover([row, col])}
              onClick={() => onPick(row, col)}
              style={{ width: 18, height: 18, border: '1px solid #cbd5e1', background: on ? '#bae0ff' : '#fff', cursor: 'pointer' }}
            />
          );
        })}
      </div>
      <div style={{ marginTop: 6, fontSize: 12, textAlign: 'center' }}>
        {hover[0] ? `${hover[0]} fila(s) × ${hover[1]} columna(s)` : 'Filas × columnas'}
      </div>
      <Space size={6} style={{ marginTop: 8 }}>
        <span style={{ fontSize: 12 }}>Filas</span>
        <InputNumber size="small" min={1} max={60} value={rows} onChange={(v) => setRows(v ?? 1)} style={{ width: 58 }} />
        <span style={{ fontSize: 12 }}>Columnas</span>
        <InputNumber size="small" min={1} max={12} value={cols} onChange={(v) => setCols(v ?? 1)} style={{ width: 58 }} />
        <Button size="small" type="primary" onClick={() => onPick(rows, cols)}>Insertar</Button>
      </Space>
    </div>
  );
};

const FONT_SIZE_OPTIONS = ['8pt', '10pt', '11pt', '12pt', '14pt', '16pt', '18pt', '20pt', '24pt'].map((v) => ({ value: v, label: v.replace('pt', '') }));

// Keeps the caret inside a table cell (or the editor) while a toolbar button is clicked.
const keepFocus = (event: React.MouseEvent) => event.preventDefault();

export interface VariableDef {
  group: string;
  key: string;
  label: string;
}

interface ConstanciaEditorProps {
  content: string;
  onChange: (html: string) => void;
  variables: VariableDef[];
}

const ConstanciaEditor: React.FC<ConstanciaEditorProps> = ({ content, onChange, variables }) => {
  const [tablePickerOpen, setTablePickerOpen] = useState(false);
  // Lets clicks pass through the text so objects placed behind it can be selected.
  const [objectsMode, setObjectsMode] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: { openOnClick: false } }),
      TextStyle,
      Color,
      FontSize,
      FontFamily,
      TextTransform,
      LineHeight,
      TextIndent,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      FloatingImage,
      FloatingLine,
      FloatingTable,
    ],
    // The toolbar reflects the current selection (e.g. line/table controls).
    shouldRerenderOnTransaction: true,
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-slate focus:outline-none',
        style: 'min-height: 100%;',
      },
    },
  });

  // Insert variable at cursor position. Keys may contain {n} (subject number in
  // the canonical grade order) and {m} (term/lapso number) placeholders — the
  // user is prompted for them so e.g. subject.{n}.score becomes subject.3.score.
  const insertVariable = useCallback((varKey: string, _varLabel: string) => {
    if (!editor) return;
    let key = varKey;
    if (key.includes('{n}')) {
      const raw = window.prompt('Número de materia (posición en el orden del grado):');
      if (raw === null) return;
      const n = parseInt(raw, 10);
      if (!n || n < 1) { message.warning('Número de materia inválido'); return; }
      key = key.replaceAll('{n}', String(n));
    }
    if (key.includes('{m}')) {
      const raw = window.prompt('Número de lapso (1, 2, 3…):');
      if (raw === null) return;
      const m = parseInt(raw, 10);
      if (!m || m < 1) { message.warning('Número de lapso inválido'); return; }
      key = key.replaceAll('{m}', String(m));
    }
    // Insert as a styled span so it's visually distinct
    const html = `<span style="background-color: #e6f4ff; color: #1677ff; padding: 1px 4px; border-radius: 3px; font-weight: 600;" data-variable="${key}">{{${key}}}</span>`;
    if (insertIntoActiveCell(html)) return;
    editor.chain().focus().insertContent(html).run();
  }, [editor]);

  const addLink = useCallback(() => {
    if (!editor) return;
    const url = window.prompt('Ingrese la URL:');
    if (url) editor.chain().focus().setLink({ href: url }).run();
  }, [editor]);

  if (!editor) return <div>Cargando editor…</div>;

  const lineSelected = editor.isActive('floatingLine');
  const tableSelected = editor.isActive('floatingTable');
  const lineAttrs = lineSelected ? editor.getAttributes('floatingLine') : {};
  const tableAttrs = tableSelected ? editor.getAttributes('floatingTable') : {};

  // No focus() here: keeps the caret inside a table cell that is being edited.
  const updateObject = (type: 'floatingLine' | 'floatingTable', patch: Record<string, unknown>) => {
    editor.chain().updateAttributes(type, patch).run();
  };

  const applyTablePatch = (patch: Record<string, unknown> | null) => {
    if (patch) updateObject('floatingTable', patch);
  };

  const deleteSelectedObject = () => {
    clearActiveCell();
    editor.chain().focus(undefined, { scrollIntoView: false }).deleteSelection().run();
  };

  const insertTable = (rows: number, cols: number) => {
    setTablePickerOpen(false);
    insertFloatingNode(editor, 'floatingTable', { cells: createCells(rows, cols), width: Math.min(624, cols * 120) });
  };

  const toggleMark = (mark: 'bold' | 'italic' | 'underline') => {
    if (formatActiveCell(mark)) return;
    const chain = editor.chain().focus();
    if (mark === 'bold') chain.toggleBold().run();
    else if (mark === 'italic') chain.toggleItalic().run();
    else chain.toggleUnderline().run();
  };

  const align = (value: CellAlign) => {
    if (alignActiveCell(value)) return;
    editor.chain().focus().setTextAlign(value).run();
  };

  // Group variables for dropdown
  const groupedVars = variables.reduce((acc, v) => {
    if (!acc[v.group]) acc[v.group] = [];
    acc[v.group].push(v);
    return acc;
  }, {} as Record<string, VariableDef[]>);

  const menuItems = Object.entries(groupedVars).map(([group, vars]) => ({
    key: group,
    label: <span style={{ fontWeight: 600, fontSize: 11, color: '#8B93A6', textTransform: 'uppercase' }}>{group}</span>,
    children: vars.map(v => ({
      key: v.key,
      label: <span style={{ fontSize: 13 }}>{v.label} <code style={{ color: '#999', fontSize: 11 }}>{`{{${v.key}}}`}</code></span>,
    })),
  }));

  return (
    <div className="rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 p-3 border border-slate-200 border-b-0 rounded-t-lg bg-slate-50 items-center sticky top-0 z-10">
        <Space>
          <Button icon={<UndoOutlined />} onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} size="small" />
          <Button icon={<RedoOutlined />} onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} size="small" />
        </Space>

        <div className="w-px h-6 bg-slate-300 mx-1" />

        <Select
          defaultValue="'Times New Roman', serif"
          size="small"
          style={{ width: 160 }}
          onChange={(value) => editor.chain().focus().setMark('textStyle', { fontFamily: value }).run()}
          options={[
            { value: "'Times New Roman', serif", label: 'Times New Roman' },
            { value: "'Arial', sans-serif", label: 'Arial' },
            { value: "'Cambria', serif", label: 'Cambria' },
            { value: "'Calibri', sans-serif", label: 'Calibri' },
            { value: "'Garamond', serif", label: 'Garamond' },
            { value: "'Georgia', serif", label: 'Georgia' },
            { value: "'Palatino Linotype', 'Book Antiqua', Palatino, serif", label: 'Palatino' },
            { value: "'Trebuchet MS', sans-serif", label: 'Trebuchet MS' },
            { value: "'Tahoma', sans-serif", label: 'Tahoma' },
            { value: "'Verdana', sans-serif", label: 'Verdana' },
            { value: "'Courier New', monospace", label: 'Courier New' },
            { value: "'Lucida Sans Unicode', sans-serif", label: 'Lucida Sans' },
          ]}
        />

        <Select
          defaultValue="12pt"
          size="small"
          style={{ width: 90 }}
          onChange={(value) => editor.chain().focus().setMark('textStyle', { fontSize: value }).run()}
          options={[
            { value: '8pt', label: '8' },
            { value: '10pt', label: '10' },
            { value: '11pt', label: '11' },
            { value: '12pt', label: '12' },
            { value: '14pt', label: '14' },
            { value: '16pt', label: '16' },
            { value: '18pt', label: '18' },
            { value: '20pt', label: '20' },
            { value: '24pt', label: '24' },
            { value: '28pt', label: '28' },
            { value: '32pt', label: '32' },
          ]}
        />

        <input
          type="color"
          onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
          value={editor.getAttributes('textStyle').color || '#000000'}
          style={{ width: 32, height: 32, cursor: 'pointer', border: '1px solid #d9d9d9', borderRadius: 4 }}
        />

        <div className="w-px h-6 bg-slate-300 mx-1" />

        <Space>
          <Button icon={<BoldOutlined />} onMouseDown={keepFocus} onClick={() => toggleMark('bold')} type={editor.isActive('bold') ? 'primary' : 'default'} size="small" />
          <Button icon={<ItalicOutlined />} onMouseDown={keepFocus} onClick={() => toggleMark('italic')} type={editor.isActive('italic') ? 'primary' : 'default'} size="small" />
          <Button icon={<UnderlineOutlined />} onMouseDown={keepFocus} onClick={() => toggleMark('underline')} type={editor.isActive('underline') ? 'primary' : 'default'} size="small" />
        </Space>

        <div className="w-px h-6 bg-slate-300 mx-1" />

        <Space>
          <Button icon={<UnorderedListOutlined />} onClick={() => editor.chain().focus().toggleBulletList().run()} type={editor.isActive('bulletList') ? 'primary' : 'default'} size="small" />
          <Button icon={<OrderedListOutlined />} onClick={() => editor.chain().focus().toggleOrderedList().run()} type={editor.isActive('orderedList') ? 'primary' : 'default'} size="small" />
        </Space>

        <div className="w-px h-6 bg-slate-300 mx-1" />

        <Space>
          <Button icon={<AlignLeftOutlined />} onMouseDown={keepFocus} onClick={() => align('left')} type={editor.isActive({ textAlign: 'left' }) ? 'primary' : 'default'} size="small" />
          <Button icon={<AlignCenterOutlined />} onMouseDown={keepFocus} onClick={() => align('center')} type={editor.isActive({ textAlign: 'center' }) ? 'primary' : 'default'} size="small" />
          <Button icon={<AlignRightOutlined />} onMouseDown={keepFocus} onClick={() => align('right')} type={editor.isActive({ textAlign: 'right' }) ? 'primary' : 'default'} size="small" />
          <Button icon={<MenuOutlined />} onMouseDown={keepFocus} onClick={() => align('justify')} type={editor.isActive({ textAlign: 'justify' }) ? 'primary' : 'default'} size="small" />
        </Space>

        <div className="w-px h-6 bg-slate-300 mx-1" />

        <Button icon={<LinkOutlined />} onClick={addLink} type={editor.isActive('link') ? 'primary' : 'default'} size="small" />

        <div className="w-px h-6 bg-slate-300 mx-1" />

        {/* Image insertion + wrapping mode */}
        <Upload
          accept="image/*"
          showUploadList={false}
          beforeUpload={(file) => {
            const reader = new FileReader();
            reader.onload = () => {
              const src = reader.result as string;
              editor.chain().focus().setImage({ src, alt: file.name }).run();
            };
            reader.readAsDataURL(file);
            return false;
          }}
        >
          <Button icon={<PictureOutlined />} size="small" title="Insertar imagen">Imagen</Button>
        </Upload>

        {editor.isActive('image') && (
          <Select
            size="small"
            style={{ width: 150 }}
            value={editor.getAttributes('image').wrap || 'inline'}
            onChange={(value: ImageWrapMode) => {
              editor.chain().focus().setImageWrap(value).run();
            }}
            options={[
              { value: 'inline', label: 'En línea' },
              { value: 'left', label: 'Flotar izquierda' },
              { value: 'right', label: 'Flotar derecha' },
              { value: 'front', label: 'Delante del texto' },
              { value: 'behind', label: 'Detrás del texto' },
            ]}
          />
        )}

        {/* Floating objects: signature lines and tables */}
        <Button
          icon={<LineOutlined />}
          size="small"
          title="Insertar línea (para firmas)"
          onClick={() => insertFloatingNode(editor, 'floatingLine', {})}
        >
          Línea
        </Button>

        <Popover
          trigger="click"
          open={tablePickerOpen}
          onOpenChange={setTablePickerOpen}
          content={<TableSizePicker onPick={insertTable} />}
          title="Insertar tabla"
        >
          <Button
            icon={<TableOutlined />}
            size="small"
            title="Insertar tabla. Con clic derecho sobre una celda puedes agregar o quitar filas y columnas"
          >
            Tabla
          </Button>
        </Popover>

        <Button
          icon={<SelectOutlined />}
          size="small"
          type={objectsMode ? 'primary' : 'default'}
          title="Permite seleccionar las líneas, tablas e imágenes colocadas detrás del texto"
          onClick={() => setObjectsMode((on) => !on)}
        >
          Objetos detrás
        </Button>

        {lineSelected && (
          <Space size={4} wrap>
            <Select
              size="small"
              style={{ width: 115 }}
              value={lineAttrs.orientation || 'horizontal'}
              onChange={(value) => updateObject('floatingLine', { orientation: value })}
              options={[
                { value: 'horizontal', label: 'Horizontal' },
                { value: 'vertical', label: 'Vertical' },
              ]}
            />
            <Select
              size="small"
              style={{ width: 80 }}
              value={Number(lineAttrs.thickness) || 1}
              onChange={(value) => updateObject('floatingLine', { thickness: value })}
              options={[1, 2, 3, 4, 6].map((v) => ({ value: v, label: `${v} px` }))}
            />
            <Select
              size="small"
              style={{ width: 115 }}
              value={lineAttrs.lineStyle || 'solid'}
              onChange={(value) => updateObject('floatingLine', { lineStyle: value })}
              options={[
                { value: 'solid', label: 'Continua' },
                { value: 'dashed', label: 'Discontinua' },
                { value: 'dotted', label: 'Punteada' },
              ]}
            />
            <input
              type="color"
              title="Color de la línea"
              value={lineAttrs.color || '#000000'}
              onChange={(e) => updateObject('floatingLine', { color: e.target.value })}
              style={{ width: 28, height: 28, cursor: 'pointer', border: '1px solid #d9d9d9', borderRadius: 4 }}
            />
            <Select
              size="small"
              style={{ width: 150 }}
              value={lineAttrs.layer || 'front'}
              onChange={(value) => updateObject('floatingLine', { layer: value })}
              options={[
                { value: 'front', label: 'Delante del texto' },
                { value: 'behind', label: 'Detrás del texto' },
              ]}
            />
            <Select
              size="small"
              style={{ width: 155 }}
              title="Anclada al texto: la línea sigue al párrafo sobre el que está puesta, aunque las variables cambien el largo del texto"
              value={lineAttrs.anchor === 'text' ? 'text' : 'page'}
              onChange={(value) => setAnchorMode(editor, value as AnchorMode)}
              options={[
                { value: 'text', label: 'Anclada al texto' },
                { value: 'page', label: 'Fija en la página' },
              ]}
            />
            <Button icon={<DeleteOutlined />} size="small" danger title="Eliminar línea" onClick={deleteSelectedObject} />
          </Space>
        )}

        {tableSelected && (
          <Space size={4} wrap>
            <Button
              icon={<InsertRowBelowOutlined />}
              size="small"
              title="Insertar fila debajo de la celda activa"
              onMouseDown={keepFocus}
              onClick={() => applyTablePatch(addTableRow(tableAttrs, getActiveCellPosition()?.row))}
            >
              +Fila
            </Button>
            <Button
              icon={<DeleteRowOutlined />}
              size="small"
              title="Eliminar la fila de la celda activa"
              onMouseDown={keepFocus}
              onClick={() => applyTablePatch(removeTableRow(tableAttrs, getActiveCellPosition()?.row))}
            >
              -Fila
            </Button>
            <Button
              icon={<InsertRowRightOutlined />}
              size="small"
              title="Insertar columna a la derecha de la celda activa"
              onMouseDown={keepFocus}
              onClick={() => applyTablePatch(addTableColumn(tableAttrs, getActiveCellPosition()?.col))}
            >
              +Col
            </Button>
            <Button
              icon={<DeleteColumnOutlined />}
              size="small"
              title="Eliminar la columna de la celda activa"
              onMouseDown={keepFocus}
              onClick={() => applyTablePatch(removeTableColumn(tableAttrs, getActiveCellPosition()?.col))}
            >
              -Col
            </Button>
            <input
              type="color"
              title="Color del borde"
              value={tableAttrs.borderColor && tableAttrs.borderColor !== 'transparent' ? tableAttrs.borderColor : '#000000'}
              onChange={(e) => updateObject('floatingTable', { borderColor: e.target.value })}
              style={{ width: 28, height: 28, cursor: 'pointer', border: '1px solid #d9d9d9', borderRadius: 4 }}
            />
            <Select
              size="small"
              style={{ width: 120 }}
              value={tableAttrs.borderColor === 'transparent' ? 'none' : String(tableAttrs.borderWidth ?? 1)}
              onChange={(value) => updateObject(
                'floatingTable',
                value === 'none'
                  ? { borderColor: 'transparent' }
                  : {
                    borderWidth: Number(value),
                    borderColor: tableAttrs.borderColor === 'transparent' ? '#000000' : tableAttrs.borderColor,
                  },
              )}
              options={[
                { value: 'none', label: 'Sin borde' },
                { value: '1', label: 'Borde 1 px' },
                { value: '2', label: 'Borde 2 px' },
                { value: '3', label: 'Borde 3 px' },
              ]}
            />
            <Select
              size="small"
              style={{ width: 95 }}
              placeholder="Tamaño"
              allowClear
              value={tableAttrs.fontSize || undefined}
              onChange={(value) => updateObject('floatingTable', { fontSize: value ?? null })}
              options={FONT_SIZE_OPTIONS}
            />
            <Select
              size="small"
              style={{ width: 150 }}
              value={tableAttrs.layer || 'front'}
              onChange={(value) => updateObject('floatingTable', { layer: value })}
              options={[
                { value: 'front', label: 'Delante del texto' },
                { value: 'behind', label: 'Detrás del texto' },
              ]}
            />
            <Select
              size="small"
              style={{ width: 155 }}
              title="Anclada al texto: la tabla sigue al párrafo sobre el que está puesta, aunque las variables cambien el largo del texto"
              value={tableAttrs.anchor === 'text' ? 'text' : 'page'}
              onChange={(value) => setAnchorMode(editor, value as AnchorMode)}
              options={[
                { value: 'text', label: 'Anclada al texto' },
                { value: 'page', label: 'Fija en la página' },
              ]}
            />
            <Button icon={<DeleteOutlined />} size="small" danger title="Eliminar tabla" onClick={deleteSelectedObject} />
          </Space>
        )}

        <div className="w-px h-6 bg-slate-300 mx-1" />

        {/* Text transform (uppercase / lowercase / capitalize) */}
        <Select
          size="small"
          style={{ width: 130 }}
          placeholder="Mayús/Minús"
          allowClear
          value={editor.getAttributes('textStyle').textTransform || undefined}
          onChange={(value) => {
            if (value) {
              editor.chain().focus().setMark('textStyle', { textTransform: value }).run();
            } else {
              editor.chain().focus().setMark('textStyle', { textTransform: null }).run();
            }
          }}
          options={[
            { value: 'uppercase', label: 'MAYÚSCULAS' },
            { value: 'lowercase', label: 'minúsculas' },
            { value: 'capitalize', label: 'Primera Letra' },
          ]}
        />

        {/* Line spacing */}
        <Select
          size="small"
          style={{ width: 110 }}
          placeholder="Interlineado"
          allowClear
          value={editor.getAttributes('paragraph').lineHeight || undefined}
          onChange={(value) => {
            if (value) {
              editor.chain().focus().updateAttributes('paragraph', { lineHeight: value }).run();
            } else {
              editor.chain().focus().resetAttributes('paragraph', 'lineHeight').run();
            }
          }}
          options={[
            { value: '1.0', label: 'Sencillo' },
            { value: '1.15', label: '1.15' },
            { value: '1.5', label: '1.5' },
            { value: '2.0', label: 'Doble' },
            { value: '2.5', label: '2.5' },
            { value: '3.0', label: 'Triple' },
          ]}
        />

        {/* First-line indent (sangría) */}
        <Select
          size="small"
          style={{ width: 110 }}
          placeholder="Sangría"
          allowClear
          value={editor.getAttributes('paragraph').textIndent || undefined}
          onChange={(value) => {
            if (value) {
              editor.chain().focus().updateAttributes('paragraph', { textIndent: value }).run();
            } else {
              editor.chain().focus().resetAttributes('paragraph', 'textIndent').run();
            }
          }}
          options={[
            { value: '0.5cm', label: '0.5 cm' },
            { value: '1cm', label: '1 cm' },
            { value: '1.25cm', label: '1.25 cm' },
            { value: '2cm', label: '2 cm' },
            { value: '3cm', label: '3 cm' },
          ]}
        />

        <div className="w-px h-6 bg-slate-300 mx-1" />

        {/* Variable inserter */}
        <Dropdown
          menu={{
            items: menuItems,
            onClick: ({ key }) => {
              const v = variables.find(v => v.key === key);
              if (v) insertVariable(v.key, v.label);
            },
          }}
          trigger={['click']}
        >
          <Button icon={<PlusOutlined />} size="small" type="dashed" onMouseDown={keepFocus}>Insertar variable</Button>
        </Dropdown>
      </div>

      {/* Editor — page-like canvas with background/foreground image layers */}
      <div className="bg-slate-200 p-8 rounded-b-lg" style={{ minHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
        <style>{CONSTANCIA_PAGE_CSS}</style>
        <div
          className={`constancia-page constancia-editor-page${objectsMode ? ' constancia-objects-mode' : ''}`}
          style={CONSTANCIA_PAGE_STYLE}
        >
          <div className="constancia-layer constancia-layer-behind" />
          <EditorContent editor={editor} className="constancia-content" />
          <div className="constancia-layer constancia-layer-front" />
        </div>
      </div>
    </div>
  );
};

export default ConstanciaEditor;
