import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Button,
  Card,
  Checkbox,
  Col,
  Divider,
  Input,
  message,
  Popover,
  Row,
  Select,
  Space,
  Table,
  Tooltip,
  Typography,
  Pagination,
} from 'antd';
import {
  ReloadOutlined,
  SearchOutlined,
  UserOutlined,
  CheckCircleOutlined,
  BookOutlined,
  QuestionCircleOutlined,
  CloseOutlined,
  TableOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import api from '@/services/api';
import type { EnrollmentQuestionResponse } from '@/services/enrollmentQuestions';
import type { ColumnsType } from 'antd/es/table';

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

interface GuardianAssignment {
  relationship: string;
  isRepresentative?: boolean;
  profile?: GuardianProfile;
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

interface StudentData {
  firstName: string;
  lastName: string;
  document: string;
  contact?: ContactInfo;
  guardians?: GuardianAssignment[];
  birthdate?: string | null;
  residence?: ResidenceInfo;
  enrollmentAnswers?: EnrollmentAnswerRecord[];
}

type EscolaridadStatus = 'regular' | 'repitiente' | 'materia_pendiente';

interface TempData {
  firstName: string;
  lastName: string;
  document: string;
  gradeId: number;
  sectionId?: number | null;
  subjectIds: number[];
  escolaridad: EscolaridadStatus;
  phone1?: string;
  whatsapp?: string;
  birthdate: Dayjs | null;
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
  sectionId?: number | null;
  status: 'pending' | 'completed';
  student: StudentData;
  tempData: TempData;
}

interface MatriculationApiResponse {
  id: number;
  gradeId: number;
  sectionId?: number | null;
  status: 'pending' | 'completed';
  student: StudentData;
  escolaridad?: EscolaridadStatus;
}

interface EnrollStructureEntry {
  id: number;
  gradeId: number;
  grade?: { id: number; name: string };
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

const BASE_COLUMN_OPTIONS: ColumnOption[] = [
  { key: 'firstName', label: 'Nombres', group: 'Estudiante' },
  { key: 'lastName', label: 'Apellidos', group: 'Estudiante' },
  { key: 'document', label: 'Cédula', group: 'Estudiante' },
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

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (draftValue !== null && draftValue !== normalizedValue) {
      onChange(draftValue);
    }
    setDraftValue(null);
    if (onBlur) onBlur(e);
  };

  return (
    <input
      {...props}
      value={inputValue}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={onKeyDown}
    />
  );
});

type MatriculationColumn = ColumnsType<MatriculationRow>[number];

const MatriculationEnrollment: React.FC = () => {
  const [matriculations, setMatriculations] = useState<MatriculationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [structure, setStructure] = useState<EnrollStructureEntry[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [editableRowIds, setEditableRowIds] = useState<number[]>([]);
  const [contextMenuState, setContextMenuState] = useState<{ visible: boolean; x: number; y: number; rowId: number | null }>({
    visible: false,
    x: 0,
    y: 0,
    rowId: null
  });
  const [searchValue, setSearchValue] = useState('');

  const [questions, setQuestions] = useState<EnrollmentQuestionResponse[]>([]);
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<string[]>(
    () => BASE_COLUMN_OPTIONS.map(option => option.key)
  );
  const [columnPopoverOpen, setColumnPopoverOpen] = useState(false);

  // Filter states
  const [filterGrade, setFilterGrade] = useState<number | null>(null);
  const [filterSection, setFilterSection] = useState<number | null>(null);
  const [filterMissing, setFilterMissing] = useState<string | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Column Pinning
  const [pinnedGroups, setPinnedGroups] = useState<string[]>(['Estudiante']);

  // Dynamic Height Calculation
  const [scrollY, setScrollY] = useState(500);
  const headerRef = useRef<HTMLDivElement>(null);

  const canEditRow = useCallback((rowId: number) => editableRowIds.includes(rowId), [editableRowIds]);

  const enableRowEditing = useCallback((rowId: number) => {
    setEditableRowIds(prev => (prev.includes(rowId) ? prev : [...prev, rowId]));
  }, []);

  const lockRow = useCallback((rowId: number) => {
    setEditableRowIds(prev => prev.filter(id => id !== rowId));
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenuState(prev => ({ ...prev, visible: false, rowId: null }));
  }, []);

  const handleContextMenu = useCallback((event: React.MouseEvent, rowId: number) => {
    event.preventDefault();
    setContextMenuState({
      visible: true,
      x: event.clientX,
      y: event.clientY,
      rowId
    });
  }, []);

  const handleContextEdit = useCallback(() => {
    if (contextMenuState.rowId != null) {
      enableRowEditing(contextMenuState.rowId);
    }
    closeContextMenu();
  }, [contextMenuState.rowId, enableRowEditing, closeContextMenu]);

  useEffect(() => {
    if (!contextMenuState.visible) return;
    const handleClickAway = () => closeContextMenu();
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeContextMenu();
    };
    window.addEventListener('click', handleClickAway);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('click', handleClickAway);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [contextMenuState.visible, closeContextMenu]);

  // --- Dynamic Height Calculation ---
  useEffect(() => {
    const calculateHeight = () => {
      if (headerRef.current) {
        const { bottom } = headerRef.current.getBoundingClientRect();
        // Available height = Window Height - Header Bottom - Table Header/Pagination (~90px) - Bottom Margin (~20px)
        const available = window.innerHeight - bottom - 110;
        setScrollY(Math.max(200, available));
      }
    };

    calculateHeight();

    const resizeObserver = new ResizeObserver(() => {
      calculateHeight();
    });

    if (headerRef.current) {
      resizeObserver.observe(headerRef.current);
    }

    const handleWindowResize = () => calculateHeight();
    window.addEventListener('resize', handleWindowResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [structure, selectedRowKeys.length]); // Dependencies that might change header height

  const questionColumnOptions = useMemo(
    () =>
      questions.map<ColumnOption>(q => ({
        key: getQuestionColumnKey(q.id),
        label: q.prompt,
        group: 'Preguntas Personalizadas'
      })),
    [questions]
  );

  const allColumnOptions = useMemo<ColumnOption[]>(
    () => [...BASE_COLUMN_OPTIONS, ...questionColumnOptions],
    [questionColumnOptions]
  );

  const groupedColumnOptions = useMemo(() => {
    return allColumnOptions.reduce<Record<string, ColumnOption[]>>((acc, option) => {
      if (!acc[option.group]) acc[option.group] = [];
      acc[option.group].push(option);
      return acc;
    }, {});
  }, [allColumnOptions]);

  const optionKeyOrder = useMemo(() => allColumnOptions.map(option => option.key), [allColumnOptions]);
  const orderedGroupNames = useMemo(() => {
    const preferred = COLUMN_GROUP_ORDER.filter(group => groupedColumnOptions[group]?.length);
    const dynamic = Object.keys(groupedColumnOptions).filter(group => !COLUMN_GROUP_ORDER.includes(group));
    return [...preferred, ...dynamic];
  }, [groupedColumnOptions]);

  useEffect(() => {
    setVisibleColumnKeys(prev => {
      const cleaned = prev.filter(key => optionKeyOrder.includes(key));
      const missing = optionKeyOrder.filter(key => !cleaned.includes(key));
      const next = [...cleaned, ...missing];
      const isSameLength = next.length === prev.length;
      const isSameOrder = isSameLength && next.every((key, index) => key === prev[index]);
      return isSameOrder ? prev : next;
    });
  }, [optionKeyOrder]);

  const alignWithOptionOrder = useCallback(
    (keys: Iterable<string>) => {
      const keySet = new Set(keys);
      return optionKeyOrder.filter(key => keySet.has(key));
    },
    [optionKeyOrder]
  );

  const toggleColumnKey = useCallback((key: string) => {
    setVisibleColumnKeys(prev => {
      const nextSet = new Set(prev);
      if (nextSet.has(key)) {
        nextSet.delete(key);
      } else {
        nextSet.add(key);
      }
      return alignWithOptionOrder(nextSet);
    });
  }, [alignWithOptionOrder]);

  const handleToggleGroup = useCallback((groupName: string, checked: boolean) => {
    const groupOptions = groupedColumnOptions[groupName] || [];
    if (groupOptions.length === 0) return;
    setVisibleColumnKeys(prev => {
      const nextSet = new Set(prev);
      groupOptions.forEach(option => {
        if (checked) nextSet.add(option.key);
        else nextSet.delete(option.key);
      });
      return alignWithOptionOrder(nextSet);
    });
  }, [groupedColumnOptions, alignWithOptionOrder]);

  const showAllColumns = useCallback(
    () => setVisibleColumnKeys(optionKeyOrder),
    [optionKeyOrder]
  );
  const hideAllColumns = useCallback(() => setVisibleColumnKeys([]), []);

  const visibleColumnsSet = useMemo(() => new Set(visibleColumnKeys), [visibleColumnKeys]);
  const isColumnVisible = useCallback((key: string) => visibleColumnsSet.has(key), [visibleColumnsSet]);

  const columnMenuContent = useMemo(() => (
    <div className="min-w-[320px] max-w-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <Text strong>Columnas visibles</Text>
          <div className="text-xs text-slate-500">{visibleColumnKeys.length} / {optionKeyOrder.length}</div>
        </div>
        <Space size={4}>
          <Button size="small" type="text" onClick={showAllColumns}>Mostrar todas</Button>
          <Button size="small" type="text" onClick={hideAllColumns}>Ocultar todas</Button>
        </Space>
      </div>
      <Divider style={{ margin: '8px 0' }} />
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        {orderedGroupNames.map(groupName => {
          const options = groupedColumnOptions[groupName] || [];
          if (options.length === 0) return null;
          const selectedCount = options.filter(option => isColumnVisible(option.key)).length;
          const isAllSelected = selectedCount === options.length;
          const isIndeterminate = selectedCount > 0 && !isAllSelected;
          return (
            <div key={groupName}>
              <Checkbox
                indeterminate={isIndeterminate}
                checked={isAllSelected}
                onChange={e => handleToggleGroup(groupName, e.target.checked)}
              >
                <Space size={4}>
                  <Text strong>{groupName}</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {selectedCount}/{options.length}
                  </Text>
                </Space>
              </Checkbox>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 mt-2">
                {options.map(option => (
                  <Checkbox
                    key={option.key}
                    checked={isColumnVisible(option.key)}
                    onChange={() => toggleColumnKey(option.key)}
                  >
                    {option.label}
                  </Checkbox>
                ))}
              </div>
            </div>
          );
        })}
      </Space>
    </div>
  ), [
    groupedColumnOptions,
    orderedGroupNames,
    handleToggleGroup,
    toggleColumnKey,
    showAllColumns,
    hideAllColumns,
    isColumnVisible,
    visibleColumnKeys.length,
    optionKeyOrder.length
  ]);

  // --- Filtering & Pagination Logic ---
  const filteredData = useMemo(() => {
    return matriculations.filter(r => {
      const searchLower = searchValue.toLowerCase();
      const matchSearch = !searchValue ||
        `${r.student.firstName} ${r.student.lastName} ${r.student.document}`.toLowerCase().includes(searchLower);

      const matchGrade = !filterGrade || r.gradeId === filterGrade;
      const matchSection = !filterSection || r.sectionId === filterSection;

      let matchMissing = true;
      if (filterMissing) {
        const hasNoGuardians = !r.tempData.mother?.document || !r.tempData.father?.document;
        const hasNoContact = !r.tempData.phone1;
        const hasNoQuestions = questions.some(q => !r.tempData.enrollmentAnswers?.[q.id]);

        if (filterMissing === 'guardians') matchMissing = hasNoGuardians;
        else if (filterMissing === 'contact') matchMissing = hasNoContact;
        else if (filterMissing === 'questions') matchMissing = hasNoQuestions;
        else if (filterMissing === 'all') matchMissing = hasNoGuardians || hasNoContact || hasNoQuestions;
      }

      return matchSearch && matchGrade && matchSection && matchMissing;
    });
  }, [matriculations, searchValue, filterGrade, filterSection, filterMissing, questions]);

  const currentData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  // Reset page when filter results change length (optional but good UX)
  useEffect(() => {
    setCurrentPage(1);
  }, [searchValue, filterGrade, filterSection, filterMissing]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: period } = await api.get('/academic/active');

      const pId = period?.id;
      if (pId) {
        const [matRes, structRes, questRes] = await Promise.all([
          api.get(`/matriculations?status=pending&schoolPeriodId=${pId}`),
          api.get(`/academic/structure/${pId}`),
          api.get('/enrollment-questions?includeInactive=false')
        ]);

        setQuestions((questRes.data || []) as EnrollmentQuestionResponse[]);

        const rows = (matRes.data || []).map((m: MatriculationApiResponse) => {
          const guardians = m.student.guardians || [];
          const findGuardianProfile = (relationship: string): GuardianProfile =>
            (guardians.find(g => g.relationship === relationship)?.profile || {}) as GuardianProfile;
          const representativeAssignment = guardians.find(g => g.isRepresentative);
          const representativeRelationship = representativeAssignment?.relationship;
          const representativeType: RepresentativeType =
            representativeRelationship === 'mother' || representativeRelationship === 'father'
              ? representativeRelationship
              : 'other';

          const enrollmentAnswers = (m.student.enrollmentAnswers || []).reduce<EnrollmentAnswersMap>((acc, curr) => {
            acc[curr.questionId] = curr.answer || undefined;
            return acc;
          }, {});

          return {
            ...m,
            tempData: {
              ...m.student,
              gradeId: m.gradeId,
              sectionId: m.sectionId,
              subjectIds: [],
              escolaridad: m.escolaridad ?? 'regular',
              phone1: m.student.contact?.phone1,
              whatsapp: m.student.contact?.whatsapp,
              birthdate: m.student.birthdate ? dayjs(m.student.birthdate) : null,
              mother: findGuardianProfile('mother'),
              father: findGuardianProfile('father'),
              representative: findGuardianProfile('representative'),
              representativeType,
              enrollmentAnswers,
              address: m.student.contact?.address || 'N/A',
              birthState: m.student.residence?.birthState || 'N/A',
              birthMunicipality: m.student.residence?.birthMunicipality || 'N/A',
              birthParish: m.student.residence?.birthParish || 'N/A',
              residenceState: m.student.residence?.residenceState || 'N/A',
              residenceMunicipality: m.student.residence?.residenceMunicipality || 'N/A',
              residenceParish: m.student.residence?.residenceParish || 'N/A',
            }
          };
        });

        setMatriculations(rows);
        setStructure((structRes.data || []) as EnrollStructureEntry[]);
      }
    } catch (error) {
      console.error(error);
      message.error('Error cargando información de matrícula');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleUpdateRow = <K extends keyof TempData>(id: number, field: K, value: TempData[K]) => {
    setMatriculations(prev => prev.map(row => (
      row.id === id
        ? { ...row, tempData: { ...row.tempData, [field]: value } }
        : row
    )));
  };

  const handleUpdateGuardianField = (
    rowId: number,
    parentKey: 'mother' | 'father' | 'representative',
    field: keyof GuardianProfile,
    value: GuardianProfile[keyof GuardianProfile]
  ) => {
    setMatriculations(prev => prev.map(row => {
      if (row.id !== rowId) return row;
      const guardian = { ...(row.tempData[parentKey] || {}) } as GuardianProfile;
      guardian[field] = value;
      return { ...row, tempData: { ...row.tempData, [parentKey]: guardian } };
    }));
  };

  const handleUpdateAnswer = (rowId: number, questionId: number, value: string | string[] | undefined) => {
    setMatriculations(prev => prev.map(row => {
      if (row.id !== rowId) return row;
      const answers = { ...(row.tempData.enrollmentAnswers || {}) };
      answers[questionId] = value;
      return { ...row, tempData: { ...row.tempData, enrollmentAnswers: answers } };
    }));
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

  const selectedRows = useMemo(
    () => matriculations.filter(row => selectedRowKeys.includes(row.id)),
    [matriculations, selectedRowKeys]
  );

  const selectedGradeIds = useMemo(
    () => Array.from(new Set(selectedRows.map(row => row.tempData.gradeId))),
    [selectedRows]
  );

  const hasMixedGrades = selectedGradeIds.length > 1;

  const bulkGroupSubjects = useMemo(() => {
    if (hasMixedGrades || selectedRows.length === 0) return [];
    const gradeId = selectedRows[0].tempData.gradeId;
    const gradeStruct = structure.find(s => s.gradeId === gradeId);
    return gradeStruct?.subjects?.filter(s => s.subjectGroupId) || [];
  }, [hasMixedGrades, selectedRows, structure]);

  const bulkSections = useMemo(() => {
    if (hasMixedGrades || selectedRows.length === 0) return [];
    const gradeId = selectedRows[0].tempData.gradeId;
    const gradeStruct = structure.find(s => s.gradeId === gradeId);
    return gradeStruct?.sections || [];
  }, [hasMixedGrades, selectedRows, structure]);

  // --- Keyboard Navigation ---
  // List of columns identifiers for horizontal navigation
  const COLS = [
    'firstName', 'lastName', 'document', 'gradeId', 'sectionId', 'subjectIds',
    'mDoc', 'mFirstName', 'mLastName', 'mPhone',
    'fDoc', 'fFirstName', 'fLastName', 'fPhone',
    'repType', 'repDoc', 'repFirstName', 'repLastName', 'repPhone'
  ];

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
    // Check if event comes from a cell input/select
    if (!target.matches('input, .ant-select-selection-search-input')) return;
    
    // Only handle navigation keys
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;

    // Retrieve metadata
    // For Antd Select, the input is nested. We need to find the closest element with data attributes.
    const cell = target.closest('[data-row-index]');
    if (!cell) return;

    const rowIndexStr = cell.getAttribute('data-row-index');
    const colName = cell.getAttribute('data-col-name');

    if (!rowIndexStr || !colName) return;

    e.preventDefault();
    const rowIndex = parseInt(rowIndexStr, 10);
    let nRow = rowIndex;
    let nColIdx = COLS.indexOf(colName);

    if (e.key === 'ArrowUp') nRow = Math.max(0, rowIndex - 1);
    else if (e.key === 'ArrowDown') nRow = Math.min(matriculations.length - 1, rowIndex + 1);
    else if (e.key === 'ArrowLeft') nColIdx = Math.max(0, nColIdx - 1);
    else if (e.key === 'ArrowRight') nColIdx = Math.min(COLS.length - 1, nColIdx + 1);

    const nCol = COLS[nColIdx];
    const targetId = `nav-${nRow}-${nCol}`;

    // Use requestAnimationFrame for smoother focus transition
    requestAnimationFrame(() => {
      const el = document.getElementById(targetId);
      if (el) {
        // For Antd Selects, we might need to focus the internal input or the container
        // If it's a select container (which it usually is for id placement on Select), focus it.
        el.focus();
        if (el.tagName === 'INPUT') (el as HTMLInputElement).select();
      }
    });
  };

  // --- Columns Configuration ---

  const studentColumns = [
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
  ].filter(Boolean);

  const academicColumns = [
    isColumnVisible('gradeId') && {
      title: 'Grado',
      width: 160,
      render: (_: unknown, record: MatriculationRow, idx: number) => {
        if (!canEditRow(record.id)) {
          const gradeName = structure.find(s => s.gradeId === record.tempData.gradeId)?.grade?.name || 'N/A';
          return (
            <div className="px-1 py-0.5 text-xs text-slate-800 whitespace-nowrap overflow-hidden text-ellipsis">
              {gradeName}
            </div>
          );
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
          return (
            <div className="px-1 py-0.5 text-xs text-slate-800 whitespace-nowrap overflow-hidden text-ellipsis">
              {sectionName}
            </div>
          );
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
        
        if (!canEditRow(record.id)) {
           const subjectName = groupSubjects.find(s => s.id === currentSubjectId)?.name || (currentSubjectId ? '...' : '');
           return (
             <div className="px-1 py-0.5 text-xs text-slate-800 whitespace-nowrap overflow-hidden text-ellipsis min-h-[20px]">
               {subjectName}
             </div>
           );
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
              {groupSubjects.map(s => (
                <Option key={s.id} value={s.id}>
                  {s.name}
                </Option>
              ))}
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
          const label = ESCOLARIDAD_OPTIONS.find(o => o.value === record.tempData.escolaridad)?.label || record.tempData.escolaridad;
          return (
            <div className="px-1 py-0.5 text-xs text-slate-800 whitespace-nowrap overflow-hidden text-ellipsis">
              {label}
            </div>
          );
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

  const contactColumns = [
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

  const motherColumns = [
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

  const fatherColumns = [
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

  const representativeColumns = [
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
        const isRowEditable = canEditRow(record.id);
        const isDisabled = !isRowEditable || !editable;
        
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
            {!editable && (
              <Text type="secondary" style={{ fontSize: 11 }}>
                Representante: {label}
              </Text>
            )}
          </div>
        );
      }
    },
    isColumnVisible('representativeFirstName') && {
      title: 'Nombres',
      width: 140,
      render: (_: unknown, record: MatriculationRow, idx: number) => {
        const { profile, editable } = getRepresentativeInfo(record);
        const isRowEditable = canEditRow(record.id);
        const isDisabled = !isRowEditable || !editable;

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
        const isRowEditable = canEditRow(record.id);
        const isDisabled = !isRowEditable || !editable;

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
        const isRowEditable = canEditRow(record.id);
        const isDisabled = !isRowEditable || !editable;

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

  const questionColumns = questions
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

  const toggleGroupPin = useCallback((group: string) => {
    setPinnedGroups(prev =>
      prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group]
    );
  }, []);

  const renderGroupTitle = (group: string, titleNode: React.ReactNode) => (
    <div className="flex items-center justify-between gap-2 group select-none cursor-pointer" onClick={() => toggleGroupPin(group)}>
      {titleNode}
      <Checkbox
        checked={pinnedGroups.includes(group)}
        onClick={(e) => { e.stopPropagation(); toggleGroupPin(group); }}
        className={`transition-opacity duration-200 ${pinnedGroups.includes(group) ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`}
        style={{ transform: 'scale(0.7)' }}
      />
    </div>
  );

  const addSeparator = (cols?: (MatriculationColumn | false | null | undefined)[]): MatriculationColumn[] => {
    if (!cols) return [];
    const validCols = cols.filter((col): col is MatriculationColumn => Boolean(col));
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
  };

  const columns = [
    studentColumns.length > 0 && {
      title: renderGroupTitle('Estudiante', <Space><UserOutlined /> Estudiante</Space>),
      fixed: (pinnedGroups.includes('Estudiante') ? 'left' : undefined) as 'left' | undefined,
      className: 'group-separator-border',
      children: addSeparator(studentColumns)
    },
    academicColumns.length > 0 && {
      title: renderGroupTitle('Académico', <Space><BookOutlined /> Académico</Space>),
      fixed: (pinnedGroups.includes('Académico') ? 'left' : undefined) as 'left' | undefined,
      className: 'group-separator-border',
      children: addSeparator(academicColumns)
    },
    contactColumns.length > 0 && {
      title: renderGroupTitle('Contacto', 'Contacto'),
      fixed: (pinnedGroups.includes('Contacto') ? 'left' : undefined) as 'left' | undefined,
      className: 'group-separator-border',
      children: addSeparator(contactColumns)
    },
    (motherColumns.length > 0 || fatherColumns.length > 0 || representativeColumns.length > 0) && {
      title: renderGroupTitle('Representación', 'Representación'),
      className: 'group-separator-border',
      children: addSeparator([
        motherColumns.length > 0 && {
          title: <Text strong style={{ color: '#eb2f96' }}>Madre</Text>,
          children: motherColumns
        },
        fatherColumns.length > 0 && {
          title: <Text strong style={{ color: '#1890ff' }}>Padre</Text>,
          children: fatherColumns
        },
        representativeColumns.length > 0 && {
          title: 'Representante',
          children: representativeColumns
        }
      ].filter(Boolean))
    },
    questionColumns.length > 0 && {
      title: renderGroupTitle('Preguntas Personalizadas', <Space><QuestionCircleOutlined /> Preguntas</Space>),
      // No separator needed for the very last group typically, but consistent looks might be good.
      // Let's add it for consistency or leave it off if it's the edge.
      children: questionColumns
    }
  ].filter(Boolean) as ColumnsType<MatriculationRow>;

  return (
    <div className="flex flex-col gap-2 h-full" onKeyDown={handleTableKeyDown}>
      <div ref={headerRef} className="flex flex-col gap-2 shrink-0">
        <Card size="small" bodyStyle={{ padding: '4px 12px' }} className="glass-card !bg-white/50 border-none shrink-0">
          <Row justify="space-between" align="middle" gutter={[4, 4]}>
            <Col xs={24} lg={8}>
              <div className="flex flex-col items-start gap-1">
                <Title level={5} style={{ margin: 0 }}>Panel de Matriculación Masiva</Title>
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
            </Col>
            <Col xs={24} lg={16}>
              <Row gutter={[4, 4]} justify="end">
                <Col>
                  <Select
                    placeholder="Filtrar Grado"
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

          <div className="flex items-center gap-6">

            {/* Section 1: Counter */}
            <div className="flex items-center gap-2 pr-4 border-r border-slate-300/50 min-w-max">
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
              {selectedRowKeys.length > 0 && (
                <Button
                  type="text"
                  size="small"
                  icon={<CloseOutlined />}
                  onClick={() => setSelectedRowKeys([])}
                  className="text-slate-400 hover:text-red-500 ml-2"
                />
              )}
            </div>

            {/* Section 2: Inputs Grid */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2">
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
                    className="w-full"
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

              {/* Change Grade */}


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
                    className="w-full"
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
        </Card>
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={currentData}
        loading={loading}
        pagination={false}
        scroll={{ x: 'max-content', y: scrollY }}
        rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
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

      {contextMenuState.visible && createPortal(
        <div
          className="context-menu"
          style={{
            position: 'fixed',
            top: contextMenuState.y,
            left: contextMenuState.x,
            transform: 'translate(-50%, 4px)',
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            boxShadow: '0 12px 30px rgba(15, 23, 42, 0.2)',
            zIndex: 2000,
            minWidth: 180,
            overflow: 'hidden'
          }}
          onContextMenu={e => e.preventDefault()}
        >
          <div className="px-3 py-2 text-xs text-slate-400 border-b border-slate-100">
            Acciones de fila
          </div>
          <Button type="text" block onClick={handleContextEdit} className="!text-left !py-2">
            Editar fila
          </Button>
          <Button type="text" block onClick={closeContextMenu} className="!text-left !py-2 text-slate-500">
            Cancelar
          </Button>
          <div className="px-3 py-2 text-[11px] text-slate-400 border-t border-slate-100">
            Tip: clic derecho sobre la fila para mostrar este menú.
          </div>
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
