import React, { useState } from 'react';
import { Card, Button, Input, Collapse, Space, Tag, Popconfirm } from 'antd';
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
  onUpdateLearning: (learningId: number, description: string, contentIds?: number[]) => void;
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
  onUpdateLearning,
  onDeleteLearning,
}) => {
  const [newComponentTitle, setNewComponentTitle] = useState('');
  const [editingComponentId, setEditingComponentId] = useState<number | null>(null);
  const [editingComponentTitle, setEditingComponentTitle] = useState('');
  const [newContentForComponent, setNewContentForComponent] = useState<number | null>(null);
  const [newContentTitle, setNewContentTitle] = useState('');
  const [editingContentId, setEditingContentId] = useState<number | null>(null);
  const [editingContentTitle, setEditingContentTitle] = useState('');
  const [newLearningDesc, setNewLearningDesc] = useState('');
  const [selectedContentIds, setSelectedContentIds] = useState<number[]>([]);
  const [addingLearning, setAddingLearning] = useState(false);
  const [editingLearningId, setEditingLearningId] = useState<number | null>(null);
  const [editingLearningDesc, setEditingLearningDesc] = useState('');
  const [editingLearningContentIds, setEditingLearningContentIds] = useState<number[]>([]);
  const [openLearningKeys, setOpenLearningKeys] = useState<number[]>([]);
  const [addingComponent, setAddingComponent] = useState(false);

  const handleAddComponent = () => {
    if (!newComponentTitle.trim()) return;
    onCreateComponent(newComponentTitle.trim());
    setNewComponentTitle('');
    setAddingComponent(false);
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
    setAddingLearning(false);
  };

  const allContents = thematicComponents.flatMap(comp =>
    (comp.contents || []).map(c => ({ ...c, componentTitle: comp.title }))
  );

  const allLearnings = (() => {
    const map = new Map<number, { id: number; description: string; order: number; associations: { contentTitle: string; componentTitle: string; number: string }[] }>();
    thematicComponents.forEach((comp, compIdx) => {
      (comp.contents || []).forEach((content, contentIdx) => {
        (content.learnings || []).forEach(learning => {
          const number = `${compIdx + 1}.${contentIdx + 1}`;
          const existing = map.get(learning.id);
          if (existing) {
            existing.associations.push({ contentTitle: content.title, componentTitle: comp.title, number });
          } else {
            map.set(learning.id, {
              id: learning.id,
              description: learning.description,
              order: learning.order,
              associations: [{ contentTitle: content.title, componentTitle: comp.title, number }],
            });
          }
        });
      });
    });
    return Array.from(map.values()).sort((a, b) => a.order - b.order || a.id - b.id);
  })();

  const handleSaveLearningEdit = () => {
    if (editingLearningId !== null && editingLearningDesc.trim()) {
      onUpdateLearning(editingLearningId, editingLearningDesc.trim(), editingLearningContentIds);
    }
    setEditingLearningId(null);
    setEditingLearningDesc('');
    setEditingLearningContentIds([]);
  };

  if (thematicComponents.length === 0 && !isBlocked && !addingComponent) {
    return (
      <div>
        <Card style={{ textAlign: 'center', padding: '32px 0', backgroundColor: 'var(--color-input-bg)', border: 'none' }}>
          <div style={{ marginBottom: 16 }}>
            <span style={{ fontSize: 16, fontWeight: 600 }}>No hay componentes temáticos creados</span>
            <p style={{ color: '#666', marginTop: 4 }}>Crea el primer componente temático para este lapso.</p>
          </div>
          <Button type="dashed" icon={<PlusOutlined />} onClick={() => setAddingComponent(true)}>
            Agregar componente temático
          </Button>
        </Card>
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
              <Tag color="blue">{idx + 1}.</Tag>
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
                    <Tag color="cyan">{idx + 1}.{cIdx + 1}</Tag>
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

      {!isBlocked && !addingComponent && !addingLearning && (
        <div style={{ display: 'flex', gap: 8, marginTop: 16, alignItems: 'center' }}>
          <Button type="dashed" icon={<PlusOutlined />} onClick={() => setAddingComponent(true)}>
            Agregar componente temático
          </Button>
        </div>
      )}

      {addingComponent && (
        <div style={{ display: 'flex', gap: 8, marginTop: 16, alignItems: 'center' }}>
          <Input
            autoFocus
            placeholder="Título del componente temático"
            value={newComponentTitle}
            onChange={e => setNewComponentTitle(e.target.value)}
            onPressEnter={handleAddComponent}
            style={{ width: 300 }}
          />
          <Button type="primary" icon={<CheckOutlined />} onClick={handleAddComponent} />
          <Button icon={<CloseOutlined />} onClick={() => { setAddingComponent(false); setNewComponentTitle(''); }} />
        </div>
      )}

      {allLearnings.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Aprendizajes Esperados</div>
          <Collapse
            accordion={false}
            activeKey={openLearningKeys}
            onChange={keys => setOpenLearningKeys(keys as unknown as number[])}
            items={allLearnings.map((learning) => ({
              key: learning.id,
              label: (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                  {editingLearningId === learning.id ? (
                    <Space>
                      <Input
                        size="small"
                        value={editingLearningDesc}
                        onChange={e => setEditingLearningDesc(e.target.value)}
                        onPressEnter={handleSaveLearningEdit}
                        style={{ width: 350 }}
                      />
                      <Button size="small" icon={<CheckOutlined />} onClick={handleSaveLearningEdit} />
                      <Button size="small" icon={<CloseOutlined />} onClick={() => setEditingLearningId(null)} />
                    </Space>
                  ) : (
                    <span style={{ fontWeight: 500 }}>{learning.description}</span>
                  )}
                </div>
              ),
              extra: !isBlocked && editingLearningId !== learning.id && (
                <Space onClick={e => e.stopPropagation()}>
                  <Button
                    size="small"
                    type="text"
                    icon={<EditOutlined />}
                    onClick={() => {
                      setEditingLearningId(learning.id);
                      setEditingLearningDesc(learning.description);
                      setEditingLearningContentIds(learning.associations.map(a => {
                        const comp = thematicComponents.find(c => c.title === a.componentTitle);
                        const content = comp?.contents?.find(ct => ct.title === a.contentTitle);
                        return content?.id;
                      }).filter((id): id is number => id !== undefined));
                      if (!openLearningKeys.includes(learning.id)) {
                        setOpenLearningKeys([...openLearningKeys, learning.id]);
                      }
                    }}
                  />
                  <Popconfirm
                    title="¿Eliminar este aprendizaje?"
                    onConfirm={() => onDeleteLearning(learning.id)}
                  >
                    <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              ),
              children: (() => {
                if (editingLearningId === learning.id) {
                  return (
                    <div style={{ maxHeight: 350, overflowY: 'auto' }}>
                      <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 13 }}>Asociar a contenidos:</div>
                      <div style={{ marginBottom: 8, fontSize: 11, color: '#999' }}>Selecciona los contenidos a asociar. Los azules están asociados.</div>
                      {thematicComponents.map((comp, compIdx) => (
                        <div key={comp.id} style={{ marginBottom: 8 }}>
                          <div style={{ fontWeight: 600, fontSize: 11, color: '#666', marginBottom: 4 }}>
                            <Tag color="blue" style={{ fontSize: 11 }}>{compIdx + 1}.</Tag> {comp.title}
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingLeft: 16 }}>
                            {(comp.contents || []).map((content, contentIdx) => {
                              const selected = editingLearningContentIds.includes(content.id);
                              return (
                                <Button
                                  key={content.id}
                                  size="small"
                                  type={selected ? 'primary' : 'default'}
                                  onClick={() => {
                                    if (selected) {
                                      setEditingLearningContentIds(editingLearningContentIds.filter(id => id !== content.id));
                                    } else {
                                      setEditingLearningContentIds([...editingLearningContentIds, content.id]);
                                    }
                                  }}
                                >
                                  {selected && <CheckOutlined />} {compIdx + 1}.{contentIdx + 1} {content.title}
                                </Button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                }
                const grouped: Record<string, typeof learning.associations> = {};
                learning.associations.forEach(assoc => {
                  if (!grouped[assoc.componentTitle]) grouped[assoc.componentTitle] = [];
                  grouped[assoc.componentTitle].push(assoc);
                });
                return (
                  <div>
                    {Object.entries(grouped).map(([compTitle, assocs]) => (
                      <div key={compTitle} style={{ marginBottom: 8 }}>
                        <div style={{ fontWeight: 600, fontSize: 11, color: '#666', marginBottom: 4 }}>
                          <Tag color="blue" style={{ fontSize: 12 }}>{compTitle}</Tag>
                        </div>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', paddingLeft: 16 }}>
                          {assocs.map((assoc, aIdx) => (
                            <div key={aIdx} style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                              <Tag color="cyan" style={{ fontSize: 12 }}>{assoc.number}</Tag>
                              <Tag style={{ fontSize: 12 }}>{assoc.contentTitle}</Tag>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })(),
            }))}
          />
        </div>
      )}

      {!isBlocked && !addingLearning && (
        <div style={{ display: 'flex', gap: 8, marginTop: 16, alignItems: 'center' }}>
          {allContents.length > 0 && (
            <Button type="dashed" icon={<PlusOutlined />} onClick={() => setAddingLearning(true)}>
              Aprendizaje Esperado
            </Button>
          )}
        </div>
      )}

      {addingLearning && (
        <div style={{ marginTop: 16, padding: 16, border: '1px solid #d9d9d9', borderRadius: 8, background: 'var(--color-input-bg, #fafafa)' }}>
          <Input.TextArea
            autoFocus
            placeholder="Escribe el aprendizaje esperado..."
            value={newLearningDesc}
            onChange={e => setNewLearningDesc(e.target.value)}
            rows={2}
            style={{ marginBottom: 12 }}
          />
          <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 13 }}>Asociar a contenidos:</div>
          <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 12 }}>
            {thematicComponents.map((comp, compIdx) => (
              <div key={comp.id} style={{ marginBottom: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 11, color: '#666', marginBottom: 4 }}>
                  <Tag color="blue" style={{ fontSize: 11 }}>{compIdx + 1}.</Tag> {comp.title}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingLeft: 16 }}>
                  {(comp.contents || []).map((content, contentIdx) => {
                    const selected = selectedContentIds.includes(content.id);
                    return (
                      <Button
                        key={content.id}
                        size="small"
                        type={selected ? 'primary' : 'default'}
                        onClick={() => {
                          if (selected) {
                            setSelectedContentIds(selectedContentIds.filter(id => id !== content.id));
                          } else {
                            setSelectedContentIds([...selectedContentIds, content.id]);
                          }
                        }}
                      >
                        {selected && <CheckOutlined />} {compIdx + 1}.{contentIdx + 1} {content.title}
                      </Button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <Space>
            <Button type="primary" icon={<CheckOutlined />} onClick={handleAddLearning} disabled={!newLearningDesc.trim() || selectedContentIds.length === 0}>
              Crear
            </Button>
            <Button icon={<CloseOutlined />} onClick={() => { setAddingLearning(false); setNewLearningDesc(''); setSelectedContentIds([]); }}>
              Cancelar
            </Button>
          </Space>
        </div>
      )}
    </div>
  );
};

export default ContentTab;
