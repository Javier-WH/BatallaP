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
  Divider,
  Badge,
  Popover,
  Empty
} from 'antd';
import {
  ReloadOutlined,
  SearchOutlined,
  CheckCircleOutlined,
  UserOutlined,
  TeamOutlined,
  BookOutlined,
  QuestionCircleOutlined,
  InfoCircleOutlined
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
  const [submitting, setSubmitting] = useState<number | null>(null);
  const [questions, setQuestions] = useState<any[]>([]);

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

  const enrollStudent = async (row: MatriculationRow) => {
    setSubmitting(row.id);
    try {
      const { tempData } = row;

      // Format answers for backend: object -> array of {questionId, answer}
      const formattedAnswers = Object.entries(tempData.enrollmentAnswers || {}).map(([qId, ans]) => ({
        questionId: Number(qId),
        answer: ans
      }));

      const payload = {
        ...tempData,
        birthdate: tempData.birthdate ? tempData.birthdate.format('YYYY-MM-DD') : null,
        enrollmentAnswers: formattedAnswers
      };

      await api.post(`/matriculations/${row.id}/enroll`, payload);
      message.success(`Inscrito con éxito: ${tempData.firstName}`);
      setMatriculations(prev => prev.filter(r => r.id !== row.id));
    } catch (error: any) {
      console.error(error);
      message.error(error.response?.data?.error || 'No se pudo completar la inscripción');
    } finally {
      setSubmitting(null);
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
        const formattedAnswers = Object.entries(tempData.enrollmentAnswers || {}).map(([qId, ans]) => ({
          questionId: Number(qId),
          answer: ans
        }));

        const payload = {
          ...tempData,
          birthdate: tempData.birthdate ? tempData.birthdate.format('YYYY-MM-DD') : null,
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
  const COLS = ['firstName', 'lastName', 'document', 'gradeId', 'sectionId', 'subjectIds', 'phone1', 'whatsapp'];

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
          title: 'Madre',
          width: 160,
          ellipsis: true,
          render: (_, record) => {
            const m = record.tempData.mother;
            if (!m?.firstName) return <Text type="danger" style={{ fontSize: 11 }}>No registra</Text>;
            return (
              <Popover content={
                <div>
                  <p><b>Doc:</b> {m.documentType}-{m.document}</p>
                  <p><b>Tel:</b> {m.phone}</p>
                </div>
              } title="Detalles de la Madre">
                <Text style={{ fontSize: 12 }}>{`${m.firstName} ${m.lastName}`}</Text>
              </Popover>
            );
          }
        },
        {
          title: 'Padre',
          width: 160,
          ellipsis: true,
          render: (_, record) => {
            const f = record.tempData.father;
            if (!f?.firstName) return <Text type="secondary" style={{ fontSize: 11 }}>N/A</Text>;
            return (
              <Popover content={
                <div>
                  <p><b>Doc:</b> {f.documentType}-{f.document}</p>
                  <p><b>Tel:</b> {f.phone}</p>
                </div>
              } title="Detalles del Padre">
                <Text style={{ fontSize: 12 }}>{`${f.firstName} ${f.lastName}`}</Text>
              </Popover>
            );
          }
        },
        {
          title: 'Representante',
          width: 160,
          ellipsis: true,
          render: (_, record) => {
            const r = record.tempData.representative;
            const type = record.tempData.representativeType;
            if (!r?.firstName && !type) return <Text type="danger" style={{ fontSize: 11 }}>No asignado</Text>;

            // If it's mother or father, we show that link
            let displayName = `${r?.firstName || ''} ${r?.lastName || ''}`.trim();
            if (!displayName && type) displayName = type === 'mother' ? 'Mismo de Madre' : 'Mismo de Padre';

            return (
              <Space>
                <Badge status={r?.firstName ? 'success' : 'warning'} />
                <Text style={{ fontSize: 12 }}>{displayName}</Text>
              </Space>
            );
          }
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
    {
      title: 'Acción',
      fixed: 'right',
      width: 130,
      render: (_, record) => (
        <Button
          type="primary"
          size="small"
          icon={<CheckCircleOutlined />}
          loading={submitting === record.id}
          onClick={() => enrollStudent(record)}
          block
        >
          Matricular
        </Button>
      )
    }
  ];

  return (
    <div style={{ padding: 16, background: '#f5f7fa', minHeight: '100vh' }}>
      <Card bordered={false} bodyStyle={{ padding: '12px 24px' }} style={{ marginBottom: 12 }}>
        <Row justify="space-between" align="middle">
          <Col span={12}>
            <Title level={4} style={{ margin: 0 }}>Panel de Matriculación Masiva</Title>
            <Text type="secondary" style={{ fontSize: 13 }}>Gestione y complete las inscripciones directamente en la cuadrícula</Text>
          </Col>
          <Col span={12} style={{ textAlign: 'right' }}>
            <Space size="middle">
              <Input
                placeholder="Filtrar por nombre o identificación..."
                prefix={<SearchOutlined />}
                style={{ width: 340 }}
                value={searchValue}
                onChange={e => setSearchValue(e.target.value)}
                allowClear
              />
              <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>Actualizar</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {selectedRowKeys.length > 0 && (
        <Card size="small" style={{ marginBottom: 12, background: '#e6f7ff', border: '1px solid #91d5ff', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
          <Row align="middle">
            <Col flex="auto">
              <Space split={<Divider type="vertical" />}>
                <Badge count={selectedRowKeys.length} overflowCount={999} color="#1890ff">
                  <Text strong style={{ marginLeft: 8 }}>Seleccionados</Text>
                </Badge>

                <Space>
                  <Text style={{ fontSize: 13 }}>Asignar Sección:</Text>
                  <Select placeholder="Seleccionar" style={{ width: 150 }} onChange={v => handleBulkUpdate('sectionId', v)}>
                    <Option value={null}>Sin Sección</Option>
                    {Array.from(new Set(structure.flatMap(s => s.sections || []).map(s => s.id))).map(id => {
                      const sec = structure.flatMap(s => s.sections || []).find(s => s.id === id);
                      return <Option key={id} value={id}>{sec?.name}</Option>;
                    })}
                  </Select>
                </Space>

                <Space>
                  <Text style={{ fontSize: 13 }}>Cambiar Grado:</Text>
                  <Select placeholder="Seleccionar" style={{ width: 180 }} onChange={v => handleBulkUpdate('gradeId', v)}>
                    {structure.map(s => <Option key={s.gradeId} value={s.gradeId}>{s.grade?.name}</Option>)}
                  </Select>
                </Space>

                <Button type="primary" icon={<TeamOutlined />} onClick={handleBulkEnroll}>Inscribir Selección</Button>
              </Space>
            </Col>
            <Col>
              <Button type="text" danger onClick={() => setSelectedRowKeys([])}>Limpiar Selección</Button>
            </Col>
          </Row>
        </Card>
      )}

      <Table
        rowKey="id"
        columns={columns}
        dataSource={matriculations.filter(r =>
          `${r.student.firstName} ${r.student.lastName} ${r.student.document}`.toLowerCase().includes(searchValue.toLowerCase())
        )}
        loading={loading}
        pagination={{ pageSize: 50, showSizeChanger: true, showTotal: (total) => `Total ${total} estudiantes` }}
        scroll={{ x: 1800, y: 'calc(100vh - 260px)' }}
        rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
        size="small"
        bordered
      />

      <style>{`
        .ant-table-header th {
          background: #fafafa !important;
          color: #555 !important;
          font-weight: 600 !important;
          font-size: 12px !important;
          text-transform: uppercase !important;
          letter-spacing: 0.02em !important;
        }
        .ant-table-cell { padding: 4px 8px !important; }
        .ant-input, .ant-select-selector {
          border: 1px solid transparent !important;
          background: transparent !important;
          transition: border-color 0.2s, background 0.2s !important;
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
        .ant-table-row-selected td {
          background-color: #f6ffed !important;
        }
      `}</style>
    </div>
  );
};

export default MatriculationEnrollment;
