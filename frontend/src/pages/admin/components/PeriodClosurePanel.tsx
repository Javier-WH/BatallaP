import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Progress,
  Button,
  Tag,
  Segmented,
  Table,
  Empty,
  message,
  Tooltip,
  Space,
  Typography,
  Skeleton,
  Popconfirm,
  Modal,
  Alert,
  Form,
  Input
} from 'antd';
import { SyncOutlined, CloseCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  getActivePeriod,
  getClosureStatus,
  getPendingSubjects,
  getPeriodOutcomes,
  resolvePendingSubject,
  type ClosureStatusResponse,
  type OutcomeRecord,
  type PendingSubjectRecord,
  validatePeriodClosure,
  executePeriodClosure,
  type ClosureValidationResult,
  getPreviewOutcomes
} from '@/services/periodClosure';
import { createPeriod } from '@/services/academic';

const { Text } = Typography;

const outcomeStatusMeta: Record<
  OutcomeRecord['status'],
  { label: string; color: string; description: string }
> = {
  aprobado: {
    label: 'Aprobado',
    color: 'green',
    description: 'Promedio y materias dentro del mínimo.'
  },
  materias_pendientes: {
    label: 'Materia Pendiente',
    color: 'orange',
    description: 'Promovido con materia pendiente.'
  },
  reprobado: {
    label: 'Reprobado',
    color: 'red',
    description: 'Debe repetir el grado.'
  }
};

const pendingStatusMeta: Record<
  PendingSubjectRecord['status'],
  { label: string; color: string }
> = {
  pendiente: { label: 'Pendiente', color: 'orange' },
  aprobada: { label: 'Aprobada', color: 'green' },
  convalidada: { label: 'Convalidada', color: 'blue' }
};

