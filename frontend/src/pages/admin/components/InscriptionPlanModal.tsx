import { useEffect, useState } from 'react';
import { Alert, Checkbox, Modal, Radio, Spin, Tag } from 'antd';
import {
  getInscriptionPlan, setInscriptionPlan,
  type InscriptionPlanChange, type InscriptionPlanInfo,
} from '@/services/paymentsService';

interface Props {
  inscriptionId: number;
  studentName: string;
  onClose: () => void;
  onDone: (message: string) => void;
}

const money = (rows: { amount: number; currency: string }[]) => {
  const by: Record<string, number> = {};
  rows.forEach(r => { by[r.currency] = (by[r.currency] ?? 0) + Number(r.amount); });
  return Object.entries(by).map(([c, v]) => `${v.toFixed(2)} ${c}`).join(' + ') || '—';
};

/**
 * Chooses the enrollment plan a student takes (basic enrollment, full package with uniform…) and
 * reconciles their package debts: new items are charged, items the plan no longer includes are
 * retired (never when they already have payments or deliveries).
 */
export default function InscriptionPlanModal({ inscriptionId, studentName, onClose, onDone }: Props) {
  const [info, setInfo] = useState<InscriptionPlanInfo | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [change, setChange] = useState<InscriptionPlanChange | null>(null);
  const [retire, setRetire] = useState(true);
  const [loading, setLoading] = useState(true);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getInscriptionPlan(inscriptionId)
      .then(i => { setInfo(i); setSelected(i.currentPlanId); })
      .catch(err => setError(err?.response?.data?.message || 'No se pudieron cargar los planes'))
      .finally(() => setLoading(false));
  }, [inscriptionId]);

  // The plan stored on the student: the plan in force is stored as "no assignment".
  const target = (id: number | null) => (id === info?.inForcePlanId ? null : id);
  const unchanged = !info || selected === info.currentPlanId;

  const pick = async (id: number) => {
    setSelected(id);
    setChange(null);
    setError(null);
    if (!info || id === info.currentPlanId) return;
    setPreviewing(true);
    try {
      setChange(await setInscriptionPlan(inscriptionId, { enrollmentPlanId: target(id), dryRun: true }));
    } catch (err: any) {
      setError(err?.response?.data?.message || 'No se pudo calcular el cambio');
    } finally {
      setPreviewing(false);
    }
  };

  const submit = async () => {
    if (!info || selected == null) return;
    setSaving(true);
    setError(null);
    try {
      const res = await setInscriptionPlan(inscriptionId, { enrollmentPlanId: target(selected), retireObsolete: retire });
      const planName = info.plans.find(p => p.id === selected)?.name ?? 'plan';
      onDone(`Plan «${planName}» asignado · ${res.created ?? 0} deuda(s) nueva(s)${res.retired ? ` · ${res.retired} retirada(s)` : ''}`);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'No se pudo cambiar el plan');
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      title="Plan de inscripción"
      okText="Aplicar plan"
      cancelText="Cancelar"
      okButtonProps={{ disabled: unchanged || previewing || saving, loading: saving }}
      onOk={submit}
      onCancel={onClose}
      width={560}
      destroyOnClose
    >
      <div className="text-sm space-y-3">
        <div className="text-slate-500">Estudiante: <b className="text-slate-800">{studentName}</b></div>
        {loading && <div className="text-center py-6"><Spin /></div>}
        {info && info.plans.length === 0 && <Alert type="info" showIcon message="Este período no tiene planes de inscripción activos." />}
        {info && (
          <Radio.Group value={selected} onChange={e => pick(e.target.value)} className="w-full">
            <div className="space-y-2">
              {info.plans.map(p => (
                <label key={p.id} className={`block border px-3 py-2 cursor-pointer ${selected === p.id ? 'border-[#2F5EA8] bg-[#F1F5FC]' : 'border-[#DBDEE4]'}`}>
                  <Radio value={p.id}>
                    <b>{p.name}</b>{' '}
                    {p.id === info.currentPlanId && <Tag color="green">Actual</Tag>}
                    {p.inForce && <Tag>Por defecto</Tag>}
                    {!p.autoApply && <Tag color="purple">Opcional</Tag>}
                  </Radio>
                  {p.description && <div className="text-xs text-slate-500 ml-6">{p.description}</div>}
                  <div className="text-xs text-slate-600 ml-6 mt-0.5">
                    {p.items.length ? p.items.map(i => `${i.name ?? '—'}${i.quantity > 1 ? ` x${i.quantity}` : ''}`).join(' · ') : 'Sin items'}
                  </div>
                </label>
              ))}
            </div>
          </Radio.Group>
        )}

        {previewing && <div className="text-center"><Spin size="small" /></div>}
        {change && (
          <div className="bg-slate-50 rounded p-3 space-y-1">
            <div>
              Se cobrará: <b>{change.create.length ? change.create.map(c => c.description).join(', ') : 'nada nuevo'}</b>
              {change.create.length > 0 && <> ({money(change.create)})</>}
            </div>
            {change.retire.length > 0 && (
              <>
                <div>
                  Ya no corresponde: <b>{change.retire.map(c => c.description).join(', ')}</b> ({money(change.retire)})
                </div>
                <Checkbox checked={retire} onChange={e => setRetire(e.target.checked)}>
                  Retirar estas deudas (no tienen pagos ni entregas)
                </Checkbox>
              </>
            )}
            {change.keptWithPayments > 0 && (
              <div className="text-xs text-amber-700">{change.keptWithPayments} deuda(s) con pagos o entregas se conservan.</div>
            )}
          </div>
        )}
        {error && <Alert type="error" showIcon message={error} />}
      </div>
    </Modal>
  );
}
