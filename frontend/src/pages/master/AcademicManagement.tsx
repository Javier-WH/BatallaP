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
  Collapse,
  Typography,
  Tooltip,
  Empty,
  ColorPicker,
  Switch
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  BookOutlined,
  AppstoreOutlined,
  CheckCircleOutlined,
  HolderOutlined,
  UserAddOutlined,
  ProjectOutlined,
  SearchOutlined,
  CalendarOutlined,
  HistoryOutlined,
  ClockCircleOutlined,
  TeamOutlined,
  AimOutlined,
  SafetyOutlined,
  ThunderboltOutlined
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
import {
  SUBJECT_ICONS,
  SUBJECT_ICON_LABELS,
  SUBJECT_COLORS,
  getSubjectVisual,
  withAlpha,
} from '@/utils/subjectVisuals';

/**
 * ColorPicker returns a Color object (or null when cleared); the API expects a
 * hex string or null.
 */
const normalizeColorValue = (value: unknown): string | null => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  const toHex = (value as { toHexString?: () => string }).toHexString;
  return typeof toHex === 'function' ? toHex.call(value) : null;
};

const subjectIconOptions = Object.keys(SUBJECT_ICONS).map(name => ({
  value: name,
  label: SUBJECT_ICON_LABELS[name] || name,
}));

/** Suggested colors for grades (años) */
const GRADE_COLORS = [
  '#1890ff', '#52c41a', '#fa8c16', '#722ed1', '#eb2f96',
  '#13c2c2', '#f5222d', '#faad14', '#2f54eb', '#a0d911',
];

/**
 * Generates a lighter variation of a hex color by mixing it with white.
 * `amount` 0 = original, 1 = white.
 */
const lightenColor = (hex: string, amount: number): string => {
  const clean = (hex || '').replace('#', '');
  if (clean.length !== 6) return hex;
  const r = Math.round(parseInt(clean.slice(0, 2), 16) + (255 - parseInt(clean.slice(0, 2), 16)) * amount);
  const g = Math.round(parseInt(clean.slice(2, 4), 16) + (255 - parseInt(clean.slice(2, 4), 16)) * amount);
  const b = Math.round(parseInt(clean.slice(4, 6), 16) + (255 - parseInt(clean.slice(4, 6), 16)) * amount);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};

/** Default fallback color for grades without an explicit color */
const DEFAULT_GRADE_COLOR = '#1890ff';

// Context for passing drag listeners to the drag handle cell
interface RowContextProps {
  setActivatorNodeRef?: (element: HTMLElement | null) => void;
  listeners?: Record<string, unknown>;
}
const RowContext = createContext<RowContextProps>({});

type PeriodStatus = 'preinscripcion' | 'activo' | 'historico' | 'externo';

interface Period {
  id: number;
  period: string;
  name: string;
  status: PeriodStatus;
  /** Derived from `status` on the backend. Kept for backwards compatibility. */
  isActive?: boolean;
}

const PERIOD_STATUS_PRESENTATION: Record<PeriodStatus, { label: string; color: string; icon: React.ReactNode }> = {
  activo: { label: 'Periodo Activo', color: 'success', icon: <CheckCircleOutlined /> },
  preinscripcion: { label: 'Preinscripción', color: 'processing', icon: <ClockCircleOutlined /> },
  historico: { label: 'Histórico', color: 'default', icon: <HistoryOutlined /> },
  externo: { label: 'Externo', color: 'warning', icon: <HistoryOutlined /> },
};

interface BaseCatalogItem {
  id: number;
  name: string;
}

interface Grade extends BaseCatalogItem {
  isDiversified: boolean;
  order?: number | null;
}

type Section = BaseCatalogItem;

type SubjectGroup = BaseCatalogItem & {
  bulletinAbbreviation?: string | null;
  longAbbreviation?: string | null;
  shortAbbreviation?: string | null;
};

interface Subject extends BaseCatalogItem {
  abbreviation?: string | null;
  subjectGroupId?: number | null;
  subjectGroup?: SubjectGroup | null;
  usesLiteralGrades?: boolean;
  icon?: string | null;
  color?: string | null;
  includeInAverage?: boolean;
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
const { Title, Text } = Typography;

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
  onToggleAverage?: (periodGradeId: number, subjectId: number, includeInAverage: boolean) => void;
}

