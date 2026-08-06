import React, { useState } from 'react';
import { Card, Button, Input, Collapse, Space, Tag, Popconfirm, Modal, Checkbox } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';

interface ThematicContentData {
  id: number;
  title: string;
  order: number;
  learnings?: ExpectedLearningData[];
}

interface ExpectedLearningData {
  id: number;
  description: string;
  order: number;
}

interface ThematicComponentData {
  id: number;
  title: string;
  order: number;
  contents?: ThematicContentData[];
}

interface ContentTabProps {
  thematicComponents: ThematicComponentData[];
  isBlocked: boolean;
  onCreateComponent: (title: string) => void;
  onUpdateComponent: (id: number, title: string) => void;
  onDeleteComponent: (id: number) => void;
  onCreateContent: (componentId: number, title: string) => void;
  onUpdateContent: (contentId: number, title: string) => void;
  onDeleteContent: (contentId: number) => void;
  onCreateLearning: (contentIds: number[], description: string) => void;
  onDeleteLearning: (learningId: number) => void;
}

const ContentTab: React.FC<ContentTabProps> = ({
  thematicComponents,
  isBlocked,
  onCreateComponent,
  onUpdateComponent,
  onDeleteComponent,
  onCreateContent,
  onUpdateContent,
  onDeleteContent,
  onCreateLearning,
  onDeleteLearning,
}) => {
  const [newComponentTitle, setNewComponentTitle] = useState('');
  const [editingComponentId, setEditingComponentId] = useState<number | null>(null);
  const [editingComponentTitle, setEditingComponentTitle] = useState('');
  const [newContentForComponent, setNewContentForComponent] = useState<number | null>(null);
  const [newContentTitle, setNewContentTitle] = useState('');
  const [editingContentId, setEditingContentId] = useState<number | null>(null);
  const [editingContentTitle, setEditingContentTitle] = useState('');
  const [showLearningModal, setShowLearningModal] = useState(false);
  const [newLearningDesc, setNewLearningDesc] = useState('');
  const [selectedContentIds, setSelectedContentIds] = useState<number[]>([]);

  const handleAddComponent = () => {
    if (!newComponentTitle.trim()) return;
    onCreateComponent(newComponentTitle.trim());
    setNewComponentTitle('');
  };

  const handleSaveComponentEdit = () => {
    if (editingComponentId !== null && editingComponentTitle.trim()) {
      onUpdateComponent(editingComponentId, editingComponentTitle.trim());
    }
    setEditingComponentId(null);
    setEditingComponentTitle('');
  };

  const handleAddContent = (componentId: number) => {
    if (!newContentTitle.trim()) return;
    onCreateContent(componentId, newContentTitle.trim());
    setNewContentTitle('');
    setNewContentForComponent(null);
  };

  const handleSaveContentEdit = () => {
    if (editingContentId !== null && editingContentTitle.trim()) {
      onUpdateContent(editingContentId, editingContentTitle.trim());
    }
    setEditingContentId(null);
    setEditingContentTitle('');
  };

  const handleAddLearning = () => {
    if (!newLearningDesc.trim() || selectedContentIds.length === 0) return;
    onCreateLearning(selectedContentIds, newLearningDesc.trim());
    setNewLearningDesc('');
    setSelectedContentIds([]);
    setShowLearningModal(false);
  };

  const allContents = thematicComponents.flatMap(comp =>
    (comp.contents || []).map(c => ({ ...c, componentTitle: comp.title }))
  );

  if (thematicComponents.length === 0 && !isBlocked) {
    return (
      <div>
        <Card style={{ textAlign: 'center', padding: '32px 0', backgroundColor: 'var(--color-input-bg)', border: 'none' }}>
          <div style={{ marginBottom: 16 }}>
            <span style={{ fontSize: 16, fontWeight: 600 }}>No hay componentes temáticos creados</span>
            <p style={{ color: '#666', marginTop: 4 }}>Crea el primer componente temático para este lapso.</p>
          </div>
        </Card>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <Input
            placeholder="Título del componente temático"
            value={newComponentTitle}
            onChange={e => setNewComponentTitle(e.target.value)}
            onPressEnter={handleAddComponent}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAddComponent}>
            Crear
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Collapse
        accordion={false}
        items={thematicComponents.map((comp, idx) => ({
          key: comp.id,
          label: (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
              <Tag color="blue">{idx + 1}</Tag>
              {editingComponentId === comp.id ? (
                <Space>
                  <Input
                    size="small"
                    value={editingComponentTitle}
                    onChange={e => setEditingComponentTitle(e.target.value)}
                    onPressEnter={handleSaveComponentEdit}
                    style={{ width: 300 }}
                  />
                  <Button size="small" icon={<CheckOutlined />} onClick={handleSaveComponentEdit} />
                  <Button size="small" icon={<CloseOutlined />} onClick={() => setEditingComponentId(null)} />
                </Space>
              ) : (
                <span style={{ fontWeight: 600 }}>{comp.title}</span>
              )}
            </div>
          ),
          extra: !isBlocked && editingComponentId !== comp.id && (
            <Space onClick={e => e.stopPropagation()}>
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() => {
                  setEditingComponentId(comp.id);
                  setEditingComponentTitle(comp.title);
                }}
              />
              <Popconfirm
                title="¿Eliminar este componente y todo su contenido?"
                onConfirm={() => onDeleteComponent(comp.id)}
              >
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </Space>
          ),
          children: (
            <div style={{ paddingLeft: 24 }}>
              {comp.contents?.map((content, cIdx) => (
                <div key={content.id} style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Tag color="cyan">{cIdx + 1}</Tag>
                    {editingContentId === content.id ? (
                      <Space>
                        <Input
                          size="small"
                          value={editingContentTitle}
                          onChange={e => setEditingContentTitle(e.target.value)}
                          onPressEnter={handleSaveContentEdit}
                          style={{ width: 300 }}
                        />
                        <Button size="small" icon={<CheckOutlined />} onClick={handleSaveContentEdit} />
                        <Button size="small" icon={<CloseOutlined />} onClick={() => setEditingContentId(null)} />
                      </Space>
                    ) : (
                      <span style={{ fontWeight: 500 }}>{content.title}</span>
                    )}
                    {!isBlocked && editingContentId !== content.id && (
                      <Space>
                        <Button
                          size="small"
                          type="text"
                          icon={<EditOutlined />}
                          onClick={() => {
                            setEditingContentId(content.id);
                            setEditingContentTitle(content.title);
                          }}
                        />
                        <Popconfirm
                          title="¿Eliminar este contenido?"
                          onConfirm={() => onDeleteContent(content.id)}
                        >
                          <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                        </Popconfirm>
                      </Space>
                    )}
                  </div>
                </div>
              ))}
              {!isBlocked && (
                <div style={{ marginLeft: 24 }}>
              {newContentForComponent === comp.id ? (
                <Space>
                  <Input
                    size="small"
                    placeholder="Título del contenido"
                    value={newContentTitle}
                    onChange={e => setNewContentTitle(e.target.value)}
                    onPressEnter={() => handleAddContent(comp.id)}
                    style={{ width: 300 }}
                  />
                  <Button size="small" icon={<CheckOutlined />} onClick={() => handleAddContent(comp.id)} />
                  <Button size="small" icon={<CloseOutlined />} onClick={() => setNewContentForComponent(null)} />
                </Space>
              ) : (
                <Button
                  size="small"
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={() => setNewContentForComponent(comp.id)}
                >
                  Agregar contenido
                </Button>
              )}
                </div>
              )}
            </div>
          ),
        }))}
      />

      {!isBlocked && (
        <div style={{ display: 'flex', gap: 8, marginTop: 16, alignItems: 'center' }}>
          <Input
            placeholder="Nuevo componente temático"
            value={newComponentTitle}
            onChange={e => setNewComponentTitle(e.target.value)}
            onPressEnter={handleAddComponent}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAddComponent}>
            Agregar
          </Button>
          {allContents.length > 0 && (
            <Button icon={<PlusOutlined />} onClick={() => setShowLearningModal(true)}>
              Aprendizaje Esperado
            </Button>
          )}
        </div>
      )}

      <Modal
        title="Nuevo Aprendizaje Esperado"
        open={showLearningModal}
        onCancel={() => setShowLearningModal(false)}
        onOk={handleAddLearning}
        okText="Crear"
        cancelText="Cancelar"
        okButtonProps={{ disabled: !newLearningDesc.trim() || selectedContentIds.length === 0 }}
      >
        <Input.TextArea
          placeholder="Escribe el aprendizaje esperado..."
          value={newLearningDesc}
          onChange={e => setNewLearningDesc(e.target.value)}
          rows={3}
          style={{ marginBottom: 16 }}
        />
        <div style={{ marginBottom: 8, fontWeight: 600 }}>Asociar a contenidos:</div>
        <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid #d9d9d9', borderRadius: 6, padding: 8 }}>
          {thematicComponents.map(comp => (
            <div key={comp.id} style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 600, fontSize: 12, color: '#666', marginBottom: 4 }}>
                {comp.title}
              </div>
              {(comp.contents || []).map(content => (
                <div key={content.id} style={{ paddingLeft: 16 }}>
                  <Checkbox
                    checked={selectedContentIds.includes(content.id)}
                    onChange={e => {
                      if (e.target.checked) {
                        setSelectedContentIds([...selectedContentIds, content.id]);
                      } else {
                        setSelectedContentIds(selectedContentIds.filter(id => id !== content.id));
                      }
                    }}
                  >
                    {content.title}
                  </Checkbox>
                </div>
              ))}
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
};

export default ContentTab;
