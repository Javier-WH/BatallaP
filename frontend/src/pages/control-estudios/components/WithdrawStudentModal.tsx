import { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Radio, Select, Spin } from 'antd';
import { getInscriptionDebt, type InscriptionDebt } from '@/services/paymentsService';
import { MONTH_FULL } from '@/utils/billingMonths';

type DebtAction = 'cancel_all' | 'keep_until' | 'keep_all';

interface Props {
  open: boolean;
  studentName: string;
  inscriptionId: number | null;
  /** Billing months of the inscription's school period (for "mantener hasta"). */
  periodMonths: string[];
  submitting: boolean;
  onCancel: () => void;
  onConfirm: (debtAction: DebtAction, debtUntilMonth: string | null) => void;
}

/**
 * Withdrawal dialog: the administrator decides what happens with the
 * student's debt — cancel it, keep it through a month, or keep it all.
 * Any remaining debt holds the student's documents until it is settled.
 */
export default function WithdrawStudentModal({
  open, studentName, inscriptionId, periodMonths, submitting, onCancel, onConfirm,
}: Props) {
  const [debt, setDebt] = useState<InscriptionDebt | null>(null);
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<DebtAction>('cancel_all');
  const [untilMonth, setUntilMonth] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !inscriptionId) return;
    setLoading(true);
    setAction('cancel_all');
    setUntilMonth(null);
    getInscriptionDebt(inscriptionId)
      .then(setDebt)
      .catch(() => setDebt(null))
      .finally(() => setLoading(false));
  }, [open, inscriptionId]);

  const debtText = useMemo(() => {
    if (!debt?.hasDebt) return null;
    return Object.entries(debt.totals)
      .filter(([, t]) => t.remaining > 0)
      .map(([cur, t]) => `${t.remaining.toFixed(2)} ${cur}`)
      .join(' · ');
  }, [debt]);

  return (
    <Modal
      open={open}
      title={`Retirar a ${studentName}`}
      okText="Retirar"
      okButtonProps={{ danger: true, loading: submitting }}
      cancelText="Cancelar"
      onCancel={onCancel}
      onOk={() => onConfirm(action, action === 'keep_until' ? untilMonth : null)}
      width={520}
    >
      <p className="text-sm text-[#4B5563] mb-3">
        No se borra ningún dato (notas, materias, expediente) y el estudiante podrá ser reactivado.
      </p>

      {loading ? (
        <div className="py-6 text-center"><Spin size="small" /></div>
      ) : (
        <>
          {debt?.hasDebt ? (
            <>
              <Alert
                type="warning"
                showIcon
                className="mb-3"
                message={`Deuda pendiente: ${debtText}`}
                description="Decide qué ocurre con la deuda al retirar al estudiante."
              />
              <Radio.Group
                value={action}
                onChange={e => setAction(e.target.value)}
                className="flex flex-col gap-2 mb-3"
              >
                <Radio value="cancel_all">
                  Cancelar las mensualidades no pagadas del período
                  <span className="block text-xs text-[#8B909A]">Las deudas manuales y las ya pagadas parcialmente se conservan.</span>
                </Radio>
                <Radio value="keep_until">
                  <span className="inline-flex items-center gap-2 flex-wrap">
                    Mantener la deuda hasta
                    <Select
                      size="small"
                      value={untilMonth}
                      placeholder="elegir mes"
                      style={{ minWidth: 130 }}
                      disabled={action !== 'keep_until'}
                      onClick={e => e.stopPropagation()}
                      onChange={v => { setUntilMonth(v); setAction('keep_until'); }}
                      options={periodMonths.map(m => ({ value: m, label: MONTH_FULL[m] ?? m }))}
                    />
                    inclusive
                  </span>
                  <span className="block text-xs text-[#8B909A]">Solo se cancelan las mensualidades posteriores a ese mes.</span>
                </Radio>
                <Radio value="keep_all">
                  Conservar toda la deuda
                  <span className="block text-xs text-[#8B909A]">Nada se cancela; el estudiante sigue debiendo todo.</span>
                </Radio>
              </Radio.Group>
              <Alert
                type="info"
                showIcon
                message="Mientras quede deuda, los documentos del estudiante quedan retenidos. La constancia mostrará la advertencia hasta que la deuda se salde o un administrador los libere."
              />
            </>
          ) : (
            <Alert type="success" showIcon message="El estudiante no tiene deudas pendientes; sus documentos no quedan retenidos." />
          )}
        </>
      )}
    </Modal>
  );
}
