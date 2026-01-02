import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Button,
  Card,
  Checkbox,
  Col,
  Input,
  Menu,
  message,
  Popover,
  Radio,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  Pagination,
} from 'antd';
import type { MenuProps } from 'antd';
import {
  ReloadOutlined,
  SearchOutlined,
  UserOutlined,
  CheckCircleOutlined,
  BookOutlined,
  EyeOutlined,
  QuestionCircleOutlined,
  CloseOutlined,
  TableOutlined,
  EditOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import api from '@/services/api';
import type { EnrollmentQuestionResponse } from '@/services/enrollmentQuestions';
import type { ColumnsType } from 'antd/es/table';
import StudentSubjectsModal from '../admin/StudentSubjectsModal';

const { Text, Title } = Typography;
const { Option } = Select;

const ESCOLARIDAD_OPTIONS: { label: string; value: EscolaridadStatus }[] = [
  { label: 'Regular', value: 'regular' },
  { label: 'Repitiente', value: 'repitiente' },
  { label: 'Materia pendiente', value: 'materia_pendiente' }
];

type RepresentativeType = 'mother' | 'father' | 'other';

interface GuardianProfile {
  document?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  documentType?: string;
  residenceState?: string;
  residenceMunicipality?: string;
  residenceParish?: string;
  address?: string;
  email?: string;
}

interface ContactInfo {
  phone1?: string;
  whatsapp?: string;
  address?: string;
}

interface ResidenceInfo {
  birthState?: string;
  birthMunicipality?: string;
  birthParish?: string;
  residenceState?: string;
  residenceMunicipality?: string;
  residenceParish?: string;
}

interface EnrollmentAnswerRecord {
  questionId: number;
  answer: string | string[] | null;
}

type EnrollmentAnswersMap = Record<number, string | string[] | undefined>;

interface StudentGuardian {
  relationship: string;
  isRepresentative?: boolean;
  profile?: GuardianProfile;
}

interface StudentData {
  id: number;
  firstName: string;
  lastName: string;
  documentType: string;
  document: string;
  gender?: string;
  contact?: ContactInfo;
  guardians: StudentGuardian[];
  birthdate?: string | null;
  residence?: ResidenceInfo;
  enrollmentAnswers?: EnrollmentAnswerRecord[];
}

type EscolaridadStatus = 'regular' | 'repitiente' | 'materia_pendiente';

interface SchoolPeriod {
  id: number;
  name: string;
  isActive: boolean;
}

interface TempData {
  id: number;
  firstName: string;
  lastName: string;
  documentType: string;
  document: string;
  gender?: string;
  gradeId: number;
  sectionId?: number | null;
  subjectIds: number[];
  escolaridad: EscolaridadStatus;
  phone1?: string;
  whatsapp?: string;
  birthdate: dayjs.Dayjs | null;
  mother?: GuardianProfile;
  father?: GuardianProfile;
  representative?: GuardianProfile;
  representativeType: RepresentativeType;
  enrollmentAnswers: EnrollmentAnswersMap;
  address: string;
  birthState: string;
  birthMunicipality: string;
  birthParish: string;
  residenceState: string;
  residenceMunicipality: string;
  residenceParish: string;
  [key: string]: unknown;
}

interface MatriculationRow {
  id: number;
  gradeId: number;
  schoolPeriodId: number;
  sectionId?: number | null;
  status: 'pending' | 'completed';
  inscriptionId?: number | null;
  student: StudentData;
  tempData: TempData;
}

interface MatriculationApiResponse {
  id: number;
  gradeId: number;
  schoolPeriodId: number;
  sectionId?: number | null;
  status: 'pending' | 'completed';
  inscriptionId?: number | null;
  student: StudentData;
  escolaridad?: EscolaridadStatus;
  matriculation?: MatriculationApiResponse | null;
}

interface EnrollStructureEntry {
  id: number;
  gradeId: number;
  order?: number | null;
  grade?: { id: number; name: string; order?: number | null };
  sections?: { id: number; name: string }[];
  subjects?: { id: number; name: string; subjectGroupId?: number | null; subjectGroup?: { name: string } }[];
}

interface ColumnOption {
  key: string;
  label: string;
  group: string;
}

const COLUMN_GROUP_ORDER = [
  'Estudiante',
  'Académico',
  'Contacto',
  'Madre',
  'Padre',
  'Representante',
  'Preguntas Personalizadas'
];

const COLS = [
  'nationality', 'document', 'firstName', 'lastName', 'gender',
  'gradeId', 'sectionId', 'subjectIds', 'escolaridad',
  'phone1', 'whatsapp',
  'mDoc', 'mFirstName', 'mLastName', 'mPhone',
  'fDoc', 'fFirstName', 'fLastName', 'fPhone',
  'repType', 'repDoc', 'repFirstName', 'repLastName', 'repPhone'
];

const BASE_COLUMN_OPTIONS: ColumnOption[] = [
  { key: 'nationality', label: 'Nac.', group: 'Estudiante' },
  { key: 'document', label: 'Cédula', group: 'Estudiante' },
  { key: 'firstName', label: 'Nombres', group: 'Estudiante' },
  { key: 'lastName', label: 'Apellidos', group: 'Estudiante' },
  { key: 'gender', label: 'Género', group: 'Estudiante' },
  { key: 'gradeId', label: 'Grado', group: 'Académico' },
  { key: 'sectionId', label: 'Sección', group: 'Académico' },
  { key: 'subjectIds', label: 'Materias de Grupo', group: 'Académico' },
  { key: 'escolaridad', label: 'Escolaridad', group: 'Académico' },
  { key: 'phone1', label: 'S. Principal', group: 'Contacto' },
  { key: 'whatsapp', label: 'WhatsApp', group: 'Contacto' },
  { key: 'motherDocument', label: 'Cédula Madre', group: 'Madre' },
  { key: 'motherFirstName', label: 'Nombres Madre', group: 'Madre' },
  { key: 'motherLastName', label: 'Apellidos Madre', group: 'Madre' },
  { key: 'motherPhone', label: 'Teléfono Madre', group: 'Madre' },
  { key: 'fatherDocument', label: 'Cédula Padre', group: 'Padre' },
  { key: 'fatherFirstName', label: 'Nombres Padre', group: 'Padre' },
  { key: 'fatherLastName', label: 'Apellidos Padre', group: 'Padre' },
  { key: 'fatherPhone', label: 'Teléfono Padre', group: 'Padre' },
  { key: 'representativeType', label: 'Asignar Representante', group: 'Representante' },
  { key: 'representativeDocument', label: 'Cédula Representante', group: 'Representante' },
  { key: 'representativeFirstName', label: 'Nombres Representante', group: 'Representante' },
  { key: 'representativeLastName', label: 'Apellidos Representante', group: 'Representante' },
  { key: 'representativePhone', label: 'Teléfono Representante', group: 'Representante' },
];

const getQuestionColumnKey = (id: number) => `question-${id}`;

interface CellInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: string | undefined | null;
  onChange: (value: string) => void;
}

const CellInput = React.memo(({ value, onChange, onBlur, onKeyDown, ...props }: CellInputProps) => {
  const [draftValue, setDraftValue] = useState<string | null>(null);
  const normalizedValue = value ?? '';
  const inputValue = draftValue ?? normalizedValue;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDraftValue(e.target.value);
  };

  const commitChange = () => {
    if (draftValue !== null && draftValue !== normalizedValue) {
      onChange(draftValue);
    }
    setDraftValue(null);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const hadChanges = draftValue !== null && draftValue !== normalizedValue;
    commitChange();
    
    // Si hubo cambios y se hizo blur, disparar guardado después de un delay
    if (hadChanges) {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('cell-input-changed'));
      }, 100);
    }
    
    if (onBlur) onBlur(e);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      commitChange();
      e.currentTarget.blur();
    }
    if (onKeyDown) onKeyDown(e);
  };

  return (
    <input
      {...props}
      value={inputValue}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    />
  );
});

const contextMenuItems: MenuProps['items'] = [
  {
    type: 'group',
    label: <span className="text-[11px] text-slate-400 uppercase tracking-wide">Acciones de fila</span>,
    children: [
      {
        key: 'edit',
        icon: <EditOutlined />,
        label: 'Editar fila'
      },
      {
        key: 'cancel',
        icon: <CloseOutlined />,
        label: 'Cancelar'
      }
    ]
  }
];

