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
  Popconfirm
} from 'antd';
import { SyncOutlined, CheckCircleOutlined, WarningOutlined } from '@ant-design/icons';
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
  updateChecklistStatus
} from '@/services/periodClosure';

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
    label: 'Materias pendientes',
    color: 'orange',
    description: 'Avanza con arrastre de materias.'
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
  const [statusLoading, setStatusLoading] = useState(false);
  const [outcomeLoading, setOutcomeLoading] = useState(false);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [resolvingId, setResolvingId] = useState<number | null>(null);

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
        const data = await getPeriodOutcomes(activePeriodId, status);
        setOutcomes(data);
      } catch (error) {
        console.error(error);
        message.error('No se pudo obtener el reporte de estudiantes.');
      } finally {
        setOutcomeLoading(false);
      }
    },
    [activePeriodId]
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

  const handleChecklistQuickAction = async (status: 'in_review' | 'done') => {
    if (!activePeriodId) return;
    try {
      setStatusLoading(true);
      await updateChecklistStatus(activePeriodId, {
        gradeId: 0,
        sectionId: 0,
        termId: 0,
        status
      });
      await loadAll();
      message.success('Estado del checklist actualizado');
    } catch (error) {
      console.error(error);
      message.error('No se pudo actualizar el checklist.');
    } finally {
      setStatusLoading(false);
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
                <span>Periodo activo</span>
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
                <Statistic title="Nombre" value={periodStatus.period.name} />
              </Col>
              <Col span={12}>
                <Statistic title="Código" value={periodStatus.period.period} />
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
          <Card title="Checklist rápido">
            <Space direction="vertical" className="w-full">
              <Button
                block
                icon={<WarningOutlined />}
                onClick={() => handleChecklistQuickAction('in_review')}
                disabled={statusLoading}
              >
                Marcar checklist en revisión
              </Button>
              <Button
                block
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={() => handleChecklistQuickAction('done')}
                disabled={statusLoading}
              >
                Confirmar checklist completo
              </Button>
              <Text type="secondary" className="text-xs">
                Estas acciones requieren un checklist detallado en el futuro. Por ahora se
                marcan como acciones rápidas sobre el periodo activo.
              </Text>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card
        title={
          <div className="flex items-center justify-between">
            <span>Resultados por estudiante</span>
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
    </div>
  );
};

export default PeriodClosurePanel;
