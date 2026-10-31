import { useEffect, useRef, useState } from 'react';
import { Alert, Input, Modal, Radio, Select } from 'antd';
import api from '@/services/api';
import { deletePayment, movePayment, reSharePayment, getSharedStudents, type PaymentDestination, type SharedApplyTo } from '@/services/paymentsService';
import { methodDef } from '../paymentMethods';

export type CorrectionMode = 'delete' | 'move' | 'destination' | 'reshare';

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
  const [sharedOthers, setSharedOthers] = useState<{ studentName: string; amount: number; currency: string; inscriptionId?: number; paymentId?: number }[] | null>(null);
  const others: { studentName: string; amount: number; currency: string; inscriptionId?: number; paymentId?: number }[] = sharedOthers
    ?? (txn.sharedWith ?? []).map((o: any) => ({ studentName: o.name, amount: o.amount, currency: o.currency, inscriptionId: o.inscriptionId, paymentId: o.paymentId }));
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
  const isReshare = mode === 'reshare';
  // Moving a share to another student only ever concerns that one row.
  const askShared = others.length > 0 && !isMove && !isReshare;
  // Re-share: "single" re-splits only this row's amount; "group" re-splits the whole operation.
  const resharePool = (others.length > 0 && applyTo === 'group')
    ? others.reduce((s, o) => s + Number(o.amount), 0) + Number(txn.amount)
    : Number(txn.amount);
  const [portions, setPortions] = useState<{ inscriptionId: number; name: string; amount: string }[]>([]);
  const reshareSum = portions.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const reshareOk = isReshare && portions.length > 0
    && portions.every(p => Number(p.amount) > 0)
    && Math.abs(reshareSum - resharePool) < 0.005;
  const canSubmit = reason.trim().length >= 3
    && (!isMove || !!target) && (!askShared || !!applyTo)
    && (!isReshare || reshareOk)
    && !(isReshare && others.length > 0 && !applyTo)
    && !submitting;

  // Initialize the portions editor once applyTo is known (or immediately for single payments).
  const initPortions = (mode2: SharedApplyTo | null) => {
    const first = { inscriptionId: txn.inscriptionId, name: studentName, amount: String(Number(txn.amount)) };
    setPortions(mode2 === 'group'
      ? [first, ...others.map(o => ({ inscriptionId: o.inscriptionId ?? o.paymentId, name: o.studentName, amount: String(Number(o.amount)) }))]
      : [first]);
  };
  const addPortion = (s: { inscriptionId: number; name?: string; lastName?: string; firstName?: string }) => {
    if (portions.some(p => p.inscriptionId === s.inscriptionId)) return;
    setPortions(prev => [...prev, {
      inscriptionId: s.inscriptionId,
      name: s.name ?? `${s.lastName}, ${s.firstName}`,
      amount: '0',
    }]);
    setTarget(null);
    setOptions([]);
  };
  const removePortion = (inscriptionId: number) =>
    setPortions(prev => prev.length > 1 ? prev.filter(p => p.inscriptionId !== inscriptionId) : prev);

  // Linked students (same representative/benefactor) offered as one-click portions.
  const [linkedStudents, setLinkedStudents] = useState<{ inscriptionId: number; name: string; where?: string; withdrawn?: boolean; hasDebt?: boolean; pending?: Record<string, number> }[]>([]);
  useEffect(() => {
    if (!isReshare) return;
    getSharedStudents(Number(txn.inscriptionId), schoolPeriodId)
      .then(list => setLinkedStudents(list.filter(s => s.inscriptionId !== txn.inscriptionId)))
      .catch(() => setLinkedStudents([]));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReshare, txn.inscriptionId, schoolPeriodId]);

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
      } else if (isReshare) {
        await reSharePayment(txn.id, {
          portions: portions.map(p => ({ inscriptionId: p.inscriptionId, amount: Number(p.amount) })),
          reason: reason.trim(),
          applyTo: others.length > 0 ? applyTo! : undefined,
        });
        onDone(`Reparto del pago #${txn.id} actualizado`);
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
      title={isMove ? 'Cambiar pago de estudiante' : isDestination ? 'Cambiar destino del pago' : isReshare ? 'Cambiar reparto del pago' : 'Eliminar pago'}
      okText={isMove ? 'Mover pago' : isDestination ? 'Cambiar destino' : isReshare ? 'Aplicar reparto' : 'Eliminar pago'}
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
              <Radio.Group value={applyTo} onChange={e => { setApplyTo(e.target.value); if (isReshare) initPortions(e.target.value); }} className="flex flex-col gap-1">
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
        ) : isReshare ? (
          <div>
            {others.length === 0 && !portions.length && (() => { initPortions(null); return null; })()}
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Reparto del pago ({resharePool.toFixed(2)} {txn.currency})
            </div>
            <div className="space-y-1">
              {portions.map((p, i) => (
                <div key={p.inscriptionId} className="flex items-center gap-2">
                  <span className="flex-1 min-w-0 text-sm truncate">{p.name}</span>
                  <Input
                    size="small"
                    style={{ width: 110 }}
                    value={p.amount}
                    onChange={e => setPortions(prev => {
                      const next = prev.map((x, j) => j === i ? { ...x, amount: e.target.value } : x);
                      // The NEXT portion absorbs the remainder (wrapping to the first), so the
                      // split always adds up to the total — editing any box adjusts its neighbor.
                      if (next.length > 1) {
                        const other = (i + 1) % next.length;
                        const fixed = next.reduce((s, x, j) => (j === i || j === other) ? s : s + (Number(x.amount) || 0), 0);
                        const typed = Number(next[i].amount) || 0;
                        if (fixed + typed > resharePool) next[i] = { ...next[i], amount: String(Math.max(resharePool - fixed, 0)) };
                        next[other] = { ...next[other], amount: String(Math.max(resharePool - fixed - (Number(next[i].amount) || 0), 0)) };
                      }
                      return next;
                    })}
                    inputMode="decimal"
                  />
                  <span className="text-xs text-slate-400 w-8">{txn.currency}</span>
                  {portions.length > 1 && (
                    <button type="button" className="text-slate-400 hover:text-red-600 px-1"
                      onClick={() => removePortion(p.inscriptionId)}>✕</button>
                  )}
                </div>
              ))}
            </div>
            {linkedStudents.length > 0 && (
              <div className="mt-2 border border-slate-200 rounded p-2">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Vinculados (mismo representante o benefactor)</div>
                <div className="space-y-1">
                  {linkedStudents.map(s => {
                    const included = portions.some(p => p.inscriptionId === s.inscriptionId);
                    return (
                      <label key={s.inscriptionId} className="flex items-start gap-2 cursor-pointer text-xs">
                        <input
                          type="checkbox" className="mt-0.5" checked={included}
                          onChange={() => included ? removePortion(s.inscriptionId) : addPortion(s)}
                        />
                        <span className="flex-1 min-w-0">
                          <b className="font-semibold">{s.name}</b>
                          {s.where ? <span className="text-slate-500"> — {s.where}{s.withdrawn ? ' · retirado' : ''}</span> : null}
                          {s.hasDebt && s.pending ? <span className="block text-amber-700">Debe {Object.entries(s.pending).map(([c, v]) => `${v.toFixed(2)} ${c}`).join(' + ')}</span> : null}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="mt-2">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Agregar otro estudiante</div>
              <Select
                showSearch
                style={{ width: '100%' }}
                placeholder="Escriba apellido, nombre o cédula"
                filterOption={false}
                onSearch={search}
                loading={searching}
                notFoundContent={searching ? 'Buscando…' : 'Escriba al menos 2 letras'}
                value={target?.inscriptionId}
                onChange={id => { const s = options.find(o => o.inscriptionId === id); if (s) addPortion(s); }}
                options={options.filter(o => !portions.some(p => p.inscriptionId === o.inscriptionId)).map(o => ({ value: o.inscriptionId, label: optionLabel(o) }))}
              />
            </div>
            <div className={`mt-1 text-right text-xs font-semibold ${reshareOk ? 'text-emerald-700' : 'text-red-700'}`}>
              Suma: {reshareSum.toFixed(2)} de {resharePool.toFixed(2)} {txn.currency}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Las partes se redistribuyen entre las deudas de cada estudiante en orden cronológico. Conserva fecha, método, referencia y quién lo registró.
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
