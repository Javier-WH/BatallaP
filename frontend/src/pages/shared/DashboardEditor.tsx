import React, { useCallback, useEffect } from 'react';
import { useEditor, EditorContent, Extension } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import { Button, Space, message, Upload, Select } from 'antd';
import { UploadOutlined, BoldOutlined, ItalicOutlined, UnderlineOutlined, OrderedListOutlined, UnorderedListOutlined, AlignLeftOutlined, AlignCenterOutlined, AlignRightOutlined, LinkOutlined, PictureOutlined, UndoOutlined, RedoOutlined } from '@ant-design/icons';
import { getContent, updateContent, uploadImage, deleteImage } from '@/services/dashboardContentService';
import './DashboardEditor.css';

// Custom TextAlign extension that handles list alignment
const CustomTextAlign = TextAlign.extend({
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
const FontSize = Extension.create({
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

interface DashboardContentData {
  id: number;
  content: string;
  updatedBy?: number;
  updatedAt: string;
}

interface DashboardEditorProps {
  onSaved?: () => void;
}

const DashboardEditor: React.FC<DashboardEditorProps> = ({ onSaved }) => {
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [uploadedImages, setUploadedImages] = React.useState<Set<string>>(new Set());
  const [isUploading, setIsUploading] = React.useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: {
          openOnClick: false,
        },
      }),
      TextStyle,
      Color,
      FontSize,
      Image.configure({
        inline: false,
        allowBase64: false,
        resize: {
          enabled: true,
          directions: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
          minWidth: 50,
          minHeight: 50,
          alwaysPreserveAspectRatio: true,
        },
      }),
      CustomTextAlign.configure({
        types: ['heading', 'paragraph', 'listItem'],
      }),
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'prose prose-slate max-w-none min-h-[400px] p-4 focus:outline-none',
      },
    },
    onUpdate: ({ editor }) => {
      // Skip image deletion during upload to prevent race condition
      if (isUploading) return;

      // Track images in the editor to detect deletions
      const currentImages = new Set<string>();
      editor.state.doc.descendants((node) => {
        if (node.type.name === 'image') {
          const src = node.attrs.src as string;
          if (src) {
            const filename = src.split('/').pop();
            if (filename) {
              currentImages.add(filename);
            }
          }
        }
      });

      // Find images that were removed
      const removedImages = Array.from(uploadedImages).filter(img => !currentImages.has(img));
      
      // Delete removed images from server
      removedImages.forEach(async (filename) => {
        try {
          await deleteImage(filename);
          setUploadedImages(prev => {
            const next = new Set(prev);
            next.delete(filename);
            return next;
          });
        } catch (error) {
          console.error('Error deleting image:', error);
        }
      });
    },
  });

  useEffect(() => {
    const loadContent = async () => {
      setLoading(true);
      try {
        const data: DashboardContentData = await getContent();
        if (editor && data.content) {
          editor.commands.setContent(data.content);
          
          // Extract existing image filenames from server URLs
          const images = new Set<string>();
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = data.content;
          const imgTags = tempDiv.querySelectorAll('img');
          
          imgTags.forEach(img => {
            const src = img.getAttribute('src');
            if (src && src.startsWith('http://localhost:3000/uploads/dashboard-images/')) {
              const filename = src.split('/').pop();
              if (filename) {
                images.add(filename);
              }
            }
          });
          
          setUploadedImages(images);
        }
      } catch (error) {
        console.error('Error loading content:', error);
        message.error('Error al cargar el contenido');
      } finally {
        setLoading(false);
      }
    };
    loadContent();
  }, [editor]);

  const handleImageUpload = useCallback(async (file: File) => {
    setIsUploading(true);
    try {
      // Read file as data URL first
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Show placeholder with data URL
      if (editor) {
        editor.chain().focus().setImage({ src: dataUrl }).run();
      }

      // Upload to server
      const { url, filename } = await uploadImage(file);
      
      // Replace data URL with server URL
      if (editor) {
        const currentContent = editor.getHTML();
        const updatedContent = currentContent.replace(`src="${dataUrl}"`, `src="${url}"`);
        editor.commands.setContent(updatedContent);
      }
      
      setUploadedImages(prev => new Set(prev).add(filename));
      message.success('Imagen subida exitosamente');
    } catch (error) {
      console.error('Error uploading image:', error);
      message.error('Error al subir la imagen');
      // Revert: remove the data URL image
      if (editor) {
        editor.chain().focus().undo().run();
      }
    } finally {
      setIsUploading(false);
    }
    return false; // Prevent default upload behavior
  }, [editor]);

  const handleSave = async () => {
    if (!editor) return;
    
    setSaving(true);
    try {
      const content = editor.getHTML();
      await updateContent(content);
      message.success('Contenido guardado exitosamente');
      onSaved?.();
    } catch (error) {
      console.error('Error saving content:', error);
      message.error('Error al guardar el contenido');
    } finally {
      setSaving(false);
    }
  };

  const addLink = useCallback(() => {
    if (!editor) return;
    const url = window.prompt('Ingrese la URL:');
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  }, [editor]);

  if (!editor) {
    return <div>Cargando editor...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
        {/* Toolbar */}
        <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b border-slate-200">
          <Space>
            <Button
              icon={<UndoOutlined />}
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().undo()}
              size="small"
            />
            <Button
              icon={<RedoOutlined />}
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().redo()}
              size="small"
            />
          </Space>
          
          <div className="w-px h-6 bg-slate-300 mx-2" />
          
          <Space>
            <Button
              icon={<BoldOutlined />}
              onClick={() => editor.chain().focus().toggleBold().run()}
              type={editor.isActive('bold') ? 'primary' : 'default'}
              size="small"
            />
            <Button
              icon={<ItalicOutlined />}
              onClick={() => editor.chain().focus().toggleItalic().run()}
              type={editor.isActive('italic') ? 'primary' : 'default'}
              size="small"
            />
            <Button
              icon={<UnderlineOutlined />}
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              type={editor.isActive('underline') ? 'primary' : 'default'}
              size="small"
            />
          </Space>

          <div className="w-px h-6 bg-slate-300 mx-2" />

          <Space>
            <Select
              defaultValue="16px"
              size="small"
              style={{ width: 100 }}
              onChange={(value) => {
                editor.chain().focus().setMark('textStyle', { fontSize: value }).run();
              }}
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
              onChange={(e) => {
                editor.chain().focus().setColor(e.target.value).run();
              }}
              value={editor.getAttributes('textStyle').color || '#000000'}
              style={{ width: 32, height: 32, cursor: 'pointer', border: '1px solid #d9d9d9', borderRadius: 4 }}
            />
          </Space>
          
          <div className="w-px h-6 bg-slate-300 mx-2" />
          
          <Space>
            <Button
              icon={<UnorderedListOutlined />}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              type={editor.isActive('bulletList') ? 'primary' : 'default'}
              size="small"
            />
            <Button
              icon={<OrderedListOutlined />}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              type={editor.isActive('orderedList') ? 'primary' : 'default'}
              size="small"
            />
          </Space>
          
          <div className="w-px h-6 bg-slate-300 mx-2" />
          
          <Space>
            <Button
              icon={<AlignLeftOutlined />}
              onClick={() => editor.chain().focus().setTextAlign('left').run()}
              type={editor.isActive({ textAlign: 'left' }) ? 'primary' : 'default'}
              size="small"
            />
            <Button
              icon={<AlignCenterOutlined />}
              onClick={() => editor.chain().focus().setTextAlign('center').run()}
              type={editor.isActive({ textAlign: 'center' }) ? 'primary' : 'default'}
              size="small"
            />
            <Button
              icon={<AlignRightOutlined />}
              onClick={() => editor.chain().focus().setTextAlign('right').run()}
              type={editor.isActive({ textAlign: 'right' }) ? 'primary' : 'default'}
              size="small"
            />
          </Space>
          
          <div className="w-px h-6 bg-slate-300 mx-2" />
          
          <Space>
            <Button
              icon={<LinkOutlined />}
              onClick={addLink}
              type={editor.isActive('link') ? 'primary' : 'default'}
              size="small"
            />
            <Upload
              accept="image/*"
              showUploadList={false}
              beforeUpload={handleImageUpload}
            >
              <Button icon={<PictureOutlined />} size="small">
                Imagen
              </Button>
            </Upload>
          </Space>
        </div>

        {/* Editor */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <span>Cargando...</span>
          </div>
        ) : (
          <EditorContent editor={editor} />
        )}
      </div>

      {/* Save button */}
      <div className="flex justify-end">
        <Button
          type="primary"
          onClick={handleSave}
          loading={saving}
          size="large"
          className="rounded-2xl"
        >
          Guardar Cambios
        </Button>
      </div>
    </div>
  );
};

export default DashboardEditor;
