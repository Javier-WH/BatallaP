import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Form, Input, InputNumber, Button, Typography, Space, message, Spin,
  DatePicker, Table, Modal, Popconfirm, Tooltip, Alert, Tag, Row, Col, Empty,
  AutoComplete, Select, Tabs, Upload,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, EditOutlined, SwapOutlined, SearchOutlined,
  SaveOutlined, BankOutlined, DownloadOutlined, UploadOutlined, FileExcelOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '@/services/api';
import {
  getExternalGradesForPerson,
  listExternalSubjects,
  resolvePlantel,
  createExternalInscription,
  upsertExternalGrade,
  updateExternalGrade,
  deleteExternalGrade,
  type ExternalGrade,
  type ExternalSubject,
  type ExternalPlantel,
  type ExternalInscription,
  type ExternalGradeType,
  type ExternalGradeStatus,
  type BulkEntry,
} from '@/services/externalGrades';

const { Text, Title } = Typography;

interface StudentSearchResult {
  label: string;
  value: number;
}

interface GradeRow {
  key: string;
  subjectId: number;
  subjectName: string;
  finalScore: number;
  status: ExternalGradeStatus;
  gradeType: ExternalGradeType;
  issuedAt: dayjs.Dayjs;
  finalGradeId?: number;
  plantelId: number;
}