const SortableSubjectItem: React.FC<SortableSubjectItemProps> = ({ subject, periodGradeId, onRemove, onAssignTeacher, onToggleAverage }) => {
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
        {onToggleAverage && (
          <Tooltip title={subject.includeInAverage !== false ? 'Cuenta para promedio' : 'No cuenta para promedio'}>
            <Space size={4}>
              <span style={{ fontSize: 11, fontWeight: 600, color: subject.includeInAverage !== false ? '#52c41a' : '#bfbfbf' }}>Promedio</span>
              <Switch
                size="small"
                checked={subject.includeInAverage !== false}
                onClick={(checked, e) => {
                  e?.stopPropagation();
                  onToggleAverage(periodGradeId, subject.id, checked);
                }}
              />
            </Space>
          </Tooltip>
        )}
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
  const [selectedSubjectForTeacher, setSelectedSubjectForTeacher] = useState<{ periodGradeId: number, subjectId: number, periodGradeSubjectId?: number } | null>(null);
  const [availableSections, setAvailableSections] = useState<Section[]>([]);
  const [availableTeachers, setAvailableTeachers] = useState<{ id: number, name: string }[]>([]);
  const [teacherAssignForm] = Form.useForm();
  const [selectedGradeForStructure, setSelectedGradeForStructure] = useState<Grade | null>(null);
  const [selectedSpecializationId, setSelectedSpecializationId] = useState<number | null>(null);


  const [editSubjectGroupVisible, setEditSubjectGroupVisible] = useState(false);
  const [editSubjectGroupForm] = Form.useForm();
  const [editingSubjectGroup, setEditingSubjectGroup] = useState<SubjectGroup | null>(null);
  const [filterSubjectName, setFilterSubjectName] = useState<string>('');
  const [presetModalOpen, setPresetModalOpen] = useState(false);
  const [subjectPresets, setSubjectPresets] = useState<any[]>([]);
  const [presetApplying, setPresetApplying] = useState(false);
  const [createPresetModalOpen, setCreatePresetModalOpen] = useState(false);
  const [presetForm] = Form.useForm();
  const [presetItems, setPresetItems] = useState<{ name: string; abbreviation: string }[]>([{ name: '', abbreviation: '' }]);
  const [presetSubmitting, setPresetSubmitting] = useState(false);
  const [structurePresetModalOpen, setStructurePresetModalOpen] = useState(false);
  const [structurePresets, setStructurePresets] = useState<any[]>([]);
  const [structurePresetApplying, setStructurePresetApplying] = useState(false);

  const fetchSubjectPresets = async () => {
    try {
      const res = await api.get('/subject-presets');
      setSubjectPresets(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  const handleApplyPreset = async (presetId: number) => {
    setPresetApplying(true);
    try {
      const res = await api.post(`/subject-presets/${presetId}/apply`);
      const { created, skipped } = res.data;
      if (created.length > 0 && skipped.length === 0) {
        message.success(`${created.length} materias creadas`);
      } else if (created.length > 0 && skipped.length > 0) {
        message.warning(`${created.length} creadas, ${skipped.length} ya existían y se omitieron`);
      } else if (created.length === 0 && skipped.length > 0) {
        message.info('Todas las materias del preset ya existían');
      }
      setPresetModalOpen(false);
      fetchAll();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Error al aplicar preset');
    } finally {
      setPresetApplying(false);
    }
  };

  const handleCreatePreset = async () => {
    try {
      const values = await presetForm.validateFields();
      const items = presetItems
        .filter(item => item.name.trim() !== '')
        .map(item => ({ name: item.name.trim(), abbreviation: item.abbreviation.trim() || null }));
      if (items.length === 0) {
        message.error('Debe agregar al menos una materia');
        return;
      }
      setPresetSubmitting(true);
      await api.post('/subject-presets', {
        name: values.name.trim(),
        description: values.description?.trim() || null,
        items,
      });
      message.success('Preset creado correctamente');
      presetForm.resetFields();
      setPresetItems([{ name: '', abbreviation: '' }]);
      setCreatePresetModalOpen(false);
      fetchSubjectPresets();
    } catch (error: any) {
      if (error.response?.data?.message) {
        message.error(error.response.data.message);
      }
    } finally {
      setPresetSubmitting(false);
    }
  };

  const fetchStructurePresets = async () => {
    try {
      const res = await api.get('/structure-presets');
      setStructurePresets(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  const handleApplyStructurePreset = async (presetId: number) => {
    if (!activePeriodId) {
      message.warning('Seleccione un período primero');
      return;
    }
    setStructurePresetApplying(true);
    try {
      const res = await api.post(`/structure-presets/${presetId}/apply`, { schoolPeriodId: activePeriodId });
      const { results } = res.data;
      const totalGrades = results.length;
      const totalSubjects = results.reduce((acc: number, r: any) => acc + r.subjectsLinked, 0);
      const totalSections = results.reduce((acc: number, r: any) => acc + r.sectionsLinked, 0);
      message.success(`${totalGrades} grados vinculados, ${totalSubjects} materias y ${totalSections} secciones`);
      setStructurePresetModalOpen(false);
      fetchStructure();
      fetchAll();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Error al aplicar preset');
    } finally {
      setStructurePresetApplying(false);
    }
  };

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
        const active = periodsData.find((p) => p.status === 'activo') ?? periodsData[0];
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
    editSubjectGroupForm.setFieldsValue({
      name: group.name,
      bulletinAbbreviation: group.bulletinAbbreviation || '',
      longAbbreviation: group.longAbbreviation || '',
      shortAbbreviation: group.shortAbbreviation || '',
    });
    setEditSubjectGroupVisible(true);
  };

  const handleEditSubjectGroup = async (values: { name: string; bulletinAbbreviation?: string; longAbbreviation?: string; shortAbbreviation?: string }) => {
    if (!editingSubjectGroup) return;
    try {
      const payload = {
        name: (values.name || '').trim(),
        bulletinAbbreviation: (values.bulletinAbbreviation || '').trim() || null,
        longAbbreviation: (values.longAbbreviation || '').trim() || null,
        shortAbbreviation: (values.shortAbbreviation || '').trim() || null,
      };
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
      // Map includeInAverage from through table to subject level
      const mapped = res.data.map((item: any) => ({
        ...item,
        subjects: (item.subjects || []).map((sub: any) => ({
          ...sub,
          includeInAverage: sub.PeriodGradeSubject?.includeInAverage !== false,
        })),
      }));
      setStructure(mapped);
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
      message.success('Periodo activado. El periodo siguiente queda disponible en preinscripción.');
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

  const handleSectionColorChange = async (periodGradeId: number, sectionId: number, color: string) => {
    try {
      await api.put(`/academic/structure/section/${periodGradeId}/${sectionId}/color`, { color });
      fetchStructure();
    } catch (error) {
      console.error(error);
      message.error('Error al cambiar color');
    }
  };

  const handleGradeColorChange = async (periodGradeId: number, color: string) => {
    try {
      await api.put(`/academic/structure/grade/${periodGradeId}/color`, { color });
      fetchStructure();
    } catch (error) {
      console.error(error);
      message.error('Error al cambiar color del año');
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

  const handleToggleAverage = async (periodGradeId: number, subjectId: number, includeInAverage: boolean) => {
    try {
      await api.post('/academic/structure/subject/toggle-average', { periodGradeId, subjectId, includeInAverage });
      fetchStructure();
    } catch (error) {
      console.error(error);
      message.error('Error al actualizar configuración de promedio');
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
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
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
    {
      title: 'Año Escolar',
      dataIndex: 'period',
      key: 'period',
      render: (text: string) => <Text style={{ fontWeight: 800, color: '#262626', fontSize: 16 }}>{text}</Text>
    },
    {
      title: 'Identificación',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <Text style={{ fontWeight: 600, color: '#595959' }}>{text}</Text>
    },
    {
      title: 'Estado del Ciclo',
      key: 'status',
      width: 150,
      render: (_: unknown, r: Period) => {
        const presentation = PERIOD_STATUS_PRESENTATION[r.status ?? 'historico'];
        return (
          <Tag
            icon={presentation.icon}
            color={presentation.color}
            style={{
              borderRadius: 20,
              padding: '4px 12px',
              fontWeight: 700,
              textTransform: 'uppercase',
              fontSize: 10,
              border: 'none',
              boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
            }}
          >
            {presentation.label}
          </Tag>
        );
      }
    },
    {
      title: 'Acciones',
      key: 'actions',
      width: 150,
      align: 'right' as const,
      render: (_: unknown, r: Period) => (
        <Space size="middle">
          {r.status !== 'activo' && (
            <Tooltip title="Establecer como periodo de trabajo actual">
              <Button
                type="text"
                className="action-btn-hover"
                icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                onClick={() => handleActivatePeriod(r.id)}
              />
            </Tooltip>
          )}
          <Tooltip title="Editar detalles del periodo">
            <Button
              type="text"
              className="action-btn-hover"
              icon={<EditOutlined style={{ color: '#1890ff' }} />}
              onClick={() => openEditPeriod(r)}
            />
          </Tooltip>
          <Tooltip title="Eliminar periodo (Solo si no tiene datos vinculados)">
            <Button
              type="text"
              danger
              className="action-btn-hover-danger"
              icon={<DeleteOutlined />}
              onClick={() => openDeletePeriod(r)}
            />
          </Tooltip>
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
      console.log('[openEditCatalog] Subject data:', subjectRecord);
      editCatalogForm.setFieldsValue({
        name: subjectRecord.name,
        abbreviation: subjectRecord.abbreviation ?? null,
        subjectGroupId: subjectRecord.subjectGroupId ?? null,
        usesLiteralGrades: subjectRecord.usesLiteralGrades ?? false,
        icon: subjectRecord.icon ?? null,
        color: subjectRecord.color ?? null,
      });
    } else {
      editCatalogForm.setFieldsValue({ name: record.name });
    }
    setEditCatalogVisible(true);
  };

  const handleEditCatalog = async (values: { name: string; isDiversified?: boolean; subjectGroupId?: number | null; usesLiteralGrades?: boolean; abbreviation?: string | null; icon?: string | null; color?: unknown }) => {
    if (!editCatalogTarget) return;
    console.log('[handleEditCatalog] Form values:', values);
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
          abbreviation: values.abbreviation ?? null,
          subjectGroupId: values.subjectGroupId ?? null,
          usesLiteralGrades: values.usesLiteralGrades ?? false,
          icon: values.icon ?? null,
          color: normalizeColorValue(values.color),
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
        title: 'Nº',
        key: 'index',
        width: 50,
        render: (_: unknown, __: CatalogItem, index: number) => (
          <Text style={{ fontWeight: 800, color: '#bfbfbf' }}>{(index + 1).toString().padStart(2, '0')}</Text>
        ),
      }]
      : []),
    {
      title: 'Descripción de Item',
      dataIndex: 'name',
      render: (text: string, record: CatalogItem) => {
        if (type === 'grade' && 'isDiversified' in record && (record as Grade).isDiversified) {
          return (
            <Space size="middle">
              <Text style={{ fontWeight: 700, color: '#262626', fontSize: 15 }}>{text}</Text>
              <Tag color="purple" style={{ borderRadius: 6, fontWeight: 700, border: 'none', fontSize: 10 }}>DIVERSIFICADO</Tag>
            </Space>
          );
        }
        if (type === 'subject') {
          const subjectRecord = record as Subject;
          const { Icon, color } = getSubjectVisual(subjectRecord);
          const isCustom = !!(subjectRecord.icon || subjectRecord.color);
          return (
            <Space size="middle" align="start">
              <Tooltip title={isCustom ? 'Icono personalizado' : 'Icono automático según el nombre'}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 9,
                    backgroundColor: withAlpha(color, 0.12),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    border: isCustom ? `1px solid ${withAlpha(color, 0.45)}` : '1px dashed rgba(15,23,42,0.15)',
                  }}
                >
                  <Icon style={{ color, fontSize: 16 }} />
                </div>
              </Tooltip>
              <Space size="middle" direction="vertical" style={{ gap: 0 }}>
                <Space size="small">
                  <Text style={{ fontWeight: 700, color: '#262626', fontSize: 15 }}>{text}</Text>
                  {subjectRecord.abbreviation && (
                    <Tag color="cyan" style={{ borderRadius: 4, fontWeight: 700, border: 'none', fontSize: 10, margin: 0 }}>
                      {subjectRecord.abbreviation}
                    </Tag>
                  )}
                </Space>
                {subjectRecord.subjectGroup && (
                  <Tag color="processing" style={{ borderRadius: 4, fontWeight: 600, border: 'none', fontSize: 10, margin: 0 }}>
                    <ProjectOutlined style={{ marginRight: 4 }} /> {subjectRecord.subjectGroup.name.toUpperCase()}
                  </Tag>
                )}
              </Space>
            </Space>
          );
        }
        return <Text style={{ fontWeight: 700, color: '#262626', fontSize: 15 }}>{text}</Text>;
      },
    },
    {
      title: 'Acciones',
      key: 'actions',
      width: 120,
      align: 'right' as const,
      render: (_: unknown, r: CatalogItem) => (
        <Space size="small">
          <Tooltip title="Editar">
            <Button
              type="text"
              className="action-btn-hover"
              icon={<EditOutlined style={{ color: '#1890ff' }} />}
              onClick={() => openEditCatalog(type, r)}
            />
          </Tooltip>
          <Popconfirm
            title="¿Eliminar item del catálogo?"
            description="Asegúrese de que no esté en uso en ningún periodo."
            onConfirm={() => handleDeleteCatalog(type, r.id)}
            okText="Eliminar"
            cancelText="Cancelar"
            okButtonProps={{ danger: true }}
          >
            <Button
              type="text"
              danger
              className="action-btn-hover-danger"
              icon={<DeleteOutlined />}
            />
          </Popconfirm>
        </Space>
      )
    }
  ];

  // --- Render ---

  const activePeriod = periods.find((p) => p.status === 'activo');

  const orderedStructure = [...structure].sort((a, b) => {
    const aOrder = a.grade?.order ?? Number.MAX_SAFE_INTEGER;
    const bOrder = b.grade?.order ?? Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) return aOrder - bOrder;
    const aName = a.grade?.name ?? '';
    const bName = b.grade?.name ?? '';
    return aName.localeCompare(bName, 'es');
  });

  return (
    <div style={{ padding: '0 24px 40px' }}>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-card {
          animation: fadeUp 0.6s cubic-bezier(0.23, 1, 0.32, 1) both;
        }
        .delay-1 { animation-delay: 0.1s; }
        .delay-2 { animation-delay: 0.2s; }
        .delay-3 { animation-delay: 0.3s; }
        
        .premium-card {
          border-radius: 20px !important;
          border: 1px solid rgba(0,0,0,0.06) !important;
          box-shadow: 0 10px 30px rgba(0,0,0,0.04) !important;
          overflow: hidden;
        }

        .action-btn-hover:hover {
          background: #e6f7ff !important;
          transform: scale(1.1);
          border-radius: 8px;
        }
        .action-btn-hover-danger:hover {
          background: #fff1f0 !important;
          transform: scale(1.1);
          border-radius: 8px;
        }

        .active-period-row {
          background-color: #f6ffed !important;
        }
        
        .premium-table .ant-table-thead > tr > th {
          background: #fafafa !important;
          font-weight: 800 !important;
          text-transform: uppercase !important;
          font-size: 11px !important;
          letter-spacing: 0.5px !important;
          color: #8c8c8c !important;
          border-bottom: 2px solid #f0f0f0 !important;
          padding: 16px 12px !important;
        }
        
        .premium-tabs .ant-tabs-nav {
          margin-bottom: 24px !important;
        }
        .premium-tabs .ant-tabs-tab {
          padding: 12px 20px !important;
          font-weight: 700 !important;
          font-size: 13px !important;
          text-transform: uppercase !important;
          letter-spacing: 0.5px !important;
        }

        .catalog-collapse .ant-collapse-header {
          padding: 16px 24px !important;
          background: #fff !important;
          border-radius: 12px !important;
          margin-bottom: 8px !important;
          border: 1px solid #f0f0f0 !important;
          transition: all 0.3s ease !important;
        }
        .catalog-collapse .ant-collapse-header:hover {
          border-color: #1890ff !important;
          box-shadow: 0 4px 12px rgba(24,144,255,0.08) !important;
        }
      `}</style>

      {/* Hero Section */}
      <div style={{ marginBottom: 40, marginTop: 12 }} className="animate-card">
        <Row justify="space-between" align="middle">
          <Col>
            <Space size="middle" align="center">
              <div style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                background: 'linear-gradient(135deg, #001529 0%, #003a8c 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 24px rgba(0,21,41,0.2)'
              }}>
                <ProjectOutlined style={{ fontSize: 26, color: '#fff' }} />
              </div>
              <div>
                <Title level={2} style={{ margin: 0, fontWeight: 900, letterSpacing: '-0.03em', color: '#001529' }}>
                  Gestión Académica
                </Title>
                <Text type="secondary" style={{ fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                  Configuración de la base estructural y catálogos globales de la institución.
                  {activePeriod && (
                    <Tag color="blue" style={{ borderRadius: 6, fontWeight: 700, margin: 0, marginLeft: 12 }}>
                      {activePeriod.name.toUpperCase()}
                    </Tag>
                  )}
                </Text>
              </div>
            </Space>
          </Col>
        </Row>
      </div>

      <Card className="premium-card animate-card delay-1" styles={{ body: { padding: '24px' } }}>
        <Tabs defaultActiveKey="1" className="premium-tabs">
          {/* PERIODS TAB */}
          <TabPane tab={<span><CalendarOutlined /> PERIODOS ESCOLARES</span>} key="1">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
              <div>
                <Title level={4} style={{ margin: 0, fontWeight: 800 }}>Cronograma de Periodos</Title>
                <Text type="secondary">Administración de años escolares y activación de ciclos.</Text>
              </div>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setIsPeriodModalVisible(true)}
                style={{
                  height: 44,
                  padding: '0 24px',
                  borderRadius: 10,
                  fontWeight: 700,
                  background: '#001529',
                  border: 'none',
                  boxShadow: '0 4px 12px rgba(0,21,41,0.2)'
                }}
              >
                Nuevo Periodo
              </Button>
            </div>
            <Table
              dataSource={periods}
              columns={periodColumns}
              rowKey="id"
              loading={loading}
              className="premium-table"
              rowClassName={(record: Period) => (record.status === 'activo' ? 'active-period-row' : '')}
              pagination={{ pageSize: 8 }}
            />
          </TabPane>

          {/* STRUCTURE TAB */}
          <TabPane tab={<span><AppstoreOutlined /> ESTRUCTURA</span>} key="2">
            {!activePeriodId ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={<Text type="secondary">Seleccione o active un periodo escolar para gestionar su estructura.</Text>}
              />
            ) : (
              <div className="animate-card">
                <div style={{ marginBottom: 32, padding: '24px', background: '#f9f9f9', borderRadius: 16, border: '1px dashed #d9d9d9' }}>
                  <Row align="middle" gutter={24}>
                    <Col>
                      <div style={{ width: 40, height: 40, borderRadius: 8, background: '#1890ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <PlusOutlined style={{ color: '#fff' }} />
                      </div>
                    </Col>
                    <Col flex="auto">
                      <Title level={5} style={{ margin: 0 }}>Vincular Grado al Periodo</Title>
                      <Text type="secondary">Los grados seleccionados aquí podrán tener secciones y materias en este año escolar.</Text>
                    </Col>
                    <Col>
                      <Space>
                        <Select
                          key={`add-grade-${activePeriodId}-${orderedStructure.map((pg) => pg.id).join('-')}`}
                          placeholder="Seleccionar Grado del Catálogo"
                          style={{ width: 280 }}
                          size="large"
                          onChange={handleAddGradeToStructure}
                          options={grades.map((g) => ({ label: g.name, value: g.id }))}
                        />
                        <Button
                          icon={<ThunderboltOutlined />}
                          size="large"
                          onClick={() => { fetchStructurePresets(); setStructurePresetModalOpen(true); }}
                          style={{ borderRadius: 8, height: 40 }}
                        >
                          Preset de Estructura
                        </Button>
                      </Space>
                    </Col>
                  </Row>
                </div>

                <Collapse
                  className="catalog-collapse"
                  expandIcon={({ isActive }) => <PlusOutlined rotate={isActive ? 45 : 0} style={{ color: '#8c8c8c' }} />}
                  defaultActiveKey={orderedStructure.map((item) => String(item.id))}
                >
                  {orderedStructure.map((item: PeriodGradeStructureItem) => (
                    <Panel
                      key={item.id}
                      header={
                        <Space size="middle">
                          <div style={{
                            width: 32,
                            height: 32,
                            borderRadius: 6,
                            background: withAlpha(item.color || DEFAULT_GRADE_COLOR, 0.1),
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: `1px solid ${withAlpha(item.color || DEFAULT_GRADE_COLOR, 0.3)}`
                          }}>
                            <Text style={{ fontWeight: 800, color: item.color || DEFAULT_GRADE_COLOR, fontSize: 13 }}>
                              {item.grade?.order}
                            </Text>
                          </div>
                          <Text style={{ fontWeight: 700, fontSize: 16, color: '#262626' }}>
                            {item.grade?.name ?? ''}
                            {item.specialization && (
                              <Text style={{ fontWeight: 400, color: '#8c8c8c', marginLeft: 8 }}>
                                — {item.specialization.name}
                              </Text>
                            )}
                          </Text>
                          <div onClick={(e) => e.stopPropagation()}>
                            <ColorPicker
                              size="small"
                              value={item.color || DEFAULT_GRADE_COLOR}
                              presets={[{ label: 'Sugeridos', colors: GRADE_COLORS }]}
                              format="hex"
                              onChange={(color) => {
                                const hex = normalizeColorValue(color);
                                if (hex) handleGradeColorChange(item.id, hex);
                              }}
                            />
                          </div>
                        </Space>
                      }
                      extra={
                        <Popconfirm
                          title="¿Desvincular grado?"
                          description="Se perderá la relación de secciones y materias para este periodo."
                          onConfirm={() => handleRemoveGradeFromStructure(item.id)}
                        >
                          <Button
                            type="text"
                            danger
                            className="action-btn-hover-danger"
                            icon={<DeleteOutlined />}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </Popconfirm>
                      }
                    >
                      <Row gutter={32}>
                        <Col span={10}>
                          <div style={{ marginBottom: 24 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                              <Text style={{ fontWeight: 800, fontSize: 11, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                <AppstoreOutlined /> Configurar Secciones
                              </Text>
                              <Select
                                key={`add-section-${item.id}-${(item.sections || []).map((s) => s.id).join('-')}`}
                                size="small"
                                placeholder="+ Agregar"
                                style={{ width: 120 }}
                                bordered={false}
                                onChange={(val) => handleAddSectionToGrade(item.id, val)}
                                options={sections
                                  .filter((s) => !item.sections?.some((is: Section) => is.id === s.id))
                                  .map((s) => ({ label: s.name, value: s.id }))
                                }
                              />
                            </div>

                            <div style={{ background: '#fafafa', borderRadius: 12, padding: 12, minHeight: 60 }}>
                              <Space wrap>
                                {item.sections?.map((sec: any, idx: number) => {
                                  const gradeColor = item.color || DEFAULT_GRADE_COLOR;
                                  const sectionColor = lightenColor(gradeColor, 0.3 + idx * 0.15);
                                  return (
                                    <Tag
                                      key={sec.id}
                                      closable
                                      onClose={() => handleRemoveSectionFromGrade(item.id, sec.id)}
                                      style={{
                                        padding: '4px 12px',
                                        borderRadius: 8,
                                        background: withAlpha(sectionColor, 0.15),
                                        border: `1px solid ${withAlpha(sectionColor, 0.4)}`,
                                        fontWeight: 600,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 6
                                      }}
                                    >
                                      <div style={{
                                        width: 14,
                                        height: 14,
                                        borderRadius: 3,
                                        background: sectionColor,
                                        border: '1px solid rgba(0,0,0,0.1)',
                                      }} />
                                      <Text style={{ fontWeight: 800, color: sectionColor }}>{sec.name}</Text>
                                    </Tag>
                                  );
                                })}
                                {(!item.sections || item.sections.length === 0) && (
                                  <Text type="secondary" style={{ fontSize: 12, fontStyle: 'italic', padding: '4px 8px' }}>Sin secciones asignadas</Text>
                                )}
                              </Space>
                            </div>
                          </div>
                        </Col>

                        <Col span={14} style={{ borderLeft: '1px solid #f0f0f0' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <Text style={{ fontWeight: 800, fontSize: 11, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                              <BookOutlined /> Malla Curricular (Materias)
                            </Text>
                            <Select
                              key={`add-subject-${item.id}-${(item.subjects || []).map((s) => s.id).join('-')}`}
                              size="small"
                              placeholder="+ Vincular Materia"
                              style={{ width: 180 }}
                              bordered={false}
                              showSearch
                              optionFilterProp="label"
                              onChange={(val) => handleAddSubjectToGrade(item.id, val)}
                              options={subjects
                                .filter((s) => !item.subjects?.some((is: Subject) => is.id === s.id))
                                .map((s) => {
                                  const label = s.subjectGroup
                                    ? `${s.name} (${s.subjectGroup.name})`
                                    : s.name;
                                  return { label, value: s.id };
                                })
                              }
                            />
                          </div>

                          <div style={{ background: '#fafafa', borderRadius: 12, padding: 8 }}>
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
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    {item.subjects.map((sub: Subject) => (
                                      <SortableSubjectItem
                                        key={sub.id}
                                        subject={sub}
                                        periodGradeId={item.id}
                                        onRemove={handleRemoveSubjectFromGrade}
                                        onAssignTeacher={handleOpenAssignTeacher}
                                        onToggleAverage={handleToggleAverage}
                                      />
                                    ))}
                                  </div>
                                </SortableContext>
                              </DndContext>
                            ) : (
                              <div style={{ textAlign: 'center', padding: '20px' }}>
                                <Text type="secondary" style={{ fontSize: 12, fontStyle: 'italic' }}>No hay materias vinculadas a este grado</Text>
                              </div>
                            )}
                          </div>
                        </Col>
                      </Row>
                    </Panel>
                  ))}
                </Collapse>
              </div>
            )}
          </TabPane>

          {/* CATALOGS TAB */}
          <TabPane tab={<span><BookOutlined /> CATÁLOGOS</span>} key="3">
            <div className="animate-card">
              <Row gutter={24}>
                <Col span={24}>
                  <Collapse
                    className="catalog-collapse"
                    expandIcon={({ isActive }) => <PlusOutlined rotate={isActive ? 45 : 0} style={{ color: '#8c8c8c' }} />}
                    defaultActiveKey={['grades', 'sections']}
                  >
                    <Panel
                      header={
                        <Space size="middle">
                          <div style={{ width: 32, height: 32, borderRadius: 6, background: '#f9f0ff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #d3adf7' }}>
                            <TeamOutlined style={{ color: '#722ed1' }} />
                          </div>
                          <Text style={{ fontWeight: 700, fontSize: 15 }}>Grados</Text>
                        </Space>
                      }
                      key="grades"
                    >
                      <div style={{ padding: '0 8px' }}>
                        <Form form={gradeCatalogForm} layout="inline" onFinish={async (v) => {
                          await api.post('/academic/grades', v);
                          message.success('Grado creado');
                          gradeCatalogForm.resetFields();
                          fetchAll();
                        }} style={{ marginBottom: 20 }}>
                          <Form.Item name="name" rules={[{ required: true }]} style={{ width: 280 }}><Input placeholder="Nombre (ej. Primer Año)" size="middle" style={{ borderRadius: 8 }} /></Form.Item>
                          <Button type="primary" htmlType="submit" icon={<PlusOutlined />} style={{ borderRadius: 8, height: 32 }}>Agregar Grado</Button>
                        </Form>
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                          <SortableContext items={grades.map((g) => g.id)} strategy={verticalListSortingStrategy}>
                            <Table
                              dataSource={grades}
                              rowKey="id"
                              className="premium-table"
                              size="middle"
                              columns={catalogColumns('grade')}
                              pagination={false}
                              components={{ body: { row: SortableRow } }}
                            />
                          </SortableContext>
                        </DndContext>
                      </div>
                    </Panel>

                    <Panel
                      header={
                        <Space size="middle">
                          <div style={{ width: 32, height: 32, borderRadius: 6, background: '#f6ffed', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #b7eb8f' }}>
                            <AppstoreOutlined style={{ color: '#389e0d' }} />
                          </div>
                          <Text style={{ fontWeight: 700, fontSize: 15 }}>Secciones</Text>
                        </Space>
                      }
                      key="sections"
                    >
                      <div style={{ padding: '0 8px' }}>
                        <Form form={sectionCatalogForm} layout="inline" onFinish={async (v) => {
                          await api.post('/academic/sections', v);
                          message.success('Sección creada');
                          sectionCatalogForm.resetFields();
                          fetchAll();
                        }} style={{ marginBottom: 20 }}>
                          <Form.Item name="name" rules={[{ required: true }]} style={{ width: 280 }}><Input placeholder="Identificador (ej. A, B, C)" size="middle" style={{ borderRadius: 8 }} /></Form.Item>
                          <Button type="primary" htmlType="submit" icon={<PlusOutlined />} style={{ borderRadius: 8, height: 32 }}>Agregar Sección</Button>
                        </Form>
                        <Table
                          dataSource={sections}
                          rowKey="id"
                          className="premium-table"
                          size="middle"
                          columns={catalogColumns('section')}
                          pagination={{ pageSize: 10 }}
                        />
                      </div>
                    </Panel>

                    <Panel
                      header={
                        <Space size="middle">
                          <div style={{ width: 32, height: 32, borderRadius: 6, background: '#f0f5ff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #adc6ff' }}>
                            <SafetyOutlined style={{ color: '#2f54eb' }} />
                          </div>
                          <Text style={{ fontWeight: 700, fontSize: 15 }}>Especializaciones / Menciones</Text>
                        </Space>
                      }
                      key="specializations"
                    >
                      <div style={{ padding: '0 8px' }}>
                        <Form
                          form={specializationCatalogForm}
                          layout="inline"
                          onFinish={async (v) => {
                            await api.post('/academic/specializations', v);
                            message.success('Especialización registrada');
                            specializationCatalogForm.resetFields();
                            fetchAll();
                          }}
                          style={{ marginBottom: 20 }}
                        >
                          <Form.Item name="name" rules={[{ required: true }]} style={{ width: 280 }}>
                            <Input placeholder="Ej. Ciencias, Informática" size="middle" style={{ borderRadius: 8 }} />
                          </Form.Item>
                          <Button type="primary" htmlType="submit" icon={<PlusOutlined />} style={{ borderRadius: 8, height: 32 }}>Agregar</Button>
                        </Form>
                        <Table
                          dataSource={specializations}
                          rowKey="id"
                          className="premium-table"
                          size="middle"
                          columns={catalogColumns('specialization')}
                          pagination={{ pageSize: 5 }}
                        />
                      </div>
                    </Panel>

                    <Panel
                      header={
                        <Space size="middle">
                          <div style={{ width: 32, height: 32, borderRadius: 6, background: '#fff7e6', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #ffe7ba' }}>
                            <ProjectOutlined style={{ color: '#fa8c16' }} />
                          </div>
                          <Text style={{ fontWeight: 700, fontSize: 15 }}>Grupos de Materias</Text>
                        </Space>
                      }
                      key="subjectGroups"
                    >
                      <div style={{ padding: '0 8px' }}>
                        <Form
                          form={subjectGroupForm}
                          layout="inline"
                          onFinish={async (v) => {
                            try {
                              const payload = {
                                name: (v.name || '').trim(),
                                bulletinAbbreviation: (v.bulletinAbbreviation || '').trim() || null,
                                longAbbreviation: (v.longAbbreviation || '').trim() || null,
                                shortAbbreviation: (v.shortAbbreviation || '').trim() || null,
                              };
                              await api.post('/academic/subject-groups', payload);
                              message.success('Grupo creado satisfactoriamente');
                              subjectGroupForm.resetFields();
                              fetchAll();
                            } catch (error) {
                              console.error(error);
                              const err = error as { response?: { data?: { error?: string } } };
                              message.error(err.response?.data?.error || 'Error al crear grupo');
                            }
                          }}
                          style={{ marginBottom: 20 }}
                        >
                          <Form.Item name="name" rules={[{ required: true, message: 'Requerido' }]} style={{ width: 280 }}>
                            <Input placeholder="Nombre del grupo (ej. Área Técnica)" size="middle" style={{ borderRadius: 8 }} />
                          </Form.Item>
                          <Form.Item name="bulletinAbbreviation" style={{ width: 220 }}>
                            <Input placeholder="Abreviatura Boletín" size="middle" style={{ borderRadius: 8 }} />
                          </Form.Item>
                          <Form.Item name="longAbbreviation" style={{ width: 220 }}>
                            <Input placeholder="Abreviatura Larga" size="middle" style={{ borderRadius: 8 }} />
                          </Form.Item>
                          <Form.Item name="shortAbbreviation" style={{ width: 200 }}>
                            <Input placeholder="Abreviatura Corta" size="middle" style={{ borderRadius: 8 }} />
                          </Form.Item>
                          <Button type="primary" htmlType="submit" icon={<PlusOutlined />} style={{ borderRadius: 8, height: 32 }}>Crear Grupo</Button>
                        </Form>

                        <Table
                          dataSource={subjectGroups}
                          rowKey="id"
                          className="premium-table"
                          size="middle"
                          columns={[
                            { title: 'Identificador del Grupo', dataIndex: 'name', render: (t) => <Text style={{ fontWeight: 600 }}>{t}</Text> },
                            { title: 'Abrev. Boletín', dataIndex: 'bulletinAbbreviation', render: (t: string | null) => t ? <Tag color="orange">{t}</Tag> : <Text type="secondary">—</Text> },
                            { title: 'Abrev. Larga', dataIndex: 'longAbbreviation', render: (t: string | null) => t ? <Tag color="blue">{t}</Tag> : <Text type="secondary">—</Text> },
                            { title: 'Abrev. Corta', dataIndex: 'shortAbbreviation', render: (t: string | null) => t ? <Tag color="purple">{t}</Tag> : <Text type="secondary">—</Text> },
                            {
                              title: 'Gestión',
                              key: 'actions',
                              width: 120,
                              align: 'right' as const,
                              render: (_: unknown, record: SubjectGroup) => (
                                <Space size="small">
                                  <Tooltip title="Editar">
                                    <Button type="text" className="action-btn-hover" icon={<EditOutlined style={{ color: '#1890ff' }} />} onClick={() => openEditSubjectGroup(record)} />
                                  </Tooltip>
                                  <Popconfirm
                                    title="¿Eliminar grupo?"
                                    description="Asegúrese de que no tenga materias vinculadas."
                                    onConfirm={async () => {
                                      try {
                                        await api.delete(`/academic/subject-groups/${record.id}`);
                                        message.success('Grupo eliminado');
                                        await fetchAll();
                                      } catch (error) {
                                        console.error(error);
                                        message.error('El grupo está en uso y no se puede eliminar');
                                      }
                                    }}
                                  >
                                    <Button type="text" danger className="action-btn-hover-danger" icon={<DeleteOutlined />} />
                                  </Popconfirm>
                                </Space>
                              ),
                            },
                          ]}
                          pagination={{ pageSize: 5 }}
                        />
                      </div>
                    </Panel>

                    <Panel
                      header={
                        <Space size="middle">
                          <div style={{ width: 32, height: 32, borderRadius: 6, background: '#e6f7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #91d5ff' }}>
                            <BookOutlined style={{ color: '#1890ff' }} />
                          </div>
                          <Text style={{ fontWeight: 700, fontSize: 15 }}>Materias</Text>
                        </Space>
                      }
                      key="subjects"
                    >
                      <div style={{ padding: '0 8px' }}>
                        <Form form={subjectCatalogForm} layout="inline" onFinish={async (v) => {
                          await api.post('/academic/subjects', {
                            ...v,
                            subjectGroupId: v.subjectGroupId ?? null,
                            usesLiteralGrades: v.usesLiteralGrades ?? false,
                            icon: v.icon ?? null,
                            color: normalizeColorValue(v.color),
                          });
                          message.success('Materia registrada');
                          subjectCatalogForm.resetFields();
                          fetchAll();
                        }} style={{ marginBottom: 20 }}>
                          <Form.Item name="name" rules={[{ required: true }]} style={{ width: 220 }}>
                            <Input placeholder="Nombre de la materia" size="middle" style={{ borderRadius: 8 }} />
                          </Form.Item>
                          <Form.Item name="abbreviation" style={{ width: 100 }}>
                            <Input placeholder="Abrev." size="middle" style={{ borderRadius: 8 }} maxLength={10} />
                          </Form.Item>
                          <Form.Item name="subjectGroupId" style={{ width: 180 }}>
                            <Select
                              placeholder="Grupo (opcional)"
                              size="middle"
                              style={{ borderRadius: 8 }}
                              allowClear
                              showSearch
                              optionFilterProp="label"
                              options={subjectGroups.map((g) => ({ label: g.name, value: g.id }))}
                            />
                          </Form.Item>
                          <Form.Item name="icon" style={{ width: 170 }}>
                            <Select
                              placeholder="Icono (auto)"
                              size="middle"
                              allowClear
                              showSearch
                              optionFilterProp="label"
                              options={subjectIconOptions}
                            />
                          </Form.Item>
                          <Form.Item name="color" style={{ marginRight: 8 }}>
                            <ColorPicker
                              presets={[{ label: 'Sugeridos', colors: SUBJECT_COLORS }]}
                              allowClear
                              format="hex"
                            />
                          </Form.Item>
                          <Form.Item name="usesLiteralGrades" valuePropName="checked">
                            <Checkbox>Literales</Checkbox>
                          </Form.Item>
                          <Button type="primary" htmlType="submit" icon={<PlusOutlined />} style={{ borderRadius: 8, height: 32 }}>Crear Materia</Button>
                          <Button
                            icon={<ThunderboltOutlined />}
                            onClick={() => { fetchSubjectPresets(); setPresetModalOpen(true); }}
                            style={{ borderRadius: 8, height: 32 }}
                          >
                            Preset
                          </Button>
                        </Form>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                          <Input
                            placeholder="Filtrar materias por nombre..."
                            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                            allowClear
                            onChange={e => setFilterSubjectName(e.target.value)}
                            style={{ width: 350, borderRadius: 10, height: 40 }}
                          />
                        </div>

                        <Table
                          dataSource={subjects.filter(s => s.name.toLowerCase().includes(filterSubjectName.toLowerCase()))}
                          rowKey="id"
                          className="premium-table"
                          size="middle"
                          columns={catalogColumns('subject')}
                          pagination={{ pageSize: 8 }}
                        />
                      </div>
                    </Panel>
                  </Collapse>
                </Col>
              </Row>
            </div>
          </TabPane>

          {/* PERIOD CLOSURE TAB */}
          <TabPane tab={<span><HistoryOutlined /> CIERRE</span>} key="5">
            <div className="animate-card" style={{ padding: '24px' }}>
              <PeriodClosurePanel />
            </div>
          </TabPane>
        </Tabs>
      </Card>

      {/* Create Period Modal */}
      <Modal
        title={null}
        open={isPeriodModalVisible}
        onCancel={() => setIsPeriodModalVisible(false)}
        footer={null}
        destroyOnClose
        centered
        width={500}
        styles={{ body: { padding: 0, borderRadius: 24, overflow: 'hidden' } }}
      >
        <div style={{ borderRadius: 24, overflow: 'hidden' }}>
          <div style={{ padding: '24px 32px', background: 'linear-gradient(135deg, #001529 0%, #003a8c 100%)', color: '#fff' }}>
            <Space size="middle">
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CalendarOutlined style={{ fontSize: 22 }} />
              </div>
              <div>
                <Title level={4} style={{ color: '#fff', margin: 0, fontWeight: 800 }}>Nuevo Periodo Escolar</Title>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>Cronograma</Text>
              </div>
            </Space>
          </div>

          <Form form={periodForm} layout="vertical" onFinish={handleCreatePeriod} style={{ padding: '32px' }} requiredMark={false}>
            <Form.Item
              name="period"
              label={<Text style={{ fontWeight: 700 }}>Ciclo Escolar (Año-Año)</Text>}
              rules={[{ required: true, message: 'Seleccione el periodo escolar' }]}
            >
              <Select placeholder="Seleccione periodo" size="large" style={{ borderRadius: 8 }}>
                {(() => {
                  const options: string[] = [];
                  const currentYear = new Date().getFullYear();
                  const maxStart = currentYear + 1;
                  const minStart = 2020;
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
              label={<Text style={{ fontWeight: 700 }}>Nombre Descriptivo</Text>}
              rules={[{ required: true, message: 'Ingrese un nombre descriptivo' }]}
            >
              <Input placeholder="Ej. Año Escolar 2025-2026" size="large" style={{ borderRadius: 8 }} />
            </Form.Item>

            <Button type="primary" htmlType="submit" block size="large" style={{
              height: 50,
              borderRadius: 12,
              fontWeight: 800,
              background: '#001529',
              border: 'none',
              marginTop: 16
            }}>
              Crear Nuevo Ciclo
            </Button>
          </Form>
        </div>
      </Modal>

      <Modal
        title={null}
        open={editSubjectGroupVisible}
        onCancel={() => {
          setEditSubjectGroupVisible(false);
          setEditingSubjectGroup(null);
          editSubjectGroupForm.resetFields();
        }}
        footer={null}
        destroyOnClose
        centered
        width={450}
        styles={{ body: { padding: 0 } }}
      >
        <div style={{ borderRadius: 24, overflow: 'hidden' }}>
          <div style={{ padding: '20px 32px', background: 'linear-gradient(135deg, #fa8c16 0%, #d46b08 100%)', color: '#fff' }}>
            <Space>
              <ProjectOutlined style={{ fontSize: 20 }} />
              <Title level={4} style={{ color: '#fff', margin: 0, fontWeight: 800 }}>Editar Grupo</Title>
            </Space>
          </div>
          <Form form={editSubjectGroupForm} layout="vertical" onFinish={handleEditSubjectGroup} style={{ padding: '32px' }}>
            <Form.Item
              name="name"
              label={<Text style={{ fontWeight: 700 }}>Nombre del grupo de materias</Text>}
              rules={[{ required: true, message: 'Requerido' }]}
            >
              <Input placeholder="Nombre del grupo" size="large" />
            </Form.Item>
            <Form.Item
              name="bulletinAbbreviation"
              label={<Text style={{ fontWeight: 700 }}>Abreviatura Boletín</Text>}
              tooltip="Nombre a mostrar en el boletín. Si se deja vacío, se usa el nombre normal."
            >
              <Input placeholder="Ej: Grupos de Creación" size="large" />
            </Form.Item>
            <Form.Item
              name="longAbbreviation"
              label={<Text style={{ fontWeight: 700 }}>Abreviatura Larga</Text>}
              tooltip="Se usa en resúmenes finales. Si se deja vacío, se usa el nombre normal."
            >
              <Input placeholder="Ej: Área de Participación" size="large" />
            </Form.Item>
            <Form.Item
              name="shortAbbreviation"
              label={<Text style={{ fontWeight: 700 }}>Abreviatura Corta</Text>}
              tooltip="Se usa en resúmenes finales (versión corta). Si se deja vacío, se usa el nombre normal."
            >
              <Input placeholder="Ej: PGCRP" size="large" />
            </Form.Item>
            <Button type="primary" htmlType="submit" block size="large" style={{
              height: 48,
              borderRadius: 12,
              fontWeight: 700,
              background: '#fa8c16',
              border: 'none'
            }}>
              Guardar Cambios
            </Button>
          </Form>
        </div>
      </Modal>

      {/* Edit Catalog Modal */}
      <Modal
        title={null}
        open={editCatalogVisible}
        onCancel={() => setEditCatalogVisible(false)}
        footer={null}
        destroyOnClose
        centered
        width={480}
        styles={{ body: { padding: 0 } }}
      >
        <div style={{ borderRadius: 24, overflow: 'hidden' }}>
          <div style={{ padding: '20px 32px', background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)', color: '#fff' }}>
            <Space>
              <EditOutlined style={{ fontSize: 20 }} />
              <Title level={4} style={{ color: '#fff', margin: 0, fontWeight: 800 }}>
                {editCatalogTarget?.type === 'grade' ? 'Ajustar Grado' : 'Ajustar Item de Catálogo'}
              </Title>
            </Space>
          </div>
          <Form form={editCatalogForm} layout="vertical" onFinish={handleEditCatalog} style={{ padding: '32px' }}>
            <Form.Item name="name" label={<Text style={{ fontWeight: 700 }}>Nombre</Text>} rules={[{ required: true }]}>
              <Input size="large" />
            </Form.Item>

            {editCatalogTarget?.type === 'grade' && (
              <Form.Item name="isDiversified" valuePropName="checked" style={{ marginBottom: 24 }}>
                <Checkbox><Text style={{ fontWeight: 600 }}>Es Educación Diversificada</Text></Checkbox>
              </Form.Item>
            )}

            {editCatalogTarget?.type === 'subject' && (
              <>
                <Form.Item name="abbreviation" label={<Text style={{ fontWeight: 700 }}>Abreviatura</Text>}>
                  <Input placeholder="Ej: CA, EF, MAT" size="large" maxLength={10} />
                </Form.Item>
                <Form.Item name="subjectGroupId" label={<Text style={{ fontWeight: 700 }}>Grupo de Materia</Text>}>
                  <Select
                    allowClear
                    placeholder="Sin grupo asignado"
                    size="large"
                    options={subjectGroups.map((g) => ({ label: g.name, value: g.id }))}
                  />
                </Form.Item>
                <Row gutter={12}>
                  <Col span={16}>
                    <Form.Item name="icon" label={<Text style={{ fontWeight: 700 }}>Icono</Text>} extra="Si se deja vacío se asigna automáticamente según el nombre.">
                      <Select
                        allowClear
                        showSearch
                        optionFilterProp="label"
                        placeholder="Automático"
                        size="large"
                        options={subjectIconOptions}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item name="color" label={<Text style={{ fontWeight: 700 }}>Color</Text>}>
                      <ColorPicker
                        presets={[{ label: 'Sugeridos', colors: SUBJECT_COLORS }]}
                        allowClear
                        format="hex"
                        size="large"
                      />
                    </Form.Item>
                  </Col>
                </Row>
                <Form.Item name="usesLiteralGrades" valuePropName="checked" style={{ marginBottom: 24 }}>
                  <Checkbox>Usar Notas Literales (A, B, C...)</Checkbox>
                </Form.Item>
              </>
            )}

            <Button type="primary" htmlType="submit" block size="large" style={{
              height: 48,
              borderRadius: 12,
              fontWeight: 700,
              background: '#096dd9',
              border: 'none'
            }}>
              Aplicar Ajustes
            </Button>
          </Form>
        </div>
      </Modal>

      <Modal
        title={null}
        open={editPeriodVisible}
        onCancel={() => setEditPeriodVisible(false)}
        footer={null}
        destroyOnClose
        centered
        width={480}
        styles={{ body: { padding: 0 } }}
      >
        <div style={{ borderRadius: 24, overflow: 'hidden' }}>
          <div style={{ padding: '20px 32px', background: 'linear-gradient(135deg, #001529 0%, #003a8c 100%)', color: '#fff' }}>
            <Space>
              <CalendarOutlined style={{ fontSize: 20 }} />
              <Title level={4} style={{ color: '#fff', margin: 0, fontWeight: 800 }}>Editar Ciclo Escolar</Title>
            </Space>
          </div>
          <Form form={editPeriodForm} layout="vertical" onFinish={handleEditPeriod} style={{ padding: '32px' }}>
            <Form.Item label={<Text style={{ fontWeight: 700 }}>Periodo Académico</Text>}>
              <Input value={editingPeriod?.period} disabled size="large" />
            </Form.Item>

            <Form.Item
              name="name"
              label={<Text style={{ fontWeight: 700 }}>Nombre del Periodo</Text>}
              rules={[{ required: true, message: 'Ingrese un nombre descriptivo' }]}
            >
              <Input placeholder="Año Escolar 2025-2026" size="large" />
            </Form.Item>

            <Button type="primary" htmlType="submit" block size="large" style={{
              height: 48,
              borderRadius: 12,
              fontWeight: 700,
              background: '#001529',
              border: 'none'
            }}>
              Actualizar Periodo
            </Button>
          </Form>
        </div>
      </Modal>

      <Modal
        title={null}
        open={deletePeriodVisible}
        onCancel={() => setDeletePeriodVisible(false)}
        onOk={() => periodToDelete && handleDeletePeriod(periodToDelete.id)}
        okButtonProps={{
          danger: true,
          disabled: deleteConfirmText !== 'DELETE',
        }}
        okText="Eliminar permanentemente"
        centered
        destroyOnClose
      >
        <div style={{ padding: '8px 4px' }}>
          <Title level={4} style={{ fontWeight: 800, color: '#ff4d4f' }}>
            ¿Eliminar Periodo Escolar?
          </Title>
          <Text style={{ fontSize: 14 }}>
            Esta acción <strong>no se puede deshacer</strong>. Se eliminará el periodo{' '}
            <strong>{periodToDelete?.name}</strong> y{' '}
            <strong>todos los datos vinculados</strong> (estructura, notas, inscripciones).
          </Text>
          <div style={{ marginTop: 20, background: '#fff1f0', padding: '16px', borderRadius: 12, border: '1px solid #ffa39e' }}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 12, fontWeight: 700 }}>
              PARA CONFIRMAR, ESCRIBA "DELETE" ABAJO:
            </Text>
            <Input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="ESCRIBA DELETE"
              size="large"
              style={{ borderRadius: 8, textTransform: 'uppercase' }}
            />
          </div>
        </div>
      </Modal>

      <Modal
        title={null}
        open={specializationModalVisible}
        onCancel={() => {
          setSpecializationModalVisible(false);
          setSelectedGradeForStructure(null);
          setSelectedSpecializationId(null);
        }}
        footer={null}
        centered
        width={450}
        styles={{ body: { padding: 0 } }}
      >
        <div style={{ borderRadius: 24, overflow: 'hidden' }}>
          <div style={{ padding: '24px 32px', background: 'linear-gradient(135deg, #722ed1 0%, #391085 100%)', color: '#fff' }}>
            <Space>
              <AimOutlined style={{ fontSize: 24 }} />
              <div>
                <Title level={4} style={{ color: '#fff', margin: 0, fontWeight: 800 }}>Especialización</Title>
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>REQUERIDA PARA GRADOS DIVERSIFICADOS</Text>
              </div>
            </Space>
          </div>
          <div style={{ padding: '32px' }}>
            <Text style={{ display: 'block', marginBottom: 20, fontSize: 14 }}>
              Seleccione la mención para <strong>{selectedGradeForStructure?.name}</strong> en este año escolar:
            </Text>
            <Select
              placeholder="Seleccione la especialización"
              size="large"
              style={{ width: '100%', marginBottom: 24 }}
              value={selectedSpecializationId ?? undefined}
              onChange={(val) => setSelectedSpecializationId(val)}
              options={specializations.map((s) => ({ label: s.name, value: s.id }))}
            />
            <Button
              type="primary"
              block
              size="large"
              disabled={!selectedSpecializationId}
              onClick={handleConfirmDiversifiedGrade}
              style={{ height: 48, borderRadius: 12, background: '#722ed1', border: 'none', fontWeight: 700 }}
            >
              Vincular Grado con Mencíon
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal para asignar profesor */}
      <Modal
        title={null}
        open={teacherAssignModalVisible}
        onCancel={() => setTeacherAssignModalVisible(false)}
        footer={null}
        centered
        width={480}
        styles={{ body: { padding: 0 } }}
      >
        <div style={{ borderRadius: 24, overflow: 'hidden' }}>
          <div style={{ padding: '24px 32px', background: 'linear-gradient(135deg, #001529 0%, #003a8c 100%)', color: '#fff' }}>
            <Space>
              <UserAddOutlined style={{ fontSize: 22 }} />
              <div>
                <Title level={4} style={{ color: '#fff', margin: 0, fontWeight: 800 }}>Asignar Docente</Title>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>Carga Académica</Text>
              </div>
            </Space>
          </div>
          <Form
            form={teacherAssignForm}
            layout="vertical"
            onFinish={handleAssignTeacher}
            style={{ padding: '32px' }}
            requiredMark={false}
          >
            <Form.Item
              name="teacherId"
              label={<Text style={{ fontWeight: 700 }}>Profesor Designado</Text>}
              rules={[{ required: true, message: 'Seleccione un profesor' }]}
            >
              <Select
                placeholder="Buscar profesor..."
                size="large"
                showSearch
                optionFilterProp="children"
                filterOption={(input, option) =>
                  option?.children?.toString().toLowerCase().includes(input.toLowerCase()) ?? false
                }
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
              label={<Text style={{ fontWeight: 700 }}>Sección asignada</Text>}
              rules={[{ required: true, message: 'Seleccione una sección' }]}
            >
              <Select
                placeholder="Seleccionar sección..."
                size="large"
              >
                {availableSections.map(section => (
                  <Select.Option key={section.id} value={section.id}>
                    {section.name}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>

            <Button type="primary" htmlType="submit" block size="large" style={{ height: 50, borderRadius: 12, fontWeight: 800, background: '#001529', border: 'none', marginTop: 12 }}>
              Vincular Docente
            </Button>
          </Form>
        </div>
      </Modal>

      <Modal
        title="Presets de Materias"
        open={presetModalOpen}
        onCancel={() => setPresetModalOpen(false)}
        footer={null}
        width={600}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13, margin: 0 }}>
            Selecciona un preset para cargar sus materias. Las que ya existan se omitirán.
          </p>
          <Button
            icon={<PlusOutlined />}
            onClick={() => { presetForm.resetFields(); setPresetItems([{ name: '', abbreviation: '' }]); setCreatePresetModalOpen(true); }}
            style={{ borderRadius: 8 }}
            size="small"
          >
            Crear nuevo
          </Button>
        </div>
        {subjectPresets.map((preset) => (
          <div
            key={preset.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 16px',
              borderRadius: 10,
              border: '1px solid #f0f0f0',
              marginBottom: 8,
              background: '#fafafa',
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>
                {preset.name}
                {preset.isSystem && <Tag color="blue" style={{ marginLeft: 8, fontSize: 11 }}>Sistema</Tag>}
              </div>
              {preset.description && (
                <div style={{ fontSize: 12, color: '#8c8c8c' }}>{preset.description}</div>
              )}
              <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 2 }}>
                {preset.items?.length || 0} materias
              </div>
            </div>
            <Space>
              {!preset.isSystem && (
                <Popconfirm
                  title="¿Eliminar preset?"
                  onConfirm={async () => {
                    try {
                      await api.delete(`/subject-presets/${preset.id}`);
                      message.success('Preset eliminado');
                      fetchSubjectPresets();
                    } catch (error: any) {
                      message.error(error.response?.data?.message || 'Error al eliminar');
                    }
                  }}
                >
                  <Button type="text" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              )}
              <Button
                type="primary"
                loading={presetApplying}
                onClick={() => handleApplyPreset(preset.id)}
                style={{ borderRadius: 8 }}
              >
                Aplicar
              </Button>
            </Space>
          </div>
        ))}
        {subjectPresets.length === 0 && (
          <Empty description="No hay presets disponibles" />
        )}
      </Modal>

      <Modal
        title="Crear nuevo preset"
        open={createPresetModalOpen}
        onCancel={() => setCreatePresetModalOpen(false)}
        onOk={handleCreatePreset}
        confirmLoading={presetSubmitting}
        okText="Guardar"
        cancelText="Cancelar"
        width={600}
      >
        <Form form={presetForm} layout="vertical">
          <Form.Item name="name" label="Nombre del preset" rules={[{ required: true, message: 'Requerido' }]}>
            <Input placeholder="Ej. Primaria 288A" style={{ borderRadius: 8 }} />
          </Form.Item>
          <Form.Item name="description" label="Descripción (opcional)">
            <Input placeholder="Ej. Educación Primaria — Plan 288A" style={{ borderRadius: 8 }} />
          </Form.Item>
        </Form>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Materias</div>
        {presetItems.map((item, index) => (
          <div key={index} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <Input
              placeholder="Nombre de la materia"
              value={item.name}
              onChange={e => {
                const newItems = [...presetItems];
                newItems[index].name = e.target.value;
                setPresetItems(newItems);
              }}
              style={{ borderRadius: 8, flex: 1 }}
            />
            <Input
              placeholder="Abrev."
              value={item.abbreviation}
              onChange={e => {
                const newItems = [...presetItems];
                newItems[index].abbreviation = e.target.value;
                setPresetItems(newItems);
              }}
              style={{ borderRadius: 8, width: 100 }}
              maxLength={10}
            />
            {presetItems.length > 1 && (
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={() => setPresetItems(presetItems.filter((_, i) => i !== index))}
              />
            )}
          </div>
        ))}
        <Button
          type="dashed"
          icon={<PlusOutlined />}
          onClick={() => setPresetItems([...presetItems, { name: '', abbreviation: '' }])}
          style={{ borderRadius: 8, width: '100%' }}
        >
          Agregar materia
        </Button>
      </Modal>

      <Modal
        title="Presets de Estructura"
        open={structurePresetModalOpen}
        onCancel={() => setStructurePresetModalOpen(false)}
        footer={null}
        width={600}
      >
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginBottom: 16 }}>
          Selecciona un preset para vincular grados, materias y secciones al período activo.
          Las materias deben existir previamente en el catálogo (usa el preset de materias primero).
        </p>
        {structurePresets.map((preset) => (
          <div
            key={preset.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 16px',
              borderRadius: 10,
              border: '1px solid #f0f0f0',
              marginBottom: 8,
              background: '#fafafa',
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>
                {preset.name}
                {preset.isSystem && <Tag color="blue" style={{ marginLeft: 8, fontSize: 11 }}>Sistema</Tag>}
              </div>
              {preset.description && (
                <div style={{ fontSize: 12, color: '#8c8c8c' }}>{preset.description}</div>
              )}
              <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 2 }}>
                {preset.grades?.length || 0} grados
              </div>
            </div>
            <Space>
              {!preset.isSystem && (
                <Popconfirm
                  title="¿Eliminar preset?"
                  onConfirm={async () => {
                    try {
                      await api.delete(`/structure-presets/${preset.id}`);
                      message.success('Preset eliminado');
                      fetchStructurePresets();
                    } catch (error: any) {
                      message.error(error.response?.data?.message || 'Error al eliminar');
                    }
                  }}
                >
                  <Button type="text" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              )}
              <Button
                type="primary"
                loading={structurePresetApplying}
                onClick={() => handleApplyStructurePreset(preset.id)}
                style={{ borderRadius: 8 }}
              >
                Aplicar
              </Button>
            </Space>
          </div>
        ))}
        {structurePresets.length === 0 && (
          <Empty description="No hay presets disponibles" />
        )}
      </Modal>
    </div>
  );
};

export default AcademicManagement;

