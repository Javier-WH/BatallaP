import React, { useState, useRef, useCallback } from 'react';
import { Button, Space, message, Popover, Slider, Select } from 'antd';
import { PlusOutlined, PictureOutlined, SaveOutlined, SettingOutlined, BoldOutlined, ItalicOutlined, UnderlineOutlined } from '@ant-design/icons';
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
  styles?: {
    fontWeight?: string;
    fontStyle?: string;
    textDecoration?: string;
    color?: string;
    backgroundColor?: string;
    fontSize?: string;
    filter?: string;
    border?: string;
    borderRadius?: string;
    opacity?: number;
  };
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
  const [styleMenuVisible, setStyleMenuVisible] = useState(false);
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  
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
          if (Array.isArray(parsed)) {
            setElements(parsed);
          } else {
            setElements(parsed.elements || []);
            setBackgroundColor(parsed.backgroundColor || '#ffffff');
          }
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

  const handleStyleMenuClick = (e: React.MouseEvent, elementId: string) => {
    e.stopPropagation();
    setSelectedElement(elementId);
    setStyleMenuVisible(true);
  };

  const handleStyleChange = (styleKey: string, styleValue: string | number) => {
    if (selectedElement) {
      setElements(elements.map(el => {
        if (el.id === selectedElement) {
          return {
            ...el,
            styles: {
              ...el.styles,
              [styleKey]: styleValue,
            },
          };
        }
        return el;
      }));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const content = {
        elements,
        backgroundColor,
      };
      await updateContent(JSON.stringify(content));
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
    <div className="space-y-4 dashboard-editor">
      <div className="flex items-center justify-between bg-gray-100 p-4 rounded dashboard-editor-toolbar">
        <Space wrap>
          <Button icon={<PlusOutlined />} onClick={handleAddText}>
            Agregar Texto
          </Button>
          <Button icon={<PictureOutlined />} onClick={handleAddImageClick}>
            Agregar Imagen
          </Button>
          <Space.Compact>
            <span className="flex items-center px-2">Color de Fondo:</span>
            <input
              type="color"
              value={backgroundColor}
              onChange={(e) => setBackgroundColor(e.target.value)}
              className="w-8 h-8 cursor-pointer border rounded"
            />
          </Space.Compact>
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
        className="relative border-2 border-dashed border-gray-300 min-h-[600px] overflow-hidden"
        style={{ position: 'relative', minHeight: 'calc(100vh - 200px)', backgroundColor }}
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
                style={{ 
                  minHeight: '100%',
                  fontWeight: element.styles?.fontWeight,
                  fontStyle: element.styles?.fontStyle,
                  textDecoration: element.styles?.textDecoration,
                  color: element.styles?.color,
                  backgroundColor: element.styles?.backgroundColor,
                  fontSize: element.styles?.fontSize,
                }}
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
                style={{
                  filter: element.styles?.filter,
                  border: element.styles?.border,
                  borderRadius: element.styles?.borderRadius,
                  opacity: element.styles?.opacity,
                }}
              />
            )}

            {/* Resize handles */}
            {selectedElement === element.id && (
              <>
                <Popover
                  content={
                    <div className="space-y-3 w-64">
                      {element.type === 'text' ? (
                        <>
                          <div>
                            <label className="block text-xs font-bold mb-1">Formato</label>
                            <Space>
                              <Button 
                                size="small" 
                                icon={<BoldOutlined />}
                                onClick={() => handleStyleChange('fontWeight', element.styles?.fontWeight === 'bold' ? 'normal' : 'bold')}
                                type={element.styles?.fontWeight === 'bold' ? 'primary' : 'default'}
                              />
                              <Button 
                                size="small" 
                                icon={<ItalicOutlined />}
                                onClick={() => handleStyleChange('fontStyle', element.styles?.fontStyle === 'italic' ? 'normal' : 'italic')}
                                type={element.styles?.fontStyle === 'italic' ? 'primary' : 'default'}
                              />
                              <Button 
                                size="small" 
                                icon={<UnderlineOutlined />}
                                onClick={() => handleStyleChange('textDecoration', element.styles?.textDecoration === 'underline' ? 'none' : 'underline')}
                                type={element.styles?.textDecoration === 'underline' ? 'primary' : 'default'}
                              />
                            </Space>
                          </div>
                          <div>
                            <label className="block text-xs font-bold mb-1">Color de Texto</label>
                            <input
                              type="color"
                              value={element.styles?.color || '#000000'}
                              onChange={(e) => handleStyleChange('color', e.target.value)}
                              className="w-full h-8 cursor-pointer"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold mb-1">Color de Fondo</label>
                            <div className="flex items-center space-x-2">
                              <input
                                type="color"
                                value={element.styles?.backgroundColor === 'transparent' ? '#ffffff' : (element.styles?.backgroundColor || '#ffffff')}
                                onChange={(e) => handleStyleChange('backgroundColor', e.target.value)}
                                className="w-8 h-8 cursor-pointer border rounded"
                                disabled={element.styles?.backgroundColor === 'transparent'}
                              />
                              <label className="flex items-center space-x-1">
                                <input
                                  type="checkbox"
                                  checked={element.styles?.backgroundColor === 'transparent'}
                                  onChange={(e) => handleStyleChange('backgroundColor', e.target.checked ? 'transparent' : '#ffffff')}
                                />
                                <span className="text-xs">Transparente</span>
                              </label>
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-bold mb-1">Tamaño de Fuente</label>
                            <Select
                              size="small"
                              value={element.styles?.fontSize || '16px'}
                              onChange={(value) => handleStyleChange('fontSize', value)}
                              className="w-full"
                              options={[
                                { value: '12px', label: '12px' },
                                { value: '14px', label: '14px' },
                                { value: '16px', label: '16px' },
                                { value: '18px', label: '18px' },
                                { value: '24px', label: '24px' },
                                { value: '32px', label: '32px' },
                                { value: '48px', label: '48px' },
                              ]}
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <label className="block text-xs font-bold mb-1">Brillo (Gamma)</label>
                            <Slider
                              min={0.1}
                              max={2}
                              step={0.1}
                              value={parseFloat(element.styles?.filter?.match(/brightness\(([^)]+)\)/)?.[1] || '1')}
                              onChange={(value) => handleStyleChange('filter', `brightness(${value})`)}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold mb-1">Contraste</label>
                            <Slider
                              min={0.1}
                              max={2}
                              step={0.1}
                              value={parseFloat(element.styles?.filter?.match(/contrast\(([^)]+)\)/)?.[1] || '1')}
                              onChange={(value) => handleStyleChange('filter', `${element.styles?.filter?.replace(/contrast\([^)]+\)/, '')} contrast(${value})`)}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold mb-1">Saturación</label>
                            <Slider
                              min={0}
                              max={2}
                              step={0.1}
                              value={parseFloat(element.styles?.filter?.match(/saturate\(([^)]+)\)/)?.[1] || '1')}
                              onChange={(value) => handleStyleChange('filter', `${element.styles?.filter?.replace(/saturate\([^)]+\)/, '')} saturate(${value})`)}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold mb-1">Escala de Grises</label>
                            <Slider
                              min={0}
                              max={1}
                              step={0.1}
                              value={parseFloat(element.styles?.filter?.match(/grayscale\(([^)]+)\)/)?.[1] || '0')}
                              onChange={(value) => handleStyleChange('filter', `${element.styles?.filter?.replace(/grayscale\([^)]+\)/, '')} grayscale(${value})`)}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold mb-1">Opacidad</label>
                            <Slider
                              min={0}
                              max={1}
                              step={0.1}
                              value={element.styles?.opacity || 1}
                              onChange={(value) => handleStyleChange('opacity', value)}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold mb-1">Borde</label>
                            <Select
                              size="small"
                              value={element.styles?.border || 'none'}
                              onChange={(value) => handleStyleChange('border', value)}
                              className="w-full"
                              options={[
                                { value: 'none', label: 'Ninguno' },
                                { value: '1px solid #000', label: '1px Negro' },
                                { value: '2px solid #000', label: '2px Negro' },
                                { value: '1px solid #fff', label: '1px Blanco' },
                                { value: '2px solid #fff', label: '2px Blanco' },
                                { value: '2px dashed #000', label: '2px Negro Discontinuo' },
                              ]}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold mb-1">Radio de Borde</label>
                            <Select
                              size="small"
                              value={element.styles?.borderRadius || '0px'}
                              onChange={(value) => handleStyleChange('borderRadius', value)}
                              className="w-full"
                              options={[
                                { value: '0px', label: '0px' },
                                { value: '4px', label: '4px' },
                                { value: '8px', label: '8px' },
                                { value: '12px', label: '12px' },
                                { value: '16px', label: '16px' },
                                { value: '50%', label: '50%' },
                              ]}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  }
                  trigger="click"
                  open={styleMenuVisible && selectedElement === element.id}
                  onOpenChange={(open) => setStyleMenuVisible(open)}
                >
                  <Button
                    size="small"
                    icon={<SettingOutlined />}
                    style={{ position: 'absolute', top: '-30px', left: '50%', transform: 'translateX(-50%)' }}
                    onClick={(e) => handleStyleMenuClick(e, element.id)}
                  />
                </Popover>
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
