import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/context/AuthContext';
import {
  Button,
  Card,
  Checkbox,
  Col,
  Input,
  Menu,
  message,
  Modal,
  Popover,
  Radio,
  Row,
  Select,
  Space,
  Tooltip,
  Typography,
} from 'antd';
import type { MenuProps } from 'antd';
import {
  ReloadOutlined,
  SearchOutlined,
  UserOutlined,
  UserAddOutlined,
  CheckCircleOutlined,
  BookOutlined,
  EyeOutlined,
  CloseOutlined,
  TableOutlined,
  EditOutlined,
  FileExcelOutlined,
  UserSwitchOutlined,
  EyeInvisibleOutlined,
  PrinterOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import api from '@/services/api';
import type { EnrollmentQuestionResponse } from '@/services/enrollmentQuestions';
import StudentSubjectsModal from '../admin/StudentSubjectsModal';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import SearchGuardianModal from '@/components/shared/SearchGuardianModal';
import type { GuardianProfileResponse } from '@/services/guardians';
import MatriculationAgGrid from './MatriculationAgGrid';
import {
  BASE_COLUMN_OPTIONS as AG_BASE_COLUMN_OPTIONS,
  COLUMN_GROUPS,
  getQuestionColumnKey as agGetQuestionColumnKey,
  type VenezuelaState,
} from './matriculationColumns';

const { Text, Title } = Typography;
const { Option } = Select;

type RepresentativeType = 'mother' | 'father' | 'other';

interface GuardianProfile {
  id?: number;
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
  occupation?: string;
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

const normalizeRelationship = (value: unknown): string => String(value ?? '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim();

const isTruthyRepresentative = (value: unknown): boolean => (
  value === true || value === 1 || value === '1' || normalizeRelationship(value) === 'true' || normalizeRelationship(value) === 'si'
);

interface StudentGuardian {
  relationship: string;
  isRepresentative?: boolean | number | string;
  is_representative?: boolean | number | string;
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
  pathology?: string;
  livingWith?: string;
}

type EscolaridadStatus = 'regular' | 'repitiente' | 'materia_pendiente';

interface SchoolPeriod {
  id: number;
  name: string;
  status: 'preinscripcion' | 'activo' | 'historico' | 'externo';
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
  pathology?: string;
  livingWith?: string;
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
  hiddenFromControlEstudios?: boolean;
}

interface EnrollmentDocumentInfo {
  receivedCertificadoAprendizaje?: boolean;
  receivedCartaBuenaConducta?: boolean;
  receivedNotasCertificadas?: boolean;
  receivedPartidaNacimiento?: boolean;
  receivedCopiaCedulaEstudiante?: boolean;
  receivedInformesMedicos?: boolean;
  receivedFotoCarnetEstudiante?: boolean;
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
  subjects?: { id: number; name: string; subjectGroupId?: number | null }[];
  documents?: EnrollmentDocumentInfo | null;
  hiddenFromControlEstudios?: boolean;
}

interface EnrollStructureEntry {
  id: number;
  gradeId: number;
  order?: number | null;
  grade?: { id: number; name: string; order?: number | null };
  sections?: { id: number; name: string }[];
  subjects?: { id: number; name: string; subjectGroupId?: number | null; subjectGroup?: { name: string } }[];
}

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
      },
      {
        key: 'change-representative',
        icon: <UserSwitchOutlined />,
        label: 'Cambiar Representante'
      }
    ]
  }
];

// Fixed height reserved for the bulk action bar. The space is always taken up
// so the grid below never jumps when the bar appears/disappears.
const BULK_BAR_HEIGHT = 56;

