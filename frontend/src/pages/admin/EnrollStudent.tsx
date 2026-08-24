import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, Button, Form, message, Select, Row, Col, Tabs, Alert, Upload, Modal, Progress, Table, Tag, Space, Divider } from 'antd';
import type { UploadFile, RcFile } from 'antd/es/upload/interface';
import type { ColumnsType } from 'antd/es/table';
import { UserAddOutlined, UploadOutlined, DownloadOutlined, InboxOutlined } from '@ant-design/icons';
import api from '@/services/api';
import EnrollmentQuestionFields from '@/components/EnrollmentQuestionFields';
import { getEnrollmentQuestionsForPerson } from '@/services/enrollmentQuestions';
import type { EnrollmentQuestionResponse } from '@/services/enrollmentQuestions';
import { downloadTemplate, previewBulk, processBulk } from '@/services/bulkEnrollment';
import type { PreviewRow, ProcessResponse } from '@/services/bulkEnrollment';
import BulkRetryModal from '@/components/BulkRetryModal';
import EnrollmentReportModal from '@/components/pdf/EnrollmentReportModal';
import NewStudentEnrollmentForm from './components/NewStudentEnrollmentForm';
import { saveAs } from 'file-saver';

const { Option } = Select;
const { TabPane } = Tabs;
const { Dragger } = Upload;

type VenezuelaMunicipality = {
  municipio: string;
  parroquias: string[];
};

type VenezuelaState = {
  estado: string;
  municipios: VenezuelaMunicipality[];
};

type OptionItem = { label: string; value: string | number };

type SchoolPeriodStatus = 'preinscripcion' | 'activo' | 'historico' | 'externo';

type SchoolPeriod = {
  id: number;
  period: string;
  name: string;
  startYear: number;
  endYear: number;
  status: SchoolPeriodStatus;
  /** Derived from `status` on the backend. Kept for backwards compatibility. */
  isActive: boolean;
};

type Grade = {
  id: number;
  name: string;
};

type Section = {
  id: number;
  name: string;
  PeriodGradeSection?: { id: number };
};

type Subject = {
  id: number;
  name: string;
  PeriodGradeSubject?: { id: number; order: number };
  subjectGroup?: { id: number; name: string };
};

type EnrollStructureItem = {
  id: number;
  gradeId: number;
  schoolPeriodId: number;
  specializationId?: number | null;
  grade?: Grade;
  sections?: Section[];
  subjects?: Subject[];
};

type UserSearchResult = {
  id: number;
  firstName: string;
  lastName: string;
  document: string;
  roles: { name: string }[];
};

type PreviewTableRow = PreviewRow & { key: number };
type ProcessTableRow = ProcessResponse['results'][number] & { key: number };

const ESCOLARIDAD_OPTIONS = [
  { label: 'Regular', value: 'regular' },
  { label: 'Repitiente', value: 'repitiente' },
  { label: 'Materia pendiente', value: 'materia_pendiente' }
];

type EnrollmentAnswerFormValues = Record<number, string | string[]>;

const transformAnswers = (raw?: EnrollmentAnswerFormValues) => {
  if (!raw) return [];
  return Object.entries(raw).map(([key, value]) => ({
    questionId: Number(key),
    answer: value
  }));
};

