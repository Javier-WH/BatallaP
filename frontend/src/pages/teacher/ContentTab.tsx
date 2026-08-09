import React, { useState } from 'react';
import { Card, Button, Input, Collapse, Space, Tag, Popconfirm, message, Alert } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, CheckOutlined, CloseOutlined, HolderOutlined } from '@ant-design/icons';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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
  onReorderContents: (componentId: number, contentIds: number[]) => void;
  onReorderComponents: (componentIds: number[]) => void;
}

interface SortableCollapseItemProps {
  component: ThematicComponentData;
  index: number;
  isBlocked: boolean;
  editingComponentId: number | null;
  editingComponentTitle: string;
  openKeys: number[];
  onOpenChange: (keys: number[]) => void;
  onEditStart: (comp: ThematicComponentData) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
  onEditTitleChange: (value: string) => void;
  onDelete: (componentId: number) => void;
  renderChildren: (comp: ThematicComponentData, idx: number) => React.ReactNode;
}

const SortableCollapseItem: React.FC<SortableCollapseItemProps> = ({
  component,
  index,
  isBlocked,
  editingComponentId,
  editingComponentTitle,
  openKeys,
  onOpenChange,
  onEditStart,
  onEditSave,
  onEditCancel,
  onEditTitleChange,
  onDelete,
  renderChildren,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: component.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <Collapse
        accordion={false}
        className="content-collapse"
        activeKey={openKeys}
        onChange={keys => onOpenChange(keys as unknown as number[])}
        items={[{
          key: component.id,
          label: (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
              {!isBlocked && (
                <HolderOutlined
                  style={{ cursor: 'grab', color: '#999' }}
                  {...listeners}
                />
              )}
              <Tag color="blue">{index + 1}.</Tag>
              {editingComponentId === component.id ? (
                <Space>
                  <Input
                    size="small"
                    value={editingComponentTitle}
                    onChange={e => onEditTitleChange(e.target.value)}
                    onPressEnter={onEditSave}
                    style={{ width: 300 }}
                  />
                  <Button size="small" icon={<CheckOutlined />} onClick={onEditSave} />
                  <Button size="small" icon={<CloseOutlined />} onClick={onEditCancel} />
                </Space>
              ) : (
                <span style={{ fontWeight: 600 }}>{component.title}</span>
              )}
            </div>
          ),
          extra: !isBlocked && editingComponentId !== component.id && (
            <Space onClick={e => e.stopPropagation()}>
              <Button
                size="small"
                type="text"
                icon={<EditOutlined />}
                onClick={() => onEditStart(component)}
              />
              <Popconfirm
                title="¿Eliminar este componente y todo su contenido?"
                onConfirm={() => onDelete(component.id)}
              >
                <Button size="small" type="text" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </Space>
          ),
          children: renderChildren(component, index),
        }]}
      />
    </div>
  );
};

interface SortableContentItemProps {
  content: ThematicContentData;
  index: number;
  componentIndex: number;
  isBlocked: boolean;
  editingContentId: number | null;
  editingContentTitle: string;
  onEditStart: (content: ThematicContentData) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
  onEditTitleChange: (value: string) => void;
  onDelete: (contentId: number) => void;
}

