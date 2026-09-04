import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Button, Table, Space, Typography, Row, Col, Tag, Empty, Spin,
  message, Alert, Steps, Modal, Descriptions, Statistic, Divider, Badge,
} from 'antd';
import {
  FlagOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  PlayCircleOutlined,
  EyeOutlined,
  ReloadOutlined,
  UserOutlined,
  BookOutlined,
  SafetyOutlined,
  RocketOutlined,
  FileTextOutlined,
  LockOutlined,
  CheckOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import api from '@/services/api';
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
const { Step } = Steps;

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
        message.success('Cierre de período ejecutado exitosamente');
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
      render: (_: any, record: OutcomeRecord) => (
        <Badge
          count={record.failedSubjects}
          color={record.failedSubjects > 0 ? 'red' : 'green'}
          showZero
        />
      ),
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
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <Card style={{ marginBottom: 24 }}>
        <Row align="middle" justify="space-between">
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
        <Steps current={currentStep} style={{ marginBottom: 24 }}>
          <Step
            title="Validar"
            description="Verificar requisitos previos"
            icon={<SafetyOutlined />}
          />
          <Step
            title="Validado"
            description="Requisitos verificados"
            icon={<CheckCircleOutlined />}
          />
          <Step
            title="Previsualizar"
            description="Ver resultados antes de ejecutar"
            icon={<EyeOutlined />}
          />
          <Step
            title="Ejecutar"
            description="Procesar el cierre"
            icon={<RocketOutlined />}
          />
          <Step
            title="Completado"
            description="Período cerrado"
            icon={<FlagOutlined />}
          />
        </Steps>

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
          </Descriptions>

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
            <Table
              dataSource={preview}
              columns={previewColumns}
              rowKey="inscriptionId"
              size="small"
              pagination={false}
              scroll={{ y: 500 }}
            />
          </>
        )}
      </Modal>

      {/* Confirm Execution Modal */}
      <Modal
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
