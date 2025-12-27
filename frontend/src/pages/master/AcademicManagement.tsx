/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, createContext, useContext } from 'react';
import {
  Card,
  Tabs,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Tag,
  message,
  Select,
  Space,
  Row,
  Col,
  Popconfirm,
  Checkbox,
  Collapse
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  BookOutlined,
  AppstoreOutlined,
  CheckCircleOutlined,
  HolderOutlined,
  UserAddOutlined
} from '@ant-design/icons';
import api from '@/services/api';
import PeriodClosurePanel from '@/pages/admin/components/PeriodClosurePanel';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Context for passing drag listeners to the drag handle cell
interface RowContextProps {
  setActivatorNodeRef?: (element: HTMLElement | null) => void;
  listeners?: Record<string, unknown>;
}
const RowContext = createContext<RowContextProps>({});

interface Period {
  id: number;
  period: string;
  name: string;
  isActive?: boolean;
}

interface BaseCatalogItem {
  id: number;
  name: string;
}

interface Grade extends BaseCatalogItem {
  isDiversified: boolean;
  order?: number | null;
}

type Section = BaseCatalogItem;

type SubjectGroup = BaseCatalogItem;

interface Subject extends BaseCatalogItem {
  subjectGroupId?: number | null;
  subjectGroup?: SubjectGroup | null;
}

type Specialization = BaseCatalogItem;

interface PeriodGradeStructureItem {
  id: number;
  gradeId: number;
  grade?: Grade;
  specialization?: Specialization | null;
  sections?: Section[];
  subjects?: Subject[];
}

type CatalogType = 'grade' | 'section' | 'subject' | 'specialization';

type CatalogItem = Grade | Section | Subject | Specialization;

const { TabPane } = Tabs;
const { Panel } = Collapse;

interface SortableRowProps {
  children: React.ReactNode;
  'data-row-key': number;
}

const SortableRow: React.FC<SortableRowProps> = (props) => {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: props['data-row-key'],
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    backgroundColor: isDragging ? '#fafafa' : undefined,
  };

  return (
    <RowContext.Provider value={{ setActivatorNodeRef, listeners }}>
      <tr {...props} ref={setNodeRef} style={style} {...attributes}>
        {props.children}
      </tr>
    </RowContext.Provider>
  );
};

const DragHandle: React.FC = () => {
  const { setActivatorNodeRef, listeners } = useContext(RowContext);
  return (
    <HolderOutlined
      ref={setActivatorNodeRef}
      style={{ cursor: 'grab', color: '#999' }}
      {...listeners}
    />
  );
};

interface SortableSubjectItemProps {
  subject: Subject;
  periodGradeId: number;
  onRemove: (periodGradeId: number, subjectId: number) => void;
  onAssignTeacher?: (periodGradeId: number, subjectId: number) => void;
}

const SortableSubjectItem: React.FC<SortableSubjectItemProps> = ({ subject, periodGradeId, onRemove, onAssignTeacher }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `${periodGradeId}-${subject.id}`,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 13,
    cursor: 'move',
    opacity: isDragging ? 0.5 : 1,
    backgroundColor: isDragging ? '#f0f0f0' : 'white',
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid #f0f0f0',
    marginBottom: '8px',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <Space>
        <HolderOutlined style={{ color: '#999', cursor: 'grab' }} {...listeners} />
        <BookOutlined />
        <span>{subject.name}</span>
        {subject.subjectGroup && (
          <Tag color="blue" style={{ borderRadius: 12 }}>
            {subject.subjectGroup.name}
          </Tag>
        )}
      </Space>
      <Space>
        {onAssignTeacher && (
          <UserAddOutlined
            style={{ color: '#1890ff', cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation();
              onAssignTeacher(periodGradeId, subject.id);
            }}
          />
        )}
        <DeleteOutlined
          style={{ color: '#ff4d4f', cursor: 'pointer' }}
          onClick={(e) => {
            e.stopPropagation();
            onRemove(periodGradeId, subject.id);
          }}
        />
      </Space>
    </div>
  );
};

