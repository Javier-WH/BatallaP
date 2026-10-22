import { useEffect, useRef, useState } from 'react';
import { Alert, Input, Modal, Radio, Select } from 'antd';
import api from '@/services/api';
import { deletePayment, movePayment, type PaymentDestination, type SharedApplyTo } from '@/services/paymentsService';
import { methodDef } from '../paymentMethods';

export type CorrectionMode = 'delete' | 'move' | 'destination';

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

const DESTINATION_LABEL: Record<PaymentDestination, string> = {
  auto: 'Automático (en orden de deudas)',
  tuition: 'Inscripción y mensualidades',
  item: 'Items vendibles (uniformes, etc.)',
};

const optionLabel = (s: StudentOption) =>
  `${s.lastName}, ${s.firstName} · ${s.document} · ${s.gradeName} ${s.sectionName}`;

/**
 * Corrects a payment entered by mistake: delete it, or move it to the right
 * student. Both require a reason and are recorded in the payment audit trail.
 */
export default function PaymentCorrectionModal({ txn, mode, studentName, schoolPeriodId, onClose, onDone }: Props) {
  const [reason, setReason] = useState('');
  const [target, setTarget] = useState<StudentOption | null>(null);
  const [scope, setScope] = useState<PaymentDestination>('item');
  const [options, setOptions] = useState<StudentOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Payments shared between students (one transfer, several students) must say what to touch.
  const [applyTo, setApplyTo] = useState<SharedApplyTo | null>(null);
  const [sharedOthers, setSharedOthers] = useState<{ studentName: string; amount: number; currency: string }[] | null>(null);
  const others: { studentName: string; amount: number; currency: string }[] = sharedOthers
    ?? (txn.sharedWith ?? []).map((o: any) => ({ studentName: o.name, amount: o.amount, currency: o.currency }));
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
  const isDestination = mode === 'destination';
  // Moving a share to another student only ever concerns that one row.
  const askShared = others.length > 0 && !isMove;
  const canSubmit = reason.trim().length >= 3 && (!isMove || !!target) && (!askShared || !!applyTo) && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      if (isMove) {
        await movePayment(txn.id, { toInscriptionId: target!.inscriptionId }, reason.trim(), others.length ? 'single' : undefined);
        onDone(`Pago #${txn.id} movido a ${target!.lastName}, ${target!.firstName}`);
      } else if (isDestination) {
        await movePayment(txn.id, { scope }, reason.trim(), askShared ? applyTo! : undefined);
        onDone(`Pago #${txn.id} reasignado a: ${DESTINATION_LABEL[scope]}`);
      } else {
        await deletePayment(txn.id, reason.trim(), askShared ? applyTo! : undefined);
        onDone(`Pago #${txn.id} eliminado`);
      }
    } catch (err: any) {
      const data = err?.response?.data;
      if (err?.response?.status === 409 && data?.code === 'SHARED_PAYMENT') {
        setSharedOthers(data.others ?? []);
        setError('Este pago es compartido con otros estudiantes: elija a cuáles aplicar la corrección.');
      } else {
        setError(data?.message || 'No se pudo completar la corrección');
      }
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open
      title={isMove ? 'Cambiar pago de estudiante' : isDestination ? 'Cambiar destino del pago' : 'Eliminar pago'}
      okText={isMove ? 'Mover pago' : isDestination ? 'Cambiar destino' : 'Eliminar pago'}
      cancelText="Cancelar"
      okButtonProps={{ danger: !isMove && !isDestination, disabled: !canSubmit, loading: submitting }}
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

        {others.length > 0 && (
          <div className="border border-amber-200 bg-amber-50 rounded p-3 space-y-2">
            <div>
              Este pago es <b>compartido</b>: la misma operación se repartió también a{' '}
              {others.map((o, i) => (
                <span key={i}>{i > 0 && ', '}<b>{o.studentName}</b> ({Number(o.amount).toFixed(2)} {o.currency})</span>
              ))}.
            </div>
            {isMove ? (
              <div className="text-xs text-slate-500">Solo se moverá la parte de este estudiante; las demás no se tocan.</div>
            ) : (
              <Radio.Group value={applyTo} onChange={e => setApplyTo(e.target.value)} className="flex flex-col gap-1">
                <Radio value="single">Solo esta parte ({Number(txn.amount).toFixed(2)} {txn.currency})</Radio>
                <Radio value="group">Todo el pago compartido (todos los estudiantes)</Radio>
              </Radio.Group>
            )}
          </div>
        )}

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
        ) : isDestination ? (
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Nuevo destino</div>
            <Select
              style={{ width: '100%' }}
              value={scope}
              onChange={setScope}
              options={(Object.keys(DESTINATION_LABEL) as PaymentDestination[]).map(k => ({ value: k, label: DESTINATION_LABEL[k] }))}
            />
            <p className="text-xs text-slate-400 mt-1">
              El pago se vuelve a repartir entre las deudas del destino elegido (en orden, la más antigua primero) y deja de aplicarse a las que tenía. Conserva su fecha, método y quién lo registró.
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
            placeholder={isMove ? 'Ej.: se cargó al hermano por error' : isDestination ? 'Ej.: era para el uniforme, no la mensualidad' : 'Ej.: pago registrado dos veces'}
          />
        </div>

        {error && <Alert type="error" showIcon message={error} />}
      </div>
    </Modal>
  );
}