const ExternalGrades: React.FC = () => {
  const [activeTab, setActiveTab] = useState('individual');

  // Student search
  const [studentQuery, setStudentQuery] = useState('');
  const [studentResults, setStudentResults] = useState<StudentSearchResult[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(null);
  const [selectedPersonLabel, setSelectedPersonLabel] = useState('');

  // External inscriptions for selected student
  const [externalInscriptions, setExternalInscriptions] = useState<ExternalInscription[]>([]);
  const [loadingInscriptions, setLoadingInscriptions] = useState(false);

  // Catalogs
  const [subjects, setSubjects] = useState<ExternalSubject[]>([]);
  const [grades, setGrades] = useState<{ id: number; name: string }[]>([]);

  // Plantel search / creation
  const [plantelQuery, setPlantelQuery] = useState('');
  const [plantelResults, setPlantelResults] = useState<ExternalPlantel[]>([]);
  const [selectedPlantel, setSelectedPlantel] = useState<ExternalPlantel | null>(null);
  const [newPlantelModalOpen, setNewPlantelModalOpen] = useState(false);
  const [plantelForm] = Form.useForm();

  // Inscription form
  const [inscriptionForm] = Form.useForm();

  // Grade rows being edited
  const [gradeRows, setGradeRows] = useState<GradeRow[]>([]);
  const [saving, setSaving] = useState(false);

  // List view
  const [allGrades, setAllGrades] = useState<ExternalGrade[]>([]);
  const [loadingAllGrades, setLoadingAllGrades] = useState(false);

  // Load catalogs on mount
  useEffect(() => {
    listExternalSubjects().then(setSubjects).catch(() => message.error('Error cargando materias'));
    api.get('/academic/grades').then((res) => setGrades(res.data || [])).catch(() => {});
    loadAllGrades();
  }, []);

  const loadAllGrades = useCallback(async () => {
    setLoadingAllGrades(true);
    try {
      const data = await listExternalGrades();
      setAllGrades(data);
    } catch {
      message.error('Error cargando notas externas');
    } finally {
      setLoadingAllGrades(false);
    }
  }, []);

  // Student search
  const searchStudent = useCallback(async (query: string) => {
    setStudentQuery(query);
    if (query.trim().length < 3) {
      setStudentResults([]);
      return;
    }
    try {
      const res = await api.get('/users', { params: { q: query.trim() } });
      setStudentResults(
        (res.data || []).map((p: any) => ({
          label: `${p.lastName || ''} ${p.firstName || ''} (C.I. ${p.document || '—'})`,
          value: p.id,
        }))
      );
    } catch {
      setStudentResults([]);
    }
  }, []);

  const onSelectStudent = useCallback(async (value: number, option: any) => {
    setSelectedPersonId(value);
    setSelectedPersonLabel(option?.label ?? '');
    setLoadingInscriptions(true);
    try {
      const { inscriptions } = await getExternalGradesForPerson(value);
      setExternalInscriptions(inscriptions);
      // Pre-fill grade rows from existing external grades.
      const rows: GradeRow[] = [];
      inscriptions.forEach((ins) => {
        (ins.inscriptionSubjects || []).forEach((is) => {
          if (is.finalGrade && (is.finalGrade.gradeType === 'transferencia' || is.finalGrade.gradeType === 'equivalencia')) {
            rows.push({
              key: `${ins.id}-${is.subject.id}`,
              subjectId: is.subject.id,
              subjectName: is.subject.name,
              finalScore: Number(is.finalGrade.finalScore ?? 0),
              status: is.finalGrade.status,
              gradeType: is.finalGrade.gradeType as ExternalGradeType,
              issuedAt: dayjs(is.finalGrade.calculatedAt),
              finalGradeId: is.finalGrade.id,
              plantelId: is.finalGrade.plantelId ?? 0,
            });
          }
        });
      });
      setGradeRows(rows);
    } catch (err) {
      message.error('Error cargando notas externas del estudiante');
      setExternalInscriptions([]);
      setGradeRows([]);
    } finally {
      setLoadingInscriptions(false);
    }
  }, []);

  // Plantel search
  const searchPlantel = useCallback(async (query: string) => {
    setPlantelQuery(query);
    if (query.trim().length < 2) {
      setPlantelResults([]);
      return;
    }
    try {
      const res = await api.get('/planteles/search', { params: { q: query.trim() } });
      setPlantelResults(res.data || []);
    } catch {
      setPlantelResults([]);
    }
  }, []);

  const onSelectPlantel = useCallback((plantel: ExternalPlantel) => {
    setSelectedPlantel(plantel);
    setPlantelQuery(`${plantel.name} (${plantel.code})`);
  }, []);

  const handleCreatePlantel = useCallback(async () => {
    try {
      const values = await plantelForm.validateFields();
      const created = await resolvePlantel(values);
      setSelectedPlantel(created);
      setPlantelQuery(`${created.name} (${created.code})`);
      setNewPlantelModalOpen(false);
      plantelForm.resetFields();
      message.success('Plantel registrado');
    } catch (err: any) {
      if (err?.errorFields) return; // form validation
      message.error(err?.message || 'Error al registrar plantel');
    }
  }, [plantelForm]);

  // Add a grade row
  const addGradeRow = useCallback(() => {
    setGradeRows((prev) => [
      ...prev,
      {
        key: `new-${Date.now()}`,
        subjectId: 0,
        subjectName: '',
        finalScore: 0,
        status: 'aprobada',
        gradeType: 'transferencia',
        issuedAt: dayjs(),
        plantelId: selectedPlantel?.id ?? 0,
      },
    ]);
  }, [selectedPlantel]);

  const updateGradeRow = useCallback((key: string, patch: Partial<GradeRow>) => {
    setGradeRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }, []);

  const removeGradeRow = useCallback((key: string) => {
    setGradeRows((prev) => prev.filter((r) => r.key !== key));
  }, []);

  // Save a single grade row (creates inscription if needed)
  const saveGradeRow = useCallback(async (row: GradeRow) => {
    if (!selectedPersonId) { message.warning('Seleccione un estudiante'); return; }
    if (!selectedPlantel) { message.warning('Seleccione un plantel origen'); return; }
    if (!row.subjectId) { message.warning('Seleccione una materia'); return; }
    if (!row.plantelId) { message.warning('La fila no tiene plantel asignado'); return; }

    setSaving(true);
    try {
      // Find or create the external inscription for this period/plantel/grade.
      const periodLabel = inscriptionForm.getFieldValue('periodLabel') || `${dayjs().year()}-${dayjs().year() + 1}`;
      const periodName = inscriptionForm.getFieldValue('periodName') || `${periodLabel} - ${selectedPlantel.name}`;
      const gradeId = inscriptionForm.getFieldValue('gradeId');
      if (!gradeId) { message.warning('Seleccione el grado del estudiante en ese período'); return; }

      const inscription = await createExternalInscription({
        personId: selectedPersonId,
        periodLabel,
        periodName,
        gradeId,
        plantelId: selectedPlantel.id,
      });

      if (row.finalGradeId) {
        // Update existing
        await updateExternalGrade(row.finalGradeId, {
          finalScore: row.finalScore,
          status: row.status,
          plantelId: row.plantelId,
          issuedAt: row.issuedAt.toISOString(),
          gradeType: row.gradeType,
        });
        message.success('Nota externa actualizada');
      } else {
        // Create new
        await upsertExternalGrade({
          inscriptionId: inscription.id,
          subjectId: row.subjectId,
          finalScore: row.finalScore,
          status: row.status,
          plantelId: row.plantelId,
          issuedAt: row.issuedAt.toISOString(),
          gradeType: row.gradeType,
        });
        message.success('Nota externa registrada');
      }
      // Refresh
      onSelectStudent(selectedPersonId, { label: selectedPersonLabel });
      loadAllGrades();
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Error al guardar nota externa');
    } finally {
      setSaving(false);
    }
  }, [selectedPersonId, selectedPlantel, selectedPersonLabel, inscriptionForm, onSelectStudent, loadAllGrades]);

  const handleDeleteGrade = useCallback(async (id: number) => {
    setSaving(true);
    try {
      await deleteExternalGrade(id);
      message.success('Nota externa eliminada');
      if (selectedPersonId) {
        onSelectStudent(selectedPersonId, { label: selectedPersonLabel });
      }
      loadAllGrades();
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Error al eliminar nota externa');
    } finally {
      setSaving(false);
    }
  }, [selectedPersonId, selectedPersonLabel, onSelectStudent, loadAllGrades]);

  // Bulk state
  const [bulkEntries, setBulkEntries] = useState<BulkEntry[]>([]);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ created: number; skipped: number } | null>(null);
  const [bulkErrors, setBulkErrors] = useState<Array<{ row: number; message: string }> | null>(null);

  const downloadTemplate = useCallback(async () => {
    try {
      const response = await api.get('/external-grades/bulk/template', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'plantilla_notas_externas.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Error al descargar plantilla');
    }
  }, []);

  const handleBulkUpload = useCallback(async (file: File) => {
    setBulkProcessing(true);
    setBulkResult(null);
    setBulkErrors(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await api.post('/external-grades/bulk/process', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setBulkResult(response.data);
      message.success(`Carga masiva completada: ${response.data.created} notas registradas, ${response.data.skipped} omitidas`);
      loadAllGrades();
    } catch (err: any) {
      if (err?.response?.data?.errors) {
        setBulkErrors(err.response.data.errors);
        message.error(`Se encontraron ${err.response.data.totalErrors ?? err.response.data.errors.length} errores en el archivo`);
      } else {
        message.error(err?.response?.data?.message || 'Error al procesar archivo');
      }
    } finally {
      setBulkProcessing(false);
    }
    return false; // prevent antd default upload behavior
  }, [loadAllGrades]);

  const gradeColumns = [
    {
      title: 'Materia',
      dataIndex: 'subjectId',
      render: (_: any, row: GradeRow) => (
        <Select
          showSearch
          style={{ width: 220 }}
          placeholder="Seleccione materia"
          value={row.subjectId || undefined}
          optionFilterProp="label"
          options={subjects.map((s) => ({ value: s.id, label: s.name }))}
          onChange={(value) => {
            const subj = subjects.find((s) => s.id === value);
            updateGradeRow(row.key, { subjectId: value, subjectName: subj?.name ?? '' });
          }}
        />
      ),
    },
    {
      title: 'Nota',
      dataIndex: 'finalScore',
      width: 100,
      render: (_: any, row: GradeRow) => (
        <InputNumber
          min={0}
          max={20}
          step={0.1}
          value={row.finalScore}
          onChange={(v) => updateGradeRow(row.key, { finalScore: v ?? 0 })}
        />
      ),
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      width: 130,
      render: (_: any, row: GradeRow) => (
        <Select
          style={{ width: 120 }}
          value={row.status}
          onChange={(v: ExternalGradeStatus) => updateGradeRow(row.key, { status: v })}
          options={[
            { value: 'aprobada', label: 'Aprobada' },
            { value: 'reprobada', label: 'Reprobada' },
          ]}
        />
      ),
    },
    {
      title: 'Tipo',
      dataIndex: 'gradeType',
      width: 150,
      render: (_: any, row: GradeRow) => (
        <Select
          style={{ width: 140 }}
          value={row.gradeType}
          onChange={(v: ExternalGradeType) => updateGradeRow(row.key, { gradeType: v })}
          options={[
            { value: 'transferencia', label: 'Transferencia' },
            { value: 'equivalencia', label: 'Equivalencia' },
          ]}
        />
      ),
    },
    {
      title: 'Fecha documento',
      dataIndex: 'issuedAt',
      width: 180,
      render: (_: any, row: GradeRow) => (
        <DatePicker
          value={row.issuedAt}
          onChange={(d) => d && updateGradeRow(row.key, { issuedAt: d })}
        />
      ),
    },
    {
      title: 'Acciones',
      width: 150,
      render: (_: any, row: GradeRow) => (
        <Space>
          <Button
            type="primary"
            size="small"
            icon={<SaveOutlined />}
            loading={saving}
            onClick={() => saveGradeRow(row)}
          >
            Guardar
          </Button>
          {row.finalGradeId && (
            <Popconfirm title="¿Eliminar esta nota externa?" onConfirm={() => handleDeleteGrade(row.finalGradeId!)}>
              <Button danger size="small" icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
          {!row.finalGradeId && (
            <Button size="small" icon={<DeleteOutlined />} onClick={() => removeGradeRow(row.key)} />
          )}
        </Space>
      ),
    },
  ];

  const allGradesColumns = [
    {
      title: 'Estudiante',
      render: (_: any, record: ExternalGrade) => {
        const s = record.inscriptionSubject?.inscription?.student;
        return s ? `${s.lastName} ${s.firstName} (C.I. ${s.document})` : '—';
      },
    },
    {
      title: 'Materia',
      render: (_: any, record: ExternalGrade) => record.inscriptionSubject?.subject?.name ?? '—',
    },
    {
      title: 'Nota',
      dataIndex: 'finalScore',
      width: 80,
      render: (v: number | null) => (v != null ? Number(v).toFixed(1) : '—'),
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      width: 110,
      render: (s: string) => (
        <Tag color={s === 'aprobada' ? 'green' : 'red'}>{s === 'aprobada' ? 'Aprobada' : 'Reprobada'}</Tag>
      ),
    },
    {
      title: 'Tipo',
      dataIndex: 'gradeType',
      width: 120,
      render: (t: string) => (t === 'transferencia' ? 'Transferencia' : 'Equivalencia'),
    },
    {
      title: 'Institución origen',
      render: (_: any, record: ExternalGrade) =>
        record.plantel ? `${record.plantel.name} (${record.plantel.code})` : '—',
    },
    {
      title: 'Período',
      render: (_: any, record: ExternalGrade) => record.inscriptionSubject?.inscription?.period?.name ?? '—',
    },
    {
      title: 'Fecha documento',
      dataIndex: 'calculatedAt',
      width: 130,
      render: (d: string) => (d ? dayjs(d).format('DD/MM/YYYY') : '—'),
    },
    {
      title: 'Acciones',
      width: 100,
      render: (_: any, record: ExternalGrade) => (
        <Popconfirm title="¿Eliminar esta nota externa?" onConfirm={() => handleDeleteGrade(record.id)}>
          <Button danger size="small" icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <div className="p-6">
      <Title level={3}>
        <SwapOutlined /> Notas Externas
      </Title>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Registre notas de estudiantes provenientes de otras instituciones educativas."
        description="Cada nota se asocia al plantel emisor y a la fecha del documento original. Estas notas aparecen en las notas certificadas con su institución de origen."
      />

      <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
        {
          key: 'individual',
          label: 'Registro Individual',
          children: (
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <Card title="1. Estudiante" size="small">
                <AutoComplete
                  style={{ width: '100%' }}
                  options={studentResults}
                  value={studentQuery}
                  onSearch={searchStudent}
                  onSelect={(v, opt) => onSelectStudent(v as number, opt)}
                  placeholder="Buscar por cédula o nombre (mín. 3 caracteres)"
                  notFoundContent={null}
                />
                {selectedPersonId > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <Tag color="blue">Seleccionado: {selectedPersonLabel}</Tag>
                  </div>
                )}
              </Card>

              <Card title="2. Plantel origen" size="small">
                <Space style={{ width: '100%' }}>
                  <AutoComplete
                    style={{ width: 400 }}
                    options={plantelResults.map((p) => ({
                      value: p.id,
                      label: `${p.name} (${p.code}) — ${p.state}`,
                      plantel: p,
                    }))}
                    value={plantelQuery}
                    onSearch={searchPlantel}
                    onSelect={(_v, opt: any) => onSelectPlantel(opt.plantel)}
                    placeholder="Buscar plantel por código DEA o nombre"
                    notFoundContent={null}
                  />
                  <Button icon={<PlusOutlined />} onClick={() => setNewPlantelModalOpen(true)}>
                    Nuevo plantel
                  </Button>
                </Space>
                {selectedPlantel && (
                  <div style={{ marginTop: 8 }}>
                    <Tag color="purple">
                      <BankOutlined /> {selectedPlantel.name} — {selectedPlantel.state}
                    </Tag>
                  </div>
                )}
              </Card>

              <Card title="3. Período y grado externo" size="small">
                <Form form={inscriptionForm} layout="inline">
                  <Form.Item name="periodLabel" label="Período" rules={[{ required: true }]}>
                    <Input placeholder="2024-2025" style={{ width: 120 }} />
                  </Form.Item>
                  <Form.Item name="periodName" label="Nombre">
                    <Input placeholder="2024-2025 - Colegio X" style={{ width: 240 }} />
                  </Form.Item>
                  <Form.Item name="gradeId" label="Grado" rules={[{ required: true }]}>
                    <Select
                      style={{ width: 180 }}
                      placeholder="Seleccione grado"
                      options={grades.map((g) => ({ value: g.id, label: g.name }))}
                    />
                  </Form.Item>
                </Form>
              </Card>

              <Card
                title="4. Notas externas"
                size="small"
                extra={<Button icon={<PlusOutlined />} onClick={addGradeRow}>Agregar nota</Button>}
              >
                <Spin spinning={loadingInscriptions}>
                  <Table
                    dataSource={gradeRows}
                    columns={gradeColumns}
                    rowKey="key"
                    pagination={false}
                    size="small"
                    locale={{ emptyText: <Empty description="No hay notas registradas" /> }}
                  />
                </Spin>
              </Card>

              {externalInscriptions.length > 0 && (
                <Card title="Inscripciones externas existentes" size="small">
                  {externalInscriptions.map((ins) => (
                    <div key={ins.id} style={{ marginBottom: 8 }}>
                      <Tag color="cyan">
                        {ins.period?.name ?? '—'} — {ins.grade?.name ?? '—'}
                      </Tag>
                      <Text type="secondary">
                        {' '}{ins.inscriptionSubjects?.length ?? 0} materia(s)
                      </Text>
                    </div>
                  ))}
                </Card>
              )}
            </Space>
          ),
        },
        {
          key: 'list',
          label: 'Todas las notas externas',
          children: (
            <Card size="small">
              <Table
                dataSource={allGrades}
                columns={allGradesColumns}
                rowKey="id"
                loading={loadingAllGrades}
                pagination={{ pageSize: 20 }}
                size="small"
              />
            </Card>
          ),
        },
        {
          key: 'bulk',
          label: 'Carga masiva Excel',
          children: (
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <Card title="Carga masiva de notas externas" size="small">
                <Alert
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                  message="Descargue la plantilla Excel, complete las filas con las notas externas y súbala aquí."
                  description="El sistema validará cada fila y registrará las notas en una sola transacción. Las materias y grados deben coincidir con los nombres del catálogo."
                />
                <Space>
                  <Button icon={<DownloadOutlined />} onClick={downloadTemplate}>
                    Descargar plantilla
                  </Button>
                </Space>
              </Card>

              <Card title="Subir archivo" size="small">
                <Upload.Dragger
                  accept=".xlsx"
                  multiple={false}
                  showUploadList={false}
                  beforeUpload={handleBulkUpload}
                  disabled={bulkProcessing}
                >
                  {bulkProcessing ? (
                    <Spin tip="Procesando..." />
                  ) : (
                    <>
                      <p className="ant-upload-drag-icon">
                        <FileExcelOutlined style={{ fontSize: 48, color: '#52c41a' }} />
                      </p>
                      <p className="ant-upload-text">Haga clic o arrastre un archivo .xlsx aquí</p>
                      <p className="ant-upload-hint">Solo se aceptan archivos Excel (.xlsx) generados con la plantilla</p>
                    </>
                  )}
                </Upload.Dragger>
              </Card>

              {bulkResult && (
                <Card title="Resultado" size="small">
                  <Space>
                    <Tag color="green">Registradas: {bulkResult.created}</Tag>
                    <Tag color="orange">Omitidas: {bulkResult.skipped}</Tag>
                  </Space>
                </Card>
              )}

              {bulkErrors && bulkErrors.length > 0 && (
                <Card title={`Errores (${bulkErrors.length})`} size="small">
                  <Table
                    dataSource={bulkErrors}
                    columns={[
                      { title: 'Fila', dataIndex: 'row', key: 'row', width: 80 },
                      { title: 'Error', dataIndex: 'message', key: 'message' },
                    ]}
                    rowKey="row"
                    pagination={{ pageSize: 20 }}
                    size="small"
                  />
                </Card>
              )}
            </Space>
          ),
        },
      ]} />

      <Modal
        title="Registrar nuevo plantel"
        open={newPlantelModalOpen}
        onCancel={() => setNewPlantelModalOpen(false)}
        onOk={handleCreatePlantel}
        okText="Registrar"
        cancelText="Cancelar"
      >
        <Form form={plantelForm} layout="vertical">
          <Form.Item name="code" label="Código DEA">
            <Input placeholder="Ej. 090123" />
          </Form.Item>
          <Form.Item name="name" label="Nombre del plantel" rules={[{ required: true }]}>
            <Input placeholder="U.E. Colegio Example" />
          </Form.Item>
          <Form.Item name="state" label="Estado">
            <Input placeholder="Aragua" />
          </Form.Item>
          <Form.Item name="municipality" label="Municipio">
            <Input />
          </Form.Item>
          <Form.Item name="dependency" label="Dependencia">
            <Input placeholder="Pública / Privada" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ExternalGrades;
