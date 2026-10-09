import React, { useCallback, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import { Button, Modal, Select, Space } from 'antd';
import {
  AlignCenterOutlined, AlignLeftOutlined, AlignRightOutlined, BoldOutlined,
  ItalicOutlined, LinkOutlined, OrderedListOutlined, RedoOutlined,
  UnderlineOutlined, UndoOutlined, UnorderedListOutlined,
} from '@ant-design/icons';
import { CustomTextAlign, FontSize } from './tiptapExtensions';
import './DashboardEditor.css';

/**
 * Rich-text modal for a dashboard text element. The canvas stores plain HTML in
 * `element.content`; editing through Tiptap keeps the markup clean instead of
 * the old contentEditable + innerHTML round-trip that leaked raw tags.
 */
interface TextElementEditorModalProps {
  open: boolean;
  initialHtml: string;
  onSave: (html: string) => void;
  onCancel: () => void;
}

const TextElementEditorModal: React.FC<TextElementEditorModalProps> = ({ open, initialHtml, onSave, onCancel }) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: { openOnClick: false },
      }),
      TextStyle,
      Color,
      FontSize,
      CustomTextAlign.configure({
        types: ['heading', 'paragraph', 'listItem'],
      }),
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'prose prose-slate max-w-none min-h-[200px] p-3 focus:outline-none',
      },
    },
  });

  // (Re)load the element's HTML every time the modal opens for a new element.
  useEffect(() => {
    if (open && editor) {
      editor.commands.setContent(initialHtml || '');
      editor.commands.focus('end');
    }
  }, [open, initialHtml, editor]);

  const addLink = useCallback(() => {
    if (!editor) return;
    const url = window.prompt('Ingrese la URL:');
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  }, [editor]);

  const handleOk = () => {
    if (!editor) return;
    const html = editor.getHTML();
    onSave(editor.isEmpty ? '' : html);
  };

  return (
    <Modal
      open={open}
      title="Editar texto"
      onOk={handleOk}
      onCancel={onCancel}
      okText="Aplicar"
      cancelText="Cancelar"
      width={640}
      centered
      destroyOnHidden
      maskClosable={false}
    >
      {editor && (
        <>
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-1.5 mb-3 pb-3 border-b border-slate-200">
            <Space size={4}>
              <Button icon={<UndoOutlined />} onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} size="small" />
              <Button icon={<RedoOutlined />} onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} size="small" />
            </Space>

            <div className="w-px h-5 bg-slate-300 mx-1" />

            <Space size={4}>
              <Button icon={<BoldOutlined />} onClick={() => editor.chain().focus().toggleBold().run()} type={editor.isActive('bold') ? 'primary' : 'default'} size="small" />
              <Button icon={<ItalicOutlined />} onClick={() => editor.chain().focus().toggleItalic().run()} type={editor.isActive('italic') ? 'primary' : 'default'} size="small" />
              <Button icon={<UnderlineOutlined />} onClick={() => editor.chain().focus().toggleUnderline().run()} type={editor.isActive('underline') ? 'primary' : 'default'} size="small" />
            </Space>

            <div className="w-px h-5 bg-slate-300 mx-1" />

            <Space size={4}>
              <Select
                size="small"
                style={{ width: 104 }}
                placeholder="Tamaño"
                value={(editor.getAttributes('textStyle').fontSize as string) || '16px'}
                onChange={(value) => editor.chain().focus().setMark('textStyle', { fontSize: value }).run()}
                options={[
                  { value: '12px', label: 'Pequeño' },
                  { value: '14px', label: 'Mediano' },
                  { value: '16px', label: 'Normal' },
                  { value: '18px', label: 'Grande' },
                  { value: '24px', label: 'Muy grande' },
                ]}
              />
              <input
                type="color"
                title="Color de texto"
                onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
                value={editor.getAttributes('textStyle').color || '#000000'}
                style={{ width: 28, height: 28, cursor: 'pointer', border: '1px solid #d9d9d9', borderRadius: 4 }}
              />
            </Space>

            <div className="w-px h-5 bg-slate-300 mx-1" />

            <Space size={4}>
              <Button icon={<UnorderedListOutlined />} onClick={() => editor.chain().focus().toggleBulletList().run()} type={editor.isActive('bulletList') ? 'primary' : 'default'} size="small" />
              <Button icon={<OrderedListOutlined />} onClick={() => editor.chain().focus().toggleOrderedList().run()} type={editor.isActive('orderedList') ? 'primary' : 'default'} size="small" />
            </Space>

            <div className="w-px h-5 bg-slate-300 mx-1" />

            <Space size={4}>
              <Button icon={<AlignLeftOutlined />} onClick={() => editor.chain().focus().setTextAlign('left').run()} type={editor.isActive({ textAlign: 'left' }) ? 'primary' : 'default'} size="small" />
              <Button icon={<AlignCenterOutlined />} onClick={() => editor.chain().focus().setTextAlign('center').run()} type={editor.isActive({ textAlign: 'center' }) ? 'primary' : 'default'} size="small" />
              <Button icon={<AlignRightOutlined />} onClick={() => editor.chain().focus().setTextAlign('right').run()} type={editor.isActive({ textAlign: 'right' }) ? 'primary' : 'default'} size="small" />
            </Space>

            <div className="w-px h-5 bg-slate-300 mx-1" />

            <Button icon={<LinkOutlined />} onClick={addLink} type={editor.isActive('link') ? 'primary' : 'default'} size="small" />
          </div>

          <div className="border border-slate-200 rounded-lg">
            <EditorContent editor={editor} />
          </div>
          <p className="text-xs mt-2 mb-0" style={{ color: 'var(--color-text-muted)' }}>
            El bloque del canvas puede moverse y redimensionarse; aquí solo editas su contenido.
          </p>
        </>
      )}
    </Modal>
  );
};

export default TextElementEditorModal;