const MatriculationEnrollment: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManageVisibility = !!user?.roles.some(r => r === 'Administrador' || r === 'Master');
  const [activePeriod, setActivePeriod] = useState<SchoolPeriod | null>(null);
  const [viewStatus, setViewStatus] = useState<'pending' | 'completed'>('pending');
  const [matriculations, setMatriculations] = useState<MatriculationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [structure, setStructure] = useState<EnrollStructureEntry[]>([]);
  const [locations, setLocations] = useState<VenezuelaState[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);
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
  const [guardianModalVisible, setGuardianModalVisible] = useState(false);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  // Helper function to load filters from localStorage
  const loadSavedFilters = () => {
    try {
      const savedFilters = localStorage.getItem('matriculation-filters');
      if (savedFilters) {
        return JSON.parse(savedFilters);
      }
    } catch (e) {
      console.error('Error loading filters from localStorage:', e);
    }
    return {};
  };

  const savedFilters = loadSavedFilters();

  const [searchValue, setSearchValue] = useState(savedFilters.searchValue || '');
  const [questions, setQuestions] = useState<EnrollmentQuestionResponse[]>([]);
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<string[]>(() => savedFilters.visibleColumnKeys || AG_BASE_COLUMN_OPTIONS.map((option: { key: string }) => option.key));
  const [columnPopoverOpen, setColumnPopoverOpen] = useState(false);
  const [filterGrade, setFilterGrade] = useState<number | null>(savedFilters.filterGrade ?? null);
  const [filterSection, setFilterSection] = useState<number | null>(savedFilters.filterSection ?? null);
  const [filterGender, setFilterGender] = useState<string | null>(savedFilters.filterGender ?? null);
  const [filterEscolaridad, setFilterEscolaridad] = useState<'regular' | 'repitiente' | 'materia_pendiente' | null>(savedFilters.filterEscolaridad ?? null);
  const [filterSchoolPeriod, setFilterSchoolPeriod] = useState<number | null>(savedFilters.filterSchoolPeriod ?? null);
  const [allPeriods, setAllPeriods] = useState<SchoolPeriod[]>([]);
  const [filterMissing, setFilterMissing] = useState<string | null>(savedFilters.filterMissing ?? null);
  const [filterInscription, setFilterInscription] = useState<'inscrito' | 'no_inscrito' | null>(savedFilters.filterInscription ?? null);
  const [nominaModalOpen, setNominaModalOpen] = useState(false);
  const [nominaGradeId, setNominaGradeId] = useState<number | null>(null);
  const [nominaSectionId, setNominaSectionId] = useState<number | null>(null);
  const [nominaTeacher, setNominaTeacher] = useState('');
  const [scrollY, setScrollY] = useState(500);
  const headerRef = useRef<HTMLDivElement>(null);
  const bulkActionRef = useRef<HTMLDivElement>(null);

  // Save filters to localStorage whenever they change
  useEffect(() => {
    const filters = {
      searchValue,
      visibleColumnKeys,
      filterGrade,
      filterSection,
      filterGender,
      filterEscolaridad,
      filterSchoolPeriod,
      filterMissing,
      filterInscription
    };
    localStorage.setItem('matriculation-filters', JSON.stringify(filters));
  }, [searchValue, visibleColumnKeys, filterGrade, filterSection, filterGender, filterEscolaridad, filterSchoolPeriod, filterMissing, filterInscription]);

  useEffect(() => {
    const updateScrollY = () => {
      const vh = window.innerHeight;
      let headerBottom = 0;

      if (headerRef.current) {
        const rect = headerRef.current.getBoundingClientRect();
        headerBottom = rect.bottom;
      }

      // Buffer: Table Header (grouped ~80px) + Horizontal Scrollbar (~15px) + Bottom Margin (~10px) + Extra safety
      const tableOverhead = 115;
      const calculated = vh - headerBottom - tableOverhead;

      setScrollY(Math.max(200, calculated));
    };

    updateScrollY();
    const timer = setTimeout(updateScrollY, 50);
    window.addEventListener('resize', updateScrollY);
    return () => {
      window.removeEventListener('resize', updateScrollY);
      clearTimeout(timer);
    };
  }, [selectedRowKeys.length, viewStatus, structure.length]);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [periodRes, allPeriodsRes, questionsRes] = await Promise.all([
          api.get('/academic/periods/active'),
          api.get('/academic/periods'),
          api.get('/enrollment-questions')
        ]);
        if (periodRes.data) setActivePeriod(periodRes.data);
        else message.warning('No hay un período académico activo configurado.');
        if (allPeriodsRes.data) {
          setAllPeriods(allPeriodsRes.data);

          // Only preseleccionar el período activo if no saved filter exists
          const savedFilters = localStorage.getItem('matriculation-filters');
          const hasSavedPeriodFilter = savedFilters ? JSON.parse(savedFilters).filterSchoolPeriod !== undefined : false;

          if (!hasSavedPeriodFilter) {
            const activePeriod = allPeriodsRes.data.find((p: any) => p.status === 'activo');
            if (activePeriod) {
              setFilterSchoolPeriod(activePeriod.id);
            }
          }
        }
        if (questionsRes.data) setQuestions(questionsRes.data);
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
    setLoading(true);
    try {
      const endpoint = viewStatus === 'completed' ? '/inscriptions' : '/matriculations';
      const params: any = {
        status: viewStatus === 'pending' ? 'pending' : undefined,
        schoolPeriodId: filterSchoolPeriod || undefined // Usar filtro si está seleccionado, sino no filtrar
      };
      const [dataRes, structRes, locRes] = await Promise.all([
        api.get(endpoint, { params }),
        api.get(`/academic/structure/${filterSchoolPeriod || activePeriod?.id}`),
        api.get('/locations/venezuela'),
      ]);
      if (locRes.data) setLocations(locRes.data);
      if (dataRes.data) {
        const mapped = dataRes.data.map((item: MatriculationApiResponse) => {
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
          const findGuardianProfile = (relationship: string): GuardianProfile => {
            const profile = (guardians.find((g: StudentGuardian) => (
              normalizeRelationship(g.relationship) === normalizeRelationship(relationship)
            ))?.profile || {}) as GuardianProfile;
            return profile;
          };

          // The API may serialize the boolean flag as boolean, 0/1, or a
          // string depending on the database driver. Support all formats and
          // normalize relationship names before mapping the Vínculo column.
          const representativeAssignment = guardians.find((g: StudentGuardian) => {
            const rawGuardian = g as StudentGuardian & {
              dataValues?: { isRepresentative?: unknown; is_representative?: unknown; relationship?: unknown };
            };
            return isTruthyRepresentative(g.isRepresentative)
              || isTruthyRepresentative(g.is_representative)
              || isTruthyRepresentative(rawGuardian.dataValues?.isRepresentative)
              || isTruthyRepresentative(rawGuardian.dataValues?.is_representative);
          });
          const representativeRelationship = representativeAssignment
            ? (
              representativeAssignment.relationship
              || (representativeAssignment as StudentGuardian & { dataValues?: { relationship?: unknown } }).dataValues?.relationship
            )
            : undefined;
          const rawRepresentativeType = (
            representativeRelationship
            ?? (m as unknown as { representativeType?: unknown }).representativeType
            ?? (student as unknown as { representativeType?: unknown }).representativeType
          );
          const normalizedRepresentativeType = normalizeRelationship(rawRepresentativeType);
          const representativeType: RepresentativeType =
            normalizedRepresentativeType === 'mother' || normalizedRepresentativeType === 'madre'
              ? 'mother'
              : normalizedRepresentativeType === 'father' || normalizedRepresentativeType === 'padre'
                ? 'father'
                : 'other';

          const enrollmentAnswersList = student.enrollmentAnswers ?? [];
          const enrollmentAnswers = enrollmentAnswersList.reduce<EnrollmentAnswersMap>((acc, curr) => {
            acc[curr.questionId] = curr.answer ?? undefined;
            return acc;
          }, {});

          const assignedSubjects = isInscription ? (item.subjects || []) : [];
          const groupSubjectIds = assignedSubjects
            .filter(s => s.subjectGroupId)
            .map(s => s.id);

          return {
            ...m,
            documents: item.documents ?? item.matriculation?.documents ?? null,
            tempData: {
              ...student,
              id: student.id,
              documentType: student.documentType || 'Venezolano',
              gender: student.gender,
              gradeId: m.gradeId,
              sectionId: m.sectionId,
              subjectIds: groupSubjectIds,
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
              pathology: student.pathology || 'N/A',
              livingWith: student.livingWith || 'N/A',
            }
          } as MatriculationRow;
        });
        const uniqueMap = new Map<string, MatriculationRow>();

        mapped.forEach((row: MatriculationRow) => {
          const uniqueKey = row.tempData.document || String(row.tempData.id);
          const existing = uniqueMap.get(uniqueKey);

          if (existing) {
            // Priority: Regular > Materia Pendiente
            const isCurrentPrimary = row.tempData.escolaridad !== 'materia_pendiente';
            const isExistingPrimary = existing.tempData.escolaridad !== 'materia_pendiente';

            if (isCurrentPrimary && !isExistingPrimary) {
              // Replace MP entry with Regular entry, keeping the MP flag AND override status to MP for display
              row.tempData['hasPendingInscription'] = true;
              row.tempData.escolaridad = 'materia_pendiente';
              uniqueMap.set(uniqueKey, row);
            } else if (!isCurrentPrimary && isExistingPrimary) {
              // Keep Regular entry, add MP flag AND override status to MP for display
              existing.tempData['hasPendingInscription'] = true;
              existing.tempData.escolaridad = 'materia_pendiente';
            } else {
              // Should not happen (two regulars or two MPs), keep first
            }
          } else {
            if (row.tempData.escolaridad === 'materia_pendiente') {
              row.tempData['hasPendingInscription'] = true;
            }
            uniqueMap.set(uniqueKey, row);
          }
        });

        setMatriculations(Array.from(uniqueMap.values()));
      }

      if (structRes.data) {
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
      }
    } catch (error) {
      console.error('[MatriculationEnrollment] Error fetching data:', error);
      message.error('Error cargando información');
    } finally {
      setLoading(false);
    }
  }, [viewStatus, filterSchoolPeriod, activePeriod]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Deseleccionar estudiantes al cambiar entre matriculados y no matriculados
  useEffect(() => {
    setSelectedRowKeys([]);
  }, [viewStatus]);

  // Save a single field change to the backend immediately (AG-Grid native editing)
  const saveFieldChange = useCallback(async (rowId: number, changes: Record<string, unknown>) => {
    const row = matriculations.find(r => r.id === rowId);
    if (!row) return;
    const endpoint = viewStatus === 'completed'
      ? `/inscriptions/${row.inscriptionId || rowId}`
      : `/matriculations/${rowId}`;
    try {
      await api.patch(endpoint, changes);
    } catch (error) {
      console.error('Error saving field change:', error);
      message.error('Error al guardar cambio');
      await fetchData();
    }
  }, [matriculations, viewStatus, fetchData]);

  const handleUpdateRow = useCallback(<K extends keyof TempData>(id: number, field: K, value: TempData[K]) => {
    setMatriculations(prev => prev.map(row => (
      row.id === id ? { ...row, tempData: { ...row.tempData, [field]: value } } : row
    )));
    const payload: Record<string, unknown> = {};
    if (field === 'birthdate' && value) {
      payload[field as string] = (value as dayjs.Dayjs).format('YYYY-MM-DD');
    } else {
      payload[field as string] = value;
    }
    saveFieldChange(id, payload);
  }, [saveFieldChange]);

  // Batch update of multiple tempData fields (used by cascading location selects)
  const handleUpdateFields = useCallback((id: number, changes: Partial<TempData>) => {
    setMatriculations(prev => prev.map(row => (
      row.id === id ? { ...row, tempData: { ...row.tempData, ...changes } } : row
    )));
    const payload: Record<string, unknown> = {};
    Object.entries(changes).forEach(([k, v]) => {
      if (k === 'birthdate' && v) {
        payload[k] = (v as dayjs.Dayjs).format('YYYY-MM-DD');
      } else {
        payload[k] = v;
      }
    });
    saveFieldChange(id, payload);
  }, [saveFieldChange]);

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
    saveFieldChange(rowId, { [parentKey]: updatedProfile });
  }, [saveFieldChange]);

  // Batch update of multiple guardian fields (used by cascading location selects)
  const handleUpdateGuardianFields = useCallback((
    rowId: number,
    parentKey: 'mother' | 'father' | 'representative',
    changes: Partial<GuardianProfile>
  ) => {
    let updatedProfile: GuardianProfile = {};
    setMatriculations(prev => prev.map(row => {
      if (row.id !== rowId) return row;
      const guardian = { ...(row.tempData[parentKey] || {}) } as GuardianProfile;
      Object.assign(guardian, changes);
      updatedProfile = guardian;
      return { ...row, tempData: { ...row.tempData, [parentKey]: guardian } };
    }));
    saveFieldChange(rowId, { [parentKey]: updatedProfile });
  }, [saveFieldChange]);

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
    const formattedAnswers = Object.entries(updatedAnswers).map(([qId, ans]) => ({
      questionId: Number(qId),
      answer: ans
    }));
    saveFieldChange(rowId, { enrollmentAnswers: formattedAnswers });
  }, [saveFieldChange]);

  const handleBulkToggleVisibility = async (hidden: boolean) => {
    const ids = selectedRowKeys.map(k => Number(k));
    if (ids.length === 0) return;

    message.loading({ content: hidden ? 'Desinscribiendo estudiantes...' : 'Inscribiendo estudiantes...', key: 'vis' });
    try {
      await api.post('/matriculations/bulk-visibility', { ids, hidden });
      message.success({ content: hidden ? 'Estudiantes desinscritos' : 'Estudiantes inscritos', key: 'vis' });
      setSelectedRowKeys([]);
      fetchData();
    } catch (err: any) {
      const apiErr = err as { response?: { data?: { error?: string } } };
      message.error({ content: apiErr?.response?.data?.error || 'Error al cambiar inscripción', key: 'vis' });
    }
  };

  const handleToggleInscription = async (id: number, hidden: boolean) => {
    try {
      await api.patch(`/matriculations/${id}/visibility`, { hidden });
      setMatriculations(prev => prev.map(r => r.id === id ? { ...r, hiddenFromControlEstudios: hidden } : r));
    } catch (err: any) {
      const apiErr = err as { response?: { data?: { error?: string } } };
      message.error(apiErr?.response?.data?.error || 'Error al cambiar inscripción');
    }
  };

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

  const handleBulkSubjectSave = useCallback(async (subjectIds: number[]) => {
    const rows = matriculations.filter(r => selectedRowKeys.includes(r.id));
    if (rows.length === 0) return;

    message.loading({ content: `Asignando materia de grupo a ${rows.length} estudiante(s)...`, key: 'bulk-subject' });

    let errors = 0;
    for (const row of rows) {
      const inscriptionId = row.inscriptionId;
      if (!inscriptionId) {
        errors++;
        continue;
      }
      try {
        await api.patch(`/inscriptions/${inscriptionId}`, { subjectIds });
      } catch (error) {
        console.error(`[handleBulkSubjectSave] Error para inscripción ${inscriptionId}:`, error);
        errors++;
      }
    }

    if (errors === 0) {
      message.success({ content: 'Materia de grupo asignada correctamente', key: 'bulk-subject', duration: 2 });
    } else {
      message.warning({ content: `Asignada con ${errors} error(es)`, key: 'bulk-subject', duration: 3 });
    }

    await fetchData();
  }, [matriculations, selectedRowKeys, fetchData]);

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

  const closeContextMenu = useCallback(() => setContextMenuState(prev => ({ ...prev, visible: false })), []);

  const handleGridContextMenu = useCallback((rowId: number, x: number, y: number) => {
    setContextMenuState({ visible: true, x, y, rowId });
  }, []);

  const handleContextEdit = useCallback(() => {
    // With AG-Grid native editing, cells are editable by clicking
    closeContextMenu();
  }, [closeContextMenu]);

  const handleContextMenuClick = useCallback<NonNullable<MenuProps['onClick']>>(async ({ key }) => {
    if (key === 'edit') {
      await handleContextEdit();
    }
    if (key === 'cancel') {
      closeContextMenu();
    }
    if (key === 'change-representative') {
      if (contextMenuState.rowId !== null) {
        setGuardianModalVisible(true);
      }
      closeContextMenu();
    }
  }, [handleContextEdit, closeContextMenu, contextMenuState.rowId]);

  const handleGuardianSelected = useCallback((guardian: GuardianProfileResponse) => {
    if (contextMenuState.rowId === null) return;
    const rowId = contextMenuState.rowId;

    const row = matriculations.find(r => r.id === rowId);
    if (!row) return;

    let newType: RepresentativeType = 'other';
    const isMother = row.tempData.mother?.document === guardian.document && row.tempData.mother?.documentType === guardian.documentType;
    const isFather = row.tempData.father?.document === guardian.document && row.tempData.father?.documentType === guardian.documentType;
    if (isMother) newType = 'mother';
    else if (isFather) newType = 'father';

    const changes: Record<string, unknown> = { representativeType: newType };
    if (newType === 'other') {
      changes.representative = {
        firstName: guardian.firstName,
        lastName: guardian.lastName,
        documentType: guardian.documentType,
        document: guardian.document,
        phone: guardian.phone,
        email: guardian.email,
        residenceState: guardian.residenceState,
        residenceMunicipality: guardian.residenceMunicipality,
        residenceParish: guardian.residenceParish,
        address: guardian.address,
        id: guardian.id
      };
    }

    setMatriculations(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      const updatedTempData = { ...r.tempData, representativeType: newType };
      if (newType === 'other') {
        updatedTempData.representative = { ...guardian, id: guardian.id };
      }
      return { ...r, tempData: updatedTempData };
    }));

    saveFieldChange(rowId, changes);
    message.success('Representante actualizado');
  }, [contextMenuState.rowId, matriculations, saveFieldChange]);

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
      if (filterSchoolPeriod && item.schoolPeriodId !== filterSchoolPeriod) return false;
      if (canManageVisibility && filterInscription) {
        const isHidden = !!item.hiddenFromControlEstudios;
        if (filterInscription === 'inscrito' && isHidden) return false;
        if (filterInscription === 'no_inscrito' && !isHidden) return false;
      }
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
  }, [matriculations, searchValue, filterGrade, filterSection, filterGender, filterEscolaridad, filterSchoolPeriod, filterMissing, filterInscription, canManageVisibility, questions]);

  const exportToExcel = useCallback(async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Matrículas');

      // Exportar datos filtrados (el ordenamiento lo maneja AG-Grid internamente)
      const dataToExport = [...filteredData];

      // Mapeo de columnas con sus extractores y formateadores
      const columnConfig: Record<string, { header: string; getValue: (record: MatriculationRow) => string }> = {
        nationality: { header: 'Nac.', getValue: (r) => r.tempData.documentType === 'Venezolano' ? 'V' : 'E' },
        document: { header: 'Cédula', getValue: (r) => r.tempData.document || '' },
        firstName: { header: 'Nombres', getValue: (r) => r.tempData.firstName || '' },
        lastName: { header: 'Apellidos', getValue: (r) => r.tempData.lastName || '' },
        gender: { header: 'Género', getValue: (r) => r.tempData.gender === 'M' ? 'Masculino' : r.tempData.gender === 'F' ? 'Femenino' : '' },
        birthdate: { header: 'Fecha Nacimiento', getValue: (r) => r.tempData.birthdate ? dayjs(r.tempData.birthdate).format('DD/MM/YYYY') : '' },
        pathology: { header: 'Patología', getValue: (r) => r.tempData.pathology || 'N/A' },
        livingWith: { header: 'Vive Con', getValue: (r) => r.tempData.livingWith || 'N/A' },
        birthState: { header: 'Estado Nacimiento', getValue: (r) => r.tempData.birthState || '' },
        birthMunicipality: { header: 'Municipio Nacimiento', getValue: (r) => r.tempData.birthMunicipality || '' },
        birthParish: { header: 'Parroquia Nacimiento', getValue: (r) => r.tempData.birthParish || '' },
        residenceState: { header: 'Estado Residencia', getValue: (r) => r.tempData.residenceState || '' },
        residenceMunicipality: { header: 'Municipio Residencia', getValue: (r) => r.tempData.residenceMunicipality || '' },
        residenceParish: { header: 'Parroquia Residencia', getValue: (r) => r.tempData.residenceParish || '' },
        address: { header: 'Dirección', getValue: (r) => r.tempData.address || '' },
        gradeId: { header: 'Grado', getValue: (r) => structure.find(s => s.gradeId === r.tempData.gradeId)?.grade?.name || 'N/A' },
        sectionId: {
          header: 'Sección',
          getValue: (r) => {
            const gradeStruct = structure.find(s => s.gradeId === r.tempData.gradeId);
            return gradeStruct?.sections?.find(s => s.id === r.tempData.sectionId)?.name || 'N/A';
          }
        },
        subjectIds: {
          header: 'Materia',
          getValue: (r) => {
            const gradeStruct = structure.find(s => s.gradeId === r.tempData.gradeId);
            const subjectId = r.tempData.subjectIds?.[0];
            return gradeStruct?.subjects?.find(s => s.id === subjectId)?.name || '';
          }
        },
        escolaridad: {
          header: 'Escolaridad',
          getValue: (r) => {
            const map: Record<EscolaridadStatus, string> = {
              regular: 'Regular',
              repitiente: 'Repitiente',
              materia_pendiente: 'Materia pendiente'
            };
            return map[r.tempData.escolaridad] || r.tempData.escolaridad;
          }
        },
        phone1: { header: 'Teléfono', getValue: (r) => r.tempData.phone1 || '' },
        whatsapp: { header: 'WhatsApp', getValue: (r) => r.tempData.whatsapp || '' },
        motherDocument: { header: 'Cédula Madre', getValue: (r) => r.tempData.mother?.document || '' },
        motherFirstName: { header: 'Nombres Madre', getValue: (r) => r.tempData.mother?.firstName || '' },
        motherLastName: { header: 'Apellidos Madre', getValue: (r) => r.tempData.mother?.lastName || '' },
        fatherDocument: { header: 'Cédula Padre', getValue: (r) => r.tempData.father?.document || '' },
        fatherFirstName: { header: 'Nombres Padre', getValue: (r) => r.tempData.father?.firstName || '' },
        fatherLastName: { header: 'Apellidos Padre', getValue: (r) => r.tempData.father?.lastName || '' },
        representativeFirstName: {
          header: 'Representante',
          getValue: (r) => {
            const { profile } = getRepresentativeInfo(r);
            return `${profile?.firstName || ''} ${profile?.lastName || ''}`.trim();
          }
        },
        representativePhone: {
          header: 'Telf. Rep.',
          getValue: (r) => {
            const { profile } = getRepresentativeInfo(r);
            return profile?.phone || '';
          }
        }
      };

      // Agregar columnas de preguntas personalizadas
      questions.forEach(q => {
        const key = agGetQuestionColumnKey(q.id);
        columnConfig[key] = {
          header: q.prompt,
          getValue: (r) => {
            const value = r.tempData.enrollmentAnswers?.[q.id];
            if (Array.isArray(value)) return value.join(', ');
            return value?.toString() || '';
          }
        };
      });

      // Filtrar solo las columnas visibles
      const visibleColumns = visibleColumnKeys
        .map(key => ({ key, config: columnConfig[key] }))
        .filter(col => col.config);

      const headers = visibleColumns.map(c => c.config.header);

      // --- CONFIGURACIÓN DEL ENCABEZADO ---
      // Determinamos el nombre del grado y sección si hay un filtro aplicado
      let gradeName = '';
      let sectionName = '';
      if (filterGrade) {
        gradeName = structure.find(s => s.gradeId === filterGrade)?.grade?.name || '';
      }
      if (filterSection && filterGrade) {
        sectionName = structure.find(s => s.gradeId === filterGrade)?.sections?.find(s => s.id === filterSection)?.name || '';
      }

      const headerTitle = "UNIDAD EDUCATIVA COLEGIO BATALLA DE LA VICTORIA";
      const reportTitle = viewStatus === 'completed' ? "NÓMINA DE ESTUDIANTES INSCRITOS" : "NÓMINA DE ESTUDIANTES (PRE-MATRÍCULA)";
      const gradeSectionText = (gradeName || sectionName) ? `${gradeName} ${sectionName}`.trim() : "";
      const periodText = activePeriod ? `PERÍODO ESCOLAR ${activePeriod.name}` : "";

      // --- LOGO ---
      try {
        const logoRes = await api.get('/upload/logo', { responseType: 'arraybuffer' });
        const logoId = workbook.addImage({
          buffer: logoRes.data,
          extension: 'png',
        });

        // Ajustar posición del logo (lado izquierdo) - Aumentado de tamaño
        worksheet.addImage(logoId, {
          tl: { col: 0.1, row: 0.2 },
          ext: { width: 110, height: 110 }
        });
      } catch (e) {
        console.error('No se pudo cargar el logo para el Excel', e);
      }

      // Añadimos filas de encabezado (5 filas iniciales)
      worksheet.addRow([]); // Espacio 
      worksheet.addRow(['', '', headerTitle]); // Fila 2
      worksheet.addRow(['', '', reportTitle]); // Fila 3
      if (gradeSectionText) worksheet.addRow(['', '', gradeSectionText]); // Fila 4
      if (periodText) worksheet.addRow(['', '', periodText]); // Fila 5
      worksheet.addRow([]); // Espacio en blanco antes de la tabla

      // Estilo para el encabezado (al lado del logo)
      const headerRows = [2, 3, 4, 5];
      headerRows.forEach(rowIdx => {
        const row = worksheet.getRow(rowIdx);
        // Mezclamos desde la columna 3 hasta el final para dejar espacio al logo
        const startCol = 3;
        const endCol = Math.max(startCol, headers.length);

        if (row.getCell(startCol).value) {
          worksheet.mergeCells(rowIdx, startCol, rowIdx, endCol);
          row.getCell(startCol).alignment = { horizontal: 'left', vertical: 'middle' };
          row.getCell(startCol).font = { bold: true, size: rowIdx === 2 ? 14 : 11 };
        }
        row.height = 24; // Aumentar altura para que el logo más grande luzca mejor
      });

      // --- TABLA ---
      // Añadir fila de encabezado de tabla
      const tableHeaderRow = worksheet.addRow(headers);
      tableHeaderRow.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' }
        };
        cell.font = { bold: true };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });

      // Añadir datos
      dataToExport.forEach(record => {
        const rowValues = visibleColumns.map(col => col.config.getValue(record));
        const row = worksheet.addRow(rowValues);
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
          cell.font = { size: 10 };
        });
      });

      // Auto-ajustar anchos
      worksheet.columns = headers.map((h, i) => {
        let maxLen = h.length;
        // Revisar las primeras 100 filas para el ancho
        for (let j = 0; j < Math.min(dataToExport.length, 100); j++) {
          const val = columnConfig[visibleColumns[i].key].getValue(dataToExport[j]);
          if (val && val.length > maxLen) maxLen = val.length;
        }
        return { width: Math.min(maxLen + 4, 40) };
      });

      // Generar y descargar el archivo
      const buffer = await workbook.xlsx.writeBuffer();
      const timestamp = dayjs().format('YYYY-MM-DD_HH-mm-ss');
      const fileName = `matriculas_${viewStatus}_${timestamp}.xlsx`;
      saveAs(new Blob([buffer]), fileName);

      message.success(`Exportados ${dataToExport.length} registros a Excel`);
    } catch (error) {
      console.error('Error exportando a Excel:', error);
      message.error('Error al exportar a Excel');
    }
  }, [filteredData, visibleColumnKeys, structure, questions, viewStatus, activePeriod, filterGrade, filterSection]);

  const generateNominaExcel = useCallback(async (gradeId: number, sectionId: number, teacherName: string) => {
    try {
      const res = await api.get('/inscriptions', {
        params: {
          schoolPeriodId: filterSchoolPeriod || activePeriod?.id,
          gradeId,
          sectionId
        }
      });
      const students: any[] = (res.data || [])
        .filter((s: any) => !s.matriculation?.hiddenFromControlEstudios);

      // Sort by cédula number ascending, with "Cedula Escolar" (CE) at the end
      const parseDoc = (doc: string, docType: string) => {
        const isEscolar = docType === 'Cedula Escolar';
        const num = parseInt((doc || '').replace(/\D/g, ''), 10) || 0;
        return { isEscolar, num };
      };
      students.sort((a: any, b: any) => {
        const da = parseDoc(a.student?.document || '', a.student?.documentType || '');
        const db = parseDoc(b.student?.document || '', b.student?.documentType || '');
        if (da.isEscolar !== db.isEscolar) return da.isEscolar ? 1 : -1;
        return da.num - db.num;
      });

      if (students.length === 0) {
        message.warning('No se encontraron estudiantes inscritos en esta sección');
        return;
      }

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Nómina');

      // Logo: 1.24" x 1.24" (~119px), 10px top margin, 20px left margin
      try {
        const logoRes = await api.get('/upload/logo', { responseType: 'arraybuffer' });
        const logoId = workbook.addImage({ buffer: logoRes.data, extension: 'png' });
        worksheet.addImage(logoId, {
          tl: { col: 0.31, row: 0.5 },
          ext: { width: 119, height: 119 }
        });
      } catch (e) {
        console.error('No se pudo cargar el logo para la nómina', e);
      }

      const gradeName = structure.find(s => s.gradeId === gradeId)?.grade?.name || '';
      const sectionName = structure.find(s => s.gradeId === gradeId)?.sections?.find(s => s.id === sectionId)?.name || '';
      const periodName = allPeriods.find(p => p.id === (filterSchoolPeriod || activePeriod?.id))?.name || activePeriod?.name || '';

      // Header rows (starting at row 1)
      const titleRow = worksheet.addRow(['', '', 'U.E.C. BATALLA DE LA VICTORIA']);
      const periodRow = worksheet.addRow(['', '', periodName]);
      worksheet.addRow([]);
      const teacherRow = worksheet.addRow(['', '', `Prof. Guía: ${teacherName}`.trim()]);
      const sectionRow = worksheet.addRow(['', '', `${gradeName} ${sectionName}`]);

      [titleRow, periodRow, teacherRow].forEach((row, i) => {
        const firstCell = row.getCell(3);
        if (i < 2) {
          firstCell.font = { bold: true, size: 16 };
          firstCell.alignment = { horizontal: 'center' };
        } else {
          firstCell.font = { bold: true, size: 11 };
        }
      });
      sectionRow.getCell(3).font = { bold: true, size: 12 };
      sectionRow.getCell(3).alignment = { horizontal: 'center' };

      // Table starts at row 7 (after title, period, blank, teacher, section, blank)
      const startRow = 7;
      const headerRow = worksheet.getRow(startRow);
      headerRow.values = ['#', 'CÉDULA', 'APELLIDOS Y NOMBRES', 'Teléfono'];
      for (let c = 1; c <= 4; c++) {
        const cell = headerRow.getCell(c);
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
        cell.alignment = { horizontal: 'center' };
      }

      worksheet.getColumn(1).width = 6;
      worksheet.getColumn(2).width = 18;
      worksheet.getColumn(3).width = 45;
      worksheet.getColumn(4).width = 18;

      students.forEach((s, idx) => {
        const row = worksheet.getRow(startRow + 1 + idx);
        row.values = [
          idx + 1,
          s.student?.document || '',
          `${s.student?.lastName || ''} ${s.student?.firstName || ''}`.trim(),
          s.student?.contact?.phone1 || ''
        ];
        row.getCell(1).alignment = { horizontal: 'center' };
        row.getCell(2).alignment = { horizontal: 'center' };
        row.getCell(4).alignment = { horizontal: 'center' };
      });

      // Empty rows (minimum 40 students total)
      const emptyStart = startRow + 1 + students.length;
      const totalRows = startRow + 35;
      for (let i = emptyStart; i <= totalRows; i++) {
        const row = worksheet.getRow(i);
        row.values = [i - startRow, '', '', ''];
        row.getCell(1).alignment = { horizontal: 'center' };
      }

      // Borders for table
      const lastRow = totalRows;
      for (let r = startRow; r <= lastRow; r++) {
        for (let c = 1; c <= 4; c++) {
          const cell = worksheet.getRow(r).getCell(c);
          cell.border = {
            top: { style: 'thin', color: { argb: 'FF000000' } },
            left: { style: 'thin', color: { argb: 'FF000000' } },
            bottom: { style: 'thin', color: { argb: 'FF000000' } },
            right: { style: 'thin', color: { argb: 'FF000000' } }
          };
        }
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const fileName = `nomina_${gradeName}_${sectionName}_${dayjs().format('YYYY-MM-DD')}.xlsx`;
      saveAs(new Blob([buffer]), fileName);
      message.success(`Nómina de ${students.length} estudiantes generada`);
    } catch (error) {
      console.error('Error generando nómina:', error);
      message.error('Error al generar la nómina');
    }
  }, [activePeriod, allPeriods, filterSchoolPeriod, structure]);

  const handleOpenNominaModal = () => {
    if (!filterGrade || !filterSection) {
      setNominaModalOpen(true);
      setNominaGradeId(filterGrade);
      setNominaSectionId(filterSection);
      setNominaTeacher('');
    } else {
      // Direct generation: fetch guide teacher first, then generate
      const periodId = filterSchoolPeriod || activePeriod?.id;
      if (periodId) {
        api.get('/section-guides', {
          params: { schoolPeriodId: periodId, gradeId: filterGrade, sectionId: filterSection },
        }).then(res => {
          const guide = res.data;
          const teacherName = guide?.guideTeacher
            ? `${guide.guideTeacher.lastName || ''} ${guide.guideTeacher.firstName || ''}`.trim()
            : '';
          generateNominaExcel(filterGrade, filterSection, teacherName);
        }).catch(() => generateNominaExcel(filterGrade, filterSection, ''));
      } else {
        generateNominaExcel(filterGrade, filterSection, '');
      }
    }
  };

  // Fetch guide teacher when grade/section changes in the nomina modal
  useEffect(() => {
    if (!nominaGradeId || !nominaSectionId) {
      setNominaTeacher('');
      return;
    }
    const periodId = filterSchoolPeriod || activePeriod?.id;
    if (!periodId) return;
    api.get('/section-guides', {
      params: { schoolPeriodId: periodId, gradeId: nominaGradeId, sectionId: nominaSectionId },
    }).then(res => {
      const guide = res.data;
      if (guide?.guideTeacher) {
        const t = guide.guideTeacher;
        setNominaTeacher(`${t.lastName || ''} ${t.firstName || ''}`.trim());
      } else {
        setNominaTeacher('');
      }
    }).catch(() => setNominaTeacher(''));
  }, [nominaGradeId, nominaSectionId, filterSchoolPeriod, activePeriod]);

  const handleToggleGroup = (group: string, checked: boolean) => {
    let groupKeys: string[] = [];
    if (group === 'Preguntas Personalizadas') {
      groupKeys = questions.map(q => agGetQuestionColumnKey(q.id));
    } else {
      groupKeys = AG_BASE_COLUMN_OPTIONS.filter((o: { group: string }) => o.group === group).map((o: { key: string }) => o.key);
    }

    if (checked) {
      setVisibleColumnKeys(prev => Array.from(new Set([...prev, ...groupKeys])));
    } else {
      setVisibleColumnKeys(prev => prev.filter(key => !groupKeys.includes(key)));
    }
  };

  const columnMenuContent = (
    <div style={{ maxHeight: '450px', overflowY: 'auto', padding: '12px', width: '280px' }} className="custom-scrollbar">
      <div className="mb-4 pb-2 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10">
        <Text strong style={{ color: '#1e293b' }}>Gestión de Columnas</Text>
        <Space>
          <Button size="small" type="link" onClick={() => setVisibleColumnKeys(AG_BASE_COLUMN_OPTIONS.map(o => o.key).concat(questions.map(q => agGetQuestionColumnKey(q.id))))}>Todas</Button>
          <Button size="small" type="link" onClick={() => setVisibleColumnKeys(['document', 'firstName', 'lastName'])}>Mínimas</Button>
        </Space>
      </div>
      <div className="flex flex-col gap-4">
        {COLUMN_GROUPS.map(group => {
          const groupOptions = AG_BASE_COLUMN_OPTIONS.filter(o => o.group === group);
          const groupKeys = group === 'Preguntas Personalizadas'
            ? questions.map(q => agGetQuestionColumnKey(q.id))
            : groupOptions.map(o => o.key);

          if (groupKeys.length === 0) return null;

          const visibleInGroup = groupKeys.filter(k => visibleColumnKeys.includes(k));
          const allChecked = visibleInGroup.length === groupKeys.length;
          const indeterminate = visibleInGroup.length > 0 && visibleInGroup.length < groupKeys.length;

          return (
            <div key={group} className="bg-slate-50/50 p-2 rounded-lg border border-slate-100/50">
              <div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-200/50">
                <Checkbox
                  indeterminate={indeterminate}
                  checked={allChecked}
                  onChange={(e) => handleToggleGroup(group, e.target.checked)}
                >
                  <span className="text-[10px] uppercase font-extrabold text-slate-500 tracking-wider">
                    {group}
                  </span>
                </Checkbox>
              </div>
              <div className="grid grid-cols-1 gap-1.5 pl-1">
                <Checkbox.Group
                  style={{ width: '100%' }}
                  value={visibleColumnKeys}
                  onChange={(checked) => setVisibleColumnKeys(checked as string[])}
                >
                  <div className="flex flex-col gap-1">
                    {group === 'Preguntas Personalizadas' ? (
                      questions.map(q => (
                        <Checkbox key={agGetQuestionColumnKey(q.id)} value={agGetQuestionColumnKey(q.id)} className="text-[11px] text-slate-600">
                          {q.prompt}
                        </Checkbox>
                      ))
                    ) : (
                      groupOptions.map(opt => (
                        <Checkbox key={opt.key} value={opt.key} className="text-[11px] text-slate-600">
                          {opt.label}
                        </Checkbox>
                      ))
                    )}
                  </div>
                </Checkbox.Group>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-2 h-full max-h-screen overflow-hidden p-1">
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
                  <Title level={5} style={{ margin: 0 }}>Matrícula Estudiantes</Title>
                  {user?.roles?.includes('Administrador') && (
                    <Button type="primary" size="small" icon={<UserAddOutlined />} onClick={() => navigate('/admin/inscribir-estudiante')}>
                      Inscribir Estudiante
                    </Button>
                  )}
                </Space>
                <div className="flex items-center gap-2">
                  <Radio.Group
                    value={viewStatus}
                    onChange={e => {
                      setViewStatus(e.target.value);
                    }}
                    size="small"
                    buttonStyle="solid"
                  >
                    <Radio.Button value="pending">No Matriculados</Radio.Button>
                    <Radio.Button value="completed">Matriculados</Radio.Button>
                  </Radio.Group>
                  <span className="text-[10px] text-slate-400 font-normal ml-2">
                    {filteredData.length} registro(s)
                  </span>
                </div>
              </div>
            </Col>
            <Col xs={24} lg={16}>
              <Row gutter={[4, 4]} justify="end">
                <Col>
                  <Select
                    placeholder="Período Escolar"
                    size="small"
                    style={{ width: 160 }}
                    allowClear
                    value={filterSchoolPeriod}
                    onChange={setFilterSchoolPeriod}
                  >
                    {allPeriods.map(p => (
                      <Option key={p.id} value={p.id}>
                        {p.name}
                        {p.status === 'activo' && ' (Activo)'}
                        {p.status === 'preinscripcion' && ' (Preinscripción)'}
                      </Option>
                    ))}
                  </Select>
                </Col>
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
                {canManageVisibility && (
                  <Col>
                    <Select
                      placeholder="Inscripción"
                      size="small"
                      style={{ width: 130 }}
                      allowClear
                      value={filterInscription}
                      onChange={setFilterInscription}
                    >
                      <Option value="inscrito">Inscritos</Option>
                      <Option value="no_inscrito">No Inscritos</Option>
                    </Select>
                  </Col>
                )}
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
                  <Tooltip title={`Exportar ${filteredData.length} registros a Excel con filtros aplicados`}>
                    <Button
                      icon={<FileExcelOutlined />}
                      onClick={exportToExcel}
                      size="small"
                      className="border-green-400 text-green-600 hover:bg-green-50"
                    >
                      Excel ({filteredData.length})
                    </Button>
                  </Tooltip>
                </Col>
                <Col>
                  <Tooltip title="Generar nómina de estudiantes por sección">
                    <Button
                      icon={<PrinterOutlined />}
                      onClick={handleOpenNominaModal}
                      size="small"
                      className="border-blue-400 text-blue-600 hover:bg-blue-50"
                    >
                      Imprimir Nómina
                    </Button>
                  </Tooltip>
                </Col>
                <Col>
                  <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading} size="small">Actualizar</Button>
                </Col>
              </Row>
            </Col>
          </Row>
        </Card>

        {/* Space is always reserved so that showing/hiding the bulk action bar
            never shifts the grid below it. */}
        <div ref={bulkActionRef} className="shrink-0" style={{ height: BULK_BAR_HEIGHT }}>
          {selectedRowKeys.length > 0 && (
            <Card
              size="small"
              className="glass-card border-none shadow-md overflow-hidden bg-blue-50/90 ring-1 ring-blue-100"
              style={{ height: '100%' }}
              styles={{ body: { padding: '8px 16px', height: '100%' } }}
            >
              <Button
                type="text"
                size="small"
                icon={<CloseOutlined />}
                onClick={() => setSelectedRowKeys([])}
                style={{
                  position: 'absolute',
                  top: '4px',
                  right: '4px',
                  color: '#888',
                  zIndex: 10
                }}
              />

              <div className="flex items-center gap-6 h-full">
                {/* Section 1: Counter / Student Info */}
                <div className="flex items-center gap-2 pr-4 border-r border-slate-300/50 min-w-max">
                  {selectedRowKeys.length === 1 ? (
                    <>
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white shadow-sm">
                        <UserOutlined />
                      </div>
                      <div className="flex flex-col justify-center">
                        <span className="text-xs font-bold text-blue-900 leading-tight">
                          {(() => {
                            const r = matriculations.find(m => m.id === selectedRowKeys[0]);
                            return r ? `${r.tempData.firstName} ${r.tempData.lastName}` : 'Estudiante';
                          })()}
                        </span>
                        <span className="text-[10px] text-blue-700 leading-none mt-0.5">
                          {(() => {
                            const r = matriculations.find(m => m.id === selectedRowKeys[0]);
                            return r ? `${r.tempData.document}` : '';
                          })()}
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-500 text-white shadow-sm font-bold text-sm">
                        {selectedRowKeys.length}
                      </div>
                      <div className="flex flex-col leading-tight font-bold text-[10px] uppercase tracking-wide text-blue-900">
                        <span>Estudiantes</span>
                        <span>Seleccionados</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Section 2: Actions / Inputs */}
                <div className="flex-1 flex gap-4 items-center">
                  {viewStatus === 'pending' ? (
                    <div className="grid grid-cols-2 gap-4 flex-1">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Asignar Sección</span>
                        <Tooltip title={hasMixedGrades ? 'Seleccione estudiantes del mismo grado' : undefined}>
                          <Select
                            disabled={hasMixedGrades || bulkSections.length === 0}
                            placeholder="Seleccionar..."
                            size="small"
                            style={{ width: '100%' }}
                            onChange={v => handleBulkUpdate('sectionId', v)}
                            allowClear
                          >
                            {bulkSections.map(sec => <Option key={sec.id} value={sec.id}>{sec.name}</Option>)}
                          </Select>
                        </Tooltip>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Materias de Grupo</span>
                        <Tooltip title={hasMixedGrades ? 'Seleccione estudiantes del mismo grado' : undefined}>
                          <Select
                            disabled={hasMixedGrades || bulkGroupSubjects.length === 0}
                            placeholder="Asignar Materia..."
                            size="small"
                            style={{ width: '100%' }}
                            onChange={v => {
                              const newIds = v !== undefined && v !== null ? [Number(v)] : [];
                              handleBulkUpdate('subjectIds', newIds);
                              handleBulkSubjectSave(newIds);
                            }}
                            allowClear
                            options={bulkGroupSubjects.map(s => ({ label: s.name, value: s.id }))}
                          />
                        </Tooltip>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2 items-center flex-1">
                      {selectedRowKeys.length === 1 && (
                        <>
                          <Button icon={<BookOutlined />} size="small" onClick={handleOpenSubjectModal}>Gestionar Materias</Button>
                          <Button icon={<EyeOutlined />} size="small" onClick={handleViewProfile}>Ver Expediente</Button>
                        </>
                      )}
                      {!hasMixedGrades && bulkGroupSubjects.length > 0 && (
                        <div className="flex flex-col gap-0.5 ml-auto">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Materia de Grupo</span>
                          <Select
                            placeholder="Asignar..."
                            size="small"
                            style={{ width: 160 }}
                            onChange={v => {
                              const newIds = v !== undefined && v !== null ? [Number(v)] : [];
                              handleBulkUpdate('subjectIds', newIds);
                              handleBulkSubjectSave(newIds);
                            }}
                            allowClear
                            options={bulkGroupSubjects.map(s => ({ label: s.name, value: s.id }))}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Section 2b: Inscription controls (Admin/Master only) */}
                {canManageVisibility && (
                  <div className="pl-4 border-l border-slate-300/50 flex gap-2">
                    <Tooltip title="Marcar como inscrito (visible para Control de Estudios)">
                      <Button
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={() => handleBulkToggleVisibility(false)}
                      >
                        Inscribir
                      </Button>
                    </Tooltip>
                    <Tooltip title="Desinscribir (ocultar de Control de Estudios)">
                      <Button
                        size="small"
                        icon={<EyeInvisibleOutlined />}
                        onClick={() => handleBulkToggleVisibility(true)}
                      >
                        Desinscribir
                      </Button>
                    </Tooltip>
                  </div>
                )}

                {/* Section 3: Primary Action */}
                {viewStatus === 'pending' && (
                  <div className="pl-4 border-l border-slate-300/50">
                    <Button
                      type="primary"
                      icon={<CheckCircleOutlined />}
                      onClick={handleBulkEnroll}
                      className="bg-blue-600 hover:bg-blue-500 border-none shadow-md shadow-blue-500/30"
                    >
                      Inscribir
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden min-h-0">
        <MatriculationAgGrid
          rowData={filteredData}
          structure={structure}
          questions={questions}
          canManageVisibility={canManageVisibility}
          visibleColumnKeys={visibleColumnKeys}
          locations={locations}
          selectedRowIds={selectedRowKeys}
          onSelectionChanged={setSelectedRowKeys}
          height={scrollY}
          onUpdateField={handleUpdateRow}
          onUpdateFields={handleUpdateFields}
          onUpdateGuardianField={handleUpdateGuardianField}
          onUpdateGuardianFields={handleUpdateGuardianFields}
          onUpdateAnswer={handleUpdateAnswer}
          onToggleInscription={handleToggleInscription}
          onContextMenu={handleGridContextMenu}
        />
      </div>

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
          />
        </div>,
        document.body
      )}

      <style>{`
        /* AG-Grid custom styles for matriculation table */
        .ag-theme-quartz .ag-header {
          --ag-header-background-color: #f1f5f9;
        }
        .ag-theme-quartz .ag-header-cell-label {
          font-weight: 700;
          font-size: 11px;
          text-transform: uppercase;
          color: #475569;
        }
        .ag-theme-quartz .ag-row {
          --ag-row-hover-color: #e6eefb;
        }
        .ag-theme-quartz .ag-row-even {
          --ag-row-background-color: #f8fafc;
        }
        .ag-theme-quartz .ag-row-selected {
          --ag-row-background-color: #cfe3fb;
        }
        .ag-theme-quartz .ag-cell {
          font-size: 12px;
          padding: 2px 4px;
          border-right: 1px solid #e2e8f0;
        }
        /* Column divider lines */
        .ag-theme-quartz .ag-header-cell,
        .ag-theme-quartz .ag-header-group-cell {
          border-right: 1px solid #cbd5e1;
        }
        .ag-theme-quartz .ag-header-row:not(:last-child) .ag-header-cell,
        .ag-theme-quartz .ag-header-row:not(:last-child) .ag-header-group-cell {
          border-bottom: 1px solid #cbd5e1;
        }
        .ag-theme-quartz .ag-row {
          border-bottom: 1px solid #e2e8f0;
        }
        /* Stronger separator at the edge of each pinned section */
        .ag-theme-quartz .ag-pinned-left-cols-container,
        .ag-theme-quartz .ag-pinned-left-header {
          border-right: 2px solid #94a3b8;
        }
        /* Tint for the two column groups — headers + body cells */
        .ag-theme-quartz .ag-group-header-estudiante {
          background: #bfdbfe;
        }
        .ag-theme-quartz .ag-group-header-estudiante .ag-header-cell-label {
          color: #1e3a8a;
          font-weight: 700;
        }
        .ag-theme-quartz .ag-group-header-representante {
          background: #ddd6fe;
        }
        .ag-theme-quartz .ag-group-header-representante .ag-header-cell-label {
          color: #5b21b6;
          font-weight: 700;
        }
        /* Child column headers get a visible tint of their group's color. */
        .ag-theme-quartz .col-estudiante {
          background: #dbeafe;
        }
        .ag-theme-quartz .col-representante {
          background: #ede9fe;
        }
        /* Apply the distinction to the data cells as well as the headers. */
        .ag-theme-quartz .cell-estudiante {
          background-color: #eef6ff;
        }
        .ag-theme-quartz .cell-representante {
          background-color: #f5efff;
        }
        /* Hover and selection reuse each group's own hue, just darker. The
           cell background is opaque, so the row-level hover/selected color
           would otherwise be hidden behind it. */
        .ag-theme-quartz .ag-row-hover .cell-estudiante {
          background-color: #dbeafe;
        }
        .ag-theme-quartz .ag-row-hover .cell-representante {
          background-color: #e9e2ff;
        }
        .ag-theme-quartz .ag-row-selected .cell-estudiante {
          background-color: #bfdbfe;
        }
        .ag-theme-quartz .ag-row-selected .cell-representante {
          background-color: #d7cbff;
        }
        .ag-theme-quartz .ag-row-selected.ag-row-hover .cell-estudiante {
          background-color: #a9cffc;
        }
        .ag-theme-quartz .ag-row-selected.ag-row-hover .cell-representante {
          background-color: #c8b8ff;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 3px;
        }
      `}</style>
      <SearchGuardianModal
        visible={guardianModalVisible}
        onCancel={() => setGuardianModalVisible(false)}
        onSelect={handleGuardianSelected}
      />

      <Modal
        title="Imprimir Nómina de Sección"
        open={nominaModalOpen}
        onCancel={() => setNominaModalOpen(false)}
        onOk={() => {
          if (!nominaGradeId || !nominaSectionId) {
            message.warning('Seleccione grado y sección');
            return;
          }
          generateNominaExcel(nominaGradeId, nominaSectionId, nominaTeacher);
          setNominaModalOpen(false);
        }}
        okText="Generar Excel"
      >
        <div className="flex flex-col gap-4 py-2">
          <div>
            <label className="text-xs font-bold uppercase text-slate-500">Grado</label>
            <Select
              value={nominaGradeId}
              onChange={(v) => { setNominaGradeId(v); setNominaSectionId(null); }}
              style={{ width: '100%' }}
              placeholder="Seleccionar grado"
            >
              {structure.map(s => (
                <Option key={s.gradeId} value={s.gradeId}>{s.grade?.name}</Option>
              ))}
            </Select>
          </div>
          <div>
            <label className="text-xs font-bold uppercase text-slate-500">Sección</label>
            <Select
              value={nominaSectionId}
              onChange={setNominaSectionId}
              style={{ width: '100%' }}
              placeholder="Seleccionar sección"
              disabled={!nominaGradeId}
            >
              {structure.find(s => s.gradeId === nominaGradeId)?.sections?.map(sec => (
                <Option key={sec.id} value={sec.id}>{sec.name}</Option>
              ))}
            </Select>
          </div>
          <div>
            <label className="text-xs font-bold uppercase text-slate-500">Prof. Guía</label>
            <Input
              value={nominaTeacher}
              onChange={(e) => setNominaTeacher(e.target.value)}
              placeholder="Nombre del profesor guía"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default MatriculationEnrollment;
