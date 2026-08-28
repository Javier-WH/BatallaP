import React, { useCallback } from 'react';
import { useEditor, EditorContent, Extension } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';
import { Button, Space, Select, Dropdown } from 'antd';
import {
  BoldOutlined, ItalicOutlined, UnderlineOutlined,
  UnorderedListOutlined, OrderedListOutlined,
  AlignLeftOutlined, AlignCenterOutlined, AlignRightOutlined,
  UndoOutlined, RedoOutlined, LinkOutlined,
  PlusOutlined,
} from '@ant-design/icons';

// Custom FontSize extension (same as DashboardEditor)
const FontSize = Extension.create({
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
const FontFamily = Extension.create({
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
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: { openOnClick: false } }),
      TextStyle,
      Color,
      FontSize,
      FontFamily,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({ openOnClick: false }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-slate focus:outline-none',
        style: 'font-family: "Times New Roman", serif; font-size: 12pt; line-height: 1.5; width: 8.5in; min-height: 11in; padding: 1in 1in; margin: 0 auto; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1); box-sizing: border-box;',
      },
    },
  });

  // Insert variable at cursor position
  const insertVariable = useCallback((varKey: string, varLabel: string) => {
    if (!editor) return;
    // Insert as a styled span so it's visually distinct
    const html = `<span style="background-color: #e6f4ff; color: #1677ff; padding: 1px 4px; border-radius: 3px; font-weight: 600;" data-variable="${varKey}">{{${varKey}}}</span>`;
    editor.chain().focus().insertContent(html).run();
  }, [editor]);

  const addLink = useCallback(() => {
    if (!editor) return;
    const url = window.prompt('Ingrese la URL:');
    if (url) editor.chain().focus().setLink({ href: url }).run();
  }, [editor]);

  if (!editor) return <div>Cargando editor…</div>;

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
            { value: "'Courier New', monospace", label: 'Courier New' },
            { value: "'Georgia', serif", label: 'Georgia' },
            { value: "'Verdana', sans-serif", label: 'Verdana' },
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
          <Button icon={<BoldOutlined />} onClick={() => editor.chain().focus().toggleBold().run()} type={editor.isActive('bold') ? 'primary' : 'default'} size="small" />
          <Button icon={<ItalicOutlined />} onClick={() => editor.chain().focus().toggleItalic().run()} type={editor.isActive('italic') ? 'primary' : 'default'} size="small" />
          <Button icon={<UnderlineOutlined />} onClick={() => editor.chain().focus().toggleUnderline().run()} type={editor.isActive('underline') ? 'primary' : 'default'} size="small" />
        </Space>

        <div className="w-px h-6 bg-slate-300 mx-1" />

        <Space>
          <Button icon={<UnorderedListOutlined />} onClick={() => editor.chain().focus().toggleBulletList().run()} type={editor.isActive('bulletList') ? 'primary' : 'default'} size="small" />
          <Button icon={<OrderedListOutlined />} onClick={() => editor.chain().focus().toggleOrderedList().run()} type={editor.isActive('orderedList') ? 'primary' : 'default'} size="small" />
        </Space>

        <div className="w-px h-6 bg-slate-300 mx-1" />

        <Space>
          <Button icon={<AlignLeftOutlined />} onClick={() => editor.chain().focus().setTextAlign('left').run()} type={editor.isActive({ textAlign: 'left' }) ? 'primary' : 'default'} size="small" />
          <Button icon={<AlignCenterOutlined />} onClick={() => editor.chain().focus().setTextAlign('center').run()} type={editor.isActive({ textAlign: 'center' }) ? 'primary' : 'default'} size="small" />
          <Button icon={<AlignRightOutlined />} onClick={() => editor.chain().focus().setTextAlign('right').run()} type={editor.isActive({ textAlign: 'right' }) ? 'primary' : 'default'} size="small" />
        </Space>

        <div className="w-px h-6 bg-slate-300 mx-1" />

        <Button icon={<LinkOutlined />} onClick={addLink} type={editor.isActive('link') ? 'primary' : 'default'} size="small" />

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
          <Button icon={<PlusOutlined />} size="small" type="dashed">Insertar variable</Button>
        </Dropdown>
      </div>

      {/* Editor — page-like canvas */}
      <div className="bg-slate-200 p-8 rounded-b-lg" style={{ minHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};

export default ConstanciaEditor;