const EnrollStudent: React.FC = () => {
  // State
  const [activePeriod, setActivePeriod] = useState<SchoolPeriod | null>(null);
  const [allPeriods, setAllPeriods] = useState<SchoolPeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | null>(null);
  const [enrollStructure, setEnrollStructure] = useState<EnrollStructureItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [venezuelaLocations, setVenezuelaLocations] = useState<VenezuelaState[]>([]);
  const [existingEnrollmentQuestions, setExistingEnrollmentQuestions] = useState<EnrollmentQuestionResponse[]>([]);
  const [existingQuestionsLoading, setExistingQuestionsLoading] = useState(false);

  // Bulk enrollment state
  const [bulkPreviewRows, setBulkPreviewRows] = useState<PreviewRow[]>([]);
  const [bulkStats, setBulkStats] = useState({ total: 0, valid: 0, invalid: 0 });
  const [bulkTemplateLoading, setBulkTemplateLoading] = useState(false);
  const [bulkPreviewLoading, setBulkPreviewLoading] = useState(false);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkResults, setBulkResults] = useState<ProcessResponse | null>(null);
  const [bulkFileList, setBulkFileList] = useState<UploadFile[]>([]);
  const [retryModalOpen, setRetryModalOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportUuid, setReportUuid] = useState<string | null>(null);
  const [retryRowNumber, setRetryRowNumber] = useState(0);
  const [retryPayload, setRetryPayload] = useState<Record<string, unknown> | null>(null);
  const [retryErrors, setRetryErrors] = useState<string[]>([]);
  const [retryProcessMessage, setRetryProcessMessage] = useState<string | undefined>(undefined);

  // For section selector (controlled)
  const [selectedGradeIdExisting, setSelectedGradeIdExisting] = useState<number | null>(null);

  // Existing Student State
  const [studentOptions, setStudentOptions] = useState<OptionItem[]>([]);
  const [searchingStudents, setSearchingStudents] = useState(false);
  const searchTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Forms
  const [existingStudentForm] = Form.useForm();
  const hasValidBulkRows = useMemo(
    () => bulkPreviewRows.some((row) => row.payload && row.errors.length === 0),
    [bulkPreviewRows]
  );

  const previewTableData = useMemo<PreviewTableRow[]>(
    () =>
      bulkPreviewRows.map((row, index) => ({
        ...row,
        key: row.rowNumber ?? index + 2
      })),
    [bulkPreviewRows]
  );

  const resultTableData = useMemo<ProcessTableRow[]>(
    () =>
      bulkResults
        ? bulkResults.results.map((result, index) => ({
            ...result,
            key: result.rowNumber ?? index
          }))
        : [],
    [bulkResults]
  );

  const openRetryModal = useCallback((rn: number, errs: string[], processMsg?: string) => {
    const previewRow = bulkPreviewRows.find((r) => r.rowNumber === rn);
    setRetryRowNumber(rn);
    setRetryPayload(previewRow?.payload ? { ...previewRow.payload } : null);
    setRetryErrors(errs);
    setRetryProcessMessage(processMsg);
    setRetryModalOpen(true);
  }, [bulkPreviewRows]);

  const bulkPreviewColumns = useMemo<ColumnsType<PreviewTableRow>>(
    () => [
      {
        title: 'Fila',
        dataIndex: 'rowNumber',
        width: 80
      },
      {
        title: 'Estado',
        dataIndex: 'errors',
        width: 120,
        render: (errors: string[], record: PreviewTableRow) =>
          errors && errors.length > 0 ? (
            <Tag
              color="error"
              style={{ cursor: record.payload ? 'pointer' : 'default' }}
              onClick={() => record.payload && openRetryModal(record.rowNumber, errors)}
            >
              Errores {record.payload ? '(editar)' : ''}
            </Tag>
          ) : (
            <Tag color="success">Válido</Tag>
          )
      },
      {
        title: 'Comentarios',
        dataIndex: 'errors',
        render: (errors: string[], record: PreviewTableRow) =>
          errors && errors.length > 0 ? (
            <Space direction="vertical" size="small" style={record.payload ? { cursor: 'pointer' } : undefined}
              onClick={() => record.payload && openRetryModal(record.rowNumber, errors)}>
              {errors.map((err, idx) => (
                <Tag color="warning" key={idx} style={{ whiteSpace: 'normal' }}>
                  {err}
                </Tag>
              ))}
            </Space>
          ) : (
            <span>Sin observaciones</span>
          )
      }
    ],
    [openRetryModal]
  );

  const bulkResultColumns = useMemo<ColumnsType<ProcessTableRow>>(
    () => [
      {
        title: 'Fila',
        dataIndex: 'rowNumber',
        width: 80
      },
      {
        title: 'Resultado',
        dataIndex: 'success',
        width: 120,
        render: (success: boolean, record: ProcessTableRow) =>
          success ? (
            <Tag color="success">Registrado</Tag>
          ) : (
            <Tag
              color="error"
              style={{ cursor: 'pointer' }}
              onClick={() => openRetryModal(record.rowNumber, [], record.message)}
            >
              Error (editar)
            </Tag>
          )
      },
      {
        title: 'Mensaje',
        dataIndex: 'message',
        render: (msg: string, record: ProcessTableRow) =>
          record.success ? (
            <span>{msg}</span>
          ) : (
            <a onClick={() => openRetryModal(record.rowNumber, [], msg)} style={{ color: '#cf1322' }}>
              {msg}
            </a>
          )
      }
    ],
    [openRetryModal]
  );

  const handleBulkTemplateDownload = async () => {
    setBulkTemplateLoading(true);
    try {
      const buffer = await downloadTemplate();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      saveAs(blob, 'plantilla_inscripciones.xlsx');
      message.success('Plantilla descargada');
    } catch (error) {
      console.error('Error descargando plantilla:', error);
      message.error('No se pudo descargar la plantilla');
    } finally {
      setBulkTemplateLoading(false);
    }
  };

  const resetBulkState = () => {
    setBulkPreviewRows([]);
    setBulkStats({ total: 0, valid: 0, invalid: 0 });
    setBulkResults(null);
    setBulkFileList([]);
  };

  const handleBulkPreviewUpload = async (file: RcFile) => {
    setBulkPreviewLoading(true);
    setBulkResults(null);
    try {
      const preview = await previewBulk(file);
      setBulkPreviewRows(preview.rows);
      setBulkStats({ total: preview.total, valid: preview.valid, invalid: preview.invalid });
      setBulkFileList([
        {
          uid: file.uid,
          name: file.name,
          status: 'done',
          originFileObj: file
        } as UploadFile
      ]);
      message.success('Archivo leído correctamente');
    } catch (error: any) {
      console.error('Error previsualizando archivo:', error);
      message.error(error?.response?.data?.error || 'No se pudo leer el archivo');
      resetBulkState();
    } finally {
      setBulkPreviewLoading(false);
    }
    return false;
  };

  const handleBulkProcess = async () => {
    if (!hasValidBulkRows) {
      message.warning('No hay filas válidas para procesar');
      return;
    }
    setBulkProcessing(true);
    try {
      const response = await processBulk(bulkPreviewRows);
      setBulkResults(response);
      message.success('Carga masiva procesada');
    } catch (error: any) {
      console.error('Error procesando carga masiva:', error);
      message.error(error?.response?.data?.error || 'No se pudo procesar la carga');
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleRetrySuccess = (rowNumber: number) => {
    if (bulkResults) {
      setBulkResults({
        ...bulkResults,
        results: bulkResults.results.map((r) =>
          r.rowNumber === rowNumber ? { ...r, success: true, message: 'Inscripción registrada (corregido)' } : r
        )
      });
    }
    setBulkPreviewRows((prev) =>
      prev.map((r) => (r.rowNumber === rowNumber ? { ...r, errors: [] } : r))
    );
  };

  const bulkUploadProps = {
    name: 'file',
    multiple: false,
    fileList: bulkFileList,
    beforeUpload: handleBulkPreviewUpload,
    onRemove: () => {
      resetBulkState();
    },
    accept: '.xlsx',
    disabled: bulkPreviewLoading || bulkProcessing
  };

  const handlePeriodChange = async (periodId: number) => {
    setSelectedPeriodId(periodId);
    setSelectedGradeIdExisting(null);
    existingStudentForm.setFieldsValue({ gradeId: undefined, sectionId: undefined });
    try {
      const structureRes = await api.get(`/academic/structure/${periodId}`);
      setEnrollStructure(structureRes.data);
    } catch {
      message.error('Error al cargar estructura del período');
    }
  };

  // Load Active Period and its structure on mount
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        // 1. Get periods and find active
        const periodsRes = await api.get('/academic/periods');
        setAllPeriods(periodsRes.data);
        const active = periodsRes.data.find((p: SchoolPeriod) => p.status === 'activo');

        if (!active) {
          message.warning('No hay periodo escolar activo configurado');
          setLoading(false);
          return;
        }

        setActivePeriod(active);
        setSelectedPeriodId(active.id);

        // 2. Load structure for active period
        const structureRes = await api.get(`/academic/structure/${active.id}`);
        setEnrollStructure(structureRes.data);

        // 3. Load venezuela locations
        const locationsRes = await api.get('/locations/venezuela');
        setVenezuelaLocations(locationsRes.data);

      } catch (error) {
        console.log(error);
        message.error('Error cargando datos del periodo activo');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  // Refresh the periods list (used by the Preinscripción tab after creating
  // the preinscription period on demand).
  const refreshPeriods = useCallback(async () => {
    try {
      const periodsRes = await api.get('/academic/periods');
      setAllPeriods(periodsRes.data);
    } catch (error) {
      console.error('Error refrescando períodos:', error);
    }
  }, []);

  const loadExistingQuestions = async (personId: number) => {
    setExistingQuestionsLoading(true);
    try {
      const questions = await getEnrollmentQuestionsForPerson(personId);
      setExistingEnrollmentQuestions(questions);
      const answers: EnrollmentAnswerFormValues = {};
      questions.forEach((question) => {
        if (question.answer !== null && question.answer !== undefined) {
          answers[question.id] = question.answer as string | string[];
        }
      });
      existingStudentForm.setFieldsValue({ enrollmentAnswers: answers });
    } catch (error) {
      console.error('Error cargando preguntas adicionales:', error);
      message.error('No se pudieron cargar las preguntas del formulario');
      setExistingEnrollmentQuestions([]);
    } finally {
      setExistingQuestionsLoading(false);
    }
  };

  // Get sections for selected grade
  const getSectionsForGrade = (gradeId: number | null) => {
    if (!gradeId) return [];
    const item = enrollStructure.find(s => s.gradeId === gradeId);
    return item?.sections || [];
  };

  // --- Handlers ---

  const handleSearchStudents = (value: string) => {
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!value || value.length < 2) {
      setStudentOptions([]);
      return;
    }

    // Debounce: wait 300ms before searching
    searchTimeoutRef.current = setTimeout(async () => {
      setSearchingStudents(true);
      try {
        const res = await api.get(`/users?q=${encodeURIComponent(value)}`);
        const students = res.data.filter((p: UserSearchResult) =>
          p.roles?.some((r) => ['student', 'estudiante', 'alumno'].includes(r.name.toLowerCase()))
        );
        setStudentOptions(students.map((p: UserSearchResult) => ({
          label: `${p.firstName} ${p.lastName} (${p.document})`,
          value: p.id
        })));
      } catch (error) {
        console.error('Error buscando estudiantes:', error);
      } finally {
        setSearchingStudents(false);
      }
    }, 300);
  };

  // Submit: Existing Student
  const handleExistingStudentSubmit = async (values: Record<string, unknown>) => {
    if (!selectedPeriodId) {
      message.error('No hay periodo activo');
      return;
    }

    try {
      const response = await api.post('/inscriptions', {
        ...values,
        schoolPeriodId: selectedPeriodId,
        enrollmentAnswers: transformAnswers(values.enrollmentAnswers as EnrollmentAnswerFormValues | undefined),
      });
      const reportUuid = response.data?.reportUuid as string | undefined;

      message.success('Solicitud de inscripción registrada exitosamente');
      existingStudentForm.resetFields();
      setSelectedGradeIdExisting(null);

      if (reportUuid) {
        Modal.confirm({
          title: 'Inscripción exitosa',
          content: '¿Desea generar e imprimir la planilla de inscripción?',
          okText: 'Sí, ver planilla',
          cancelText: 'No, continuar',
          onOk: () => {
            setReportUuid(reportUuid);
            setReportModalOpen(true);
          },
        });
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      message.error(err.response?.data?.error || 'Error en inscripción');
    }
  };

  if (loading) {
    return <Card loading />;
  }

  if (!activePeriod) {
    return (
      <Card>
        <Alert
          type="warning"
          message="No hay periodo escolar activo"
          description="Para inscribir estudiantes, primero debe configurar un periodo escolar activo desde el módulo de Gestión Académica."
          showIcon
        />
      </Card>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', paddingBottom: 40 }}>
      <Card title="Inscripción de Estudiantes">
        <Tabs defaultActiveKey="new">

          {/* TAB 1: NEW STUDENT (uses extracted component) */}
          <TabPane tab="Nuevo Ingreso (Registrar e Inscribir)" key="new">
            <NewStudentEnrollmentForm
              mode="inscripcion"
              allPeriods={allPeriods}
              venezuelaLocations={venezuelaLocations}
              onPeriodsChanged={refreshPeriods}
            />
          </TabPane>

          {/* TAB PREINSCRIPCION: same component, always targets preinscription period */}
          <TabPane tab="Preinscripción" key="preinscripcion">
            <NewStudentEnrollmentForm
              mode="preinscripcion"
              allPeriods={allPeriods}
              venezuelaLocations={venezuelaLocations}
              onPeriodsChanged={refreshPeriods}
            />
          </TabPane>

          
          <TabPane tab="Inscripción masiva" key="bulk">
            <Card type="inner" title="Carga de plantilla" style={{ marginBottom: 24 }}>
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <Space wrap>
                  <Button icon={<DownloadOutlined />} loading={bulkTemplateLoading} onClick={handleBulkTemplateDownload}>
                    Descargar plantilla
                  </Button>
                  <Button
                    type="primary"
                    icon={<UploadOutlined />}
                    disabled={!hasValidBulkRows || bulkProcessing}
                    loading={bulkProcessing}
                    onClick={handleBulkProcess}
                  >
                    Procesar estudiantes
                  </Button>
                </Space>
                <Dragger {...bulkUploadProps} disabled={bulkPreviewLoading || bulkProcessing} maxCount={1}>
                  <p className="ant-upload-drag-icon">
                    <InboxOutlined />
                  </p>
                  <p className="ant-upload-text">Haz clic o arrastra un archivo Excel (.xlsx)</p>
                  <p className="ant-upload-hint">Lee el archivo para validar los datos antes de inscribir</p>
                </Dragger>
                <div>
                  <Space size="large">
                    <span>Total filas: <strong>{bulkStats.total}</strong></span>
                    <span>Válidas: <strong style={{ color: '#52c41a' }}>{bulkStats.valid}</strong></span>
                    <span>Inválidas: <strong style={{ color: '#f5222d' }}>{bulkStats.invalid}</strong></span>
                  </Space>
                  {bulkProcessing && (
                    <Progress
                      percent={bulkResults ? Math.round((bulkResults.processed / bulkResults.total) * 100) : undefined}
                      status="active"
                      style={{ marginTop: 8 }}
                    />
                  )}
                </div>
              </Space>
            </Card>

            {bulkPreviewRows.length > 0 && (
              <Card type="inner" title="Previsualización" style={{ marginBottom: 24 }}>
                <Table
                  dataSource={previewTableData}
                  columns={bulkPreviewColumns}
                  loading={bulkPreviewLoading}
                  pagination={{ pageSize: 8 }}
                  size="small"
                  rowClassName={(record) => (record.errors.length ? 'row-error' : 'row-valid')}
                />
              </Card>
            )}

            {bulkResults && (
              <Card type="inner" title="Resultado de la carga">
                <Table
                  dataSource={resultTableData}
                  columns={bulkResultColumns}
                  size="small"
                  pagination={false}
                />
                <Divider />
                <Space>
                  <Tag color="success">Éxitos: {bulkResults.results.filter((r) => r.success).length}</Tag>
                  <Tag color="error">Errores: {bulkResults.results.filter((r) => !r.success).length}</Tag>
                </Space>
              </Card>
            )}
          </TabPane>

          {/* TAB 2: EXISTING STUDENT */}
          <TabPane tab="Estudiante Regular (Ya Registrado)" key="existing">
            <Form
              form={existingStudentForm}
              layout="vertical"
              onFinish={handleExistingStudentSubmit}
              style={{ maxWidth: 600, margin: '20px auto' }}
              initialValues={{ escolaridad: 'regular' }}
            >
              <div style={{ marginBottom: 24, padding: 20, background: '#eaf3ff', border: '2px solid #91caff', borderRadius: 10, boxShadow: '0 2px 8px rgba(24, 144, 255, 0.12)' }}>
                <Form.Item label={<span style={{ fontSize: 16, fontWeight: 700, color: '#0958d9' }}>Período Escolar</span>} style={{ marginBottom: 0 }}>
                  <Select
                    size="large"
                    style={{ fontSize: 17, fontWeight: 600 }}
                    value={selectedPeriodId}
                    onChange={(val) => handlePeriodChange(val)}
                    placeholder="Seleccione período"
                  >
                    {allPeriods.map(p => (
                      <Option key={p.id} value={p.id}>
                        <span style={{ fontWeight: 600 }}>{p.name}</span>
                        <span style={{ color: 'var(--color-text-muted)', fontSize: 11, marginLeft: 8 }}>{p.period}</span>
                        {p.status === 'activo' && <Tag color="green" style={{ marginLeft: 8, fontSize: 10 }}>Activo</Tag>}
                        {p.status === 'preinscripcion' && <Tag color="blue" style={{ marginLeft: 8, fontSize: 10 }}>Preinscripción</Tag>}
                        {p.status === 'historico' && <Tag color="default" style={{ marginLeft: 8, fontSize: 10 }}>Cerrado</Tag>}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </div>

              <Form.Item
                name="personId"
                label="Estudiante (escriba al menos 2 caracteres para buscar)"
                rules={[{ required: true, message: 'Busque y seleccione un estudiante' }]}
              >
                <Select
                  showSearch
                  placeholder="Escriba nombre o cédula..."
                  filterOption={false}
                  onSearch={handleSearchStudents}
                  onChange={(personId: number) => {
                    existingStudentForm.setFieldsValue({ personId });
                    loadExistingQuestions(personId);
                  }}
                  loading={searchingStudents}
                  options={studentOptions}
                  notFoundContent={
                    searchingStudents
                      ? <div style={{ padding: 8 }}>Buscando...</div>
                      : studentOptions.length === 0
                        ? <div style={{ padding: 8, color: '#999' }}>Escriba para buscar estudiantes</div>
                        : null
                  }
                />
              </Form.Item>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="gradeId"
                    label="Grado"
                    rules={[{ required: true, message: 'Seleccione un grado' }]}
                  >
                    <Select
                      placeholder="Seleccione Grado"
                      onChange={(val) => {
                        setSelectedGradeIdExisting(val);
                        existingStudentForm.setFieldsValue({ sectionId: undefined });
                      }}
                    >
                      {enrollStructure.map(s => (
                        <Option key={s.gradeId} value={s.gradeId}>{s.grade?.name}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="sectionId"
                    label="Sección (Opcional)"
                  >
                    <Select
                      placeholder="Seleccione Sección"
                      disabled={!selectedGradeIdExisting}
                      allowClear
                    >
                      {getSectionsForGrade(selectedGradeIdExisting).map((sec: Section) => (
                        <Option key={sec.id} value={sec.id}>{sec.name}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="escolaridad"
                    label="Escolaridad"
                    rules={[{ required: true, message: 'Seleccione la escolaridad del estudiante' }]}
                  >
                    <Select placeholder="Seleccione" options={ESCOLARIDAD_OPTIONS} />
                  </Form.Item>
                </Col>
              </Row>


              <Form.Item>
                <Button type="primary" htmlType="submit" block icon={<UserAddOutlined />}>
                  Inscribir Estudiante
                </Button>
              </Form.Item>

              {existingEnrollmentQuestions.length > 0 && (
                <div style={{ marginTop: 24 }}>
                  <h4 style={{ color: '#666', borderBottom: '1px solid #eee', paddingBottom: 8 }}>
                    Preguntas adicionales del plantel
                  </h4>
                  {existingQuestionsLoading ? (
                    <Card loading />
                  ) : (
                    <EnrollmentQuestionFields
                      questions={existingEnrollmentQuestions}
                      parentName="enrollmentAnswers"
                    />
                  )}
                </div>
              )}
            </Form>
          </TabPane>
        </Tabs>
      </Card>

      <BulkRetryModal
        open={retryModalOpen}
        onClose={() => setRetryModalOpen(false)}
        onSuccess={handleRetrySuccess}
        rowNumber={retryRowNumber}
        payload={retryPayload}
        errors={retryErrors}
        processMessage={retryProcessMessage}
        enrollStructure={enrollStructure}
        venezuelaLocations={venezuelaLocations}
        activePeriod={activePeriod}
      />
      <EnrollmentReportModal
        open={reportModalOpen}
        uuid={reportUuid}
        onClose={() => { setReportModalOpen(false); setReportUuid(null); }}
      />
    </div >
  );
};

export default EnrollStudent;