const SortableContentItem: React.FC<SortableContentItemProps> = ({
  content,
  index,
  componentIndex,
  isBlocked,
  editingContentId,
  editingContentTitle,
  onEditStart,
  onEditSave,
  onEditCancel,
  onEditTitleChange,
  onDelete,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: content.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    marginBottom: 16,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        {!isBlocked && (
          <HolderOutlined
            style={{ cursor: 'grab', color: '#999' }}
            {...listeners}
          />
        )}
        <Tag color="cyan">{componentIndex + 1}.{index + 1}</Tag>
        {editingContentId === content.id ? (
          <Space>
            <Input
              size="small"
              value={editingContentTitle}
              onChange={e => onEditTitleChange(e.target.value)}
              onPressEnter={onEditSave}
              style={{ width: 300 }}
            />
            <Button size="small" icon={<CheckOutlined />} onClick={onEditSave} />
            <Button size="small" icon={<CloseOutlined />} onClick={onEditCancel} />
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
              onClick={() => onEditStart(content)}
            />
            <Popconfirm
              title="¿Eliminar este contenido?"
              onConfirm={() => onDelete(content.id)}
            >
              <Button size="small" type="text" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Space>
        )}
      </div>
    </div>
  );
};

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
  onReorderContents,
  onReorderComponents,
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
  const [localContentOrder, setLocalContentOrder] = useState<Record<number, number[]>>({});
  const [localComponentOrder, setLocalComponentOrder] = useState<number[]>([]);
  const [openComponentKeys, setOpenComponentKeys] = useState<number[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Build effective components considering local reorder state
  const effectiveComponents: ThematicComponentData[] = (() => {
    if (localComponentOrder.length === 0) return thematicComponents;
    const byId = new Map(thematicComponents.map(c => [c.id, c]));
    const ordered: ThematicComponentData[] = [];
    localComponentOrder.forEach(id => {
      const c = byId.get(id);
      if (c) ordered.push(c);
    });
    thematicComponents.forEach(c => {
      if (!localComponentOrder.includes(c.id)) ordered.push(c);
    });
    return ordered;
  })();

  // Build effective contents per component considering local reorder state
  const getEffectiveContents = (comp: ThematicComponentData): ThematicContentData[] => {
    const orderMap = localContentOrder[comp.id];
    if (!orderMap) return comp.contents || [];
    const byId = new Map((comp.contents || []).map(c => [c.id, c]));
    const ordered: ThematicContentData[] = [];
    orderMap.forEach(id => {
      const c = byId.get(id);
      if (c) ordered.push(c);
    });
    // Append any new contents not in the local order yet
    (comp.contents || []).forEach(c => {
      if (!orderMap.includes(c.id)) ordered.push(c);
    });
    return ordered;
  };

  const handleContentDragEnd = (componentId: number, event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const comp = thematicComponents.find(c => c.id === componentId);
    if (!comp) return;

    const contents = getEffectiveContents(comp);
    const oldIndex = contents.findIndex(c => c.id === active.id);
    const newIndex = contents.findIndex(c => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(contents, oldIndex, newIndex);
    const newOrder = reordered.map(c => c.id);
    setLocalContentOrder(prev => ({ ...prev, [componentId]: newOrder }));
    onReorderContents(componentId, newOrder);
  };

  const handleComponentDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = effectiveComponents.findIndex(c => c.id === active.id);
    const newIndex = effectiveComponents.findIndex(c => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(effectiveComponents, oldIndex, newIndex);
    const newOrder = reordered.map(c => c.id);
    setLocalComponentOrder(newOrder);
    onReorderComponents(newOrder);
  };

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
    const descTrimmed = newLearningDesc.trim();
    if (allLearnings.some(l => l.description.toLowerCase() === descTrimmed.toLowerCase())) {
      message.warning('Ya existe un aprendizaje esperado con esa descripción.');
      return;
    }
    onCreateLearning(selectedContentIds, descTrimmed);
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

  const contentsWithoutLearning = (() => {
    const learningContentIds = new Set<number>();
    allLearnings.forEach(l => l.associations.forEach(a => {
      const comp = thematicComponents.find(c => c.title === a.componentTitle);
      const content = comp?.contents?.find(ct => ct.title === a.contentTitle);
      if (content) learningContentIds.add(content.id);
    }));
    const missing: string[] = [];
    thematicComponents.forEach((comp, compIdx) => {
      (comp.contents || []).forEach((content, contentIdx) => {
        if (!learningContentIds.has(content.id)) {
          missing.push(`${compIdx + 1}.${contentIdx + 1}`);
        }
      });
    });
    return missing;
  })();

  const handleSaveLearningEdit = () => {
    if (editingLearningId !== null && editingLearningDesc.trim()) {
      const descTrimmed = editingLearningDesc.trim();
      if (allLearnings.some(l => l.id !== editingLearningId && l.description.toLowerCase() === descTrimmed.toLowerCase())) {
        message.warning('Ya existe un aprendizaje esperado con esa descripción.');
        return;
      }
      onUpdateLearning(editingLearningId, descTrimmed, editingLearningContentIds);
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
      <style>{`
        .content-collapse .ant-collapse-header {
          background-color: color-mix(in srgb, var(--color-accent) 6%, var(--color-content-bg));
          border-radius: 12px !important;
          margin-bottom: 4px;
          transition: background-color 0.2s;
        }
        .content-collapse .ant-collapse-header:hover {
          background-color: color-mix(in srgb, var(--color-accent) 10%, var(--color-content-bg));
        }
        .content-collapse .ant-collapse-content-box {
          background-color: var(--color-content-bg) !important;
        }
        .content-section {
          border: 1px solid color-mix(in srgb, var(--color-accent) 22%, var(--color-content-bg));
          border-radius: 14px;
          padding: 18px;
          background: var(--color-content-bg);
        }
        .content-section + .content-section {
          margin-top: 22px;
        }
        .content-section-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 16px;
        }
        .content-section-heading {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 0;
          font-size: 18px;
          font-weight: 700;
          color: var(--color-text-main);
        }
        .content-section-heading::before {
          content: '';
          width: 4px;
          height: 24px;
          border-radius: 4px;
          background: var(--color-accent);
        }
        .content-section-description {
          margin: 4px 0 0 14px;
          color: var(--color-text-muted);
          font-size: 12px;
        }
        .learning-section {
          border-color: color-mix(in srgb, var(--color-brand-secondary) 35%, var(--color-content-bg));
          background: color-mix(in srgb, var(--color-brand-secondary) 3%, var(--color-content-bg));
        }
        .learning-section .content-section-heading::before {
          background: var(--color-brand-secondary);
        }
      `}</style>
      <div className="content-section thematic-section">
        <div className="content-section-header">
          <div>
            <h3 className="content-section-heading">Componentes temáticos</h3>
            <p className="content-section-description">Organiza los contenidos que desarrollarás durante el lapso.</p>
          </div>
          <Tag color="blue">{thematicComponents.length} {thematicComponents.length === 1 ? 'componente' : 'componentes'}</Tag>
        </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleComponentDragEnd}
      >
        <SortableContext
          items={effectiveComponents.map(c => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {effectiveComponents.map((comp, idx) => (
            <SortableCollapseItem
              key={comp.id}
              component={comp}
              index={idx}
              isBlocked={isBlocked}
              editingComponentId={editingComponentId}
              editingComponentTitle={editingComponentTitle}
              openKeys={openComponentKeys}
              onOpenChange={setOpenComponentKeys}
              onEditStart={(c) => {
                setEditingComponentId(c.id);
                setEditingComponentTitle(c.title);
              }}
              onEditSave={handleSaveComponentEdit}
              onEditCancel={() => setEditingComponentId(null)}
              onEditTitleChange={setEditingComponentTitle}
              onDelete={onDeleteComponent}
              renderChildren={(comp, idx) => (
                <div style={{ paddingLeft: 24 }}>
                  {(() => {
                    const effectiveContents = getEffectiveContents(comp);
                    if (effectiveContents.length === 0) return null;
                    return (
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={(event) => handleContentDragEnd(comp.id, event)}
                      >
                        <SortableContext
                          items={effectiveContents.map(c => c.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {effectiveContents.map((content, cIdx) => (
                            <SortableContentItem
                              key={content.id}
                              content={content}
                              index={cIdx}
                              componentIndex={idx}
                              isBlocked={isBlocked}
                              editingContentId={editingContentId}
                              editingContentTitle={editingContentTitle}
                              onEditStart={(c) => {
                                setEditingContentId(c.id);
                                setEditingContentTitle(c.title);
                              }}
                              onEditSave={handleSaveContentEdit}
                              onEditCancel={() => setEditingContentId(null)}
                              onEditTitleChange={setEditingContentTitle}
                              onDelete={onDeleteContent}
                            />
                          ))}
                        </SortableContext>
                      </DndContext>
                    );
                  })()}
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
              )}
            />
          ))}
        </SortableContext>
      </DndContext>

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
      </div>

      <div className="content-section learning-section">
          <div className="content-section-header">
            <div>
              <h3 className="content-section-heading">Aprendizajes esperados</h3>
              <p className="content-section-description">Define los logros que deben alcanzar los estudiantes y relaciónalos con tus contenidos.</p>
            </div>
            <Tag color="cyan">{allLearnings.length} {allLearnings.length === 1 ? 'aprendizaje' : 'aprendizajes'}</Tag>
          </div>
          {allLearnings.length === 0 && !isBlocked && allContents.length === 0 && (
            <div style={{ textAlign: 'center', padding: '16px 0', color: '#999', fontSize: 12 }}>
              Primero crea contenidos temáticos para poder asociar aprendizajes.
            </div>
          )}
          {allLearnings.length > 0 && contentsWithoutLearning.length > 0 && (
            <Alert
              type="error"
              showIcon
              style={{ marginBottom: 12, fontSize: 12 }}
              message={`Contenidos sin aprendizaje esperado: ${contentsWithoutLearning.join(', ')}`}
            />
          )}
          {allLearnings.length > 0 && (
          <Collapse
            accordion={false}
            className="content-collapse"
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
    </div>
  );
};

export default ContentTab;
