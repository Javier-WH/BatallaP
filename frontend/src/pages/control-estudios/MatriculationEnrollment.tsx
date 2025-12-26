import React, { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Card,
  Col,
  Input,
  message,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import {
  ReloadOutlined,
  SearchOutlined,
  UserOutlined,
  CheckCircleOutlined,
  BookOutlined,
  QuestionCircleOutlined,
  CloseOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '@/services/api';
import type { ColumnsType } from 'antd/es/table';

const { Text, Title } = Typography;
const { Option } = Select;

interface MatriculationRow {
  id: number;
  gradeId: number;
  sectionId?: number | null;
  status: 'pending' | 'completed';
  student: any;
  tempData: any;
}

interface EnrollStructureEntry {
  id: number;
  gradeId: number;
  grade?: { id: number; name: string };
  sections?: { id: number; name: string }[];
  subjects?: { id: number; name: string; subjectGroupId?: number | null; subjectGroup?: { name: string } }[];
}

const MatriculationEnrollment: React.FC = () => {
  const [matriculations, setMatriculations] = useState<MatriculationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [structure, setStructure] = useState<EnrollStructureEntry[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [searchValue, setSearchValue] = useState('');

  const [questions, setQuestions] = useState<any[]>([]);

  // Filter states
  const [filterGrade, setFilterGrade] = useState<number | null>(null);
  const [filterSection, setFilterSection] = useState<number | null>(null);
  const [filterMissing, setFilterMissing] = useState<string | null>(null);

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

        setQuestions(questRes.data || []);

        const rows = (matRes.data || []).map((m: any) => ({
          ...m,
          tempData: {
            ...m.student,
            gradeId: m.gradeId,
            sectionId: m.sectionId,
            subjectIds: [],
            phone1: m.student.contact?.phone1,
            whatsapp: m.student.contact?.whatsapp,
            birthdate: m.student.birthdate ? dayjs(m.student.birthdate) : null,
            mother: m.student.guardians?.find((g: any) => g.relationship === 'mother')?.profile || {},
            father: m.student.guardians?.find((g: any) => g.relationship === 'father')?.profile || {},
            representative: m.student.guardians?.find((g: any) => g.relationship === 'representative')?.profile || {},
            representativeType: m.student.guardians?.find((g: any) => g.isRepresentative)?.relationship || 'mother',
            enrollmentAnswers: (m.student.enrollmentAnswers || []).reduce((acc: any, curr: any) => {
              acc[curr.questionId] = curr.answer;
              return acc;
            }, {}),
            // Fallbacks for missing fields to avoid controller errors
            address: m.student.contact?.address || 'N/A',
            birthState: m.student.residence?.birthState || 'N/A',
            birthMunicipality: m.student.residence?.birthMunicipality || 'N/A',
            birthParish: m.student.residence?.birthParish || 'N/A',
            residenceState: m.student.residence?.residenceState || 'N/A',
            residenceMunicipality: m.student.residence?.residenceMunicipality || 'N/A',
            residenceParish: m.student.residence?.residenceParish || 'N/A',
          }
        }));

        setMatriculations(rows);
        setStructure(structRes.data || []);
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

  const handleUpdateRow = (id: number, field: string, value: any) => {
    setMatriculations(prev => prev.map(row => {
      if (row.id === id) {
        return { ...row, tempData: { ...row.tempData, [field]: value } };
      }
      return row;
    }));
  };

  const handleUpdateNested = (rowId: number, parentKey: 'mother' | 'father' | 'representative' | 'enrollmentAnswers', field: string, value: any) => {
    setMatriculations(prev => prev.map(row => {
      if (row.id === rowId) {
        const parent = { ...(row.tempData[parentKey] || {}) };
        parent[field] = value;
        return { ...row, tempData: { ...row.tempData, [parentKey]: parent } };
      }
      return row;
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
        const fixGuardian = (g: any) => ({
          ...g,
          documentType: g.documentType || 'Venezolano',
          residenceState: g.residenceState || 'N/A',
          residenceMunicipality: g.residenceMunicipality || 'N/A',
          residenceParish: g.residenceParish || 'N/A',
          address: g.address || 'N/A',
          email: g.email || 'no@email.com',
          phone: g.phone || '0000000000'
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

  const handleBulkUpdate = (field: string, value: any) => {
    setMatriculations(prev => prev.map(row => {
      if (selectedRowKeys.includes(row.id)) {
        return { ...row, tempData: { ...row.tempData, [field]: value } };
      }
      return row;
    }));
  };

  // --- Keyboard Navigation ---
  // List of columns identifiers for horizontal navigation
  const COLS = [
    'firstName', 'lastName', 'document', 'gradeId', 'sectionId', 'subjectIds',
    'mDoc', 'mFirstName', 'mLastName', 'mPhone',
    'fDoc', 'fFirstName', 'fLastName', 'fPhone',
    'repType'
  ];

  const handleKeyDown = (e: React.KeyboardEvent, rowIndex: number, colName: string) => {
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

  const columns: ColumnsType<MatriculationRow> = [
    {
      title: <Space><UserOutlined /> Estudiante</Space>,
      fixed: 'left',
      children: [
        {
          title: 'Nombres',
          width: 150,
          render: (_, record, idx) => (
            <Input
              id={`nav-${idx}-firstName`}
              value={record.tempData.firstName}
              onKeyDown={e => handleKeyDown(e, idx, 'firstName')}
              onChange={e => handleUpdateRow(record.id, 'firstName', e.target.value)}
            />
          )
        },
        {
          title: 'Apellidos',
          width: 150,
          render: (_, record, idx) => (
            <Input
              id={`nav-${idx}-lastName`}
              value={record.tempData.lastName}
              onKeyDown={e => handleKeyDown(e, idx, 'lastName')}
              onChange={e => handleUpdateRow(record.id, 'lastName', e.target.value)}
            />
          )
        },
        {
          title: 'Cédula',
          width: 120,
          render: (_, record, idx) => (
            <Input
              id={`nav-${idx}-document`}
              value={record.tempData.document}
              onKeyDown={e => handleKeyDown(e, idx, 'document')}
              onChange={e => handleUpdateRow(record.id, 'document', e.target.value)}
            />
          )
        },
      ]
    },
    {
      title: <Space><BookOutlined /> Académico</Space>,
      children: [
        {
          title: 'Grado',
          width: 160,
          render: (_, record, idx) => (
            <Select
              id={`nav-${idx}-gradeId`}
              value={record.tempData.gradeId}
              style={{ width: '100%' }}
              onInputKeyDown={e => handleKeyDown(e as any, idx, 'gradeId')}
              onChange={(v) => handleUpdateRow(record.id, 'gradeId', v)}
            >
              {structure.map(s => <Option key={s.gradeId} value={s.gradeId}>{s.grade?.name}</Option>)}
            </Select>
          )
        },
        {
          title: 'Sección',
          width: 100,
          render: (_, record, idx) => {
            const gradeStruct = structure.find(s => s.gradeId === record.tempData.gradeId);
            return (
              <Select
                id={`nav-${idx}-sectionId`}
                value={record.tempData.sectionId}
                allowClear style={{ width: '100%' }}
                onInputKeyDown={e => handleKeyDown(e as any, idx, 'sectionId')}
                onChange={(v) => handleUpdateRow(record.id, 'sectionId', v)}
              >
                {gradeStruct?.sections?.map(sec => <Option key={sec.id} value={sec.id}>{sec.name}</Option>)}
              </Select>
            );
          }
        },
        {
          title: 'Materias de Grupo',
          width: 280,
          render: (_, record, idx) => {
            const gradeStruct = structure.find(s => s.gradeId === record.tempData.gradeId);
            const groupSubjects = gradeStruct?.subjects?.filter(s => s.subjectGroupId) || [];
            return (
              <Select
                id={`nav-${idx}-subjectIds`}
                mode="multiple"
                style={{ width: '100%' }}
                value={record.tempData.subjectIds}
                onInputKeyDown={e => handleKeyDown(e as any, idx, 'subjectIds')}
                placeholder="Ninguna"
                onChange={(v) => handleUpdateRow(record.id, 'subjectIds', v)}
                maxTagCount="responsive"
              >
                {groupSubjects.map(s => (
                  <Option key={s.id} value={s.id}>
                    {s.name} <Tag color="blue" style={{ fontSize: 9 }}>{s.subjectGroup?.name}</Tag>
                  </Option>
                ))}
              </Select>
            );
          }
        },
      ]
    },
    {
      title: 'Contacto',
      children: [
        {
          title: 'S. Principal',
          width: 140,
          render: (_, record, idx) => (
            <Input
              id={`nav-${idx}-phone1`}
              value={record.tempData.phone1}
              onKeyDown={e => handleKeyDown(e, idx, 'phone1')}
              onChange={e => handleUpdateRow(record.id, 'phone1', e.target.value)}
            />
          )
        },
        {
          title: 'WhatsApp',
          width: 140,
          render: (_, record, idx) => (
            <Input
              id={`nav-${idx}-whatsapp`}
              value={record.tempData.whatsapp}
              onKeyDown={e => handleKeyDown(e, idx, 'whatsapp')}
              onChange={e => handleUpdateRow(record.id, 'whatsapp', e.target.value)}
            />
          )
        },
      ]
    },
    {
      title: 'Representación',
      children: [
        {
          title: <Text strong style={{ color: '#eb2f96' }}>Madre</Text>,
          children: [
            {
              title: 'Cédula',
              width: 130,
              render: (_, record, idx) => (
                <Input
                  id={`nav-${idx}-mDoc`}
                  value={record.tempData.mother?.document}
                  placeholder="Doc..."
                  onKeyDown={e => handleKeyDown(e, idx, 'mDoc')}
                  onChange={e => handleUpdateNested(record.id, 'mother', 'document', e.target.value)}
                />
              )
            },
            {
              title: 'Nombres',
              width: 140,
              render: (_, record, idx) => (
                <Input
                  id={`nav-${idx}-mFirstName`}
                  value={record.tempData.mother?.firstName}
                  onKeyDown={e => handleKeyDown(e, idx, 'mFirstName')}
                  onChange={e => handleUpdateNested(record.id, 'mother', 'firstName', e.target.value)}
                />
              )
            },
            {
              title: 'Apellidos',
              width: 140,
              render: (_, record, idx) => (
                <Input
                  id={`nav-${idx}-mLastName`}
                  value={record.tempData.mother?.lastName}
                  onKeyDown={e => handleKeyDown(e, idx, 'mLastName')}
                  onChange={e => handleUpdateNested(record.id, 'mother', 'lastName', e.target.value)}
                />
              )
            },
            {
              title: 'Teléfono',
              width: 130,
              render: (_, record, idx) => (
                <Input
                  id={`nav-${idx}-mPhone`}
                  value={record.tempData.mother?.phone}
                  onKeyDown={e => handleKeyDown(e, idx, 'mPhone')}
                  onChange={e => handleUpdateNested(record.id, 'mother', 'phone', e.target.value)}
                />
              )
            },
          ]
        },
        {
          title: <Text strong style={{ color: '#1890ff' }}>Padre</Text>,
          children: [
            {
              title: 'Cédula',
              width: 130,
              render: (_, record, idx) => (
                <Input
                  id={`nav-${idx}-fDoc`}
                  value={record.tempData.father?.document}
                  placeholder="Doc..."
                  onKeyDown={e => handleKeyDown(e, idx, 'fDoc')}
                  onChange={e => handleUpdateNested(record.id, 'father', 'document', e.target.value)}
                />
              )
            },
            {
              title: 'Nombres',
              width: 140,
              render: (_, record, idx) => (
                <Input
                  id={`nav-${idx}-fFirstName`}
                  value={record.tempData.father?.firstName}
                  onKeyDown={e => handleKeyDown(e, idx, 'fFirstName')}
                  onChange={e => handleUpdateNested(record.id, 'father', 'firstName', e.target.value)}
                />
              )
            },
            {
              title: 'Apellidos',
              width: 140,
              render: (_, record, idx) => (
                <Input
                  id={`nav-${idx}-fLastName`}
                  value={record.tempData.father?.lastName}
                  onKeyDown={e => handleKeyDown(e, idx, 'fLastName')}
                  onChange={e => handleUpdateNested(record.id, 'father', 'lastName', e.target.value)}
                />
              )
            },
            {
              title: 'Teléfono',
              width: 130,
              render: (_, record, idx) => (
                <Input
                  id={`nav-${idx}-fPhone`}
                  value={record.tempData.father?.phone}
                  onKeyDown={e => handleKeyDown(e, idx, 'fPhone')}
                  onChange={e => handleUpdateNested(record.id, 'father', 'phone', e.target.value)}
                />
              )
            },
          ]
        },
        {
          title: 'Representante',
          children: [
            {
              title: 'Asignar',
              width: 140,
              render: (_, record, idx) => (
                <Select
                  id={`nav-${idx}-repType`}
                  value={record.tempData.representativeType}
                  style={{ width: '100%' }}
                  onInputKeyDown={e => handleKeyDown(e as any, idx, 'repType')}
                  onChange={v => handleUpdateRow(record.id, 'representativeType', v)}
                >
                  <Option value="mother">Madre</Option>
                  <Option value="father">Padre</Option>
                  <Option value="other">Otro</Option>
                </Select>
              )
            },
          ]
        }
      ]
    },
    {
      title: <Space><QuestionCircleOutlined /> Preguntas Personalizadas</Space>,
      children: questions.map(q => ({
        title: q.prompt,
        width: 200,
        render: (_: any, record: any) => {
          const val = record.tempData.enrollmentAnswers?.[q.id];
          if (q.type === 'text') {
            return (
              <Input
                value={val || ''}
                placeholder="..."
                onChange={e => {
                  const newAnswers = { ...record.tempData.enrollmentAnswers, [q.id]: e.target.value };
                  handleUpdateRow(record.id, 'enrollmentAnswers', newAnswers);
                }}
              />
            );
          }
          if (q.type === 'select' || q.type === 'checkbox') {
            return (
              <Select
                mode={q.type === 'checkbox' ? 'multiple' : undefined}
                style={{ width: '100%' }}
                value={val}
                placeholder="Elija..."
                onChange={v => {
                  const newAnswers = { ...record.tempData.enrollmentAnswers, [q.id]: v };
                  handleUpdateRow(record.id, 'enrollmentAnswers', newAnswers);
                }}
              >
                {(q.options || []).map((opt: string) => (
                  <Option key={opt} value={opt}>{opt}</Option>
                ))}
              </Select>
            );
          }
          return null;
        }
      }))
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Card className="glass-card !bg-white/50 border-none">
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col xs={24} lg={8}>
            <Title level={4} style={{ margin: 0 }}>Panel de Matriculación Masiva</Title>
            <Text type="secondary" style={{ fontSize: 13 }}>Gestione las inscripciones directamente en la cuadrícula</Text>
          </Col>
          <Col xs={24} lg={16}>
            <Row gutter={[8, 8]} justify="end">
              <Col>
                <Select
                  placeholder="Filtrar Grado"
                  style={{ width: 160 }}
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
                  style={{ width: 110 }}
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
                  style={{ width: 160 }}
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
                  placeholder="Buscar Estudiante..."
                  prefix={<SearchOutlined />}
                  style={{ width: 220 }}
                  value={searchValue}
                  onChange={e => setSearchValue(e.target.value)}
                  allowClear
                />
              </Col>
              <Col>
                <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>Actualizar</Button>
              </Col>
            </Row>
          </Col>
        </Row>
      </Card>

      <Card
        size="small"
        bodyStyle={{ padding: '16px 24px' }}
        style={{
          marginBottom: 12,
          background: selectedRowKeys.length > 0 ? '#e6f7ff' : '#f8fafc',
          borderColor: selectedRowKeys.length > 0 ? '#91d5ff' : '#e2e8f0',
          transition: 'all 0.3s ease',
          position: 'relative'
        }}
      >
        {/* Clear button in top-right corner */}
        <Button
          disabled={selectedRowKeys.length === 0}
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

        <div className="flex items-center gap-6">

          {/* Section 1: Counter */}
          <div className="flex items-center gap-3 pr-6 border-r border-slate-300/50 min-w-max">
            <div
              className={`flex items-center justify-center w-10 h-10 rounded-full text-base font-bold shadow-sm transition-colors ${selectedRowKeys.length > 0 ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-400'
                }`}
            >
              {selectedRowKeys.length}
            </div>
            <div className={`flex flex-col leading-tight font-bold text-xs uppercase tracking-wide ${selectedRowKeys.length > 0 ? 'text-blue-900' : 'text-slate-400'}`}>
              <span>Estudiantes</span>
              <span>Seleccionados</span>
            </div>
          </div>

          {/* Section 2: Inputs Grid */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Assign Section */}
            <div className="flex flex-col gap-1">
              <span className={`text-[10px] font-bold uppercase tracking-wider ${selectedRowKeys.length > 0 ? 'text-slate-500' : 'text-slate-300'}`}>
                Asignar Sección
              </span>
              <Select
                disabled={selectedRowKeys.length === 0}
                placeholder="Seleccionar..."
                className="w-full"
                onChange={v => handleBulkUpdate('sectionId', v)}
                allowClear
              >
                {Array.from(new Set(structure.flatMap(s => s.sections || []).map(s => s.id))).map(id => {
                  const sec = structure.flatMap(s => s.sections || []).find(s => s.id === id);
                  return <Option key={id} value={id}>{sec?.name}</Option>;
                })}
              </Select>
            </div>

            {/* Change Grade */}


            {/* Group Subjects */}
            <div className="flex flex-col gap-1">
              <span className={`text-[10px] font-bold uppercase tracking-wider ${selectedRowKeys.length > 0 ? 'text-slate-500' : 'text-slate-300'}`}>
                Materias de Grupo
              </span>
              <Select
                disabled={selectedRowKeys.length === 0}
                mode="multiple"
                placeholder="Asignar Materias..."
                className="w-full"
                maxTagCount="responsive"
                onChange={v => handleBulkUpdate('subjectIds', v)}
                allowClear
              >
                {Array.from(new Map(structure.flatMap(s => s.subjects || [])
                  .filter(sub => sub.subjectGroupId)
                  .map(sub => [sub.id, sub])).values())
                  .map(sub => (
                    <Option key={sub.id} value={sub.id}>
                      {sub.name} <Tag color="blue" style={{ fontSize: 9 }}>{sub.subjectGroup?.name}</Tag>
                    </Option>
                  ))
                }
              </Select>
            </div>
          </div>

          {/* Section 3: Actions */}
          <div className="flex items-center pl-6 border-l border-slate-300/50 min-w-max">
            <Button
              disabled={selectedRowKeys.length === 0}
              type="primary"
              size="large"
              icon={<CheckCircleOutlined />}
              onClick={handleBulkEnroll}
              className="bg-blue-600 hover:bg-blue-500 border-none shadow-md shadow-blue-500/30"
            >
              Inscribir
            </Button>
          </div>

        </div>
      </Card>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={matriculations.filter(r => {
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
        })}
        loading={loading}
        pagination={{ pageSize: 50, showSizeChanger: true, showTotal: (total) => `Total ${total} estudiantes` }}
        scroll={{ x: 1800, y: 'calc(100vh - 260px)' }}
        rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
        size="small"
        bordered
      />

      <style>{`
        /* 1. Global Header Styles */
        .ant-table-thead > tr > th {
          background-color: #fafafa !important;
          color: #555 !important;
          font-weight: 600 !important;
          font-size: 12px !important;
          text-transform: uppercase !important;
          opacity: 1 !important;
        }

        /* 2. Global Body Styles */
        .ant-table-tbody > tr > td {
          background-color: #ffffff !important;
          padding: 4px 8px !important;
          opacity: 1 !important;
        }

        /* 3. Global Hover Styles */
        .ant-table-tbody > tr:hover > td {
          background-color: #fafafa !important;
        }

        /* 4. Global Selected Styles */
        .ant-table-tbody > tr.ant-table-row-selected > td {
          background-color: #f6ffed !important;
        }

        /* 5. Input Styles (Keep transparent to show row color, or white if focused) */
        .ant-input, .ant-select-selector {
          border: 1px solid transparent !important;
          background: transparent !important;
          border-radius: 4px !important;
        }
        .ant-table-row:hover .ant-input, 
        .ant-table-row:hover .ant-select-selector {
          border-color: #d9d9d9 !important;
          background: #fff !important;
        }
        .ant-input:focus, .ant-select-focused .ant-select-selector {
          border-color: #1890ff !important;
          background: #fff !important;
          box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.1) !important;
        }
      `}</style>
    </div>
  );
};

export default MatriculationEnrollment;
