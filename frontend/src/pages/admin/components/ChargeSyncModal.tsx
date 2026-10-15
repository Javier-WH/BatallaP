import React, { useEffect, useState } from 'react';
import { Modal, Alert, Statistic, Row, Col, Spin, message, Typography } from 'antd';
import {
  previewChargeSync, applyChargeSync, type ChargeSyncSummary,
} from '@/services/paymentsService';

const { Text } = Typography;

const money = (byCurrency: Record<string, number>) => {
  const parts = Object.entries(byCurrency).map(([cur, v]) => `${v.toLocaleString('es-VE', { minimumFractionDigits: 2 })} ${cur}`);
  return parts.length ? parts.join(' · ') : '—';
};

interface Props {
  open: boolean;
  onClose: () => void;
  periodLabel?: string;
}

const ChargeSyncModal: React.FC<Props> = ({ open, onClose, periodLabel }) => {
  const [summary, setSummary] = useState<ChargeSyncSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPreview = async () => {
    setLoading(true);
    setError(null);
    try {
      setSummary(await previewChargeSync());
    } catch (err: any) {
      setSummary(null);
      setError(err.response?.data?.message || 'Error al calcular la vista previa');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) loadPreview();
  }, [open]);

  const nothingToDo = !!summary && summary.generate.charges === 0 && summary.sync.charges === 0;

  const handleApply = async () => {
    setApplying(true);
    try {
      const res = await applyChargeSync(summary?.schoolPeriodId);
      message.success(`Deudas generadas: ${res.created + res.reactivated} · actualizadas: ${res.updated}`);
      onClose();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Error al generar las deudas');
    } finally {
      setApplying(false);
    }
  };

  return (
    <Modal
      title={`Generar / actualizar deudas${periodLabel ? ` — ${periodLabel}` : ''}`}
      open={open}
      onCancel={onClose}
      onOk={handleApply}
      okText="Aplicar cambios"
      cancelText="Cancelar"
      okButtonProps={{ disabled: loading || nothingToDo || !summary, loading: applying }}
      width={640}
    >
      <Text type="secondary">
        Crea las deudas (inscripción y mensualidades) de los estudiantes del período presente que aún no las tienen
        y ajusta las que cambiaron por una nueva vigencia de costos. Las deudas manuales no se modifican.
      </Text>
      <div style={{ marginTop: 16 }}>
        {loading && <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>}
        {error && <Alert type="error" message={error} showIcon />}
        {summary && !loading && (
          <>
            {nothingToDo && <Alert type="success" showIcon message="Todo al día: no hay deudas por generar ni por actualizar." style={{ marginBottom: 12 }} />}
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Statistic title="Estudiantes con deudas por generar" value={summary.generate.inscriptions} />
              </Col>
              <Col span={12}>
                <Statistic title="Deudas a crear" value={summary.generate.charges} suffix={<small style={{ fontSize: 12 }}>{money(summary.generate.amountByCurrency)}</small>} />
              </Col>
              <Col span={12}>
                <Statistic title="Deudas a actualizar (nueva vigencia)" value={summary.sync.charges} suffix={summary.sync.charges ? <small style={{ fontSize: 12 }}>{money(summary.sync.deltaByCurrency)}</small> : undefined} />
              </Col>
              <Col span={12}>
                <Statistic title="Ya pagadas (no se tocan)" value={summary.sync.skippedPaid} />
              </Col>
            </Row>
            {summary.excludedMateriaPendiente > 0 && (
              <Alert
                style={{ marginTop: 16 }}
                type="info"
                showIcon
                message={`${summary.excludedMateriaPendiente} inscripción(es) de Materia Pendiente no generan deuda.`}
              />
            )}
            {summary.warnings.length > 0 && (
              <Alert
                style={{ marginTop: 12 }}
                type="warning"
                showIcon
                message="Configuración incompleta"
                description={
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {summary.warnings.map(w => (
                      <li key={w.message}>{w.message} ({w.count} estudiante{w.count === 1 ? '' : 's'})</li>
                    ))}
                  </ul>
                }
              />
            )}
          </>
        )}
      </div>
    </Modal>
  );
};

export default ChargeSyncModal;
