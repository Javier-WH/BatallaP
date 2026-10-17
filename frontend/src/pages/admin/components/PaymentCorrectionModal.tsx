import { useEffect, useRef, useState } from 'react';
import { Alert, Input, Modal, Select } from 'antd';
import api from '@/services/api';
import { deletePayment, movePayment } from '@/services/paymentsService';
import { methodDef } from '../paymentMethods';

export type CorrectionMode = 'delete' | 'move';

interface StudentOption {
  inscriptionId: number;
  lastName: string;
  firstName: string;
  document: string;
  gradeName: string;
  sectionName: string;
}

interface Props {
  txn: any;
  mode: CorrectionMode;
  /** Name of the student the payment is currently charged to. */
  studentName: string;
  schoolPeriodId: number;
  onClose: () => void;
  onDone: (message: string) => void;
}

const optionLabel = (s: StudentOption) =>
  `${s.lastName}, ${s.firstName} · ${s.document} · ${s.gradeName} ${s.sectionName}`;

/**
 * Corrects a payment entered by mistake: delete it, or move it to the right
 * student. Both require a reason and are recorded in the payment audit trail.
 */
export default function PaymentCorrectionModal({ txn, mode, studentName, schoolPeriodId, onClose, onDone }: Props) {
  const [reason, setReason] = useState('');
  const [target, setTarget] = useState<StudentOption | null>(null);
  const [options, setOptions] = useState<StudentOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const search = (q: string) => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) { setOptions([]); return; }
    timer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.get('/attendance/reports/student-search', { params: { schoolPeriodId, q } });
        setOptions((res.data ?? []).filter((s: StudentOption) => s.inscriptionId !== txn.inscriptionId));
      } catch {
        setOptions([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  };

  const isMove = mode === 'move';
  const canSubmit = reason.trim().length >= 3 && (!isMove || !!target) && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      if (isMove) {
        await movePayment(txn.id, target!.inscriptionId, reason.trim());
        onDone(`Pago #${txn.id} movido a ${target!.lastName}, ${target!.firstName}`);
      } else {
        await deletePayment(txn.id, reason.trim());
        onDone(`Pago #${txn.id} eliminado`);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'No se pudo completar la corrección');
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open
      title={isMove ? 'Cambiar pago de estudiante' : 'Eliminar pago'}
      okText={isMove ? 'Mover pago' : 'Eliminar pago'}
      cancelText="Cancelar"
      okButtonProps={{ danger: !isMove, disabled: !canSubmit, loading: submitting }}
      onOk={submit}
      onCancel={onClose}
      width={500}
      destroyOnClose
    >
      <div className="text-sm space-y-3">
        <div className="bg-slate-50 rounded p-3 space-y-0.5">
          <div>Pago <b>#{txn.id}</b> · <b>{Number(txn.amount).toFixed(2)} {txn.currency}</b> · {methodDef(txn.method).label}</div>
          <div className="text-slate-500">
            Cargado a <b>{studentName || '—'}</b>
            {txn.registeredBy && <> · registrado por <b>{txn.registeredBy.firstName} {txn.registeredBy.lastName}</b></>}
          </div>
        </div>

        {isMove ? (
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Estudiante correcto</div>
            <Select
              showSearch
              style={{ width: '100%' }}
              placeholder="Escriba apellido, nombre o cédula"
              filterOption={false}
              onSearch={search}
              loading={searching}
              notFoundContent={searching ? 'Buscando…' : 'Escriba al menos 2 letras'}
              value={target?.inscriptionId}
              onChange={id => setTarget(options.find(o => o.inscriptionId === id) ?? null)}
              options={options.map(o => ({ value: o.inscriptionId, label: optionLabel(o) }))}
            />
            <p className="text-xs text-slate-400 mt-1">
              El pago conserva su fecha, método y quién lo registró, y se aplica a la deuda más antigua del estudiante destino.
            </p>
          </div>
        ) : (
          <Alert type="warning" showIcon message="El pago se elimina del ledger y la deuda del estudiante vuelve a quedar pendiente. Queda un registro de la eliminación." />
        )}

        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Motivo (obligatorio)</div>
          <Input.TextArea
            rows={2}
            maxLength={500}
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder={isMove ? 'Ej.: se cargó al hermano por error' : 'Ej.: pago registrado dos veces'}
          />
        </div>

        {error && <Alert type="error" showIcon message={error} />}
      </div>
    </Modal>
  );
}