const PeriodClosurePanel: React.FC = () => {
  const [createPeriodModalVisible, setCreatePeriodModalVisible] = useState(false);
  const [creatingPeriod, setCreatingPeriod] = useState(false);
  const [nextPeriodForm] = Form.useForm();

  const [statusLoading, setStatusLoading] = useState(false);
  const [outcomeLoading, setOutcomeLoading] = useState(false);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [validationModalVisible, setValidationModalVisible] = useState(false);
  const [validationResult, setValidationResult] = useState<ClosureValidationResult | null>(null);
  const [validationLoading, setValidationLoading] = useState(false);
  const [executionLoading, setExecutionLoading] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(true);

  const [periodStatus, setPeriodStatus] = useState<ClosureStatusResponse | null>(null);
  const [outcomes, setOutcomes] = useState<OutcomeRecord[]>([]);
  const [pendingSubjects, setPendingSubjects] = useState<PendingSubjectRecord[]>([]);
  const [activePeriodId, setActivePeriodId] = useState<number | null>(null);
  const [selectedOutcomeFilter, setSelectedOutcomeFilter] = useState<
    OutcomeRecord['status'] | 'todos'
  >('todos');

  const loadAll = useCallback(async () => {
    try {
      setStatusLoading(true);
      const period = await getActivePeriod();
      if (!period) {
        setActivePeriodId(null);
        setPeriodStatus(null);
        setOutcomes([]);
        setPendingSubjects([]);
        return;
      }

      setActivePeriodId(period.id);
      const [statusResp, outcomesResp, pendingResp] = await Promise.all([
        getClosureStatus(period.id),
        getPeriodOutcomes(period.id),
        getPendingSubjects(period.id)
      ]);
      setPeriodStatus(statusResp);
      setOutcomes(outcomesResp);
      setPendingSubjects(pendingResp);
    } catch (error) {
      console.error(error);
      message.error('No se pudo cargar la información del periodo.');
    } finally {
      setStatusLoading(false);
    }
  }, []);

  const reloadOutcomes = useCallback(
    async (status?: OutcomeRecord['status']) => {
      if (!activePeriodId) return;
      try {
        setOutcomeLoading(true);
        const data = isPreviewMode
          ? await getPreviewOutcomes(activePeriodId, status)
          : await getPeriodOutcomes(activePeriodId, status);
        setOutcomes(data);
      } catch (error) {
        console.error(error);
        message.error('No se pudo obtener el reporte de estudiantes.');
      } finally {
        setOutcomeLoading(false);
      }
    },
    [activePeriodId, isPreviewMode]
  );

  const reloadPending = useCallback(async () => {
    if (!activePeriodId) return;
    try {
      setPendingLoading(true);
      const data = await getPendingSubjects(activePeriodId);
      setPendingSubjects(data);
    } catch (error) {
      console.error(error);
      message.error('No se pudieron obtener las materias pendientes.');
    } finally {
      setPendingLoading(false);
    }
  }, [activePeriodId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleOutcomeFilterChange = (value: string | number) => {
    const asStatus = value as OutcomeRecord['status'] | 'todos';
    setSelectedOutcomeFilter(asStatus);
    reloadOutcomes(asStatus === 'todos' ? undefined : asStatus);
  };

  const checklistProgress = useMemo(() => {
    if (!periodStatus) return 0;
    if (periodStatus.checklist.total === 0) return 0;
    return Math.round((periodStatus.checklist.done / periodStatus.checklist.total) * 100);
  }, [periodStatus]);

  const outcomeColumns = [
    {
      title: 'Estudiante',
      key: 'student',
      render: (_: unknown, record: OutcomeRecord) => {
        const student = record.inscription.student;
        return (
          <div className="flex flex-col">
            <Text strong>{student ? `${student.firstName} ${student.lastName}` : 'N/A'}</Text>
            <Text type="secondary" className="text-xs">
              {student?.document || '-'}
            </Text>
          </div>
        );
      }
    },
    {
      title: 'Grado / Sección',
      key: 'grade',
      render: (_: unknown, record: OutcomeRecord) => {
        const grade = record.inscription.grade?.name || 'N/A';
        const section = record.inscription.section?.name || '—';
        return (
          <Space direction="vertical" size={0}>
            <Text>{grade}</Text>
            <Text type="secondary" className="text-xs">
              Sección {section}
            </Text>
          </Space>
        );
      }
    },
    {
      title: 'Promedio Final',
      dataIndex: 'finalAverage',
      render: (avg: string | null) => <Text strong>{avg ?? 'N/D'}</Text>
    },
    {
      title: 'Materias reprobadas',
      dataIndex: 'failedSubjects',
      render: (value: number) => (
        <Tag color={value > 0 ? 'volcano' : 'green'}>
          {value} {value === 1 ? 'materia' : 'materias'}
        </Tag>
      )
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      render: (status: OutcomeRecord['status']) => (
        <Tooltip title={outcomeStatusMeta[status].description}>
          <Tag color={outcomeStatusMeta[status].color}>{outcomeStatusMeta[status].label}</Tag>
        </Tooltip>
      )
    },
    {
      title: 'Próximo curso',
      key: 'promotion',
      render: (_: unknown, record: OutcomeRecord) => {
        if (record.status === 'reprobado') return <Text type="secondary">Repite</Text>;
        if (!record.promotionGrade) return <Text type="secondary">Egreso</Text>;
        return <Text>{record.promotionGrade.name}</Text>;
      }
    }
  ];

  const pendingColumns = [
    {
      title: 'Estudiante',
      key: 'student',
      render: (_: unknown, record: PendingSubjectRecord) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.inscription?.student ? `${record.inscription.student.firstName} ${record.inscription.student.lastName}` : 'N/A'}</Text>
          <Text type="secondary" className="text-xs">
            {record.inscription?.grade?.name} / {record.inscription?.section?.name ?? '—'}
          </Text>
        </Space>
      )
    },
    {
      title: 'Materia',
      dataIndex: ['subject', 'name'],
      render: (name: string) => <Text>{name}</Text>
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      render: (status: PendingSubjectRecord['status']) => (
        <Tag color={pendingStatusMeta[status].color}>{pendingStatusMeta[status].label}</Tag>
      )
    },
    {
      title: 'Última actualización',
      dataIndex: 'updatedAt',
      render: (date: string) => (
        <Text type="secondary">{dayjs(date).format('DD/MM/YYYY HH:mm')}</Text>
      )
    },
    {
      title: 'Acciones',
      key: 'actions',
      render: (_: unknown, record: PendingSubjectRecord) => (
        <Space>
          {record.status === 'pendiente' ? (
            <>
              <Popconfirm
                title="Marcar como aprobada"
                okText="Confirmar"
                cancelText="Cancelar"
                onConfirm={() => handleResolvePending(record.id, 'aprobada')}
              >
                <Button size="small" type="link" disabled={resolvingId === record.id}>
                  Aprobar
                </Button>
              </Popconfirm>
              <Popconfirm
                title="Convalidar materia"
                okText="Confirmar"
                cancelText="Cancelar"
                onConfirm={() => handleResolvePending(record.id, 'convalidada')}
              >
                <Button size="small" type="link" disabled={resolvingId === record.id}>
                  Convalidar
                </Button>
              </Popconfirm>
            </>
          ) : (
            <Tag color={pendingStatusMeta[record.status].color}>
              {pendingStatusMeta[record.status].label}
            </Tag>
          )}
        </Space>
      )
    }
  ];

  const handleRefresh = () => {
    loadAll();
  };

  const handleResolvePending = async (
    pendingSubjectId: number,
    status: 'aprobada' | 'convalidada'
  ) => {
    try {
      setResolvingId(pendingSubjectId);
      await resolvePendingSubject(pendingSubjectId, status);
      message.success('Materia actualizada.');
      reloadPending();
      reloadOutcomes(selectedOutcomeFilter === 'todos' ? undefined : selectedOutcomeFilter);
    } catch (error) {
      console.error(error);
      message.error('No se pudo actualizar la materia pendiente.');
    } finally {
      setResolvingId(null);
    }
  };


  // ... existing loadAll ...

  const handleCreateNextPeriod = async () => {
    try {
      const values = await nextPeriodForm.validateFields();
      setCreatingPeriod(true);

      await createPeriod(values);
      message.success('Próximo periodo creado exitosamente.');
      setCreatePeriodModalVisible(false);
      await loadAll();
    } catch (error) {
      console.error(error);
      message.error('Error al crear el periodo. Verifique los datos.');
    } finally {
      setCreatingPeriod(false);
    }
  };

  const handleValidateClosure = async () => {
    if (!activePeriodId || !periodStatus) return;

    if (!periodStatus.nextPeriod) {
      const currentPeriodName = periodStatus.period.period; // e.g. "2025-2026"
      const parts = currentPeriodName.split('-');
      if (parts.length === 2) {
        const p1 = parseInt(parts[0], 10) + 1;
        const p2 = parseInt(parts[1], 10) + 1;
        nextPeriodForm.setFieldsValue({
          name: `Año Escolar ${p1}-${p2}`,
          period: `${p1}-${p2}`
        });
      }
      setCreatePeriodModalVisible(true);
      return;
    }

    try {
      setValidationLoading(true);
      const validation = await validatePeriodClosure(activePeriodId);
      setValidationResult(validation);
      setValidationModalVisible(true);
    } catch (error) {
      console.error(error);
      message.error('No se pudo validar el cierre del periodo.');
    } finally {
      setValidationLoading(false);
    }
  };

  const handleExecuteClosure = async () => {
    if (!activePeriodId) return;
    try {
      setExecutionLoading(true);
      const result = await executePeriodClosure(activePeriodId);

      if (result.success) {
        message.success('Cierre de periodo completado exitosamente');
        Modal.success({
          title: 'Cierre completado',
          content: (
            <div>
              <p><strong>Estadísticas del cierre:</strong></p>
              <ul>
                <li>Total de estudiantes: {result.stats.totalStudents}</li>
                <li>Aprobados: {result.stats.approved}</li>
                <li>Con materias pendientes: {result.stats.withPendingSubjects}</li>
                <li>Reprobados: {result.stats.failed}</li>
                <li>Nuevas inscripciones creadas: {result.stats.newInscriptions}</li>
                <li>Materias pendientes asignadas: {result.stats.pendingSubjectsCreated}</li>
              </ul>
            </div>
          ),
          width: 600
        });
        setValidationModalVisible(false);
        setIsPreviewMode(false);
        await loadAll();
      } else {
        message.error('No se pudo completar el cierre del periodo');
        Modal.error({
          title: 'Error en el cierre',
          content: (
            <div>
              <p>Errores encontrados:</p>
              <ul>
                {result.errors.map((err: string, idx: number) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          ),
          width: 600
        });
      }
    } catch (error) {
      console.error(error);
      message.error('Error al ejecutar el cierre del periodo.');
    } finally {
      setExecutionLoading(false);
    }
  };

  if (statusLoading && !periodStatus) {
    return (
      <div className="p-6">
        <Skeleton active paragraph={{ rows: 6 }} />
      </div>
    );
  }

  if (!periodStatus || !activePeriodId) {
    return (
      <div className="p-6 flex flex-col items-center justify-center gap-3">
        <Empty description="No hay periodo activo disponible." />
        <Button icon={<SyncOutlined />} onClick={handleRefresh}>
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Row gutter={[16, 16]}>
        <Col xs={24} md={16}>
          <Card
            title={
              <div className="flex items-center justify-between">
                <span>Periodo a cerrar</span>
                <Button
                  size="small"
                  icon={<SyncOutlined spin={statusLoading} />}
                  onClick={handleRefresh}
                >
                  Actualizar
                </Button>
              </div>
            }
          >
            <Row gutter={16}>
              <Col span={12}>
                <Statistic title="Periodo actual" value={periodStatus.period.name} />
                <Text type="secondary" className="text-xs">
                  {periodStatus.period.period}
                </Text>
              </Col>
              <Col span={12}>
                {periodStatus.nextPeriod ? (
                  <>
                    <Statistic title="Próximo periodo" value={periodStatus.nextPeriod.name} />
                    <Text type="secondary" className="text-xs">
                      {periodStatus.nextPeriod.period}
                    </Text>
                  </>
                ) : (
                  <>
                    <Statistic title="Próximo periodo" value="No configurado" />
                    <Text type="danger" className="text-xs">
                      Debe crear el siguiente periodo antes de cerrar
                    </Text>
                  </>
                )}
              </Col>
              <Col span={12}>
                <Statistic
                  title="Checklist completado"
                  value={checklistProgress}
                  suffix="%"
                />
                <Progress
                  percent={checklistProgress}
                  status={checklistProgress === 100 ? 'success' : 'active'}
                  strokeColor="#2563eb"
                  size="small"
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="Lapsos bloqueados"
                  value={periodStatus.blockedTerms}
                  suffix={`de ${periodStatus.totalTerms}`}
                />
              </Col>
            </Row>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card title="Acciones de cierre">
            <Space direction="vertical" className="w-full">
              <Button
                block
                type="primary"
                danger
                icon={<CloseCircleOutlined />}
                onClick={handleValidateClosure}
                loading={validationLoading}
                disabled={statusLoading || executionLoading}
              >
                Confirmar cierre completo
              </Button>
              <Text type="secondary" className="text-xs">
                El cierre de periodo inscribirá automáticamente a los estudiantes en el siguiente periodo según su rendimiento académico.
              </Text>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card
        title={
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>Resultados por estudiante</span>
              {isPreviewMode && (
                <Tag color="blue" icon={<SyncOutlined spin={outcomeLoading} />}>
                  Vista previa (cálculo en tiempo real)
                </Tag>
              )}
            </div>
            <Segmented
              options={[
                { label: 'Todos', value: 'todos' },
                ...Object.entries(outcomeStatusMeta).map(([key, meta]) => ({
                  label: meta.label,
                  value: key
                }))
              ]}
              size="small"
              value={selectedOutcomeFilter}
              onChange={handleOutcomeFilterChange}
            />
          </div>
        }
        extra={
          <Tooltip title="Recargar">
            <Button
              icon={<SyncOutlined spin={outcomeLoading} />}
              onClick={() =>
                reloadOutcomes(selectedOutcomeFilter === 'todos' ? undefined : selectedOutcomeFilter)
              }
            />
          </Tooltip>
        }
      >
        <Table
          rowKey="id"
          columns={outcomeColumns}
          dataSource={outcomes}
          loading={outcomeLoading}
          pagination={{ pageSize: 8 }}
          locale={{
            emptyText: <Empty description="Sin registros para este filtro" />
          }}
        />
      </Card>

      <Card
        title="Materias pendientes"
        extra={
          <Tooltip title="Recargar">
            <Button icon={<SyncOutlined spin={pendingLoading} />} onClick={reloadPending} />
          </Tooltip>
        }
      >
        <Table
          rowKey="id"
          columns={pendingColumns}
          dataSource={pendingSubjects}
          loading={pendingLoading || resolvingId !== null}
          pagination={{ pageSize: 6 }}
          locale={{
            emptyText: (
              <Empty
                description="No hay materias pendientes registradas."
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            )
          }}
        />
      </Card>

      <Modal
        title="Crear Próximo Periodo"
        open={createPeriodModalVisible}
        onCancel={() => setCreatePeriodModalVisible(false)}
        onOk={handleCreateNextPeriod}
        confirmLoading={creatingPeriod}
        okText="Crear y Continuar"
      >
        <Alert
          message="Periodo Siguiente Requerido"
          description="Para cerrar el periodo actual, debe existir un periodo escolar siguiente. Configúrelo ahora."
          type="info"
          showIcon
          className="mb-4"
        />
        <Form form={nextPeriodForm} layout="vertical">
          <Form.Item name="name" label="Nombre del Periodo" rules={[{ required: true }]}>
            <Input placeholder="Ej. Año Escolar 2026-2027" />
          </Form.Item>
          <Form.Item name="period" label="Periodo (Año-Año)" rules={[{ required: true }]}>
            <Input placeholder="Ej. 2026-2027" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Validación de cierre de periodo"
        open={validationModalVisible}
        onCancel={() => setValidationModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setValidationModalVisible(false)}>
            Cancelar
          </Button>,
          <Button
            key="execute"
            type="primary"
            danger
            disabled={!validationResult?.valid}
            loading={executionLoading}
            onClick={handleExecuteClosure}
          >
            Ejecutar cierre
          </Button>
        ]}
        width={700}
      >
        {validationResult && (
          <div className="space-y-4">
            {validationResult.valid ? (
              <Alert
                message="Validación exitosa"
                description="El periodo está listo para ser cerrado. Se inscribirán automáticamente los estudiantes en el siguiente periodo."
                type="success"
                showIcon
              />
            ) : (
              <Alert
                message="Validación fallida"
                description="Se encontraron errores que deben ser corregidos antes de cerrar el periodo."
                type="error"
                showIcon
              />
            )}

            {validationResult.errors.length > 0 && (
              <div>
                <Text strong>Errores:</Text>
                <ul className="mt-2 ml-4">
                  {validationResult.errors.map((error: string, idx: number) => (
                    <li key={idx} className="text-red-600">
                      {error}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {validationResult.warnings.length > 0 && (
              <div>
                <Text strong>Advertencias:</Text>
                <ul className="mt-2 ml-4">
                  {validationResult.warnings.map((warning: string, idx: number) => (
                    <li key={idx} className="text-orange-600">
                      {warning}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {validationResult.valid && (
              <Alert
                message="Proceso de cierre"
                description={
                  <div>
                    <p>Al ejecutar el cierre se realizarán las siguientes acciones:</p>
                    <ul className="mt-2 ml-4">
                      <li>Se calcularán las calificaciones finales de todos los estudiantes</li>
                      <li>Se evaluará el rendimiento según las reglas de transición</li>
                      <li>Los estudiantes aprobados se inscribirán en el siguiente grado</li>
                      <li>Los estudiantes con materias pendientes (menos de 4) se inscribirán con arrastre</li>
                      <li>Los estudiantes reprobados (4 o más materias) repetirán el grado</li>
                      <li>El periodo actual se marcará como inactivo</li>
                      <li>El siguiente periodo se activará automáticamente</li>
                    </ul>
                    <p className="mt-2 font-bold text-red-600">
                      Esta acción no se puede deshacer. Asegúrese de tener un respaldo de la base de datos.
                    </p>
                  </div>
                }
                type="warning"
                showIcon
              />
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default PeriodClosurePanel;
