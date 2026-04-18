import React, { useState, useRef, useCallback } from 'react';
import { Button, Space, message } from 'antd';
import { PlusOutlined, PictureOutlined, SaveOutlined } from '@ant-design/icons';
import { getContent, updateContent, uploadImage } from '@/services/dashboardContentService';

interface DashboardElement {
  id: string;
  type: 'text' | 'image';
  x: number;
  y: number;
  width: number;
  height: number;
  content?: string;
  imageUrl?: string;
}

interface DashboardEditorManualProps {
  onSaved?: () => void;
}

const DashboardEditorManual: React.FC<DashboardEditorManualProps> = ({ onSaved }) => {
  const [elements, setElements] = useState<DashboardElement[]>([]);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizingHandle, setResizingHandle] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0, elementX: 0, elementY: 0 });
  
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load content on mount
  React.useEffect(() => {
    const loadContent = async () => {
      setLoading(true);
      try {
        const data = await getContent();
        if (data.content) {
          const parsed = JSON.parse(data.content);
          setElements(parsed);
        }
      } catch (error) {
        console.error('Error loading content:', error);
      } finally {
        setLoading(false);
      }
    };
    loadContent();
  }, []);

  const handleAddText = () => {
    const newElement: DashboardElement = {
      id: `text-${Date.now()}`,
      type: 'text',
      x: 50,
      y: 50,
      width: 200,
      height: 100,
      content: 'Texto editable',
    };
    setElements([...elements, newElement]);
    setSelectedElement(newElement.id);
  };

  const handleAddImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
    // Reset input value to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleImageUpload = async (file: File) => {
    try {
      const { url } = await uploadImage(file);
      const newElement: DashboardElement = {
        id: `image-${Date.now()}`,
        type: 'image',
        x: 50,
        y: 50,
        width: 200,
        height: 200,
        imageUrl: url,
      };
      setElements([...elements, newElement]);
      setSelectedElement(newElement.id);
      message.success('Imagen agregada exitosamente');
    } catch (error) {
      console.error('Error uploading image:', error);
      message.error('Error al subir la imagen');
    }
  };

  const handleMouseDown = (e: React.MouseEvent, elementId: string, handle?: string) => {
    e.stopPropagation();
    setSelectedElement(elementId);
    
    const element = elements.find(el => el.id === elementId);
    if (!element) return;

    if (handle) {
      setIsResizing(true);
      setResizingHandle(handle);
      setResizeStart({
        x: e.clientX,
        y: e.clientY,
        width: element.width,
        height: element.height,
        elementX: element.x,
        elementY: element.y,
      });
    } else {
      setIsDragging(true);
      setDragOffset({
        x: e.clientX - element.x,
        y: e.clientY - element.y,
      });
    }
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging && selectedElement) {
      setElements(elements.map(el => {
        if (el.id === selectedElement) {
          return {
            ...el,
            x: e.clientX - dragOffset.x,
            y: e.clientY - dragOffset.y,
          };
        }
        return el;
      }));
    }

    if (isResizing && selectedElement && resizingHandle) {
      requestAnimationFrame(() => {
        const deltaX = e.clientX - resizeStart.x;
        const deltaY = e.clientY - resizeStart.y;
        
        setElements(elements.map(el => {
          if (el.id === selectedElement) {
            const newElement = { ...el };
            
            if (resizingHandle.includes('right')) {
              newElement.width = Math.max(20, resizeStart.width + deltaX);
            }
            if (resizingHandle.includes('bottom')) {
              newElement.height = Math.max(20, resizeStart.height + deltaY);
            }
            if (resizingHandle.includes('left')) {
              const newWidth = Math.max(20, resizeStart.width - deltaX);
              newElement.x = resizeStart.elementX + (resizeStart.width - newWidth);
              newElement.width = newWidth;
            }
            if (resizingHandle.includes('top')) {
              const newHeight = Math.max(20, resizeStart.height - deltaY);
              newElement.y = resizeStart.elementY + (resizeStart.height - newHeight);
              newElement.height = newHeight;
            }
            
            return newElement;
          }
          return el;
        }));
      });
    }
  }, [isDragging, isResizing, selectedElement, resizingHandle, dragOffset, elements, resizeStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(false);
    setResizingHandle(null);
  }, []);

  React.useEffect(() => {
    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, handleMouseMove, handleMouseUp]);

  const handleContentChange = (elementId: string, content: string) => {
    setElements(elements.map(el => {
      if (el.id === elementId) {
        return { ...el, content };
      }
      return el;
    }));
  };

  const handleDelete = () => {
    if (selectedElement) {
      setElements(elements.filter(el => el.id !== selectedElement));
      setSelectedElement(null);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateContent(JSON.stringify(elements));
      message.success('Contenido guardado exitosamente');
      onSaved?.();
    } catch (error) {
      console.error('Error saving content:', error);
      message.error('Error al guardar el contenido');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div>Cargando...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-gray-100 p-4 rounded">
        <Space>
          <Button icon={<PlusOutlined />} onClick={handleAddText}>
            Agregar Texto
          </Button>
          <Button icon={<PictureOutlined />} onClick={handleAddImageClick}>
            Agregar Imagen
          </Button>
          {selectedElement && (
            <Button danger onClick={handleDelete}>
              Eliminar
            </Button>
          )}
        </Space>
        <Button 
          type="primary" 
          icon={<SaveOutlined />} 
          onClick={handleSave}
          loading={saving}
        >
          Guardar
        </Button>
      </div>

      <div 
        ref={containerRef}
        className="relative bg-white border-2 border-dashed border-gray-300 min-h-[600px] overflow-hidden"
        style={{ position: 'relative' }}
        onClick={() => setSelectedElement(null)}
      >
        {elements.map((element) => (
          <div
            key={element.id}
            className="absolute"
            style={{
              left: element.x,
              top: element.y,
              width: element.width,
              height: element.height,
              border: selectedElement === element.id ? '2px solid #1890ff' : '1px dashed #ccc',
              cursor: isDragging ? 'grabbing' : 'grab',
            }}
            onMouseDown={(e) => handleMouseDown(e, element.id)}
            onClick={(e) => e.stopPropagation()}
          >
            {element.type === 'text' ? (
              <div
                contentEditable
                suppressContentEditableWarning
                className="w-full h-full p-2 outline-none"
                style={{ minHeight: '100%' }}
                onBlur={(e) => handleContentChange(element.id, e.currentTarget.innerHTML)}
              >
                {element.content}
              </div>
            ) : (
              <img
                src={element.imageUrl}
                alt="Dashboard element"
                className="w-full h-full object-fill pointer-events-none"
                draggable={false}
              />
            )}

            {/* Resize handles */}
            {selectedElement === element.id && (
              <>
                <div
                  className="absolute w-3 h-3 bg-blue-500 rounded-full cursor-nw-resize"
                  style={{ top: -6, left: -6 }}
                  onMouseDown={(e) => handleMouseDown(e, element.id, 'top-left')}
                />
                <div
                  className="absolute w-3 h-3 bg-blue-500 rounded-full cursor-ne-resize"
                  style={{ top: -6, right: -6 }}
                  onMouseDown={(e) => handleMouseDown(e, element.id, 'top-right')}
                />
                <div
                  className="absolute w-3 h-3 bg-blue-500 rounded-full cursor-sw-resize"
                  style={{ bottom: -6, left: -6 }}
                  onMouseDown={(e) => handleMouseDown(e, element.id, 'bottom-left')}
                />
                <div
                  className="absolute w-3 h-3 bg-blue-500 rounded-full cursor-se-resize"
                  style={{ bottom: -6, right: -6 }}
                  onMouseDown={(e) => handleMouseDown(e, element.id, 'bottom-right')}
                />
              </>
            )}
          </div>
        ))}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </div>
  );
};

export default DashboardEditorManual;
