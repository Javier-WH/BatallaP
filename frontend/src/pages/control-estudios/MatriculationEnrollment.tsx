import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
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

const MatriculationEnrollment: React.FC = () => {
  const [matriculations, setMatriculations] = useState<MatriculationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [structure, setStructure] = useState<EnrollStructureEntry[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
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
    window.addEventListener('resize', calculateHeight);

    // Recalculate when selection changes (as it adds/removes a card)
    const timeoutId = setTimeout(calculateHeight, 100);

    return () => {
      window.removeEventListener('resize', calculateHeight);
      clearTimeout(timeoutId);
    };
  }, [selectedRowKeys.length, structure]);

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

  const handleKeyDown = <T extends Element>(e: React.KeyboardEvent<T>, rowIndex: number, colName: string) => {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;

    e.preventDefault();
    let nRow = rowIndex;
    let nColIdx = COLS.indexOf(colName);

    if (e.key === 'ArrowUp') nRow = Math.max(0, rowIndex - 1);
    else if (e.key === 'ArrowDown') nRow = Math.min(matriculations.length - 1, rowIndex + 1);
    else if (e.key === 'ArrowLeft') nColIdx = Math.max(0, nColIdx - 1);
    else if (e.key === 'ArrowRight') nColIdx = Math.min(COLS.length - 1, nColIdx + 1);

    const nCol = COLS[nColIdx];
    const targetId = `nav-${nRow}-${nCol}`;

    setTimeout(() => {
      const el = document.getElementById(targetId);
      if (el) {
        el.focus();
        if (el.tagName === 'INPUT') (el as HTMLInputElement).select();
        // If it's a select, we can't easily auto-open it with focus alone in many versions of Antd
        // but it will be focused for the next arrow.
      }
    }, 10);
  };

  // --- Columns Configuration ---

  const studentColumns = [
    isColumnVisible('firstName') && {
      title: 'Nombres',
      width: 150,
      render: (_: unknown, record: MatriculationRow, idx: number) => (
        <Input
          id={`nav-${idx}-firstName`}
          value={record.tempData.firstName}
          onKeyDown={e => handleKeyDown(e, idx, 'firstName')}
          onChange={e => handleUpdateRow(record.id, 'firstName', e.target.value)}
        />
      )
    },
    isColumnVisible('lastName') && {
      title: 'Apellidos',
      width: 150,
      render: (_: unknown, record: MatriculationRow, idx: number) => (
        <Input
          id={`nav-${idx}-lastName`}
          value={record.tempData.lastName}
          onKeyDown={e => handleKeyDown(e, idx, 'lastName')}
          onChange={e => handleUpdateRow(record.id, 'lastName', e.target.value)}
        />
      )
    },
    isColumnVisible('document') && {
      title: 'Cédula',
      width: 120,
      render: (_: unknown, record: MatriculationRow, idx: number) => (
        <Input
          id={`nav-${idx}-document`}
          value={record.tempData.document}
          onKeyDown={e => handleKeyDown(e, idx, 'document')}
          onChange={e => handleUpdateRow(record.id, 'document', e.target.value)}
        />
      )
    },
  ].filter(Boolean);

  const academicColumns = [
    isColumnVisible('gradeId') && {
      title: 'Grado',
      width: 160,
      render: (_: unknown, record: MatriculationRow, idx: number) => (
        <Select
          id={`nav-${idx}-gradeId`}
          value={record.tempData.gradeId}
          style={{ width: '100%' }}
          onInputKeyDown={e => handleKeyDown(e, idx, 'gradeId')}
          onChange={(v) => handleUpdateRow(record.id, 'gradeId', v)}
        >
          {structure.map(s => <Option key={s.gradeId} value={s.gradeId}>{s.grade?.name}</Option>)}
        </Select>
      )
    },
    isColumnVisible('sectionId') && {
      title: 'Sección',
      width: 120,
      render: (_: unknown, record: MatriculationRow, idx: number) => {
        const gradeStruct = structure.find(s => s.gradeId === record.tempData.gradeId);
        return (
          <Select
            id={`nav-${idx}-sectionId`}
            value={record.tempData.sectionId}
            allowClear
            style={{ width: '100%' }}
            onInputKeyDown={e => handleKeyDown(e, idx, 'sectionId')}
            onChange={(v) => handleUpdateRow(record.id, 'sectionId', v)}
          >
            {gradeStruct?.sections?.map(sec => <Option key={sec.id} value={sec.id}>{sec.name}</Option>)}
          </Select>
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
        return (
          <Select
            id={`nav-${idx}-subjectIds`}
            style={{ width: '100%' }}
            value={currentSubjectId}
            allowClear
            onInputKeyDown={e => handleKeyDown(e, idx, 'subjectIds')}
            placeholder="Seleccione"
            onChange={(v) => handleUpdateRow(record.id, 'subjectIds', v ? [v] : [])}
          >
            {groupSubjects.map(s => (
              <Option key={s.id} value={s.id}>
                {s.name}
              </Option>
            ))}
          </Select>
        );
      }
    },
    isColumnVisible('escolaridad') && {
      title: 'Escolaridad',
      width: 150,
      render: (_: unknown, record: MatriculationRow, idx: number) => (
        <Select
          id={`nav-${idx}-escolaridad`}
          value={record.tempData.escolaridad}
          style={{ width: '100%' }}
          onInputKeyDown={e => handleKeyDown(e, idx, 'escolaridad')}
          onChange={(v) => handleUpdateRow(record.id, 'escolaridad', v as EscolaridadStatus)}
          options={ESCOLARIDAD_OPTIONS}
        />
      )
    },
  ].filter(Boolean);

  const contactColumns = [
    isColumnVisible('phone1') && {
      title: 'S. Principal',
      width: 140,
      render: (_: unknown, record: MatriculationRow, idx: number) => (
        <Input
          id={`nav-${idx}-phone1`}
          value={record.tempData.phone1}
          onKeyDown={e => handleKeyDown(e, idx, 'phone1')}
          onChange={e => handleUpdateRow(record.id, 'phone1', e.target.value)}
        />
      )
    },
    isColumnVisible('whatsapp') && {
      title: 'WhatsApp',
      width: 140,
      render: (_: unknown, record: MatriculationRow, idx: number) => (
        <Input
          id={`nav-${idx}-whatsapp`}
          value={record.tempData.whatsapp}
          onKeyDown={e => handleKeyDown(e, idx, 'whatsapp')}
          onChange={e => handleUpdateRow(record.id, 'whatsapp', e.target.value)}
        />
      )
    },
  ].filter(Boolean);

  const motherColumns = [
    isColumnVisible('motherDocument') && {
      title: 'Cédula',
      width: 130,
      render: (_: unknown, record: MatriculationRow, idx: number) => (
        <Input
          id={`nav-${idx}-mDoc`}
          value={record.tempData.mother?.document}
          placeholder="Doc..."
          onKeyDown={e => handleKeyDown(e, idx, 'mDoc')}
          onChange={e => handleUpdateGuardianField(record.id, 'mother', 'document', e.target.value)}
        />
      )
    },
    isColumnVisible('motherFirstName') && {
      title: 'Nombres',
      width: 140,
      render: (_: unknown, record: MatriculationRow, idx: number) => (
        <Input
          id={`nav-${idx}-mFirstName`}
          value={record.tempData.mother?.firstName}
          onKeyDown={e => handleKeyDown(e, idx, 'mFirstName')}
          onChange={e => handleUpdateGuardianField(record.id, 'mother', 'firstName', e.target.value)}
        />
      )
    },
    isColumnVisible('motherLastName') && {
      title: 'Apellidos',
      width: 140,
      render: (_: unknown, record: MatriculationRow, idx: number) => (
        <Input
          id={`nav-${idx}-mLastName`}
          value={record.tempData.mother?.lastName}
          onKeyDown={e => handleKeyDown(e, idx, 'mLastName')}
          onChange={e => handleUpdateGuardianField(record.id, 'mother', 'lastName', e.target.value)}
        />
      )
    },
    isColumnVisible('motherPhone') && {
      title: 'Teléfono',
      width: 130,
      render: (_: unknown, record: MatriculationRow, idx: number) => (
        <Input
          id={`nav-${idx}-mPhone`}
          value={record.tempData.mother?.phone}
          onKeyDown={e => handleKeyDown(e, idx, 'mPhone')}
          onChange={e => handleUpdateGuardianField(record.id, 'mother', 'phone', e.target.value)}
        />
      )
    },
  ].filter(Boolean);

  const fatherColumns = [
    isColumnVisible('fatherDocument') && {
      title: 'Cédula',
      width: 130,
      render: (_: unknown, record: MatriculationRow, idx: number) => (
        <Input
          id={`nav-${idx}-fDoc`}
          value={record.tempData.father?.document}
          placeholder="Doc..."
          onKeyDown={e => handleKeyDown(e, idx, 'fDoc')}
          onChange={e => handleUpdateGuardianField(record.id, 'father', 'document', e.target.value)}
        />
      )
    },
    isColumnVisible('fatherFirstName') && {
      title: 'Nombres',
      width: 140,
      render: (_: unknown, record: MatriculationRow, idx: number) => (
        <Input
          id={`nav-${idx}-fFirstName`}
          value={record.tempData.father?.firstName}
          onKeyDown={e => handleKeyDown(e, idx, 'fFirstName')}
          onChange={e => handleUpdateGuardianField(record.id, 'father', 'firstName', e.target.value)}
        />
      )
    },
    isColumnVisible('fatherLastName') && {
      title: 'Apellidos',
      width: 140,
      render: (_: unknown, record: MatriculationRow, idx: number) => (
        <Input
          id={`nav-${idx}-fLastName`}
          value={record.tempData.father?.lastName}
          onKeyDown={e => handleKeyDown(e, idx, 'fLastName')}
          onChange={e => handleUpdateGuardianField(record.id, 'father', 'lastName', e.target.value)}
        />
      )
    },
    isColumnVisible('fatherPhone') && {
      title: 'Teléfono',
      width: 130,
      render: (_: unknown, record: MatriculationRow, idx: number) => (
        <Input
          id={`nav-${idx}-fPhone`}
          value={record.tempData.father?.phone}
          onKeyDown={e => handleKeyDown(e, idx, 'fPhone')}
          onChange={e => handleUpdateGuardianField(record.id, 'father', 'phone', e.target.value)}
        />
      )
    },
  ].filter(Boolean);

  const representativeColumns = [
    isColumnVisible('representativeType') && {
      title: 'Asignar',
      width: 140,
      render: (_: unknown, record: MatriculationRow, idx: number) => (
        <Select
          id={`nav-${idx}-repType`}
          value={record.tempData.representativeType}
          style={{ width: '100%' }}
          onInputKeyDown={e => handleKeyDown(e, idx, 'repType')}
          onChange={v => handleUpdateRow(record.id, 'representativeType', v)}
        >
          <Option value="mother">Madre</Option>
          <Option value="father">Padre</Option>
          <Option value="other">Otro</Option>
        </Select>
      )
    },
    isColumnVisible('representativeDocument') && {
      title: 'Cédula',
      width: 140,
      render: (_: unknown, record: MatriculationRow, idx: number) => {
        const { profile, editable, label } = getRepresentativeInfo(record);
        return (
          <div className="flex flex-col gap-1">
            <Input
              id={`nav-${idx}-repDoc`}
              value={profile?.document || ''}
              placeholder="Doc..."
              disabled={!editable}
              onKeyDown={e => handleKeyDown(e, idx, 'repDoc')}
              onChange={e => {
                if (!editable) return;
                handleUpdateGuardianField(record.id, 'representative', 'document', e.target.value);
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
        return (
          <Input
            id={`nav-${idx}-repFirstName`}
            value={profile?.firstName || ''}
            disabled={!editable}
            onKeyDown={e => handleKeyDown(e, idx, 'repFirstName')}
            onChange={e => {
              if (!editable) return;
              handleUpdateGuardianField(record.id, 'representative', 'firstName', e.target.value);
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
        return (
          <Input
            id={`nav-${idx}-repLastName`}
            value={profile?.lastName || ''}
            disabled={!editable}
            onKeyDown={e => handleKeyDown(e, idx, 'repLastName')}
            onChange={e => {
              if (!editable) return;
              handleUpdateGuardianField(record.id, 'representative', 'lastName', e.target.value);
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
        return (
          <Input
            id={`nav-${idx}-repPhone`}
            value={profile?.phone || ''}
            disabled={!editable}
            onKeyDown={e => handleKeyDown(e, idx, 'repPhone')}
            onChange={e => {
              if (!editable) return;
              handleUpdateGuardianField(record.id, 'representative', 'phone', e.target.value);
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
      render: (_: unknown, record: MatriculationRow) => {
        const value = record.tempData.enrollmentAnswers?.[q.id];
        if (q.type === 'text') {
          return (
            <Input
              value={(value as string) || ''}
              placeholder="..."
              onChange={e => handleUpdateAnswer(record.id, q.id, e.target.value)}
            />
          );
        }
        if (q.type === 'select' || q.type === 'checkbox') {
          return (
            <Select
              mode={q.type === 'checkbox' ? 'multiple' : undefined}
              style={{ width: '100%' }}
              value={value as string | string[] | undefined}
              placeholder="Elija..."
              onChange={v => handleUpdateAnswer(record.id, q.id, v)}
            >
              {(q.options || []).map(opt => (
                <Option key={opt} value={opt}>{opt}</Option>
              ))}
            </Select>
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

  const addSeparator = (cols: any[]) => {
    if (!cols || cols.length === 0) return cols;
    return cols.map((col, idx) => {
      if (idx === cols.length - 1) {
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
    <div className="flex flex-col gap-2 h-full">
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
                    disabled={selectedRowKeys.length === 0 || hasMixedGrades}
                    placeholder="Seleccionar..."
                    size="small"
                    className="w-full"
                    value={selectedRows.length === 0 || hasMixedGrades ? undefined : undefined}
                    onChange={v => handleBulkUpdate('sectionId', v)}
                    allowClear
                    notFoundContent={hasMixedGrades ? 'Seleccione estudiantes del mismo grado' : undefined}
                  >
                    {bulkGroupSubjects.length > 0
                      ? (structure.find(s => s.gradeId === selectedRows[0].tempData.gradeId)?.sections || []).map(sec => (
                        <Option key={sec.id} value={sec.id}>{sec.name}</Option>
                      ))
                      : (selectedRows.length === 0 ? [] :
                        (structure.find(s => s.gradeId === selectedRows[0].tempData.gradeId)?.sections || []).map(sec => (
                          <Option key={sec.id} value={sec.id}>{sec.name}</Option>
                        )))
                    }
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
                    disabled={selectedRowKeys.length === 0 || hasMixedGrades}
                    placeholder="Asignar Materia..."
                    size="small"
                    className="w-full"
                    value={bulkGroupSubjects.length === 0 ? undefined : undefined}
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
        size="small"
        bordered
        className="flex-1 overflow-hidden"
      />

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
        .ant-select-focused .ant-select-selector {
          border-color: #cbd5e1 !important;
          background: #ffffff !important;
          border-radius: 4px !important;
        }
        .ant-input:focus, .ant-select-focused .ant-select-selector {
          border-color: #3b82f6 !important;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1) !important;
        }
      `}</style>
    </div >
  );
};

export default MatriculationEnrollment;
