import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card, Button, Table, Space, Typography, Row, Col, Tag, Empty,
  message, Alert, Steps, Modal, Descriptions, Statistic, Divider, Badge, Tooltip, Input,
} from 'antd';
import {
  FlagOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  EyeOutlined,
  ReloadOutlined,
  UserOutlined,
  SafetyOutlined,
  RocketOutlined,
  FileTextOutlined,
  LockOutlined,
  CheckOutlined,
  ExclamationCircleOutlined,
  SearchOutlined,
  FileExcelOutlined,
} from '@ant-design/icons';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { useSchool } from '@/context/SchoolContext';
import {
  getClosureStatus,
  validatePeriodClosure,
  getPreviewOutcomes,
  executePeriodClosure,
  type ClosureStatusResponse,
  type ClosureValidationResult,
  type OutcomeRecord,
  type ClosureExecutionResult,
} from '@/services/periodClosure';

const { Title, Text } = Typography;

const CLOSURE_STEPS = [
  { title: 'Validar', description: 'Verificar requisitos previos', icon: <SafetyOutlined /> },
  { title: 'Validado', description: 'Requisitos verificados', icon: <CheckCircleOutlined /> },
  { title: 'Previsualizar', description: 'Ver resultados antes de ejecutar', icon: <EyeOutlined /> },
  { title: 'Ejecutar', description: 'Procesar el cierre', icon: <RocketOutlined /> },
  { title: 'Completado', description: 'Período cerrado', icon: <FlagOutlined /> },
];

const STATUS_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  aprobado: { label: 'Aprobado', color: 'green', icon: <CheckCircleOutlined /> },
  materias_pendientes: { label: 'Con Materias Pendientes', color: 'orange', icon: <WarningOutlined /> },
  reprobado: { label: 'Reprobado', color: 'red', icon: <CloseCircleOutlined /> },
};

const CLOSURE_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  not_started: { label: 'No iniciado', color: 'default' },
  draft: { label: 'Borrador', color: 'blue' },
  validating: { label: 'Validando', color: 'processing' },
  closed: { label: 'Cerrado', color: 'green' },
  failed: { label: 'Fallido', color: 'red' },
};