const MatriculationEnrollment: React.FC = () => {
  const navigate = useNavigate();
  const [activePeriod, setActivePeriod] = useState<SchoolPeriod | null>(null);
  const [viewStatus, setViewStatus] = useState<'pending' | 'completed'>('pending');
  const [matriculations, setMatriculations] = useState<MatriculationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [structure, setStructure] = useState<EnrollStructureEntry[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [editableRowId, setEditableRowId] = useState<number | null>(null);
  const [pendingChanges, setPendingChanges] = useState<Record<string, unknown>>({});
  const [subjectModalVisible, setSubjectModalVisible] = useState(false);
  const [selectedStudentForSubjects, setSelectedStudentForSubjects] = useState<{
    inscriptionId: number;
    studentName: string;
    gradeId: number;
    schoolPeriodId: number;
  } | null>(null);
  const [contextMenuState, setContextMenuState] = useState<{ visible: boolean; x: number; y: number; rowId: number | null }>({
    visible: false,
    x: 0,
    y: 0,
    rowId: null
  });
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const [questions, setQuestions] = useState<EnrollmentQuestionResponse[]>([]);
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<string[]>(() => BASE_COLUMN_OPTIONS.map(option => option.key));
  const [columnPopoverOpen, setColumnPopoverOpen] = useState(false);
  const [filterGrade, setFilterGrade] = useState<number | null>(null);
  const [filterSection, setFilterSection] = useState<number | null>(null);
  const [filterGender, setFilterGender] = useState<string | null>(null);
  const [filterEscolaridad, setFilterEscolaridad] = useState<'regular' | 'repitiente' | 'materia_pendiente' | null>(null);
  const [filterMissing, setFilterMissing] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [pinnedGroups, setPinnedGroups] = useState<string[]>(['Estudiante']);
  const scrollY = 500;
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [periodRes, questionsRes] = await Promise.all([
          api.get('/academic/periods/active'),
          api.get('/enrollment-questions')
        ]);
        
        if (periodRes.data) {
          setActivePeriod(periodRes.data);
        } else {
          message.warning('No hay un período académico activo configurado.');
        }
        
        if (questionsRes.data) {
          setQuestions(questionsRes.data);
        }
      } catch (error) {
        console.error('Error fetching initial data:', error);
        message.error('Error al cargar datos iniciales.');
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, []);

  const fetchData = useCallback(async () => {
    if (!activePeriod) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const pId = activePeriod.id;
      const endpoint = viewStatus === 'completed' ? '/inscriptions' : '/matriculations';
      const params = {
        status: viewStatus === 'pending' ? 'pending' : undefined,
        schoolPeriodId: pId
      };

      const [dataRes, structRes] = await Promise.all([
        api.get(endpoint, { params }),
        api.get(`/academic/structure/${pId}`)
      ]);

      const rawData = dataRes.data || [];
      const rows = rawData.map((item: MatriculationApiResponse) => {
        const isInscription = viewStatus === 'completed';
        const m = isInscription ? {
          ...item.matriculation,
          id: item.matriculation?.id || -item.id,
          student: item.student || {},
          gradeId: item.gradeId,
          sectionId: item.sectionId,
          schoolPeriodId: item.schoolPeriodId,
          status: 'completed' as const,
          inscriptionId: item.id,
          escolaridad: item.escolaridad
        } : item;

        const student = m.student || {};
        const guardians: StudentGuardian[] = student.guardians || [];
        const findGuardianProfile = (relationship: string): GuardianProfile =>
          (guardians.find((g: { relationship: string; profile?: GuardianProfile }) => g.relationship === relationship)?.profile || {}) as GuardianProfile;

        const representativeAssignment = guardians.find((g: StudentGuardian) => g.isRepresentative);
        const representativeRelationship = representativeAssignment?.relationship;
        const representativeType: RepresentativeType =
          representativeRelationship === 'mother' || representativeRelationship === 'father'
            ? representativeRelationship
            : 'other';

        const enrollmentAnswersList = student.enrollmentAnswers ?? [];
        const enrollmentAnswers = enrollmentAnswersList.reduce<EnrollmentAnswersMap>((acc, curr) => {
          acc[curr.questionId] = curr.answer ?? undefined;
          return acc;
        }, {});

        return {
          ...m,
          tempData: {
            ...student,
            id: student.id,
            documentType: student.documentType || 'Venezolano',
            gender: student.gender,
            gradeId: m.gradeId,
            sectionId: m.sectionId,
            subjectIds: [],
            escolaridad: m.escolaridad ?? 'regular',
            phone1: student.contact?.phone1,
            whatsapp: student.contact?.whatsapp,
            birthdate: student.birthdate ? dayjs(student.birthdate) : null,
            mother: findGuardianProfile('mother'),
            father: findGuardianProfile('father'),
            representative: findGuardianProfile('representative'),
            representativeType,
            enrollmentAnswers,
            address: student.contact?.address || 'N/A',
            birthState: student.residence?.birthState || 'N/A',
            birthMunicipality: student.residence?.birthMunicipality || 'N/A',
            birthParish: student.residence?.birthParish || 'N/A',
            residenceState: student.residence?.residenceState || 'N/A',
            residenceMunicipality: student.residence?.residenceMunicipality || 'N/A',
            residenceParish: student.residence?.residenceParish || 'N/A',
          }
        };
      });

      setMatriculations(rows);

      const structureData = (structRes.data || []) as EnrollStructureEntry[];
      const sortedStructure = [...structureData].sort((a, b) => {
        const orderA = a.grade?.order ?? a.order ?? Number.MAX_SAFE_INTEGER;
        const orderB = b.grade?.order ?? b.order ?? Number.MAX_SAFE_INTEGER;
        if (orderA !== orderB) return orderA - orderB;
        const nameA = a.grade?.name || '';
        const nameB = b.grade?.name || '';
        return nameA.localeCompare(nameB, 'es');
      });

      setStructure(sortedStructure);
    } catch (error) {
      console.error('[MatriculationEnrollment] Error fetching data:', error);
      message.error('Error cargando información');
    } finally {
      setLoading(false);
    }
  }, [viewStatus, activePeriod]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Deseleccionar estudiantes al cambiar entre matriculados y no matriculados
  useEffect(() => {
    setSelectedRowKeys([]);
  }, [viewStatus]);

  const saveStudentChanges = useCallback(async () => {
    if (editableRowId === null || Object.keys(pendingChanges).length === 0) {
      return;
    }

    try {
      const row = matriculations.find(r => r.id === editableRowId);
      if (!row) return;

      // Determinar endpoint según viewStatus
      const endpoint = viewStatus === 'completed' 
        ? `/inscriptions/${row.inscriptionId || editableRowId}`
        : `/matriculations/${editableRowId}`;

      message.loading({ content: 'Guardando cambios...', key: 'save-student' });
      await api.patch(endpoint, pendingChanges);
      message.success({ content: 'Cambios guardados correctamente', key: 'save-student', duration: 2 });
      
      // Recargar datos para reflejar cambios desde la BD
      await fetchData();
    } catch (error) {
      console.error('Error saving student changes:', error);
      message.error({ content: 'Error al guardar cambios', key: 'save-student' });
    }
  }, [editableRowId, pendingChanges, matriculations, viewStatus, fetchData]);

  const handleGlobalEscape = useCallback(async (event: KeyboardEvent) => {
    // Solo manejar Escape, no Enter (Enter se maneja en blur del input)
    if (event.key === 'Escape') {
      if (editableRowId !== null) {
        await saveStudentChanges();
        setEditableRowId(null);
        setPendingChanges({});
      }
    }
  }, [editableRowId, saveStudentChanges]);

  useEffect(() => {
    window.addEventListener('keydown', handleGlobalEscape);
    return () => window.removeEventListener('keydown', handleGlobalEscape);
  }, [handleGlobalEscape]);

  // Listener para guardar cuando un input cambia y hace blur
  useEffect(() => {
    const handleCellInputChanged = async () => {
      if (editableRowId !== null) {
        await saveStudentChanges();
        setEditableRowId(null);
        setPendingChanges({});
      }
    };

    window.addEventListener('cell-input-changed', handleCellInputChanged);
    return () => window.removeEventListener('cell-input-changed', handleCellInputChanged);
  }, [editableRowId, saveStudentChanges]);

  const handleUpdateRow = useCallback(<K extends keyof TempData>(id: number, field: K, value: TempData[K]) => {
    // Actualizar vista local inmediatamente
    setMatriculations(prev => prev.map(row => (
      row.id === id ? { ...row, tempData: { ...row.tempData, [field]: value } } : row
    )));

    // Acumular cambios pendientes con nombres de campos de BD
    setPendingChanges(prev => {
      const newChanges = { ...prev };
      
      // Convertir nombres de campos del frontend a nombres de BD
      if (field === 'birthdate' && value) {
        newChanges[field as string] = (value as dayjs.Dayjs).format('YYYY-MM-DD');
      } else {
        newChanges[field as string] = value;
      }
      
      return newChanges;
    });
  }, []);

  const handleUpdateGuardianField = useCallback(<
    K extends keyof GuardianProfile
  >(
    rowId: number,
    parentKey: 'mother' | 'father' | 'representative',
    field: K,
    value: GuardianProfile[K]
  ) => {
    let updatedProfile: GuardianProfile = {};
    setMatriculations(prev => prev.map(row => {
      if (row.id !== rowId) return row;
      const guardian = { ...(row.tempData[parentKey] || {}) } as GuardianProfile;
      guardian[field] = value;
      updatedProfile = guardian;
      return { ...row, tempData: { ...row.tempData, [parentKey]: guardian } };
    }));

    // Acumular cambios de guardián
    setPendingChanges(prev => ({
      ...prev,
      [parentKey]: updatedProfile
    }));
  }, []);

  const handleUpdateAnswer = useCallback((
    rowId: number,
    questionId: number,
    value: EnrollmentAnswersMap[number]
  ) => {
    let updatedAnswers: EnrollmentAnswersMap = {};
    setMatriculations(prev => prev.map(row => {
      if (row.id !== rowId) return row;
      const answers = { ...(row.tempData.enrollmentAnswers || {}) };
      answers[questionId] = value;
      updatedAnswers = answers;
      return { ...row, tempData: { ...row.tempData, enrollmentAnswers: answers } };
    }));

    // Acumular cambios de respuestas
    const formattedAnswers = Object.entries(updatedAnswers).map(([qId, ans]) => ({
      questionId: Number(qId),
      answer: ans
    }));
    
    setPendingChanges(prev => ({
      ...prev,
      enrollmentAnswers: formattedAnswers
    }));
  }, []);

  const handleBulkEnroll = async () => {
    const selectedRows = matriculations.filter(r => selectedRowKeys.includes(r.id));
    if (selectedRows.length === 0) return;

    message.loading({ content: `Procesando ${selectedRows.length} inscripciones...`, key: 'bulk' });
    let successCount = 0;
    for (const row of selectedRows) {
      try {
        const { tempData } = row;
        const fixGuardian = (g?: GuardianProfile): GuardianProfile => ({
          ...(g || {}),
          documentType: g?.documentType || 'Venezolano',
          residenceState: g?.residenceState || 'N/A',
          residenceMunicipality: g?.residenceMunicipality || 'N/A',
          residenceParish: g?.residenceParish || 'N/A',
          address: g?.address || 'N/A',
          email: g?.email || 'no@email.com',
          phone: g?.phone || '0000000000'
        });

        const formattedAnswers = Object.entries(tempData.enrollmentAnswers || {}).map(([qId, ans]) => ({
          questionId: Number(qId),
          answer: ans
        }));

        const payload = {
          ...tempData,
          birthdate: tempData.birthdate ? tempData.birthdate.format('YYYY-MM-DD') : null,
          mother: fixGuardian(tempData.mother),
          father: fixGuardian(tempData.father),
          enrollmentAnswers: formattedAnswers
        };
        await api.post(`/matriculations/${row.id}/enroll`, payload);
        successCount++;
      } catch (e) {
        console.error(e);
      }
    }
    message.success({ content: `${successCount} estudiantes inscritos correctamente`, key: 'bulk' });
    fetchData();
    setSelectedRowKeys([]);
  };

  const handleBulkUpdate = <K extends keyof TempData>(field: K, value: TempData[K]) => {
    setMatriculations(prev => prev.map(row => {
      if (selectedRowKeys.includes(row.id)) {
        return { ...row, tempData: { ...row.tempData, [field]: value } };
      }
      return row;
    }));
  };

  const handleOpenSubjectModal = () => {
    if (selectedRowKeys.length !== 1) return;
    const record = matriculations.find(r => r.id === selectedRowKeys[0]);
    if (record && record.inscriptionId) {
      setSelectedStudentForSubjects({
        inscriptionId: record.inscriptionId,
        studentName: `${record.student.firstName} ${record.student.lastName}`,
        gradeId: record.gradeId,
        schoolPeriodId: record.schoolPeriodId
      });
      setSubjectModalVisible(true);
    } else {
      message.warning('El estudiante debe estar inscrito para gestionar sus materias');
    }
  };

  const handleViewProfile = () => {
    if (selectedRowKeys.length !== 1) return;
    const record = matriculations.find(r => r.id === selectedRowKeys[0]);
    if (record && record.student) {
      const personId = record.student.id;
      if (personId) {
        navigate(`/student/${personId}`);
      }
    }
  };

  const selectedRowsToManage = useMemo(
    () => matriculations.filter(row => selectedRowKeys.includes(row.id)),
    [matriculations, selectedRowKeys]
  );

  const selectedGradeIds = useMemo(
    () => Array.from(new Set(selectedRowsToManage.map(row => row.tempData.gradeId))),
    [selectedRowsToManage]
  );

  const hasMixedGrades = selectedGradeIds.length > 1;

  const bulkGroupSubjects = useMemo(() => {
    if (hasMixedGrades || selectedRowsToManage.length === 0) return [];
    const gradeId = selectedRowsToManage[0].tempData.gradeId;
    const gradeStruct = structure.find(s => s.gradeId === gradeId);
    return gradeStruct?.subjects?.filter(s => s.subjectGroupId) || [];
  }, [hasMixedGrades, selectedRowsToManage, structure]);

  const bulkSections = useMemo(() => {
    if (hasMixedGrades || selectedRowsToManage.length === 0) return [];
    const gradeId = selectedRowsToManage[0].tempData.gradeId;
    const gradeStruct = structure.find(s => s.gradeId === gradeId);
    return gradeStruct?.sections || [];
  }, [hasMixedGrades, selectedRowsToManage, structure]);

  const getRepresentativeInfo = (row: MatriculationRow) => {
    if (row.tempData.representativeType === 'mother') {
      return { profile: row.tempData.mother, label: 'Madre', editable: false };
    }
    if (row.tempData.representativeType === 'father') {
      return { profile: row.tempData.father, label: 'Padre', editable: false };
    }
    return { profile: row.tempData.representative, label: 'Otro', editable: true };
  };

  const handleTableKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (!target.matches('input, .ant-select-selection-search-input')) return;
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;

    const cell = target.closest('[data-row-index]');
    if (!cell) return;

    const rowIndexStr = cell.getAttribute('data-row-index');
    const colName = cell.getAttribute('data-col-name');
    if (!rowIndexStr || !colName) return;

    const rowIndex = parseInt(rowIndexStr, 10);
    e.preventDefault();
    let nRow = rowIndex;
    let nColIdx = COLS.indexOf(colName);

    if (e.key === 'ArrowUp') nRow = Math.max(0, rowIndex - 1);
    else if (e.key === 'ArrowDown') nRow = Math.min(matriculations.length - 1, rowIndex + 1);
    else if (e.key === 'ArrowLeft') nColIdx = Math.max(0, nColIdx - 1);
    else if (e.key === 'ArrowRight') nColIdx = Math.min(COLS.length - 1, nColIdx + 1);

    const nCol = COLS[nColIdx];
    const targetId = `nav-${nRow}-${nCol}`;

    requestAnimationFrame(() => {
      const el = document.getElementById(targetId);
      if (el) {
        el.focus();
        if (el.tagName === 'INPUT') (el as HTMLInputElement).select();
      }
    });
  };

  const closeContextMenu = useCallback(() => setContextMenuState(prev => ({ ...prev, visible: false })), []);

  const handleContextEdit = useCallback(async () => {
    if (contextMenuState.rowId !== null) {
      // Si hay una fila diferente en edición, guardar cambios primero
      if (editableRowId !== null && editableRowId !== contextMenuState.rowId) {
        await saveStudentChanges();
      }
      // Establecer nueva fila editable (solo resetear pendingChanges si es diferente)
      if (editableRowId !== contextMenuState.rowId) {
        setEditableRowId(contextMenuState.rowId);
        setPendingChanges({});
      }
    }
    closeContextMenu();
  }, [contextMenuState.rowId, closeContextMenu, editableRowId, saveStudentChanges]);

  const handleContextMenuClick = useCallback<NonNullable<MenuProps['onClick']>>(async ({ key }) => {
    if (key === 'edit') {
      await handleContextEdit();
    }
    if (key === 'cancel') {
      closeContextMenu();
    }
  }, [handleContextEdit, closeContextMenu]);

  const handleContextMenu = (e: React.MouseEvent, rowId: number) => {
    e.preventDefault();
    setContextMenuState({ visible: true, x: e.clientX, y: e.clientY, rowId });
  };

  // Cerrar menú contextual con Escape o click fuera
  useEffect(() => {
    if (!contextMenuState.visible) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeContextMenu();
      }
    };

    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        closeContextMenu();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [contextMenuState.visible, closeContextMenu]);

  const filteredData = useMemo(() => {
    return matriculations.filter(item => {
      if (searchValue) {
        const search = searchValue.toLowerCase();
        const matches = 
          item.student.firstName.toLowerCase().includes(search) ||
          item.student.lastName.toLowerCase().includes(search) ||
          item.student.document.includes(search);
        if (!matches) return false;
      }
      if (filterGrade && item.gradeId !== filterGrade) return false;
      if (filterSection && item.sectionId !== filterSection) return false;
      if (filterGender && item.student.gender !== filterGender) return false;
      if (filterEscolaridad && item.tempData.escolaridad !== filterEscolaridad) return false;
      if (filterMissing) {
        if (filterMissing === 'guardians' && item.student.guardians?.some(g => g.isRepresentative)) return false;
        if (filterMissing === 'contact' && item.student.contact?.phone1) return false;
        if (filterMissing === 'questions' && questions.every(q => item.tempData.enrollmentAnswers?.[q.id])) return false;
        if (filterMissing === 'all') {
          const hasRep = item.student.guardians?.some(g => g.isRepresentative);
          const hasPhone = !!item.student.contact?.phone1;
          const allAnswered = questions.every(q => item.tempData.enrollmentAnswers?.[q.id]);
          if (hasRep && hasPhone && allAnswered) return false;
        }
      }
      return true;
    });
  }, [matriculations, searchValue, filterGrade, filterSection, filterGender, filterEscolaridad, filterMissing, questions]);

  const currentData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  const columnMenuContent = (
    <div style={{ maxHeight: '400px', overflowY: 'auto', padding: '8px' }}>
      <div className="mb-2 pb-2 border-b border-slate-100 flex justify-between items-center">
        <Text strong>Columnas Visibles</Text>
        <Space>
          <Button size="small" type="link" onClick={() => setVisibleColumnKeys(BASE_COLUMN_OPTIONS.map(o => o.key))}>Todas</Button>
          <Button size="small" type="link" onClick={() => setVisibleColumnKeys(['document', 'firstName', 'lastName'])}>Mínimas</Button>
        </Space>
      </div>
      <Checkbox.Group
        style={{ width: '100%' }}
        value={visibleColumnKeys}
        onChange={(checked) => setVisibleColumnKeys(checked as string[])}
      >
        {COLUMN_GROUP_ORDER.map(group => {
          const groupOptions = BASE_COLUMN_OPTIONS.filter(o => o.group === group);
          if (groupOptions.length === 0 && group !== 'Preguntas Personalizadas') return null;
          return (
            <div key={group} className="mb-3">
              <div className="text-[10px] uppercase font-bold text-slate-400 mb-1 px-1 tracking-wider">{group}</div>
              <div className="grid grid-cols-1 gap-1">
                {group === 'Preguntas Personalizadas' ? (
                  questions.map(q => (
                    <Checkbox key={getQuestionColumnKey(q.id)} value={getQuestionColumnKey(q.id)} className="text-xs">{q.prompt}</Checkbox>
                  ))
                ) : (
                  groupOptions.map(opt => (
                    <Checkbox key={opt.key} value={opt.key} className="text-xs">{opt.label}</Checkbox>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </Checkbox.Group>
    </div>
  );

  const isColumnVisible = useCallback((key: string) => visibleColumnKeys.includes(key), [visibleColumnKeys]);
  const canEditRow = useCallback((id: number) => editableRowId === id, [editableRowId]);
  const lockRow = useCallback(async (id: number) => {
    if (editableRowId === id) {
      await saveStudentChanges();
      setEditableRowId(null);
      setPendingChanges({});
    }
  }, [editableRowId, saveStudentChanges]);

  const toggleGroupPin = useCallback((group: string) => {
    setPinnedGroups(prev =>
      prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group]
    );
  }, []);

  const renderGroupTitle = useCallback((group: string, titleNode: React.ReactNode) => (
    <div className="flex items-center justify-between gap-2 group select-none cursor-pointer" onClick={() => toggleGroupPin(group)}>
      {titleNode}
      <Checkbox
        checked={pinnedGroups.includes(group)}
        onClick={(e) => { e.stopPropagation(); toggleGroupPin(group); }}
        className={`transition-opacity duration-200 ${pinnedGroups.includes(group) ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`}
        style={{ transform: 'scale(0.7)' }}
      />
    </div>
  ), [pinnedGroups, toggleGroupPin]);

  type ColumnDefinition = ColumnsType<MatriculationRow>[number];
  const addSeparator = useCallback((cols?: (ColumnDefinition | false | null | undefined)[]): ColumnDefinition[] => {
    if (!cols) return [];
    const validCols = cols.filter((col): col is ColumnDefinition => Boolean(col));
    if (validCols.length === 0) return validCols;
    return validCols.map((col, idx) => {
      if (idx === validCols.length - 1) {
        return {
          ...col,
          className: 'group-separator-border',
          onHeaderCell: () => ({ className: 'group-separator-border' })
        };
      }
      return col;
    });
  }, []);

  const columns = useMemo(() => {
    const docPrefix: Record<string, string> = {
      Venezolano: 'V-',
      Extranjero: 'E-',
      Pasaporte: 'P-',
      'Cedula Escolar': 'CE-'
    };

    const studentCols = [
      isColumnVisible('nationality') && {
        title: 'Nac.',
        width: 70,
        render: (_: unknown, record: MatriculationRow) => (
          <div className="px-1 py-0.5 text-xs text-slate-800">
            {docPrefix[record.tempData.documentType as keyof typeof docPrefix] || record.tempData.documentType?.[0]?.toUpperCase() + '-'}
          </div>
        )
      },
      isColumnVisible('document') && {
        title: 'Cédula',
        width: 120,
        render: (_: unknown, record: MatriculationRow, idx: number) => (
          <CellInput
            id={`nav-${idx}-document`}
            data-row-index={idx}
            data-col-name="document"
            value={record.tempData.document}
            disabled={!canEditRow(record.id)}
            className="w-full bg-transparent px-1 py-0.5 border-transparent focus:border-blue-400 focus:outline-none focus:bg-white rounded text-xs transition-colors"
            onChange={val => handleUpdateRow(record.id, 'document', val)}
          />
        )
      },
      isColumnVisible('firstName') && {
        title: 'Nombres',
        width: 150,
        render: (_: unknown, record: MatriculationRow, idx: number) => (
          <CellInput
            id={`nav-${idx}-firstName`}
            data-row-index={idx}
            data-col-name="firstName"
            value={record.tempData.firstName}
            disabled={!canEditRow(record.id)}
            className="w-full bg-transparent px-1 py-0.5 border-transparent focus:border-blue-400 focus:outline-none focus:bg-white rounded text-xs transition-colors"
            onChange={val => handleUpdateRow(record.id, 'firstName', val)}
          />
        )
      },
      isColumnVisible('lastName') && {
        title: 'Apellidos',
        width: 150,
        render: (_: unknown, record: MatriculationRow, idx: number) => (
          <CellInput
            id={`nav-${idx}-lastName`}
            data-row-index={idx}
            data-col-name="lastName"
            value={record.tempData.lastName}
            disabled={!canEditRow(record.id)}
            className="w-full bg-transparent px-1 py-0.5 border-transparent focus:border-blue-400 focus:outline-none focus:bg-white rounded text-xs transition-colors"
            onChange={val => handleUpdateRow(record.id, 'lastName', val)}
          />
        )
      },
      isColumnVisible('gender') && {
        title: 'Género',
        width: 90,
        render: (_: unknown, record: MatriculationRow) => (
          <div className="px-1 py-0.5">
            <Tag color={record.tempData.gender === 'M' ? 'blue' : 'magenta'} className="m-0 text-[10px] leading-none px-1 py-0">
              {record.tempData.gender === 'M' ? 'Masc' : 'Fem'}
            </Tag>
          </div>
        )
      },
    ].filter(Boolean);

    const academicCols = [
      isColumnVisible('gradeId') && {
        title: 'Grado',
        width: 160,
        render: (_: unknown, record: MatriculationRow, idx: number) => {
          if (!canEditRow(record.id)) {
            const gradeName = structure.find(s => s.gradeId === record.tempData.gradeId)?.grade?.name || 'N/A';
            return <div className="px-1 py-0.5 text-xs text-slate-800 whitespace-nowrap overflow-hidden text-ellipsis">{gradeName}</div>;
          }
          return (
            <div data-row-index={idx} data-col-name="gradeId">
              <Select
                id={`nav-${idx}-gradeId`}
                value={record.tempData.gradeId}
                style={{ width: '100%' }}
                size="small"
                onChange={(v) => handleUpdateRow(record.id, 'gradeId', v)}
              >
                {structure.map(s => <Option key={s.gradeId} value={s.gradeId}>{s.grade?.name}</Option>)}
              </Select>
            </div>
          );
        }
      },
      isColumnVisible('sectionId') && {
        title: 'Sección',
        width: 120,
        render: (_: unknown, record: MatriculationRow, idx: number) => {
          const gradeStruct = structure.find(s => s.gradeId === record.tempData.gradeId);
          if (!canEditRow(record.id)) {
            const sectionName = gradeStruct?.sections?.find(s => s.id === record.tempData.sectionId)?.name || 'N/A';
            return <div className="px-1 py-0.5 text-xs text-slate-800 whitespace-nowrap overflow-hidden text-ellipsis">{sectionName}</div>;
          }
          return (
            <div data-row-index={idx} data-col-name="sectionId">
              <Select
                id={`nav-${idx}-sectionId`}
                value={record.tempData.sectionId}
                allowClear
                size="small"
                style={{ width: '100%' }}
                onChange={(v) => handleUpdateRow(record.id, 'sectionId', v)}
              >
                {gradeStruct?.sections?.map(sec => <Option key={sec.id} value={sec.id}>{sec.name}</Option>)}
              </Select>
            </div>
          );
        }
      },
      isColumnVisible('subjectIds') && {
        title: 'Materias de Grupo',
        width: 220,
        render: (_: unknown, record: MatriculationRow, idx: number) => {
          const gradeStruct = structure.find(s => s.gradeId === record.tempData.gradeId);
          const groupSubjects = gradeStruct?.subjects?.filter(s => s.subjectGroupId) || [];
          const currentSubjectId = record.tempData.subjectIds?.[0];
          if (groupSubjects.length === 0) {
            return <div className="px-1 py-0.5 text-xs text-slate-400 whitespace-nowrap overflow-hidden text-ellipsis min-h-[20px]">{gradeStruct ? 'Sin materias agrupadas' : 'Seleccione un grado'}</div>;
          }
          return (
            <div data-row-index={idx} data-col-name="subjectIds">
              <Select
                id={`nav-${idx}-subjectIds`}
                style={{ width: '100%' }}
                value={currentSubjectId}
                allowClear
                size="small"
                placeholder="Seleccione"
                onChange={(v) => handleUpdateRow(record.id, 'subjectIds', v ? [v] : [])}
              >
                {groupSubjects.map(s => <Option key={s.id} value={s.id}>{s.name}</Option>)}
              </Select>
            </div>
          );
        }
      },
      isColumnVisible('escolaridad') && {
        title: 'Escolaridad',
        width: 150,
        render: (_: unknown, record: MatriculationRow, idx: number) => {
          if (!canEditRow(record.id)) {
            const map: Record<EscolaridadStatus, { label: string; color: string }> = {
              regular: { label: 'Regular', color: 'green' },
              repitiente: { label: 'Repitiente', color: 'orange' },
              materia_pendiente: { label: 'Materia pendiente', color: 'blue' }
            };
            const info = map[record.tempData.escolaridad] ?? { label: record.tempData.escolaridad, color: 'default' };
            return <div className="px-1 py-0.5"><Tag color={info.color} className="m-0 text-[10px] leading-none px-1 py-0">{info.label}</Tag></div>;
          }
          return (
            <div data-row-index={idx} data-col-name="escolaridad">
              <Select
                id={`nav-${idx}-escolaridad`}
                value={record.tempData.escolaridad}
                style={{ width: '100%' }}
                size="small"
                onChange={(v) => handleUpdateRow(record.id, 'escolaridad', v as EscolaridadStatus)}
                options={ESCOLARIDAD_OPTIONS}
              />
            </div>
          );
        }
      },
    ].filter(Boolean);

    const contactCols = [
      isColumnVisible('phone1') && {
        title: 'S. Principal',
        width: 140,
        render: (_: unknown, record: MatriculationRow, idx: number) => (
          <CellInput
            id={`nav-${idx}-phone1`}
            data-row-index={idx}
            data-col-name="phone1"
            value={record.tempData.phone1}
            disabled={!canEditRow(record.id)}
            className="w-full bg-transparent px-1 py-0.5 border-transparent focus:border-blue-400 focus:outline-none focus:bg-white rounded text-xs transition-colors"
            onChange={val => handleUpdateRow(record.id, 'phone1', val)}
          />
        )
      },
      isColumnVisible('whatsapp') && {
        title: 'WhatsApp',
        width: 140,
        render: (_: unknown, record: MatriculationRow, idx: number) => (
          <CellInput
            id={`nav-${idx}-whatsapp`}
            data-row-index={idx}
            data-col-name="whatsapp"
            value={record.tempData.whatsapp}
            disabled={!canEditRow(record.id)}
            className="w-full bg-transparent px-1 py-0.5 border-transparent focus:border-blue-400 focus:outline-none focus:bg-white rounded text-xs transition-colors"
            onChange={val => handleUpdateRow(record.id, 'whatsapp', val)}
          />
        )
      },
    ].filter(Boolean);

    const motherCols = [
      isColumnVisible('motherDocument') && {
        title: 'Cédula',
        width: 130,
        render: (_: unknown, record: MatriculationRow, idx: number) => (
          <CellInput
            id={`nav-${idx}-mDoc`}
            data-row-index={idx}
            data-col-name="mDoc"
            value={record.tempData.mother?.document}
            placeholder="Doc..."
            disabled={!canEditRow(record.id)}
            className="w-full bg-transparent px-1 py-0.5 border-transparent focus:border-blue-400 focus:outline-none focus:bg-white rounded text-xs transition-colors"
            onChange={val => handleUpdateGuardianField(record.id, 'mother', 'document', val)}
          />
        )
      },
      isColumnVisible('motherFirstName') && {
        title: 'Nombres',
        width: 140,
        render: (_: unknown, record: MatriculationRow, idx: number) => (
          <CellInput
            id={`nav-${idx}-mFirstName`}
            data-row-index={idx}
            data-col-name="mFirstName"
            value={record.tempData.mother?.firstName}
            disabled={!canEditRow(record.id)}
            className="w-full bg-transparent px-1 py-0.5 border-transparent focus:border-blue-400 focus:outline-none focus:bg-white rounded text-xs transition-colors"
            onChange={val => handleUpdateGuardianField(record.id, 'mother', 'firstName', val)}
          />
        )
      },
      isColumnVisible('motherLastName') && {
        title: 'Apellidos',
        width: 140,
        render: (_: unknown, record: MatriculationRow, idx: number) => (
          <CellInput
            id={`nav-${idx}-mLastName`}
            data-row-index={idx}
            data-col-name="mLastName"
            value={record.tempData.mother?.lastName}
            disabled={!canEditRow(record.id)}
            className="w-full bg-transparent px-1 py-0.5 border-transparent focus:border-blue-400 focus:outline-none focus:bg-white rounded text-xs transition-colors"
            onChange={val => handleUpdateGuardianField(record.id, 'mother', 'lastName', val)}
          />
        )
      },
      isColumnVisible('motherPhone') && {
        title: 'Teléfono',
        width: 130,
        render: (_: unknown, record: MatriculationRow, idx: number) => (
          <CellInput
            id={`nav-${idx}-mPhone`}
            data-row-index={idx}
            data-col-name="mPhone"
            value={record.tempData.mother?.phone}
            disabled={!canEditRow(record.id)}
            className="w-full bg-transparent px-1 py-0.5 border-transparent focus:border-blue-400 focus:outline-none focus:bg-white rounded text-xs transition-colors"
            onChange={val => handleUpdateGuardianField(record.id, 'mother', 'phone', val)}
          />
        )
      },
    ].filter(Boolean);

    const fatherCols = [
      isColumnVisible('fatherDocument') && {
        title: 'Cédula',
        width: 130,
        render: (_: unknown, record: MatriculationRow, idx: number) => (
          <CellInput
            id={`nav-${idx}-fDoc`}
            data-row-index={idx}
            data-col-name="fDoc"
            value={record.tempData.father?.document}
            placeholder="Doc..."
            disabled={!canEditRow(record.id)}
            className="w-full bg-transparent px-1 py-0.5 border-transparent focus:border-blue-400 focus:outline-none focus:bg-white rounded text-xs transition-colors"
            onChange={val => handleUpdateGuardianField(record.id, 'father', 'document', val)}
          />
        )
      },
      isColumnVisible('fatherFirstName') && {
        title: 'Nombres',
        width: 140,
        render: (_: unknown, record: MatriculationRow, idx: number) => (
          <CellInput
            id={`nav-${idx}-fFirstName`}
            data-row-index={idx}
            data-col-name="fFirstName"
            value={record.tempData.father?.firstName}
            disabled={!canEditRow(record.id)}
            className="w-full bg-transparent px-1 py-0.5 border-transparent focus:border-blue-400 focus:outline-none focus:bg-white rounded text-xs transition-colors"
            onChange={val => handleUpdateGuardianField(record.id, 'father', 'firstName', val)}
          />
        )
      },
      isColumnVisible('fatherLastName') && {
        title: 'Apellidos',
        width: 140,
        render: (_: unknown, record: MatriculationRow, idx: number) => (
          <CellInput
            id={`nav-${idx}-fLastName`}
            data-row-index={idx}
            data-col-name="fLastName"
            value={record.tempData.father?.lastName}
            disabled={!canEditRow(record.id)}
            className="w-full bg-transparent px-1 py-0.5 border-transparent focus:border-blue-400 focus:outline-none focus:bg-white rounded text-xs transition-colors"
            onChange={val => handleUpdateGuardianField(record.id, 'father', 'lastName', val)}
          />
        )
      },
      isColumnVisible('fatherPhone') && {
        title: 'Teléfono',
        width: 130,
        render: (_: unknown, record: MatriculationRow, idx: number) => (
          <CellInput
            id={`nav-${idx}-fPhone`}
            data-row-index={idx}
            data-col-name="fPhone"
            value={record.tempData.father?.phone}
            disabled={!canEditRow(record.id)}
            className="w-full bg-transparent px-1 py-0.5 border-transparent focus:border-blue-400 focus:outline-none focus:bg-white rounded text-xs transition-colors"
            onChange={val => handleUpdateGuardianField(record.id, 'father', 'phone', val)}
          />
        )
      },
    ].filter(Boolean);

    const representativeCols = [
      isColumnVisible('representativeType') && {
        title: 'Asignar',
        width: 140,
        render: (_: unknown, record: MatriculationRow, idx: number) => (
          <div data-row-index={idx} data-col-name="repType">
            <Select
              id={`nav-${idx}-repType`}
              value={record.tempData.representativeType}
              style={{ width: '100%' }}
              size="small"
              onChange={v => handleUpdateRow(record.id, 'representativeType', v)}
            >
              <Option value="mother">Madre</Option>
              <Option value="father">Padre</Option>
              <Option value="other">Otro</Option>
            </Select>
          </div>
        )
      },
      isColumnVisible('representativeDocument') && {
        title: 'Cédula',
        width: 140,
        render: (_: unknown, record: MatriculationRow, idx: number) => {
          const { profile, editable, label } = getRepresentativeInfo(record);
          const isDisabled = !canEditRow(record.id) || !editable;
          return (
            <div className="flex flex-col gap-1">
              <CellInput
                id={`nav-${idx}-repDoc`}
                data-row-index={idx}
                data-col-name="repDoc"
                value={profile?.document}
                placeholder="Doc..."
                disabled={isDisabled}
                className="w-full bg-transparent px-1 py-0.5 border-transparent focus:border-blue-400 focus:outline-none focus:bg-white rounded text-xs transition-colors"
                onChange={val => {
                  if (!editable) return;
                  handleUpdateGuardianField(record.id, 'representative', 'document', val);
                }}
              />
              {!editable && <Text type="secondary" style={{ fontSize: 11 }}>Representante: {label}</Text>}
            </div>
          );
        }
      },
      isColumnVisible('representativeFirstName') && {
        title: 'Nombres',
        width: 140,
        render: (_: unknown, record: MatriculationRow, idx: number) => {
          const { profile, editable } = getRepresentativeInfo(record);
          const isDisabled = !canEditRow(record.id) || !editable;
          return (
            <CellInput
              id={`nav-${idx}-repFirstName`}
              data-row-index={idx}
              data-col-name="repFirstName"
              value={profile?.firstName}
              disabled={isDisabled}
              className="w-full bg-transparent px-1 py-0.5 border-transparent focus:border-blue-400 focus:outline-none focus:bg-white rounded text-xs transition-colors"
              onChange={val => {
                if (!editable) return;
                handleUpdateGuardianField(record.id, 'representative', 'firstName', val);
              }}
            />
          );
        }
      },
      isColumnVisible('representativeLastName') && {
        title: 'Apellidos',
        width: 140,
        render: (_: unknown, record: MatriculationRow, idx: number) => {
          const { profile, editable } = getRepresentativeInfo(record);
          const isDisabled = !canEditRow(record.id) || !editable;
          return (
            <CellInput
              id={`nav-${idx}-repLastName`}
              data-row-index={idx}
              data-col-name="repLastName"
              value={profile?.lastName}
              disabled={isDisabled}
              className="w-full bg-transparent px-1 py-0.5 border-transparent focus:border-blue-400 focus:outline-none focus:bg-white rounded text-xs transition-colors"
              onChange={val => {
                if (!editable) return;
                handleUpdateGuardianField(record.id, 'representative', 'lastName', val);
              }}
            />
          );
        }
      },
      isColumnVisible('representativePhone') && {
        title: 'Teléfono',
        width: 130,
        render: (_: unknown, record: MatriculationRow, idx: number) => {
          const { profile, editable } = getRepresentativeInfo(record);
          const isDisabled = !canEditRow(record.id) || !editable;
          return (
            <CellInput
              id={`nav-${idx}-repPhone`}
              data-row-index={idx}
              data-col-name="repPhone"
              value={profile?.phone}
              disabled={isDisabled}
              className="w-full bg-transparent px-1 py-0.5 border-transparent focus:border-blue-400 focus:outline-none focus:bg-white rounded text-xs transition-colors"
              onChange={val => {
                if (!editable) return;
                handleUpdateGuardianField(record.id, 'representative', 'phone', val);
              }}
            />
          );
        }
      },
    ].filter(Boolean);

    const questionCols = questions
      .filter(q => isColumnVisible(getQuestionColumnKey(q.id)))
      .map(q => ({
        title: q.prompt,
        width: 220,
        render: (_: unknown, record: MatriculationRow, idx: number) => {
          const value = record.tempData.enrollmentAnswers?.[q.id];
          const isRowEditable = canEditRow(record.id);
          const colKey = getQuestionColumnKey(q.id);
          if (q.type === 'text') {
            return (
              <CellInput
                data-row-index={idx}
                data-col-name={colKey}
                value={(value as string)}
                placeholder="..."
                disabled={!isRowEditable}
                className="w-full bg-transparent px-1 py-0.5 border-transparent focus:border-blue-400 focus:outline-none focus:bg-white rounded text-xs transition-colors"
                onChange={val => handleUpdateAnswer(record.id, q.id, val)}
              />
            );
          }
          if (q.type === 'select' || q.type === 'checkbox') {
            if (!isRowEditable) {
              const displayVal = Array.isArray(value) ? value.join(', ') : value;
              return (
                <div className="px-1 py-0.5 text-xs text-slate-800 whitespace-nowrap overflow-hidden text-ellipsis min-h-[20px]">
                  {displayVal}
                </div>
              );
            }
            return (
              <div data-row-index={idx} data-col-name={colKey}>
                <Select
                  mode={q.type === 'checkbox' ? 'multiple' : undefined}
                  style={{ width: '100%' }}
                  size="small"
                  value={value as string | string[] | undefined}
                  placeholder="Elija..."
                  disabled={!isRowEditable}
                  onChange={v => handleUpdateAnswer(record.id, q.id, v)}
                >
                  {(q.options || []).map(opt => (
                    <Option key={opt} value={opt}>{opt}</Option>
                  ))}
                </Select>
              </div>
            );
          }
          return null;
        }
      }));

    return [
      studentCols.length > 0 && {
        title: renderGroupTitle('Estudiante', <Space><UserOutlined /> Estudiante</Space>),
        fixed: (pinnedGroups.includes('Estudiante') ? 'left' : undefined) as 'left' | undefined,
        className: 'group-separator-border',
        children: addSeparator(studentCols)
      },
      academicCols.length > 0 && {
        title: renderGroupTitle('Académico', <Space><BookOutlined /> Académico</Space>),
        fixed: (pinnedGroups.includes('Académico') ? 'left' : undefined) as 'left' | undefined,
        className: 'group-separator-border',
        children: addSeparator(academicCols)
      },
      contactCols.length > 0 && {
        title: renderGroupTitle('Contacto', 'Contacto'),
        fixed: (pinnedGroups.includes('Contacto') ? 'left' : undefined) as 'left' | undefined,
        className: 'group-separator-border',
        children: addSeparator(contactCols)
      },
      (motherCols.length > 0 || fatherCols.length > 0 || representativeCols.length > 0) && {
        title: renderGroupTitle('Representación', 'Representación'),
        className: 'group-separator-border',
        children: addSeparator([
          motherCols.length > 0 && { title: <Text strong style={{ color: '#eb2f96' }}>Madre</Text>, children: motherCols },
          fatherCols.length > 0 && { title: <Text strong style={{ color: '#1890ff' }}>Padre</Text>, children: fatherCols },
          representativeCols.length > 0 && { title: 'Representante', children: representativeCols }
        ].filter(Boolean))
      },
      questionCols.length > 0 && {
        title: renderGroupTitle('Preguntas Personalizadas', <Space><QuestionCircleOutlined /> Preguntas</Space>),
        children: questionCols
      }
    ].filter(Boolean) as ColumnsType<MatriculationRow>;
  }, [
    structure,
    questions,
    pinnedGroups,
    handleUpdateRow,
    handleUpdateGuardianField,
    handleUpdateAnswer,
    renderGroupTitle,
    addSeparator,
    isColumnVisible,
    canEditRow
  ]);

  return (
    <div className="flex flex-col gap-2 h-full" onKeyDown={handleTableKeyDown}>
      <div ref={headerRef} className="flex flex-col gap-2 shrink-0">
        <Card 
          size="small" 
          styles={{ body: { padding: '2px 12px' } }} 
          className="glass-card !bg-white/50 border-none shrink-0"
        >
          <Row justify="space-between" align="middle" gutter={[4, 4]}>
            <Col xs={24} lg={8}>
              <div className="flex flex-col items-start gap-1">
                <Space>
                  <Title level={5} style={{ margin: 0 }}>Matricula Estudiantes</Title>
                </Space>
                <div className="flex items-center gap-2">
                  <Radio.Group 
                    value={viewStatus} 
                    onChange={e => {
                      setViewStatus(e.target.value);
                      setCurrentPage(1);
                    }}
                    size="small"
                    buttonStyle="solid"
                  >
                    <Radio.Button value="pending">No Matriculados</Radio.Button>
                    <Radio.Button value="completed">Matriculados</Radio.Button>
                  </Radio.Group>
                  <Pagination
                    simple
                    size="small"
                    current={currentPage}
                    pageSize={pageSize}
                    total={filteredData.length}
                    onChange={(page, size) => {
                      setCurrentPage(page);
                      if (size !== pageSize) setPageSize(size);
                    }}
                    showSizeChanger={false}
                    showTotal={(total, range) => (
                      <span className="text-[10px] text-slate-400 font-normal ml-2">
                        {range[0]}-{range[1]} de {total}
                      </span>
                    )}
                  />
                </div>
              </div>
            </Col>
            <Col xs={24} lg={16}>
              <Row gutter={[4, 4]} justify="end">
                <Col>
                  <Select
                    placeholder="Grado"
                    size="small"
                    style={{ width: 140 }}
                    allowClear
                    value={filterGrade}
                    onChange={v => { setFilterGrade(v); setFilterSection(null); }}
                  >
                    {structure.map(s => <Option key={s.gradeId} value={s.gradeId}>{s.grade?.name}</Option>)}
                  </Select>
                </Col>
                <Col>
                  <Select
                    placeholder="Escolaridad"
                    size="small"
                    style={{ width: 140 }}
                    allowClear
                    value={filterEscolaridad}
                    onChange={setFilterEscolaridad}
                  >
                    <Option value="regular">Regular</Option>
                    <Option value="repitiente">Repitiente</Option>
                    <Option value="materia_pendiente">Materia pendiente</Option>
                  </Select>
                </Col>
                <Col>
                  <Select
                    placeholder="Sección"
                    size="small"
                    style={{ width: 100 }}
                    allowClear
                    value={filterSection}
                    disabled={!filterGrade}
                    onChange={setFilterSection}
                  >
                    {structure.find(s => s.gradeId === filterGrade)?.sections?.map(sec => (
                      <Option key={sec.id} value={sec.id}>{sec.name}</Option>
                    ))}
                  </Select>
                </Col>
                <Col>
                  <Select
                    placeholder="Género"
                    size="small"
                    style={{ width: 100 }}
                    allowClear
                    value={filterGender}
                    onChange={setFilterGender}
                  >
                    <Option value="M">Masc</Option>
                    <Option value="F">Fem</Option>
                  </Select>
                </Col>
                <Col>
                  <Select
                    placeholder="Datos Faltantes"
                    size="small"
                    style={{ width: 140 }}
                    allowClear
                    value={filterMissing}
                    onChange={setFilterMissing}
                  >
                    <Option value="guardians">Sin Representantes</Option>
                    <Option value="contact">Sin Teléfono</Option>
                    <Option value="questions">Preguntas Pendientes</Option>
                    <Option value="all">Cualquier Dato Faltante</Option>
                  </Select>
                </Col>
                <Col>
                  <Input
                    placeholder="Buscar..."
                    size="small"
                    prefix={<SearchOutlined />}
                    style={{ width: 180 }}
                    value={searchValue}
                    onChange={e => setSearchValue(e.target.value)}
                    allowClear
                  />
                </Col>
                <Col>
                  <Popover
                    content={columnMenuContent}
                    trigger="click"
                    open={columnPopoverOpen}
                    onOpenChange={setColumnPopoverOpen}
                    placement="bottomRight"
                  >
                    <Button icon={<TableOutlined />} type="default" size="small">
                      Columnas
                    </Button>
                  </Popover>
                </Col>
                <Col>
                  <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading} size="small">Actualizar</Button>
                </Col>
              </Row>
            </Col>
          </Row>
        </Card>

        <Card
          size="small"
          bodyStyle={{ padding: '8px 12px' }}
          style={{
            marginBottom: 0,
            background: selectedRowKeys.length > 0 ? '#e6f7ff' : '#f8fafc',
            borderColor: selectedRowKeys.length > 0 ? '#91d5ff' : '#e2e8f0',
            transition: 'all 0.3s ease',
            position: 'relative',
            flexShrink: 0
          }}
        >
          {/* Clear button in top-right corner */}
          {selectedRowKeys.length > 0 && (
            <Button
              type="text"
              size="small"
              icon={<CloseOutlined />}
              onClick={() => setSelectedRowKeys([])}
              style={{
                position: 'absolute',
                top: '-8px',
                right: '-5px',
                color: '#888',
                zIndex: 10
              }}
            />
          )}

          {viewStatus === 'pending' ? (
            <div className="flex items-center gap-6">
              {/* Section 1: Counter o Info del Estudiante */}
              <div className="flex items-center gap-2 pr-4 border-r border-slate-300/50 min-w-max">
                {selectedRowKeys.length === 1 ? (
                  <>
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white shadow-sm">
                      <UserOutlined />
                    </div>
                    <div className="flex flex-col justify-center">
                      <span className="text-xs font-bold text-blue-900 leading-tight">
                        {matriculations.find(r => r.id === selectedRowKeys[0])?.student.firstName} {matriculations.find(r => r.id === selectedRowKeys[0])?.student.lastName}
                      </span>
                      <span className="text-[10px] text-blue-700 leading-none mt-0.5">
                        {matriculations.find(r => r.id === selectedRowKeys[0])?.student.documentType}-{matriculations.find(r => r.id === selectedRowKeys[0])?.student.document}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div
                      className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold shadow-sm transition-colors ${selectedRowKeys.length > 0 ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-400'
                        }`}
                    >
                      {selectedRowKeys.length}
                    </div>
                    <div className={`flex flex-col leading-tight font-bold text-[10px] uppercase tracking-wide ${selectedRowKeys.length > 0 ? 'text-blue-900' : 'text-slate-400'}`}>
                      <span>Estudiantes</span>
                      <span>Seleccionados</span>
                    </div>
                  </>
                )}
              </div>

              {/* Section 2: Inputs Grid */}
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2">
                {/* Assign Section */}
                <div className="flex flex-col gap-0.5">
                  <span className={`text-[9px] font-bold uppercase tracking-wider ${selectedRowKeys.length > 0 ? 'text-slate-500' : 'text-slate-300'}`}>
                    Asignar Sección
                  </span>
                  <Tooltip
                    title={hasMixedGrades ? 'Seleccione estudiantes del mismo grado para asignar secciones.' : undefined}
                    placement="topLeft"
                  >
                    <Select
                      disabled={selectedRowKeys.length === 0 || hasMixedGrades || bulkSections.length === 0}
                      placeholder="Seleccionar..."
                      size="small"
                      style={{ width: 200 }}
                      onChange={v => handleBulkUpdate('sectionId', v)}
                      allowClear
                      notFoundContent={hasMixedGrades ? 'Seleccione estudiantes del mismo grado' : undefined}
                    >
                      {bulkSections.map(sec => (
                        <Option key={sec.id} value={sec.id}>{sec.name}</Option>
                      ))}
                    </Select>
                  </Tooltip>
                </div>

                {/* Group Subjects */}
                <div className="flex flex-col gap-0.5">
                  <span className={`text-[9px] font-bold uppercase tracking-wider ${selectedRowKeys.length > 0 ? 'text-slate-500' : 'text-slate-300'}`}>
                    Materias de Grupo
                  </span>
                  <Tooltip
                    title={hasMixedGrades ? 'Seleccione estudiantes del mismo grado para asignar materias de grupo.' : undefined}
                    placement="topLeft"
                  >
                    <Select
                      disabled={selectedRowKeys.length === 0 || hasMixedGrades || bulkGroupSubjects.length === 0}
                      placeholder="Asignar Materia..."
                      size="small"
                      style={{ width: 200 }}
                      onChange={v => handleBulkUpdate('subjectIds', v ? [v] : [])}
                      allowClear
                      notFoundContent={hasMixedGrades ? 'Seleccione estudiantes del mismo grado' : undefined}
                      options={bulkGroupSubjects.map(sub => ({ label: sub.name, value: sub.id }))}
                    />
                  </Tooltip>
                </div>
              </div>

              {/* Section 3: Actions */}
              <div className="flex items-center pl-4 border-l border-slate-300/50 min-w-max">
                <Button
                  disabled={selectedRowKeys.length === 0}
                  type="primary"
                  size="middle"
                  icon={<CheckCircleOutlined />}
                  onClick={handleBulkEnroll}
                  className="bg-blue-600 hover:bg-blue-500 border-none shadow-md shadow-blue-500/30"
                >
                  Inscribir
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-6">
              {/* Section 1: Counter o Info del Estudiante */}
              <div className="flex items-center gap-2 pr-4 border-r border-slate-300/50 min-w-max">
                {selectedRowKeys.length === 1 ? (
                  <>
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white shadow-sm">
                      <UserOutlined />
                    </div>
                    <div className="flex flex-col justify-center">
                      <span className="text-xs font-bold text-blue-900 leading-tight">
                        {matriculations.find(r => r.id === selectedRowKeys[0])?.student.firstName} {matriculations.find(r => r.id === selectedRowKeys[0])?.student.lastName}
                      </span>
                      <span className="text-[10px] text-blue-700 leading-none mt-0.5">
                        {matriculations.find(r => r.id === selectedRowKeys[0])?.student.documentType}-{matriculations.find(r => r.id === selectedRowKeys[0])?.student.document}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div
                      className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold shadow-sm transition-colors ${selectedRowKeys.length > 0 ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-400'
                        }`}
                    >
                      {selectedRowKeys.length}
                    </div>
                    <div className={`flex flex-col leading-tight font-bold text-[10px] uppercase tracking-wide ${selectedRowKeys.length > 0 ? 'text-blue-900' : 'text-slate-400'}`}>
                      <span>Estudiantes</span>
                      <span>Seleccionados</span>
                    </div>
                  </>
                )}
              </div>

              {/* Section 2: Actions for Completed */}
              <div className="flex-1 flex gap-2 items-center">
                {/* Botones solo para 1 estudiante seleccionado */}
                {selectedRowKeys.length === 1 && (
                  <>
                    <Tooltip title="Gestionar materias del estudiante">
                      <Button
                        icon={<BookOutlined />}
                        size="small"
                        onClick={handleOpenSubjectModal}
                        className='border-blue-300 text-blue-600 bg-white'
                      >
                        Gestionar Materias
                      </Button>
                    </Tooltip>

                    <Tooltip title="Ver expediente del estudiante">
                      <Button
                        icon={<EyeOutlined />}
                        size="small"
                        onClick={handleViewProfile}
                        className='border-blue-300 text-blue-600 bg-white'
                      >
                        Ver Expediente
                      </Button>
                    </Tooltip>
                  </>
                )}

                {/* Selector de materias de grupo: para 1 o varios del mismo grado */}
                {selectedRowKeys.length > 0 && !hasMixedGrades && bulkGroupSubjects.length > 0 && (
                  <div className="flex flex-col gap-0.5 flex-1">
                    <span className={`text-[9px] font-bold uppercase tracking-wider ${selectedRowKeys.length > 0 ? 'text-slate-500' : 'text-slate-300'}`}>
                      Materias de Grupo
                    </span>
                    <Select
                      placeholder="Asignar Materia..."
                      size="small"
                      style={{ width: 200 }}
                      onChange={(v) => handleBulkUpdate('subjectIds', v ? [v] : [])}
                      allowClear
                      options={bulkGroupSubjects.map(s => ({ label: s.name, value: s.id }))}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={currentData}
        loading={loading}
        pagination={false}
        scroll={{ x: 'max-content', y: scrollY }}
        rowSelection={{
          type: 'checkbox',
          selectedRowKeys,
          onChange: setSelectedRowKeys
        }}
        rowClassName={record => (canEditRow(record.id) ? 'editable-row' : 'locked-row')}
        onRow={(record) => ({
          onContextMenu: (event) => handleContextMenu(event, record.id),
          onKeyDown: (event) => {
            if (event.key === 'Enter' && canEditRow(record.id)) {
              lockRow(record.id);
              event.stopPropagation();
            }
          }
        })}
        size="small"
        bordered
        className="flex-1 overflow-hidden"
      />

      {selectedStudentForSubjects && (
        <StudentSubjectsModal
          visible={subjectModalVisible}
          onClose={() => setSubjectModalVisible(false)}
          inscriptionId={selectedStudentForSubjects.inscriptionId}
          studentName={selectedStudentForSubjects.studentName}
          gradeId={selectedStudentForSubjects.gradeId}
          schoolPeriodId={selectedStudentForSubjects.schoolPeriodId}
        />
      )}

      {contextMenuState.visible && createPortal(
        <div
          ref={contextMenuRef}
          className="context-menu ant-dropdown"
          style={{
            position: 'fixed',
            top: contextMenuState.y,
            left: contextMenuState.x,
            transform: 'translate(-50%, 4px)',
            background: '#fff',
            borderRadius: 8,
            boxShadow: '0 12px 30px rgba(15, 23, 42, 0.18)',
            zIndex: 2000,
            minWidth: 200,
            overflow: 'hidden',
            border: '1px solid #e2e8f0'
          }}
          onContextMenu={e => e.preventDefault()}
        >
          <Menu
            selectable={false}
            items={contextMenuItems}
            onClick={handleContextMenuClick}
            className="context-menu__menu"
          />
        </div>,
        document.body
      )}

      <style>{`
        /* 1. Global Header Styles */
        .ant-table-thead > tr > th {
          background-color: #f1f5f9 !important;
          color: #475569 !important;
          font-weight: 700 !important;
          font-size: 11px !important;
          padding: 6px 8px !important;
          text-transform: uppercase !important;
          border-right: 1px solid #e2e8f0 !important;
          border-bottom: 1px solid #e2e8f0 !important;
        }

        /* 2. Global Body Styles - Grid & Spacing */
        .ant-table-tbody > tr > td {
          padding: 2px 4px !important;
          border-right: 1px solid #e2e8f0 !important;
          border-bottom: 1px solid #e2e8f0 !important;
          transition: background-color 0.2s;
        }
        
        /* New Group Separator Border */
        .group-separator-border {
          border-right: 2px solid #94a3b8 !important; /* Slate 400 */
        }    

        /* 3. Alternating Row Colors (Zebra Striping) */
        .ant-table-tbody > tr:nth-child(odd) > td {
          background-color: #ffffff !important;
        }
        .ant-table-tbody > tr:nth-child(even) > td {
          background-color: #f8fafc !important; /* Light Slate 50 */
        }

        /* 4. Hover Styles */
        .ant-table-tbody > tr:hover > td {
          background-color: #e2e8f0 !important; /* Slate 200 */
        }

        /* 5. Global Selected Styles */
        .ant-table-tbody > tr.ant-table-row-selected > td {
          background-color: #bae7ff !important; /* Stronger blue for selection */
        }

        /* 6. Input Styles */
        .ant-input, .ant-select-selector {
          border: 1px solid transparent !important;
          background: transparent !important;
          border-radius: 0px !important; /* Square look for grid */
          height: 26px !important;
          font-size: 12px !important;
          padding-left: 4px !important;
          padding-right: 4px !important;
        }
        .ant-select-selection-item {
          line-height: 24px !important;
        }
        .ant-input-affix-wrapper .ant-input {
          outline: none !important;
          border: none !important;
          height: 22px !important;
        }
        .ant-input-affix-wrapper  {
          height: 24px !important;
        }

        /* Show inputs on hover/focus */
        .ant-table-row:hover .ant-input,
        .ant-table-row:hover .ant-select-selector,
        .ant-input:focus,
        .ant-select-focused .ant-select-selector,
        input:focus {
          border-color: #cbd5e1 !important;
          background: #ffffff !important;
          border-radius: 4px !important;
        }
        .ant-input:focus, .ant-select-focused .ant-select-selector, input:focus {
          border-color: #3b82f6 !important;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1) !important;
        }
        .editable-row > td {
          background-color: #fff3c4 !important;
          box-shadow: inset 0 0 0 1px #fde68a;
        }
        .locked-row > td {
          background-color: #f8fafc !important;
          color: #94a3b8;
        }
        .locked-row input,
        .locked-row .ant-input,
        .locked-row .ant-select-selector {
          color: #1e293b !important; /* Slate 800 for readability */
          pointer-events: none;
        }
        .locked-row .always-editable,
        .locked-row .always-editable .ant-select-selector {
          pointer-events: auto;
          color: inherit !important;
        }
        .locked-row .ant-select-selection-item,
        .locked-row .ant-select-selection-placeholder {
          color: #1e293b !important; /* Slate 800 */
        }
        
        /* Native Input Disabled Look */
        input:disabled {
          background-color: transparent;
          color: #1e293b; /* Slate 800 */
        }
      `}</style>
    </div >
  );
};

export default MatriculationEnrollment;
