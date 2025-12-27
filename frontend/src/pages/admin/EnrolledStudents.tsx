import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Table, Card, Button, Input, Select, Space, Tag, message, Row, Col, Typography, Pagination, Checkbox, Tooltip, Popover, Divider } from 'antd';
import { FilterOutlined, TeamOutlined, EyeOutlined, BookOutlined, ReloadOutlined, SearchOutlined, CloseOutlined, UserOutlined, TableOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '@/services/api';
import type { ColumnsType } from 'antd/es/table';
import StudentSubjectsModal from './StudentSubjectsModal';

const { Option } = Select;
const { Text, Title } = Typography;

type Gender = 'M' | 'F';

interface SchoolPeriod {
  id: number;
  name: string;
  isActive: boolean;
}

interface Grade {
  id: number;
  name: string;
}

interface Section {
  id: number;
  name: string;
}

interface Contact {
  phone1?: string;
  email?: string;
  address?: string;
}

interface Residence {
  residenceState?: string;
  residenceMunicipality?: string;
}

interface GuardianProfile {
  firstName: string;
  lastName: string;
  document: string;
  phone: string;
  email: string;
}

interface StudentGuardian {
  relationship: 'mother' | 'father' | 'representative';
  isRepresentative: boolean;
  profile: GuardianProfile;
}

interface Student {
  id: number;
  firstName: string;
  lastName: string;
  documentType: string;
  document: string;
  gender: Gender;
  contact?: Contact;
  residence?: Residence;
  guardians?: StudentGuardian[];
}

interface InscriptionRecord {
  id: number;
  student: Student;
  grade: Grade;
  section?: Section | null;
  schoolPeriodId: number;
}

interface FiltersState {
  gradeId?: number;
  sectionId?: number;
  gender?: Gender;
  q: string;
}

const BASE_COLUMN_OPTIONS = [
  { key: 'firstName', label: 'Nombres', group: 'Estudiante' },
  { key: 'document', label: 'Cédula', group: 'Estudiante' },
  { key: 'gender', label: 'Género', group: 'Estudiante' },
  { key: 'grade', label: 'Grado', group: 'Académico' },
  { key: 'section', label: 'Sección', group: 'Académico' },
  { key: 'contactPhone', label: 'Teléfono', group: 'Contacto' },
  { key: 'contactEmail', label: 'Email', group: 'Contacto' },
  { key: 'contactState', label: 'Estado', group: 'Contacto' },
  { key: 'motherName', label: 'Nombre Madre', group: 'Madre' },
  { key: 'motherLastName', label: 'Apellido Madre', group: 'Madre' },
  { key: 'motherDoc', label: 'Cédula Madre', group: 'Madre' },
  { key: 'motherPhone', label: 'Telf. Madre', group: 'Madre' },
  { key: 'fatherName', label: 'Nombre Padre', group: 'Padre' },
  { key: 'fatherLastName', label: 'Apellido Padre', group: 'Padre' },
  { key: 'fatherDoc', label: 'Cédula Padre', group: 'Padre' },
  { key: 'fatherPhone', label: 'Telf. Padre', group: 'Padre' },
  { key: 'repName', label: 'Nombre Rep.', group: 'Representante' },
  { key: 'repRel', label: 'Relación Rep.', group: 'Representante' },
  { key: 'repPhone', label: 'Telf. Rep.', group: 'Representante' },
];

const EnrolledStudents: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [inscriptions, setInscriptions] = useState<InscriptionRecord[]>([]);
  const [activePeriod, setActivePeriod] = useState<SchoolPeriod | null>(null);

  // Layout & Table State
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [scrollY, setScrollY] = useState(500);
  const headerRef = useRef<HTMLDivElement>(null);
  const [pinnedGroups, setPinnedGroups] = useState<string[]>(['Estudiante']);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Subject Modal State
  const [subjectModalVisible, setSubjectModalVisible] = useState(false);
  const [selectedStudentForSubjects, setSelectedStudentForSubjects] = useState<{
    inscriptionId: number;
    studentName: string;
    gradeId: number;
    schoolPeriodId: number;
  } | null>(null);

  // Catalogs
  const [grades, setGrades] = useState<Grade[]>([]);
  const [sections, setSections] = useState<Section[]>([]);

  // Filter states
  const [filters, setFilters] = useState<FiltersState>({
    gradeId: undefined,
    sectionId: undefined,
    gender: undefined,
    q: ''
  });

  // Column Visibility State
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<string[]>(BASE_COLUMN_OPTIONS.map(o => o.key));
  const [columnPopoverOpen, setColumnPopoverOpen] = useState(false);

  const isColumnVisible = (key: string) => visibleColumnKeys.includes(key);

  const toggleColumn = (key: string) => {
    setVisibleColumnKeys(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const toggleGroup = (group: string, checked: boolean) => {
    const keysInGroup = BASE_COLUMN_OPTIONS.filter(o => o.group === group).map(o => o.key);
    setVisibleColumnKeys(prev => {
      const otherKeys = prev.filter(k => !keysInGroup.includes(k));
      return checked ? [...otherKeys, ...keysInGroup] : otherKeys;
    });
  };

  const groupedOptions = useMemo(() => {
    const groups: Record<string, typeof BASE_COLUMN_OPTIONS> = {};
    BASE_COLUMN_OPTIONS.forEach(opt => {
      if (!groups[opt.group]) groups[opt.group] = [];
      groups[opt.group].push(opt);
    });
    return groups;
  }, []);

  const columnMenuContent = useMemo(() => (
    <div className="min-w-[280px] max-w-sm max-h-[400px] overflow-y-auto">
      <div className="flex justify-between items-center mb-2">
        <Text strong>Columnas</Text>
        <Space>
          <Button size="small" type="text" onClick={() => setVisibleColumnKeys(BASE_COLUMN_OPTIONS.map(o => o.key))}>Todas</Button>
          <Button size="small" type="text" onClick={() => setVisibleColumnKeys([])}>Ninguna</Button>
        </Space>
      </div>
      <Divider style={{ margin: '4px 0 8px 0' }} />
      {Object.entries(groupedOptions).map(([group, options]) => {
        const visibleCount = options.filter(o => visibleColumnKeys.includes(o.key)).length;
        const allVisible = visibleCount === options.length;
        const indeterminate = visibleCount > 0 && !allVisible;

        return (
          <div key={group} className="mb-3">
            <Checkbox
              indeterminate={indeterminate}
              checked={allVisible}
              onChange={(e) => toggleGroup(group, e.target.checked)}
              className="font-bold mb-1 block"
            >
              {group}
            </Checkbox>
            <div className="pl-4 grid grid-cols-2 gap-x-2 gap-y-1">
              {options.map(opt => (
                <Checkbox
                  key={opt.key}
                  checked={visibleColumnKeys.includes(opt.key)}
                  onChange={() => toggleColumn(opt.key)}
                  style={{ fontSize: '11px', margin: 0 }}
                >
                  {opt.label}
                </Checkbox>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  ), [visibleColumnKeys, groupedOptions]);

  // --- 1. Initial Load ---
  useEffect(() => {
    const loadCatalogs = async () => {
      try {
        const [periodsRes, gradesRes, sectionsRes] = await Promise.all([
          api.get<SchoolPeriod[]>('/academic/periods'),
          api.get<Grade[]>('/academic/grades'),
          api.get<Section[]>('/academic/sections')
        ]);

        const active = periodsRes.data.find((p) => p.isActive) || null;
        setActivePeriod(active);
        setGrades(gradesRes.data);
        setSections(sectionsRes.data);
      } catch (error) {
        console.error('Error loading catalogs:', error);
        message.error('Error al cargar catálogos');
      }
    };
    loadCatalogs();
  }, []);

  // --- 2. Dynamic Height ---
  useEffect(() => {
    const calculateHeight = () => {
      if (headerRef.current) {
        const { bottom } = headerRef.current.getBoundingClientRect();
        const available = window.innerHeight - bottom - 122; // Adjusted margin to maximize height without overflow (approx header 22px + scrollbar 17px + padding 24px + safety)
        setScrollY(Math.max(200, available));
      }
    };
    calculateHeight();
    window.addEventListener('resize', calculateHeight);
    const timeoutId = setTimeout(calculateHeight, 100);
    return () => {
      window.removeEventListener('resize', calculateHeight);
      clearTimeout(timeoutId);
    };
  }, [selectedRowKeys.length, activePeriod]); // Recalc on selection change or period load

  // --- 3. Fetch Data ---
  const fetchInscriptions = useCallback(async () => {
    if (!activePeriod) return;
    setLoading(true);
    try {
      const params = {
        schoolPeriodId: activePeriod.id,
        gradeId: filters.gradeId,
        sectionId: filters.sectionId,
        gender: filters.gender,
        q: filters.q
      };
      const res = await api.get<InscriptionRecord[]>('/inscriptions', { params });
      setInscriptions(res.data);
      setCurrentPage(1); // Reset pagination on new fetch
    } catch (error) {
      console.error('Error fetching inscriptions:', error);
      message.error('Error al obtener lista');
    } finally {
      setLoading(false);
    }
  }, [activePeriod, filters]);

  useEffect(() => {
    fetchInscriptions();
  }, [fetchInscriptions]);


  // --- 4. Pagination Logic ---
  const currentData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return inscriptions.slice(start, start + pageSize);
  }, [inscriptions, currentPage, pageSize]);


  // --- 5. Column Logic ---
  const toggleGroupPin = useCallback((group: string) => {
    setPinnedGroups(prev =>
      prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group]
    );
  }, []);

  const renderGroupTitle = (group: string, titleNode: React.ReactNode) => (
    <div className="flex items-center justify-between gap-1 group select-none cursor-pointer" style={{ minHeight: '14px' }} onClick={() => toggleGroupPin(group)}>
      {titleNode}
      <Checkbox
        checked={pinnedGroups.includes(group)}
        onClick={(e) => { e.stopPropagation(); toggleGroupPin(group); }}
        className={`transition-opacity duration-200 ${pinnedGroups.includes(group) ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`}
        style={{ transform: 'scale(0.7)', margin: 0, padding: 0 }}
      />
    </div>
  );

  const addSeparator = (cols: any[]) => {
    if (!cols || cols.length === 0) return cols;
    // Filter by visibility first
    const visibleCols = cols.filter(c => !c.key || isColumnVisible(c.key as string));

    return visibleCols.map((col, idx) => {
      // Add separator to the last visible column in the group
      if (idx === visibleCols.length - 1) {
        return {
          ...col,
          className: 'group-separator-border',
          onHeaderCell: () => ({ className: 'group-separator-border' })
        };
      }
      return col;
    });
  };

  const studentColumns = [
    {
      title: 'Cédula',
      dataIndex: ['student', 'document'],
      key: 'document',
      width: 120,
      render: (_: string, r: InscriptionRecord) => <Text>{r.student.documentType}-{r.student.document}</Text>
    },
    {
      title: 'Nombres',
      dataIndex: ['student', 'firstName'],
      key: 'firstName',
      width: 150,
      render: (_: string, r: InscriptionRecord) => <Text>{r.student.firstName} {r.student.lastName}</Text>
    },
    {
      title: 'Género',
      dataIndex: ['student', 'gender'],
      key: 'gender',
      width: 100,
      render: (gender: string) => (
        <Tag color={gender === 'M' ? 'blue' : 'magenta'}>
          {gender === 'M' ? 'Masc' : 'Fem'}
        </Tag>
      )
    }
  ];

  const getGuardian = (r: InscriptionRecord, rel: 'mother' | 'father') => {
    return r.student.guardians?.find(g => g.relationship === rel)?.profile;
  };

  const getRepresentative = (r: InscriptionRecord) => {
    return r.student.guardians?.find(g => g.isRepresentative)?.profile;
  };

  const contactColumns = [
    {
      title: 'Teléfono',
      width: 120,
      key: 'contactPhone',
      render: (_: any, r: InscriptionRecord) => <Text>{r.student.contact?.phone1 || '-'}</Text>
    },
    {
      title: 'Email',
      width: 180,
      key: 'contactEmail',
      render: (_: any, r: InscriptionRecord) => <Text>{r.student.contact?.email || '-'}</Text>
    },
    {
      title: 'Estado',
      width: 120,
      key: 'contactState',
      render: (_: any, r: InscriptionRecord) => <Text>{r.student.residence?.residenceState || '-'}</Text>
    }
  ];

  const motherColumns = [
    { title: 'Nombre', key: 'motherName', width: 140, render: (_: any, r: InscriptionRecord) => <Text>{getGuardian(r, 'mother')?.firstName || '-'}</Text> },
    { title: 'Apellido', key: 'motherLastName', width: 140, render: (_: any, r: InscriptionRecord) => <Text>{getGuardian(r, 'mother')?.lastName || '-'}</Text> },
    { title: 'Cédula', key: 'motherDoc', width: 100, render: (_: any, r: InscriptionRecord) => <Text>{getGuardian(r, 'mother')?.document || '-'}</Text> },
    { title: 'Telf.', key: 'motherPhone', width: 110, render: (_: any, r: InscriptionRecord) => <Text>{getGuardian(r, 'mother')?.phone || '-'}</Text> },
  ];

  const fatherColumns = [
    { title: 'Nombre', key: 'fatherName', width: 140, render: (_: any, r: InscriptionRecord) => <Text>{getGuardian(r, 'father')?.firstName || '-'}</Text> },
    { title: 'Apellido', key: 'fatherLastName', width: 140, render: (_: any, r: InscriptionRecord) => <Text>{getGuardian(r, 'father')?.lastName || '-'}</Text> },
    { title: 'Cédula', key: 'fatherDoc', width: 100, render: (_: any, r: InscriptionRecord) => <Text>{getGuardian(r, 'father')?.document || '-'}</Text> },
    { title: 'Telf.', key: 'fatherPhone', width: 110, render: (_: any, r: InscriptionRecord) => <Text>{getGuardian(r, 'father')?.phone || '-'}</Text> },
  ];

  const repColumns = [
    { title: 'Nombre', key: 'repName', width: 140, render: (_: any, r: InscriptionRecord) => <Text>{getRepresentative(r)?.firstName || '-'}</Text> },
    {
      title: 'Relación', key: 'repRel', width: 100, render: (_: any, r: InscriptionRecord) => {
        const rep = r.student.guardians?.find(g => g.isRepresentative);
        const mapRel: Record<string, string> = { mother: 'Madre', father: 'Padre', representative: 'Otro' };
        return <Tag>{mapRel[rep?.relationship || ''] || rep?.relationship || '-'}</Tag>
      }
    },
    { title: 'Telf.', key: 'repPhone', width: 110, render: (_: any, r: InscriptionRecord) => <Text>{getRepresentative(r)?.phone || '-'}</Text> },
  ];

  const academicColumns = [
    {
      title: 'Grado',
      dataIndex: ['grade', 'name'],
      key: 'grade',
      width: 140,
    },
    {
      title: 'Sección',
      dataIndex: ['section', 'name'],
      key: 'section',
      // No fixed width to allow fluid expansion
      render: (name: string) => (
        <div style={{ minWidth: 100 }}>
          {name || <Text type="secondary">N/A</Text>}
        </div>
      )
    }
  ];

  const columns = [
    {
      title: renderGroupTitle('Estudiante', <Space><UserOutlined /> Estudiante</Space>),
      fixed: (pinnedGroups.includes('Estudiante') ? 'left' : undefined) as 'left' | undefined,
      className: 'group-separator-border',
      children: addSeparator(studentColumns)
    },
    // Academic (Default Pinned Candidate?)
    {
      title: renderGroupTitle('Académico', <Space><BookOutlined /> Académico</Space>),
      fixed: (pinnedGroups.includes('Académico') ? 'left' : undefined) as 'left' | undefined,
      className: 'group-separator-border',
      children: addSeparator(academicColumns)
    },
    // Contact
    {
      title: renderGroupTitle('Contacto', 'Contacto'),
      fixed: (pinnedGroups.includes('Contacto') ? 'left' : undefined) as 'left' | undefined,
      className: 'group-separator-border',
      children: addSeparator(contactColumns)
    },
    // Contact
    {
      title: renderGroupTitle('Contacto', 'Contacto'),
      fixed: (pinnedGroups.includes('Contacto') ? 'left' : undefined) as 'left' | undefined,
      className: 'group-separator-border',
      children: addSeparator(contactColumns)
    },
    // Family Group - Flattened to reduce header height
    {
      title: renderGroupTitle('Madre', <Text strong style={{ color: '#eb2f96' }}>Madre</Text>),
      fixed: (pinnedGroups.includes('Madre') ? 'left' : undefined) as 'left' | undefined,
      className: 'group-separator-border',
      children: addSeparator(motherColumns)
    },
    {
      title: renderGroupTitle('Padre', <Text strong style={{ color: '#1890ff' }}>Padre</Text>),
      fixed: (pinnedGroups.includes('Padre') ? 'left' : undefined) as 'left' | undefined,
      className: 'group-separator-border',
      children: addSeparator(fatherColumns)
    },
    {
      title: renderGroupTitle('Representante', 'Repres.'),
      fixed: (pinnedGroups.includes('Representante') ? 'left' : undefined) as 'left' | undefined,
      className: 'group-separator-border',
      children: addSeparator(repColumns)
    }
  ] as ColumnsType<InscriptionRecord>;


  // --- 6. Actions Logic ---
  const handleOpenSubjectModal = () => {
    if (selectedRowKeys.length !== 1) return;
    const record = inscriptions.find(r => r.id === selectedRowKeys[0]);
    if (record) {
      setSelectedStudentForSubjects({
        inscriptionId: record.id,
        studentName: `${record.student.firstName} ${record.student.lastName}`,
        gradeId: record.grade.id,
        schoolPeriodId: record.schoolPeriodId
      });
      setSubjectModalVisible(true);
    }
  };

  const handleViewProfile = () => {
    if (selectedRowKeys.length !== 1) return;
    const record = inscriptions.find(r => r.id === selectedRowKeys[0]);
    if (record) {
      navigate(`/student/${record.student.id}`);
    }
  };

  // --- Render ---
  const selectedRecord = useMemo(() => inscriptions.find(r => r.id === selectedRowKeys[0]), [inscriptions, selectedRowKeys]);

  return (
    <div className="flex flex-col gap-2 h-full w-full">
      <div ref={headerRef} className="flex flex-col gap-2 shrink-0">
        <Card size="small" bodyStyle={{ padding: '4px 12px' }} className="glass-card !bg-white/50 border-none shrink-0">
          <Row justify="space-between" align="middle" gutter={[4, 4]}>
            <Col xs={24} lg={8}>
              <div className="flex flex-col items-start gap-1">
                <Space>
                  <TeamOutlined style={{ color: '#1890ff' }} />
                  <Title level={5} style={{ margin: 0 }}>Estudiantes Inscritos</Title>

                </Space>
                <Pagination
                  simple
                  size="small"
                  current={currentPage}
                  pageSize={pageSize}
                  total={inscriptions.length}
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
                    placeholder="Grado"
                    size="small"
                    style={{ width: 140 }}
                    allowClear
                    value={filters.gradeId}
                    onChange={(val) => setFilters(prev => ({ ...prev, gradeId: val }))}
                  >
                    {grades.map(g => <Option key={g.id} value={g.id}>{g.name}</Option>)}
                  </Select>
                </Col>
                <Col>
                  <Select
                    placeholder="Sección"
                    size="small"
                    style={{ width: 100 }}
                    allowClear
                    value={filters.sectionId}
                    onChange={(val) => setFilters(prev => ({ ...prev, sectionId: val }))}
                  >
                    {sections.map(s => <Option key={s.id} value={s.id}>{s.name}</Option>)}
                  </Select>
                </Col>
                <Col>
                  <Select
                    placeholder="Género"
                    size="small"
                    style={{ width: 100 }}
                    allowClear
                    value={filters.gender}
                    onChange={(val) => setFilters(prev => ({ ...prev, gender: val }))}
                  >
                    <Option value="M">Masc</Option>
                    <Option value="F">Fem</Option>
                  </Select>
                </Col>
                <Col>
                  <Input
                    placeholder="Buscar..."
                    size="small"
                    prefix={<SearchOutlined />}
                    style={{ width: 160 }}
                    value={filters.q}
                    onChange={(e) => setFilters(prev => ({ ...prev, q: e.target.value }))}
                    allowClear
                  />
                </Col>
                <Col>
                  <Popover
                    content={columnMenuContent}
                    trigger="click"
                    placement="bottomRight"
                    open={columnPopoverOpen}
                    onOpenChange={setColumnPopoverOpen}
                  >
                    <Button icon={<TableOutlined />} size="small" />
                  </Popover>
                </Col>
                <Col>
                  <Button icon={<FilterOutlined />} size="small" onClick={() => setFilters({ q: '' })} />
                </Col>
                <Col>
                  <Button icon={<ReloadOutlined />} onClick={fetchInscriptions} loading={loading} size="small">Actualizar</Button>
                </Col>
              </Row>
            </Col>
          </Row>
        </Card>

        {/* Selection Bar */}
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
            {/* Selected Student Info */}
            <div className="flex items-center gap-3 pr-4 border-r border-slate-300/50 min-w-max">
              {selectedRecord ? (
                <>
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white shadow-sm">
                    <UserOutlined />
                  </div>
                  <div className="flex flex-col justify-center">
                    <span className="text-xs font-bold text-blue-900 leading-tight">
                      {selectedRecord.student.firstName} {selectedRecord.student.lastName}
                    </span>
                    <span className="text-[10px] text-blue-700 leading-none mt-0.5">
                      {selectedRecord.student.documentType}-{selectedRecord.student.document}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-200 text-slate-400">
                    <UserOutlined />
                  </div>
                  <div className="flex flex-col justify-center text-slate-400">
                    <span className="text-xs font-bold leading-tight">Ningún estudiante</span>
                    <span className="text-[10px] leading-none">seleccionado</span>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex-1 flex gap-2">
              <Tooltip title={selectedRowKeys.length !== 1 ? "Seleccione un solo estudiante" : ""}>
                <Button
                  icon={<BookOutlined />}
                  size="small"
                  disabled={selectedRowKeys.length !== 1}
                  onClick={handleOpenSubjectModal}
                  className={selectedRowKeys.length === 1 ? 'border-blue-300 text-blue-600 bg-white' : ''}
                >
                  Gestionar Materias
                </Button>
              </Tooltip>

              <Tooltip title={selectedRowKeys.length !== 1 ? "Seleccione un solo estudiante" : ""}>
                <Button
                  icon={<EyeOutlined />}
                  size="small"
                  disabled={selectedRowKeys.length !== 1}
                  onClick={handleViewProfile}
                  className={selectedRowKeys.length === 1 ? 'border-blue-300 text-blue-600 bg-white' : ''}
                >
                  Ver Expediente
                </Button>
              </Tooltip>
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
        scroll={{ x: '100%', y: scrollY }}
        rowSelection={{
          type: 'radio',
          selectedRowKeys,
          onChange: setSelectedRowKeys
        }}
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

      <style>{`
        /* 1. Global Header Styles */
        .ant-table-thead > tr > th {
          background-color: #f1f5f9 !important;
          color: #475569 !important;
          font-weight: 700 !important;
          font-size: 10px !important;
          padding: 1px 4px !important;
          height: 22px !important;
          line-height: 1 !important;
          text-transform: uppercase !important;
          border-right: 1px solid #e2e8f0 !important;
          border-bottom: 1px solid #e2e8f0 !important;
          vertical-align: middle !important;
        }

        /* Remove default separator to avoid height issues */
        .ant-table-thead th::before {
            display: none !important;
        }

        /* 2. Global Body Styles - Grid & Spacing */
        .ant-table-tbody > tr > td {
          padding: 1px 4px !important;
          font-size: 11px !important;
          line-height: 1 !important;
          border-right: 1px solid #e2e8f0 !important;
          border-bottom: 1px solid #e2e8f0 !important;
          transition: background-color 0.2s;
        }
        
        /* Compact Tags in Table */
        .ant-table-tbody .ant-tag {
          margin: 0 !important;
          padding: 0 4px !important;
          line-height: 16px !important;
          font-size: 10px !important;
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
      `}</style>
    </div>
  );
};

export default EnrolledStudents;