const PeriodClosureManagement: React.FC = () => {
  const { activePeriod } = useSchool();
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [closureStatus, setClosureStatus] = useState<ClosureStatusResponse | null>(null);
  const [validation, setValidation] = useState<ClosureValidationResult | null>(null);
  const [preview, setPreview] = useState<OutcomeRecord[] | null>(null);
  const [executionResult, setExecutionResult] = useState<ClosureExecutionResult | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [previewSearch, setPreviewSearch] = useState('');

  const periodId = activePeriod?.id;

  const fetchStatus = useCallback(async () => {
    if (!periodId) return;
    try {
      setLoading(true);
      const status = await getClosureStatus(periodId);
      setClosureStatus(status);

      // Determine current step based on status
      if (status.closure?.status === 'closed') {
        setCurrentStep(4); // done
      } else if (status.closure?.status === 'failed') {
        setCurrentStep(3); // execution failed
      } else {
        setCurrentStep(0); // ready to start
      }
    } catch (error: any) {
      console.error('Error fetching closure status:', error);
      message.error('Error al cargar el estado del cierre');
    } finally {
      setLoading(false);
    }
  }, [periodId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleValidate = async () => {
    if (!periodId) return;
    try {
      setLoading(true);
      const result = await validatePeriodClosure(periodId);
      setValidation(result);
      if (result.valid) {
        setCurrentStep(1);
        message.success('Validación completada: el período está listo para cerrarse');
      } else {
        message.warning('La validación encontró errores que deben resolverse');
      }
    } catch (error: any) {
      console.error('Error validating closure:', error);
      message.error(error.response?.data?.message || 'Error al validar el cierre');
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = async () => {
    if (!periodId) return;
    try {
      setLoading(true);
      const data = await getPreviewOutcomes(periodId);
      setPreview(data);
      setPreviewSearch('');
      setPreviewVisible(true);
      setCurrentStep(2);
    } catch (error: any) {
      console.error('Error fetching preview:', error);
      message.error('Error al generar la previsualización');
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async () => {
    if (!periodId) return;
    try {
      setExecuting(true);
      setCurrentStep(3);
      const result = await executePeriodClosure(periodId);
      setExecutionResult(result);
      if (result.success) {
        setCurrentStep(4);
        if ((result.stats.skipped ?? 0) > 0) {
          message.warning(`Cierre ejecutado, pero ${result.stats.skipped} estudiante(s) no pudieron inscribirse en el período siguiente`);
        } else {
          message.success('Cierre de período ejecutado exitosamente');
        }
        await fetchStatus();
      } else {
        message.error('El cierre se ejecutó pero con errores');
      }
    } catch (error: any) {
      console.error('Error executing closure:', error);
      message.error(error.response?.data?.message || 'Error al ejecutar el cierre');
      setCurrentStep(2);
    } finally {
      setExecuting(false);
      setConfirmVisible(false);
    }
  };

  const isClosed = closureStatus?.closure?.status === 'closed';
  const canValidate = !isClosed && !closureStatus?.closure;
  const canPreview = validation?.valid === true;
  const canExecute = preview !== null && validation?.valid === true && !isClosed;

  // Frontend-only filter for the preview modal (name, last name, document)
  const filteredPreview = useMemo(() => {
    if (!preview) return null;
    const q = previewSearch.trim().toLowerCase();
    if (!q) return preview;
    return preview.filter((record) => {
      const s = record.inscription?.student;
      if (!s) return false;
      const haystack = `${s.firstName ?? ''} ${s.lastName ?? ''} ${s.document ?? ''}`;
      return haystack.toLowerCase().includes(q);
    });
  }, [preview, previewSearch]);

  const handleExportPreviewExcel = useCallback(async () => {
    if (!preview || preview.length === 0) {
      message.warning('No hay datos para exportar');
      return;
    }
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'BatallaProject';
      workbook.created = new Date();

      const sheet = workbook.addWorksheet('Previsualización Cierre', {
        views: [{ state: 'frozen', ySplit: 1 }],
      });

      sheet.columns = [
        { header: 'Estudiante', key: 'student', width: 32 },
        { header: 'Cédula', key: 'document', width: 16 },
        { header: 'Grado Actual', key: 'grade', width: 18 },
        { header: 'Sección', key: 'section', width: 10 },
        { header: 'Promedio', key: 'average', width: 10 },
        { header: 'Materias Reprobadas', key: 'failed', width: 18 },
        { header: 'Detalle Reprobadas', key: 'failedNames', width: 40 },
        { header: 'Estado', key: 'status', width: 22 },
        { header: 'Grado Destino', key: 'promotion', width: 18 },
        { header: 'Rezagado', key: 'rezagado', width: 10 },
      ];

      // Header style
      sheet.getRow(1).font = { bold: true };
      sheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1890FF' },
      };
      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

      const statusLabels: Record<string, string> = {
        aprobado: 'Aprobado',
        materias_pendientes: 'Con Materias Pendientes',
        reprobado: 'Reprobado',
      };

      preview.forEach((record) => {
        const student = record.inscription?.student;
        const row = sheet.addRow({
          student: student ? `${student.firstName ?? ''} ${student.lastName ?? ''}`.trim() : '—',
          document: student?.document ?? '—',
          grade: record.inscription?.grade?.name ?? '—',
          section: record.inscription?.section?.name ?? '—',
          average: record.finalAverage ?? '—',
          failed: record.failedSubjects ?? 0,
          failedNames: (record.failedSubjectNames ?? []).join(', '),
          status: statusLabels[record.status] ?? record.status,
          promotion: record.promotionGrade?.name ?? 'Egresado',
          rezagado: (record as any).isRezagado ? 'Sí' : 'No',
        });

        // Color the status cell
        const statusCell = row.getCell('status');
        if (record.status === 'aprobado') {
          statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD4EDDA' } };
        } else if (record.status === 'materias_pendientes') {
          statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3CD' } };
        } else if (record.status === 'reprobado') {
          statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8D7DA' } };
        }
      });

      // Auto-filter on all columns
      sheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: sheet.rowCount, column: sheet.columnCount },
      };

      const buffer = await workbook.xlsx.writeBuffer();
      const periodName = activePeriod?.name?.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_-]+/g, '_') || 'periodo';
      saveAs(new Blob([buffer]), `previsualizacion_cierre_${periodName}.xlsx`);
      message.success('Previsualización exportada a Excel');
    } catch (error) {
      console.error('[ExportPreviewExcel] Error:', error);
      message.error('Error al exportar a Excel');
    }
  }, [preview, activePeriod]);

  const previewColumns = [
    {
      title: 'Estudiante',
      key: 'student',
      render: (_: any, record: OutcomeRecord) => (
        <Space>
          <UserOutlined />
          <span>
            {record.inscription?.student?.firstName} {record.inscription?.student?.lastName}
          </span>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.inscription?.student?.document}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Grado Actual',
      key: 'grade',
      render: (_: any, record: OutcomeRecord) => (
        <Tag color="blue">{record.inscription?.grade?.name || '—'}</Tag>
      ),
    },
    {
      title: 'Sección',
      key: 'section',
      render: (_: any, record: OutcomeRecord) => (
        <span>{record.inscription?.section?.name || '—'}</span>
      ),
    },
    {
      title: 'Promedio',
      key: 'average',
      render: (_: any, record: OutcomeRecord) => (
        <Text strong>{record.finalAverage ?? '—'}</Text>
      ),
      width: 100,
      align: 'center' as const,
    },
    {
      title: 'Materias Reprobadas',
      key: 'failed',
      render: (_: any, record: OutcomeRecord) => {
        const names = record.failedSubjectNames ?? [];
        return (
          <Tooltip
            title={
              record.failedSubjects > 0 ? (
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {names.map((name, i) => (
                    <li key={i}>{name}</li>
                  ))}
                </ul>
              ) : 'Sin materias reprobadas'
            }
          >
            <span style={{ cursor: record.failedSubjects > 0 ? 'help' : 'default' }}>
              <Badge
                count={record.failedSubjects}
                color={record.failedSubjects > 0 ? 'red' : 'green'}
                showZero
              />
            </span>
          </Tooltip>
        );
      },
      width: 120,
      align: 'center' as const,
    },
    {
      title: 'Estado',
      key: 'status',
      render: (_: any, record: OutcomeRecord) => {
        const s = STATUS_LABELS[record.status];
        return s ? <Tag color={s.color} icon={s.icon}>{s.label}</Tag> : record.status;
      },
      width: 180,
    },
    {
      title: 'Grado Destino',
      key: 'promotion',
      render: (_: any, record: OutcomeRecord) => (
        <Tag color={record.promotionGrade ? 'blue' : 'default'}>
          {record.promotionGrade?.name || 'Egresado'}
        </Tag>
      ),
      width: 150,
    },
    {
      title: 'Rezagado',
      key: 'rezagado',
      render: (_: any, record: any) => (
        record.isRezagado ? <Tag color="purple">Rezagado</Tag> : <Text type="secondary">—</Text>
      ),
      width: 100,
    },
  ];

  return (
    <div className="ce-page ce-period-closure-page" style={{ padding: '24px' }}>
      {/* Header */}
      <Card style={{ marginBottom: 24 }}>
        <Row className="ce-page-header" align="middle" justify="space-between">
          <Col>
            <Space size="large">
              <FlagOutlined style={{ fontSize: 32, color: '#1890ff' }} />
              <div>
                <Title level={3} style={{ margin: 0 }}>
                  Cierre de Período Escolar
                </Title>
                <Text type="secondary">
                  {activePeriod ? `Período: ${activePeriod.period} — ${activePeriod.name}` : 'Cargando período...'}
                </Text>
              </div>
            </Space>
          </Col>
          <Col>
            {closureStatus?.closure && (
              <Tag
                color={CLOSURE_STATUS_LABELS[closureStatus.closure.status]?.color}
                style={{ fontSize: 14, padding: '4px 12px' }}
              >
                {CLOSURE_STATUS_LABELS[closureStatus.closure.status]?.label || closureStatus.closure.status}
              </Tag>
            )}
          </Col>
        </Row>
      </Card>

      {/* Status Cards */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Estudiantes Activos"
              value={preview?.length ?? '—'}
              prefix={<UserOutlined />}
              loading={loading && preview === null}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Lapsos Cerrados"
              value={`${closureStatus?.blockedTerms ?? '—'}/${closureStatus?.totalTerms ?? '—'}`}
              prefix={<LockOutlined />}
              loading={loading}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Consejos Completados"
              value={`${closureStatus?.checklist?.done ?? '—'}/${closureStatus?.checklist?.total ?? '—'}`}
              prefix={<CheckOutlined />}
              loading={loading}
            />
          </Card>
        </Col>
      </Row>

      {/* Process Steps */}
      <Card style={{ marginBottom: 24 }}>
        <Steps current={currentStep} style={{ marginBottom: 24 }} items={CLOSURE_STEPS} />

        <Divider />

        {/* Actions */}
        <Space size="middle" wrap>
          <Button
            type="primary"
            icon={<SafetyOutlined />}
            onClick={handleValidate}
            loading={loading}
            disabled={!canValidate}
          >
            Validar Requisitos
          </Button>
          <Button
            icon={<EyeOutlined />}
            onClick={handlePreview}
            loading={loading}
            disabled={!canPreview}
          >
            Previsualizar Resultados
          </Button>
          <Button
            type="primary"
            danger
            icon={<RocketOutlined />}
            onClick={() => setConfirmVisible(true)}
            disabled={!canExecute}
            loading={executing}
          >
            Ejecutar Cierre
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchStatus}
            loading={loading}
          >
            Actualizar Estado
          </Button>
        </Space>
      </Card>

      {/* Validation Results */}
      {validation && (
        <Card
          title={
            <Space>
              <FileTextOutlined />
              <span>Resultado de la Validación</span>
            </Space>
          }
          style={{ marginBottom: 24 }}
        >
          {validation.errors.length > 0 && (
            <Alert
              message="Errores encontrados"
              description={
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {validation.errors.map((e, i) => (
                    <li key={i}><Text type="danger">{e}</Text></li>
                  ))}
                </ul>
              }
              type="error"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}
          {validation.warnings.length > 0 && (
            <Alert
              message="Advertencias"
              description={
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {validation.warnings.map((w, i) => (
                    <li key={i}><Text type="warning">{w}</Text></li>
                  ))}
                </ul>
              }
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}
          {validation.valid && validation.errors.length === 0 && validation.warnings.length === 0 && (
            <Alert
              message="Todo listo"
              description="El período cumple con todos los requisitos para ser cerrado."
              type="success"
              showIcon
            />
          )}
        </Card>
      )}

      {/* Execution Result */}
      {executionResult && (
        <Card
          title={
            <Space>
              <FlagOutlined />
              <span>Resultado del Cierre</span>
            </Space>
          }
          style={{ marginBottom: 24 }}
        >
          <Descriptions bordered column={3}>
            <Descriptions.Item label="Estado">
              <Tag color={executionResult.success ? 'green' : 'red'}>
                {executionResult.success ? 'Exitoso' : 'Con errores'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Estudiantes procesados">
              {executionResult.stats.totalStudents}
            </Descriptions.Item>
            <Descriptions.Item label="Nuevas inscripciones">
              {executionResult.stats.newInscriptions}
            </Descriptions.Item>
            <Descriptions.Item label="Aprobados">
              <Text type="success">{executionResult.stats.approved}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Con materias pendientes">
              <Text type="warning">{executionResult.stats.withPendingSubjects}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Reprobados">
              <Text type="danger">{executionResult.stats.failed}</Text>
            </Descriptions.Item>
            {(executionResult.stats.skipped ?? 0) > 0 && (
              <Descriptions.Item label="Omitidos">
                <Text type="danger">{executionResult.stats.skipped}</Text>
              </Descriptions.Item>
            )}
          </Descriptions>

          {(executionResult.stats.skipped ?? 0) > 0 && (
            <Alert
              message={`${executionResult.stats.skipped} estudiante(s) no pudieron inscribirse en el período siguiente`}
              description={
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {Array.from(new Set(
                    ((executionResult.log?.processLog as any[]) ?? [])
                      .filter((e: any) => e?.skipped || e?.failed)
                      .map((e: any) => e?.error as string)
                      .filter(Boolean)
                  )).slice(0, 10).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              }
              type="warning"
              showIcon
              style={{ marginTop: 16 }}
            />
          )}

          {executionResult.errors.length > 0 && (
            <Alert
              message="Errores durante la ejecución"
              description={
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {executionResult.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              }
              type="error"
              showIcon
              style={{ marginTop: 16 }}
            />
          )}
        </Card>
      )}

      {/* Preview Modal */}
      <Modal
        rootClassName="ce-responsive-modal"
        title={
          <Space>
            <EyeOutlined />
            <span>Previsualización del Cierre</span>
          </Space>
        }
        open={previewVisible}
        onCancel={() => setPreviewVisible(false)}
        width={1200}
        footer={[
          <Button
            key="export"
            icon={<FileExcelOutlined />}
            onClick={handleExportPreviewExcel}
            disabled={!preview || preview.length === 0}
            style={{ borderColor: '#52c41a', color: '#52c41a' }}
          >
            Exportar a Excel
          </Button>,
          <Button key="close" onClick={() => setPreviewVisible(false)}>
            Cerrar
          </Button>,
        ]}
      >
        {preview && (
          <>
            <Alert
              message={`Se procesarán ${preview.length} estudiantes`}
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Input
              allowClear
              prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
              placeholder="Buscar por nombre, apellido o cédula..."
              value={previewSearch}
              onChange={(e) => setPreviewSearch(e.target.value)}
              style={{ marginBottom: 16 }}
            />
            <Table
              scroll={{ x: 'max-content', y: 500 }}
              dataSource={filteredPreview ?? []}
              columns={previewColumns}
              rowKey="inscriptionId"
              size="small"
              pagination={false}
              locale={{ emptyText: 'Ningún estudiante coincide con la búsqueda' }}
            />
          </>
        )}
      </Modal>

      {/* Confirm Execution Modal */}
      <Modal
        rootClassName="ce-responsive-modal"
        title={
          <Space>
            <ExclamationCircleOutlined style={{ color: '#faad14' }} />
            <span>Confirmar Ejecución del Cierre</span>
          </Space>
        }
        open={confirmVisible}
        onCancel={() => setConfirmVisible(false)}
        onOk={handleExecute}
        okText="Ejecutar Cierre"
        okButtonProps={{ danger: true, loading: executing }}
        cancelText="Cancelar"
      >
        <Alert
          message="Esta acción es irreversible"
          description={
            <>
              <p>Al ejecutar el cierre:</p>
              <ul>
                <li>Se congelarán las notas finales de todos los estudiantes</li>
                <li>Se crearán las inscripciones del siguiente período</li>
                <li>Se generarán las materias pendientes</li>
                <li>El período actual pasará a estado <Text code>histórico</Text></li>
                <li>El siguiente período pasará a estado <Text code>activo</Text></li>
              </ul>
              <p><Text strong>¿Está seguro de que desea continuar?</Text></p>
            </>
          }
          type="warning"
          showIcon
        />
      </Modal>

      {/* Empty state */}
      {!periodId && !loading && (
        <Card>
          <Empty description="No hay un período activo" />
        </Card>
      )}
    </div>
  );
};

export default PeriodClosureManagement;