const AcademicManagement: React.FC = () => {
  // State
  const [periods, setPeriods] = useState<Period[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectGroups, setSubjectGroups] = useState<SubjectGroup[]>([]);
  const [specializations, setSpecializations] = useState<Specialization[]>([]);
  const [activePeriodId, setActivePeriodId] = useState<number | null>(null); // For structure view
  const [structure, setStructure] = useState<PeriodGradeStructureItem[]>([]);



  // UI State
  const [isPeriodModalVisible, setIsPeriodModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  // Forms
  const [periodForm] = Form.useForm();
  const [gradeCatalogForm] = Form.useForm();
  const [sectionCatalogForm] = Form.useForm();
  const [subjectCatalogForm] = Form.useForm();
  const [subjectGroupForm] = Form.useForm();
  const [specializationCatalogForm] = Form.useForm();

  const [editPeriodVisible, setEditPeriodVisible] = useState(false);
  const [editPeriodForm] = Form.useForm();
  const [editingPeriod, setEditingPeriod] = useState<Period | null>(null);

  const [deletePeriodVisible, setDeletePeriodVisible] = useState(false);
  const [periodToDelete, setPeriodToDelete] = useState<Period | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const [specializationModalVisible, setSpecializationModalVisible] = useState(false);
  
  // Estados para asignación de profesor
  const [teacherAssignModalVisible, setTeacherAssignModalVisible] = useState(false);
  const [selectedSubjectForTeacher, setSelectedSubjectForTeacher] = useState<{periodGradeId: number, subjectId: number, periodGradeSubjectId?: number} | null>(null);
  const [availableSections, setAvailableSections] = useState<Section[]>([]);
  const [availableTeachers, setAvailableTeachers] = useState<{id: number, name: string}[]>([]);
  const [teacherAssignForm] = Form.useForm();
  const [selectedGradeForStructure, setSelectedGradeForStructure] = useState<Grade | null>(null);
  const [selectedSpecializationId, setSelectedSpecializationId] = useState<number | null>(null);


  const [editSubjectGroupVisible, setEditSubjectGroupVisible] = useState(false);
  const [editSubjectGroupForm] = Form.useForm();
  const [editingSubjectGroup, setEditingSubjectGroup] = useState<SubjectGroup | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [pRes, gRes, sRes, subRes, specRes, sgRes] = await Promise.all([
        api.get<Period[]>('/academic/periods'),
        api.get<Grade[]>('/academic/grades'),
        api.get<Section[]>('/academic/sections'),
        api.get<Subject[]>('/academic/subjects'),
        api.get<Specialization[]>('/academic/specializations'),
        api.get<SubjectGroup[]>('/academic/subject-groups'),
      ]);
      const periodsData = pRes.data;

      setPeriods(periodsData);
      setGrades(gRes.data);
      setSections(sRes.data);
      setSubjects(subRes.data);
      setSpecializations(specRes.data);
      setSubjectGroups(sgRes.data);

      // Always sync activePeriodId with current active period (or first available)
      if (periodsData.length > 0) {
        const active = periodsData.find((p) => p.isActive) ?? periodsData[0];
        setActivePeriodId(active.id);
      } else {
        setActivePeriodId(null);
      }

    } catch (error) {
      console.error(error);
      message.error('Error cargando datos');
    } finally {
      setLoading(false);
    }
  };

  const openEditSubjectGroup = (group: SubjectGroup) => {
    setEditingSubjectGroup(group);
    editSubjectGroupForm.setFieldsValue({ name: group.name });
    setEditSubjectGroupVisible(true);
  };

  const handleEditSubjectGroup = async (values: { name: string }) => {
    if (!editingSubjectGroup) return;
    try {
      const payload = { name: (values.name || '').trim() };
      await api.put(`/academic/subject-groups/${editingSubjectGroup.id}`, payload);
      message.success('Grupo actualizado');
      setEditSubjectGroupVisible(false);
      setEditingSubjectGroup(null);
      editSubjectGroupForm.resetFields();
      await fetchAll();
      await fetchStructure();
    } catch (error) {
      console.error(error);
      const err = error as { response?: { data?: { error?: string } } };
      message.error(err.response?.data?.error || 'Error actualizando grupo');
    }
  };

  const openEditPeriod = (period: Period) => {
    setEditingPeriod(period);
    editPeriodForm.setFieldsValue({ period: period.period, name: period.name });
    setEditPeriodVisible(true);
  };

  const handleEditPeriod = async (values: { name: string }) => {
    if (!editingPeriod) return;
    try {
      await api.put(`/academic/periods/${editingPeriod.id}`, {
        period: editingPeriod.period,
        name: values.name,
      });
      message.success('Periodo actualizado');
      setEditPeriodVisible(false);
      setEditingPeriod(null);
      fetchAll();
    } catch (error) {
      console.error(error);
      message.error('Error actualizando periodo');
    }
  };

  const openDeletePeriod = (period: Period) => {
    setPeriodToDelete(period);
    setDeleteConfirmText('');
    setDeletePeriodVisible(true);
  };

  const handleDeletePeriod = async (id: number) => {
    try {
      await api.delete(`/academic/periods/${id}`);
      message.success('Periodo eliminado');
      if (activePeriodId === id) {
        setActivePeriodId(null);
        setStructure([]);
      }
      fetchAll();
      // Cerrar el modal después de eliminar exitosamente
      setDeletePeriodVisible(false);
      setPeriodToDelete(null);
      setDeleteConfirmText('');
    } catch (error) {
      console.error(error);
      message.error('Error eliminando periodo (posiblemente en uso), ' + error);
    }
  };

  const fetchStructure = async () => {
    if (!activePeriodId) return;
    try {
      const res = await api.get<PeriodGradeStructureItem[]>(`/academic/structure/${activePeriodId}`);
      setStructure(res.data);
    } catch (error) {
      console.error(error);
      message.error('Error cargando estructura');
    }
  }

  useEffect(() => {
    fetchAll();
  }, []);

  useEffect(() => {
    fetchStructure();
  }, [activePeriodId]);

  // --- Actions ---

  const handleCreatePeriod = async (values: { period: string; name: string }) => {
    try {
      const { period, name } = values;
      if (periods.some((p) => p.period === period)) {
        message.error('Ese periodo ya existe');
        return;
      }
      await api.post('/academic/periods', { period, name });
      message.success('Periodo creado');
      setIsPeriodModalVisible(false);
      periodForm.resetFields();
      fetchAll();
    } catch (error) {
      console.error(error);
      message.error('Error creando periodo');
    }
  };

  const handleActivatePeriod = async (id: number) => {
    try {
      await api.put(`/academic/periods/${id}/activate`);
      message.success('Periodo activado');
      fetchAll();
    } catch (error) {
      console.error(error);
      message.error('Error activando periodo');
    }
  };

  const handleAddGradeToStructure = async (gradeId: number) => {
    if (!activePeriodId) return message.warning('Seleccione un periodo');

    const grade = grades.find((g) => g.id === gradeId);

    // Si el grado está marcado como diversificado, pedimos mención antes de crear
    if (grade && grade.isDiversified) {
      setSelectedGradeForStructure(grade);
      setSelectedSpecializationId(null);
      setSpecializationModalVisible(true);
      return;
    }

    try {
      await api.post('/academic/structure/period-grade', { schoolPeriodId: activePeriodId, gradeId });
      message.success('Grado agregado al periodo');
      fetchStructure();
    } catch (error) {
      console.error(error);
      message.error('Error agregando grado');
    }
  };

  const handleConfirmDiversifiedGrade = async () => {
    if (!activePeriodId || !selectedGradeForStructure) return;
    if (!selectedSpecializationId) {
      message.warning('Seleccione una especialización');
      return;
    }

    try {
      await api.post('/academic/structure/period-grade', {
        schoolPeriodId: activePeriodId,
        gradeId: selectedGradeForStructure.id,
        specializationId: selectedSpecializationId,
      });
      message.success('Grado diversificado agregado al periodo');
      setSpecializationModalVisible(false);
      setSelectedGradeForStructure(null);
      setSelectedSpecializationId(null);
      fetchStructure();
    } catch (error) {
      console.error(error);
      message.error('Error agregando grado diversificado');
    }
  };

  const handleRemoveGradeFromStructure = async (pgId: number) => {
    try {
      await api.delete(`/academic/structure/period-grade/${pgId}`);
      message.success('Grado eliminado del periodo');
      fetchStructure();
    } catch (error) {
      console.error(error);
      message.error('Error eliminando grado');
    }
  };

  const handleAddSectionToGrade = async (periodGradeId: number, sectionId: number) => {
    try {
      await api.post('/academic/structure/section', { periodGradeId, sectionId });
      message.success('Sección agregada');
      fetchStructure();
    } catch (error) {
      console.error(error);
      message.error('Error agregando sección');
    }
  };

  const handleRemoveSectionFromGrade = async (periodGradeId: number, sectionId: number) => {
    try {
      await api.delete(`/academic/structure/section/${periodGradeId}/${sectionId}`);
      message.success('Sección eliminada del grado');
      fetchStructure();
    } catch (error) {
      console.error(error);
      message.error('Error eliminando sección');
    }
  };

  // Función para abrir el modal de asignación de profesor
  const handleOpenAssignTeacher = async (periodGradeId: number, subjectId: number) => {
    try {
      console.log('Obteniendo PeriodGradeSubject para:', { periodGradeId, subjectId });
      
      // Primero necesitamos obtener el periodGradeSubjectId
      const { data } = await api.get(`/academic/structure/subject/${periodGradeId}/${subjectId}`);
      console.log('Respuesta del endpoint:', data);
      
      const periodGradeSubjectId = data?.id;
      console.log('periodGradeSubjectId obtenido:', periodGradeSubjectId);
      
      if (!periodGradeSubjectId) {
        message.error('No se pudo obtener la información de la materia');
        return;
      }
      
      setSelectedSubjectForTeacher({ 
        periodGradeId, 
        subjectId,
        periodGradeSubjectId 
      });
      
      // Obtener las secciones disponibles para este grado
      const periodGrade = structure.find(pg => pg.id === periodGradeId);
      if (periodGrade && periodGrade.sections) {
        setAvailableSections(periodGrade.sections);
      }
      
      // Obtener profesores disponibles
      interface Teacher {
        id: number;
        firstName: string;
        lastName: string;
        roles?: { name: string }[];
      }
      const { data: teachers } = await api.get<Teacher[]>('/teachers');
      setAvailableTeachers(teachers
        .filter(t => t.roles?.some(r => r.name === 'Teacher'))
        .map((t) => ({ 
          id: t.id, 
          name: `${t.firstName} ${t.lastName}` 
        })));
      
      teacherAssignForm.resetFields();
      setTeacherAssignModalVisible(true);
    } catch (error) {
      console.error(error);
      message.error('Error al cargar datos para asignar profesor');
    }
  };
  
  // Función para asignar profesor
  const handleAssignTeacher = async (values: { teacherId: number, sectionId: number }) => {
    if (!selectedSubjectForTeacher || !selectedSubjectForTeacher.periodGradeSubjectId) return;
    
    try {
      console.log('Enviando datos para asignar profesor:', {
        teacherId: values.teacherId,
        periodGradeSubjectId: selectedSubjectForTeacher.periodGradeSubjectId,
        sectionId: values.sectionId
      });
      
      await api.post('/teachers/assign', {
        teacherId: values.teacherId,
        periodGradeSubjectId: selectedSubjectForTeacher.periodGradeSubjectId,
        sectionId: values.sectionId
      });
      
      message.success('Profesor asignado exitosamente');
      setTeacherAssignModalVisible(false);
      fetchStructure();
    } catch (error: unknown) {
      console.error(error);
      const axiosError = error as { response?: { data?: { message?: string } } };
      const errorMessage = axiosError.response?.data?.message || 'Error al asignar profesor';
      message.error(errorMessage);
    }
  };

  const handleAddSubjectToGrade = async (periodGradeId: number, subjectId: number) => {
    try {
      await api.post('/academic/structure/subject', { periodGradeId, subjectId });
      message.success('Materia agregada');
      fetchStructure();
    } catch (error) {
      console.error(error);
      message.error('Error agregando materia');
    }
  };

  const handleRemoveSubjectFromGrade = async (periodGradeId: number, subjectId: number) => {
    try {
      await api.post('/academic/structure/subject/remove', { periodGradeId, subjectId });
      message.success('Materia removida');
      fetchStructure();
    } catch (error) {
      console.error(error);
      message.error('Error removiendo materia');
    }
  };

  const handleReorderSubjects = async (periodGradeId: number, subjectIds: number[]) => {
    try {
      await api.post('/academic/structure/subject/reorder', { periodGradeId, subjectIds });
    } catch (error) {
      console.error(error);
      message.error('Error guardando el orden de materias');
    }
  };

  const handleSubjectDragEnd = async (event: DragEndEvent, periodGradeId: number) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const activeId = String(active.id).split('-')[1];
    const overId = String(over.id).split('-')[1];

    if (!activeId || !overId) return;

    const activeSubjectId = parseInt(activeId, 10);
    const overSubjectId = parseInt(overId, 10);

    const nextStructure = structure.map((pg) => {
      if (pg.id !== periodGradeId || !pg.subjects) return pg;

      const subjectsCopy = [...pg.subjects];
      const oldIndex = subjectsCopy.findIndex((s) => s.id === activeSubjectId);
      const newIndex = subjectsCopy.findIndex((s) => s.id === overSubjectId);

      if (oldIndex === -1 || newIndex === -1) return pg;

      const reorderedSubjects = arrayMove(subjectsCopy, oldIndex, newIndex);
      return { ...pg, subjects: reorderedSubjects };
    });

    setStructure(nextStructure);

    const updated = nextStructure.find((pg) => pg.id === periodGradeId);
    if (updated?.subjects) {
      const orderedIds = updated.subjects.map((s) => s.id);
      await handleReorderSubjects(periodGradeId, orderedIds);
    }
  };

  const handleReorderGrades = async (gradeIds: number[]) => {
    try {
      await api.post('/academic/grades/reorder', { gradeIds });
      await fetchStructure();
    } catch (error) {
      console.error(error);
      message.error('Error guardando el orden de grados');
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = grades.findIndex((g) => g.id === active.id);
      const newIndex = grades.findIndex((g) => g.id === over.id);

      const newGrades = arrayMove(grades, oldIndex, newIndex);
      setGrades(newGrades);

      const orderedIds = newGrades.map((g) => g.id);
      await handleReorderGrades(orderedIds);
    }
  };

  // --- Columns ---

  const periodColumns = [
    { title: 'Periodo', dataIndex: 'period', key: 'period' },
    { title: 'Nombre', dataIndex: 'name', key: 'name' },
    {
      title: 'Estado',
      key: 'status',
      render: (_: unknown, r: Period) => r.isActive ? <Tag color="green">ACTIVO</Tag> : <Tag>INACTIVO</Tag>
    },
    {
      title: 'Acciones',
      key: 'actions',
      render: (_: unknown, r: Period) => (
        <Space>
          {!r.isActive && (
            <Button type="text" size="small" onClick={() => handleActivatePeriod(r.id)} icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />} />
          )}
          <Button type="text" size="small" onClick={() => openEditPeriod(r)} icon={<EditOutlined />} />
          <Button type="text" size="small" danger onClick={() => openDeletePeriod(r)} icon={<DeleteOutlined />} />
        </Space>
      )
    }
  ];

  // --- Catalog Actions ---

  // State for editing catalogs
  const [editCatalogVisible, setEditCatalogVisible] = useState(false);
  const [editCatalogTarget, setEditCatalogTarget] = useState<{ type: CatalogType; id: number; name: string } | null>(null);
  const [editCatalogForm] = Form.useForm();

  const openEditCatalog = (type: CatalogType, record: CatalogItem) => {
    setEditCatalogTarget({ type, id: record.id, name: record.name });

    if (type === 'grade') {
      const gradeRecord = record as Grade;
      editCatalogForm.setFieldsValue({
        name: gradeRecord.name,
        isDiversified: gradeRecord.isDiversified,
      });
    } else if (type === 'subject') {
      const subjectRecord = record as Subject;
      editCatalogForm.setFieldsValue({
        name: subjectRecord.name,
        subjectGroupId: subjectRecord.subjectGroupId ?? null,
      });
    } else {
      editCatalogForm.setFieldsValue({ name: record.name });
    }
    setEditCatalogVisible(true);
  };

  const handleEditCatalog = async (values: { name: string; isDiversified?: boolean; subjectGroupId?: number | null }) => {
    if (!editCatalogTarget) return;
    try {
      let url = '';
      switch (editCatalogTarget.type) {
        case 'grade': url = '/academic/grades'; break;
        case 'section': url = '/academic/sections'; break;
        case 'subject': url = '/academic/subjects'; break;
        case 'specialization': url = '/academic/specializations'; break;
      }
      // Para grados, enviamos también isDiversified; para el resto solo name
      if (editCatalogTarget.type === 'grade') {
        await api.put(`${url}/${editCatalogTarget.id}`, {
          name: values.name,
          isDiversified: values.isDiversified ?? false,
        });
      } else if (editCatalogTarget.type === 'subject') {
        await api.put(`${url}/${editCatalogTarget.id}`, {
          name: values.name,
          subjectGroupId: values.subjectGroupId ?? null,
        });
      } else {
        await api.put(`${url}/${editCatalogTarget.id}`, { name: values.name });
      }
      message.success('Actualizado exitosamente');
      setEditCatalogVisible(false);
      fetchAll();
    } catch (error) {
      console.error(error);
      message.error('Error actualizando => ' + error);
    }
  };

  const handleDeleteCatalog = async (type: CatalogType, id: number) => {
    try {
      let url = '';
      switch (type) {
        case 'grade': url = '/academic/grades'; break;
        case 'section': url = '/academic/sections'; break;
        case 'subject': url = '/academic/subjects'; break;
        case 'specialization': url = '/academic/specializations'; break;
      }
      await api.delete(`${url}/${id}`);
      message.success('Eliminado exitosamente');
      fetchAll();
    } catch (error) {
      console.error(error);
      const err = error as { response?: { data?: { error?: string } } };
      message.error(err.response?.data?.error || 'Error eliminando (posiblemente en uso)');
    }
  };

  // Columns for Catalogs
  const catalogColumns = (type: CatalogType) => [
    ...(type === 'grade'
      ? [{
          title: '',
          key: 'drag',
          width: 40,
          render: () => <DragHandle />,
        }]
      : []),
    ...(type === 'grade'
      ? [{
          title: '#',
          key: 'index',
          width: 50,
          render: (_: unknown, __: CatalogItem, index: number) => index + 1,
        }]
      : []),
    {
      title: 'Nombre',
      dataIndex: 'name',
      render: (text: string, record: CatalogItem) => {
        if (type === 'grade' && 'isDiversified' in record && (record as Grade).isDiversified) {
          return (
            <Space>
              <span>{text}</span>
              <Tag color="purple" style={{ borderRadius: 12 }}>Diversificado</Tag>
            </Space>
          );
        }
        if (type === 'subject') {
          const subjectRecord = record as Subject;
          if (subjectRecord.subjectGroup) {
            return (
              <Space>
                <span>{text}</span>
                <Tag color="blue" style={{ borderRadius: 12 }}>{subjectRecord.subjectGroup.name}</Tag>
              </Space>
            );
          }
        }
        return text;
      },
    },
    {
      title: 'Acciones',
      key: 'actions',
      width: 100,
      render: (_: unknown, r: CatalogItem) => (
        <Space>
          <Button type="text" icon={<EditOutlined />} onClick={() => openEditCatalog(type, r)} />
          <Popconfirm title="¿Eliminar?" onConfirm={() => handleDeleteCatalog(type, r.id)}>
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    }
  ];

  // --- Render ---

  const activePeriod = periods.find((p) => p.isActive);

  const orderedStructure = [...structure].sort((a, b) => {
    const aOrder = a.grade?.order ?? Number.MAX_SAFE_INTEGER;
    const bOrder = b.grade?.order ?? Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) return aOrder - bOrder;
    const aName = a.grade?.name ?? '';
    const bName = b.grade?.name ?? '';
    return aName.localeCompare(bName, 'es');
  });

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <Card title="Gestión Académica">
        {activePeriod && (
          <div style={{ marginBottom: 12 }}>
            <Tag color="blue">
              Periodo activo: <strong>{activePeriod.period}</strong> - {activePeriod.name}
            </Tag>
          </div>
        )}
        <Tabs defaultActiveKey="1">
          {/* PERIODS TAB */}
          <TabPane tab="Periodos Escolares" key="1">
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsPeriodModalVisible(true)} style={{ marginBottom: 16 }}>
              Nuevo Periodo
            </Button>
            <Table
              dataSource={periods}
              columns={periodColumns}
              rowKey="id"
              loading={loading}
              rowClassName={(record: Period) => (record.isActive ? 'active-period-row' : '')}
            />
          </TabPane>

          {/* STRUCTURE TAB */}
          <TabPane tab="Estructura (Grados y Secciones)" key="2">
            {activePeriodId && (
              <>
                <Card size="small" title="Agregar Grado a este Periodo" style={{ marginBottom: 16 }}>
                  <Space>
                    <Select
                      key={`add-grade-${activePeriodId}-${orderedStructure.map((pg) => pg.id).join('-')}`}
                      placeholder="Seleccionar Grado del Catálogo"
                      style={{ width: 250 }}
                      onChange={handleAddGradeToStructure}
                      options={grades.map((g) => ({ label: g.name, value: g.id }))}
                    />
                  </Space>
                </Card>

                <Collapse defaultActiveKey={orderedStructure.map((item) => String(item.id))}>
                  {orderedStructure.map((item: PeriodGradeStructureItem) => (
                    <Panel
                      key={item.id}
                      header={`${item.grade?.name ?? ''}${item.specialization ? ` - ${item.specialization.name}` : ''}`}
                      extra={
                        <Popconfirm title="Eliminar grado y todo su contenido?" onConfirm={() => handleRemoveGradeFromStructure(item.id)}>
                          <Button type="text" danger icon={<DeleteOutlined />} onClick={(e) => e.stopPropagation()} />
                        </Popconfirm>
                      }
                    >
                      <Row gutter={16}>
                        <Col span={12}>
                          <div style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>Agregar Sección:</div>
                            <Select
                              key={`add-section-${item.id}-${(item.sections || []).map((s) => s.id).join('-')}`}
                              size="small"
                              placeholder="+ Sección"
                              style={{ width: '100%' }}
                              onChange={(val) => handleAddSectionToGrade(item.id, val)}
                              options={sections
                                .filter((s) => !item.sections?.some((is: Section) => is.id === s.id))
                                .map((s) => ({ label: s.name, value: s.id }))
                              }
                            />
                          </div>

                          <h4>Secciones:</h4>
                          <Space direction="vertical" style={{ width: '100%' }}>
                            {item.sections?.map((sec: Section) => (
                              <div key={sec.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                                <Space><AppstoreOutlined style={{ color: '#1890ff' }} /> {sec.name}</Space>
                                <DeleteOutlined
                                  style={{ color: '#ff4d4f', cursor: 'pointer' }}
                                  onClick={() => handleRemoveSectionFromGrade(item.id, sec.id)}
                                />
                              </div>
                            ))}
                            {(!item.sections || item.sections.length === 0) && <span style={{ color: '#ccc' }}>Sin secciones</span>}
                          </Space>
                        </Col>

                        <Col span={12} style={{ borderLeft: '1px solid #f0f0f0' }}>
                          <div style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>Agregar Materia:</div>
                            <Select
                              key={`add-subject-${item.id}-${(item.subjects || []).map((s) => s.id).join('-')}`}
                              size="small"
                              placeholder="+ Materia"
                              style={{ width: '100%' }}
                              onChange={(val) => handleAddSubjectToGrade(item.id, val)}
                              options={subjects
                                .filter((s) => !item.subjects?.some((is: Subject) => is.id === s.id))
                                .map((s) => {
                                  const label = s.subjectGroup
                                    ? `${s.name} - ${s.subjectGroup.name}`
                                    : s.name;
                                  return { label, value: s.id };
                                })
                              }
                            />
                          </div>

                          <h4>Materias:</h4>
                          {item.subjects && item.subjects.length > 0 ? (
                            <DndContext
                              sensors={sensors}
                              collisionDetection={closestCenter}
                              onDragEnd={(event) => handleSubjectDragEnd(event, item.id)}
                            >
                              <SortableContext
                                items={item.subjects.map((s) => `${item.id}-${s.id}`)}
                                strategy={verticalListSortingStrategy}
                              >
                                <div style={{ width: '100%' }}>
                                  {item.subjects.map((sub: Subject) => (
                                    <SortableSubjectItem
                                      key={sub.id}
                                      subject={sub}
                                      periodGradeId={item.id}
                                      onRemove={handleRemoveSubjectFromGrade}
                                      onAssignTeacher={handleOpenAssignTeacher}
                                    />
                                  ))}
                                </div>
                              </SortableContext>
                            </DndContext>
                          ) : (
                            <span style={{ color: '#ccc' }}>Sin materias</span>
                          )}
                        </Col>
                      </Row>
                    </Panel>
                  ))}
                </Collapse>
              </>
            )}
          </TabPane>

          {/* CATALOGS TAB */}
          <TabPane tab="Catálogos Globales" key="3">
            <Collapse defaultActiveKey={['subjectGroups', 'grades']}>
              <Panel header="Grupos de Materias" key="subjectGroups">
                <Form
                  form={subjectGroupForm}
                  layout="inline"
                  onFinish={async (v) => {
                    try {
                      const payload = { name: (v.name || '').trim() };
                      await api.post('/academic/subject-groups', payload);
                      message.success('Grupo creado');
                      subjectGroupForm.resetFields();
                      fetchAll();
                    } catch (error) {
                      console.error(error);
                      const err = error as { response?: { data?: { error?: string } } };
                      message.error(err.response?.data?.error || 'Error creando grupo');
                    }
                  }}
                >
                  <Form.Item name="name" rules={[{ required: true }]} style={{ width: 220 }}>
                    <Input placeholder="Nombre del grupo" />
                  </Form.Item>
                  <Button type="primary" htmlType="submit" icon={<PlusOutlined />} />
                </Form>

                <Table
                  dataSource={subjectGroups}
                  rowKey="id"
                  size="small"
                  style={{ marginTop: 16 }}
                  columns={[
                    { title: 'Nombre', dataIndex: 'name' },
                    {
                      title: 'Acciones',
                      key: 'actions',
                      width: 100,
                      render: (_: unknown, record: SubjectGroup) => (
                        <Space>
                          <Button type="text" icon={<EditOutlined />} onClick={() => openEditSubjectGroup(record)} />
                          <Popconfirm
                            title="¿Eliminar grupo?"
                            onConfirm={async () => {
                              try {
                                await api.delete(`/academic/subject-groups/${record.id}`);
                                message.success('Grupo eliminado');
                                await fetchAll();
                                await fetchStructure();
                              } catch (error) {
                                console.error(error);
                                message.error('Error eliminando grupo (posiblemente en uso)');
                              }
                            }}
                          >
                            <Button type="text" danger icon={<DeleteOutlined />} />
                          </Popconfirm>
                        </Space>
                      ),
                    },
                  ]}
                  pagination={{ pageSize: 5 }}
                />
              </Panel>

              <Panel header="Especializaciones / Menciones" key="specializations">
                <Form
                  form={specializationCatalogForm}
                  layout="inline"
                  onFinish={async (v) => {
                    await api.post('/academic/specializations', v);
                    message.success('Especialización creada');
                    specializationCatalogForm.resetFields();
                    fetchAll();
                  }}
                >
                  <Form.Item name="name" rules={[{ required: true }]} style={{ width: 260 }}>
                    <Input placeholder="Ej. Ciencias, Humanidades" />
                  </Form.Item>
                  <Button type="primary" htmlType="submit" icon={<PlusOutlined />} />
                </Form>
                <Table
                  dataSource={specializations}
                  rowKey="id"
                  size="small"
                  style={{ marginTop: 16 }}
                  columns={catalogColumns('specialization')}
                  pagination={{ pageSize: 5 }}
                />
              </Panel>

              <Panel header="Grados" key="grades">
                <Form form={gradeCatalogForm} layout="inline" onFinish={async (v) => {
                  await api.post('/academic/grades', v);
                  message.success('Grado creado');
                  gradeCatalogForm.resetFields();
                  fetchAll();
                }}>
                  <Form.Item name="name" rules={[{ required: true }]} style={{ width: 220 }}><Input placeholder="Nombre" /></Form.Item>
                  <Button type="primary" htmlType="submit" icon={<PlusOutlined />} />
                </Form>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={grades.map((g) => g.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <Table
                      dataSource={grades}
                      rowKey="id"
                      size="small"
                      style={{ marginTop: 16 }}
                      columns={catalogColumns('grade')}
                      pagination={false}
                      components={{
                        body: {
                          row: SortableRow,
                        },
                      }}
                    />
                  </SortableContext>
                </DndContext>
              </Panel>

              <Panel header="Secciones" key="sections">
                <Form form={sectionCatalogForm} layout="inline" onFinish={async (v) => {
                  await api.post('/academic/sections', v);
                  message.success('Sección creada');
                  sectionCatalogForm.resetFields();
                  fetchAll();
                }}>
                  <Form.Item name="name" rules={[{ required: true }]} style={{ width: 220 }}><Input placeholder="Nombre" /></Form.Item>
                  <Button type="primary" htmlType="submit" icon={<PlusOutlined />} />
                </Form>
                <Table
                  dataSource={sections}
                  rowKey="id"
                  size="small"
                  style={{ marginTop: 16 }}
                  columns={catalogColumns('section')}
                  pagination={{ pageSize: 5 }}
                />
              </Panel>

              <Panel header="Materias" key="subjects">
                <Form form={subjectCatalogForm} layout="inline" onFinish={async (v) => {
                  await api.post('/academic/subjects', v);
                  message.success('Creado');
                  subjectCatalogForm.resetFields();
                  fetchAll();
                }}>
                  <Form.Item name="name" rules={[{ required: true }]} style={{ width: 220 }}><Input placeholder="Nombre" /></Form.Item>
                  <Button type="primary" htmlType="submit" icon={<PlusOutlined />} />
                </Form>
                <Table
                  dataSource={subjects}
                  rowKey="id"
                  size="small"
                  style={{ marginTop: 16 }}
                  columns={catalogColumns('subject')}
                  pagination={{ pageSize: 5 }}
                />
              </Panel>
            </Collapse>
          </TabPane>

          {/* PERIOD CLOSURE TAB */}
          <TabPane tab="Cierre de Periodo" key="4">
            <PeriodClosurePanel />
          </TabPane>
        </Tabs>
      </Card>

      {/* Create Period Modal */}
      <Modal
        title="Nuevo Periodo Escolar"
        open={isPeriodModalVisible}
        onCancel={() => setIsPeriodModalVisible(false)}
        footer={null}
      >
        <Form form={periodForm} layout="vertical" onFinish={handleCreatePeriod}>
          <Form.Item
            name="period"
            label="Periodo (Año-Año)"
            rules={[{ required: true, message: 'Seleccione el periodo escolar' }]}
          >
            <Select placeholder="Seleccione periodo">
              {(() => {
                const options: string[] = [];
                const currentYear = new Date().getFullYear();
                const maxStart = currentYear;
                const minStart = 2000;
                for (let y = maxStart; y >= minStart; y -= 1) {
                  options.push(`${y}-${y + 1}`);
                }
                return options.map((p) => (
                  <Select.Option key={p} value={p}>{p}</Select.Option>
                ));
              })()}
            </Select>
          </Form.Item>

          <Form.Item
            name="name"
            label="Nombre del Periodo"
            rules={[{ required: true, message: 'Ingrese un nombre descriptivo, ej. Año Escolar 2025-2026' }]}
          >
            <Input placeholder="Año Escolar 2025-2026" />
          </Form.Item>

          <Button type="primary" htmlType="submit" block>Crear Periodo</Button>
        </Form>
      </Modal>

      <Modal
        title="Editar Grupo de Materias"
        open={editSubjectGroupVisible}
        onCancel={() => {
          setEditSubjectGroupVisible(false);
          setEditingSubjectGroup(null);
          editSubjectGroupForm.resetFields();
        }}
        footer={null}
      >
        <Form form={editSubjectGroupForm} layout="vertical" onFinish={handleEditSubjectGroup}>
          <Form.Item
            name="name"
            label="Nombre del grupo"
            rules={[{ required: true, message: 'Ingrese el nombre del grupo' }]}
          >
            <Input placeholder="Nombre del grupo" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>
            Guardar Cambios
          </Button>
        </Form>
      </Modal>

      {/* Edit Catalog Modal */}
      <Modal
        title={editCatalogTarget?.type === 'grade' ? 'Editar Grado' : 'Editar Item'}
        open={editCatalogVisible}
        onCancel={() => setEditCatalogVisible(false)}
        footer={null}
      >
        <Form form={editCatalogForm} layout="vertical" onFinish={handleEditCatalog}>
          <Form.Item name="name" label="Nombre" rules={[{ required: true }]}>
            <Input />
          </Form.Item>

          {editCatalogTarget?.type === 'grade' && (
            <Form.Item name="isDiversified" valuePropName="checked">
              <Checkbox>Diversificado</Checkbox>
            </Form.Item>
          )}

          {editCatalogTarget?.type === 'subject' && (
            <Form.Item name="subjectGroupId" label="Grupo de Materia">
              <Select
                allowClear
                placeholder="Sin grupo"
                options={subjectGroups.map((g) => ({ label: g.name, value: g.id }))}
              />
            </Form.Item>
          )}

          <Button type="primary" htmlType="submit" block>Guardar Cambios</Button>
        </Form>
      </Modal>

      <Modal
        title="Editar Periodo Escolar"
        open={editPeriodVisible}
        onCancel={() => setEditPeriodVisible(false)}
        footer={null}
      >
        <Form form={editPeriodForm} layout="vertical" onFinish={handleEditPeriod}>
          <Form.Item label="Periodo">
            <Input value={editingPeriod?.period} disabled />
          </Form.Item>

          <Form.Item
            name="name"
            label="Nombre del Periodo"
            rules={[{ required: true, message: 'Ingrese un nombre descriptivo, ej. Año Escolar 2025-2026' }]}
          >
            <Input placeholder="Año Escolar 2025-2026" />
          </Form.Item>

          <Button type="primary" htmlType="submit" block>Guardar Cambios</Button>
        </Form>
      </Modal>

      <Modal
        title="Eliminar Periodo Escolar"
        open={deletePeriodVisible}
        onCancel={() => setDeletePeriodVisible(false)}
        onOk={() => periodToDelete && handleDeletePeriod(periodToDelete.id)}
        okButtonProps={{
          danger: true,
          disabled: deleteConfirmText !== 'DELETE',
        }}
        okText="Eliminar definitivamente"
      >
        <p>
          Esta acción <strong>no se puede deshacer</strong>. Se eliminará el periodo{' '}
          <strong>{periodToDelete?.name}</strong> ({periodToDelete?.period}) y{' '}
          <strong>todos los datos relacionados</strong> a este año escolar (estructura, inscripciones, etc.).
        </p>
        <p>Para confirmar, escriba <code>DELETE</code> en el siguiente campo:</p>
        <Input
          value={deleteConfirmText}
          onChange={(e) => setDeleteConfirmText(e.target.value)}
          placeholder="Escriba DELETE para confirmar"
        />
      </Modal>

      <Modal
        title="Seleccionar Especialización"
        open={specializationModalVisible}
        onCancel={() => {
          setSpecializationModalVisible(false);
          setSelectedGradeForStructure(null);
          setSelectedSpecializationId(null);
        }}
        onOk={handleConfirmDiversifiedGrade}
        okButtonProps={{ disabled: !selectedSpecializationId }}
        okText="Agregar Grado con Mención"
      >
        <p>
          Seleccione la especialización/mención para el grado{' '}
          <strong>{selectedGradeForStructure?.name}</strong> en este periodo.
        </p>
        <Select
          placeholder="Seleccione una especialización"
          style={{ width: '100%' }}
          value={selectedSpecializationId ?? undefined}
          onChange={(val) => setSelectedSpecializationId(val)}
          options={specializations.map((s) => ({ label: s.name, value: s.id }))}
        />
      </Modal>

      {/* Modal para asignar profesor */}
      <Modal
        title="Asignar Profesor a Materia"
        open={teacherAssignModalVisible}
        onCancel={() => setTeacherAssignModalVisible(false)}
        footer={null}
      >
        <Form
          form={teacherAssignForm}
          layout="vertical"
          onFinish={handleAssignTeacher}
        >
          <Form.Item
            name="teacherId"
            label="Profesor"
            rules={[{ required: true, message: 'Seleccione un profesor' }]}
          >
            <Select 
              placeholder="Seleccionar profesor"
              showSearch
              optionFilterProp="children"
              filterOption={(input, option) => 
                option?.children?.toString().toLowerCase().includes(input.toLowerCase()) ?? false
              }
              style={{ width: '100%' }}
            >
              {availableTeachers.map(teacher => (
                <Select.Option key={teacher.id} value={teacher.id}>
                  {teacher.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item
            name="sectionId"
            label="Sección"
            rules={[{ required: true, message: 'Seleccione una sección' }]}
          >
            <Select 
              placeholder="Seleccionar sección"
              showSearch
              optionFilterProp="children"
              filterOption={(input, option) => 
                option?.children?.toString().toLowerCase().includes(input.toLowerCase()) ?? false
              }
              style={{ width: '100%' }}
            >
              {availableSections.map(section => (
                <Select.Option key={section.id} value={section.id}>
                  {section.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              Asignar Profesor
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AcademicManagement;
