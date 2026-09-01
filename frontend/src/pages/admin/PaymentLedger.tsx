import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  ChevronDown, Search, Banknote, Smartphone, Landmark, CreditCard, Hash,
  Plus, X, DollarSign, TrendingUp, AlertTriangle,
} from 'lucide-react';
import { useSchool } from '@/context/SchoolContext';
import {
  getLedgerSections, getLedgerBySection,
  createPayment, createCharge, deletePayment,
  type LedgerStudent, type LedgerSection,
} from '@/services/paymentsService';

// ── Constants ──
const MONTHS = ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'];
const MONTH_FULL: Record<string, string> = {
  Sep: 'Septiembre', Oct: 'Octubre', Nov: 'Noviembre', Dec: 'Diciembre',
  Jan: 'Enero', Feb: 'Febrero', Mar: 'Marzo', Apr: 'Abril',
  May: 'Mayo', Jun: 'Junio', Jul: 'Julio', Aug: 'Agosto',
};
const NAME_COL = 468;
const MONTH_COL = 143;
const METHODS = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'pago_movil', label: 'Pago Móvil' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'zelle', label: 'Zelle' },
  { value: 'tarjeta', label: 'Tarjeta' },
  { value: 'otro', label: 'Otro' },
];
const METHOD_ICON: Record<string, any> = {
  pago_movil: Smartphone, efectivo: Banknote, transferencia: Landmark,
  zelle: CreditCard, tarjeta: CreditCard, otro: Hash,
};

const STATUS: Record<string, { fill: string; text: string }> = {
  paid: { fill: '#79C08C', text: '#1A4D2E' },
  partial: { fill: '#F0BE55', text: '#7A4E00' },
  overdue: { fill: '#E2897F', text: '#7A1E14' },
  none: { fill: '#EDEEF1', text: '#8B909A' },
};

function getCurrentMonth(): string {
  const m = new Date().getMonth(); // 0-based
  // Map Jan(0)→Jan, Feb(1)→Feb, ... Aug(7)→Aug, Sep(8)→Sep, ... Dec(11)→Dec
  const map = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return map[m];
}
const CURRENT_MONTH = getCurrentMonth();

function statusFor(paid: number, charged: number, month: string): keyof typeof STATUS {
  if (charged <= 0) {
    // No charge yet — if month is past, it's overdue (missing charge)
    const idx = MONTHS.indexOf(month);
    const curIdx = MONTHS.indexOf(CURRENT_MONTH);
    return idx < curIdx ? 'overdue' : 'none';
  }
  const ratio = paid / charged;
  if (ratio >= 1) return 'paid';
  if (ratio > 0) return 'partial';
  const idx = MONTHS.indexOf(month);
  const curIdx = MONTHS.indexOf(CURRENT_MONTH);
  return idx < curIdx ? 'overdue' : 'none';
}

function initials(name: string): string {
  const parts = name.split(/[\s,]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0]?.slice(0, 2).toUpperCase() ?? '??';
}

// ── Sub-components ──

function MonthCell({ paid, charged, month, onClick, isOpen }: {
  paid: number; charged: number; month: string; onClick: () => void; isOpen: boolean;
}) {
  const pct = charged > 0 ? Math.min(Math.round((paid / charged) * 100), 100) : 0;
  const status = statusFor(paid, charged, month);
  const s = STATUS[status];
  const fillWidth = status === 'paid' ? 100 : pct;
  const hasData = charged > 0 || paid > 0;

  return (
    <button
      onClick={onClick}
      style={{ width: MONTH_COL }}
      className={`relative h-16 border-r border-b border-[#DBDEE4] flex items-center justify-center overflow-hidden
        transition-shadow focus:outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2F5EA8]
        ${isOpen ? 'ring-2 ring-inset ring-[#2F5EA8]' : ''} ${!hasData ? 'bg-[repeating-linear-gradient(135deg,#F4F5F8,#F4F5F8_4px,#EDEEF1_4px,#EDEEF1_8px)]' : ''}`}
    >
      {hasData && (
        <span className="absolute inset-y-0 left-0" style={{ width: `${fillWidth}%`, backgroundColor: s.fill }} />
      )}
      {hasData ? (
        <span className="relative text-[13px] font-semibold tabular-nums" style={{ color: s.text }}>{pct}%</span>
      ) : (
        <Plus size={14} className="text-transparent hover:text-[#9AA1AC] transition-colors" />
      )}
    </button>
  );
}

function TransactionRow({ txn, index, onDelete }: { txn: any; index: number; onDelete?: () => void }) {
  const Icon = METHOD_ICON[txn.method] || Hash;
  return (
    <div className={`group flex items-stretch text-sm ${index % 2 === 1 ? 'bg-[#F4F5F8]' : 'bg-white'}`}>
      <div className="w-9 shrink-0 border-r border-[#E4E6EB] flex items-center justify-center py-2">
        <Icon size={13} className="text-[#5B6472]" />
      </div>
      <div className="w-24 shrink-0 border-r border-[#E4E6EB] flex items-center px-2.5 text-[#6B7280] tabular-nums text-xs py-2">
        {txn.paymentDate ? new Date(txn.paymentDate).toLocaleDateString('es-VE') : '—'}
      </div>
      <div className="w-32 shrink-0 border-r border-[#E4E6EB] flex items-center px-2.5 py-2 text-xs">
        {METHODS.find(m => m.value === txn.method)?.label ?? txn.method}
      </div>
      <div className="w-36 shrink-0 border-r border-[#E4E6EB] flex flex-col justify-center px-2.5 py-2 tabular-nums font-medium text-[#0F7A45]">
        {Number(txn.amount).toFixed(2)} {txn.currency}
        {txn.currency === 'VES' && txn.amountVES != null && (
          <span className="text-[10px] font-normal text-[#9CA3AF] tabular-nums">Bs. {Number(txn.amountVES).toLocaleString('es-VE')}</span>
        )}
      </div>
      <div className="w-32 shrink-0 border-r border-[#E4E6EB] flex items-center px-2.5 text-xs font-mono text-[#6B7280] py-2">
        {txn.reference || '—'}{txn.bank ? ` · ${txn.bank}` : ''}
      </div>
      <div className="flex-1 flex items-center px-2.5 text-xs font-mono text-[#B7BBC3] py-2">#{txn.id}</div>
      {onDelete && (
        <div className="flex items-center pr-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onDelete} className="text-[#E2897F] hover:text-[#7A1E14] text-xs" title="Eliminar pago">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

function MonthDetail({ month, data, monthlyFee, onAddPayment, onDeletePayment }: {
  month: string;
  data: { charges: any[]; payments: any[]; totalCharged: number; totalPaid: number } | undefined;
  monthlyFee: { amount: number; currency: string } | null;
  onAddPayment: () => void;
  onDeletePayment: (paymentId: number) => void;
}) {
  const paid = data?.totalPaid ?? 0;
  const charged = data?.totalCharged ?? 0;
  const remaining = Math.max(charged - paid, 0);
  const overflow = Math.max(paid - charged, 0);
  const feeAmount = monthlyFee?.amount ?? 0;
  const feeCurrency = monthlyFee?.currency ?? 'USD';

  return (
    <div className="border-b-2 border-[#B9BEC7] bg-[#FAFBFC]">
      <div className="flex items-center gap-4 px-3 py-2 border-b border-[#E4E6EB] flex-wrap">
        <span className="text-xs font-semibold text-[#14181F] uppercase tracking-wide">{MONTH_FULL[month]}</span>
        {charged > 0 && (
          <span className="text-xs text-[#6B7280]">Cuota <b className="text-[#14181F] font-semibold">{charged.toFixed(2)} {feeCurrency}</b></span>
        )}
        <span className="text-xs text-[#0F7A45]">Pagado <b className="font-semibold">{paid.toFixed(2)} {feeCurrency}</b></span>
        {remaining > 0 && <span className="text-xs text-[#8A5A00]">Falta <b className="font-semibold">{remaining.toFixed(2)} {feeCurrency}</b></span>}
        {overflow > 0 && <span className="text-xs text-[#2F5EA8]">Excedente <b className="font-semibold">{overflow.toFixed(2)} {feeCurrency}</b></span>}
        {charged === 0 && (
          <span className="text-xs text-[#8A5A00]">Sin cobro registrado — cuota esperada: <b>{feeAmount.toFixed(2)} {feeCurrency}</b></span>
        )}
        <button
          onClick={onAddPayment}
          className="ml-auto flex items-center gap-1 text-xs font-semibold text-[#2F5EA8] hover:bg-[#DCE5F7] px-2 py-1 border border-[#B7C7E6]"
        >
          <Plus size={13} /> Agregar pago
        </button>
      </div>
      {data?.payments?.length ? (
        <div>
          <div className="flex items-stretch text-[10px] font-semibold text-[#8B909A] uppercase tracking-wide bg-[#EDEEF1] border-b border-[#DBDEE4]">
            <div className="w-9 shrink-0 border-r border-[#DBDEE4] py-1.5" />
            <div className="w-24 shrink-0 border-r border-[#DBDEE4] px-2.5 py-1.5">Fecha</div>
            <div className="w-32 shrink-0 border-r border-[#DBDEE4] px-2.5 py-1.5">Método</div>
            <div className="w-36 shrink-0 border-r border-[#DBDEE4] px-2.5 py-1.5">Monto</div>
            <div className="w-32 shrink-0 border-r border-[#DBDEE4] px-2.5 py-1.5">Referencia</div>
            <div className="flex-1 px-2.5 py-1.5">ID</div>
          </div>
          {data.payments.map((t, i) => (
            <TransactionRow key={t.id} txn={t} index={i} onDelete={() => onDeletePayment(t.id)} />
          ))}
        </div>
      ) : (
        <p className="text-xs text-[#9CA3AF] py-3 px-3">Sin pagos registrados este mes.</p>
      )}
    </div>
  );
}

function yearProgress(student: LedgerStudent, monthlyFee: number): number {
  const monthsWithData = MONTHS.filter(m => student.months[m]);
  if (monthsWithData.length === 0) return 0;
  const paidTotal = monthsWithData.reduce((s, m) => s + Math.min(student.months[m].totalPaid, student.months[m].totalCharged || monthlyFee), 0);
  const dueTotal = monthsWithData.reduce((s, m) => s + (student.months[m].totalCharged || monthlyFee), 0);
  return dueTotal > 0 ? paidTotal / dueTotal : 0;
}

// ── Modal: Add Payment ──

const inputCls = 'w-full text-sm border border-[#C5CAD2] px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#2F5EA8] focus:border-[#2F5EA8]';

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-[10px] font-semibold text-[#8B909A] uppercase tracking-wide mb-1">{label}</span>
      {children}
    </label>
  );
}

function AddPaymentModal({ students, prefill, monthlyFee, onClose, onSubmit }: {
  students: LedgerStudent[];
  prefill: { studentId?: number; month?: string } | {};
  monthlyFee: { amount: number; currency: string } | null;
  onClose: () => void;
  onSubmit: (form: any) => void;
}) {
  const [form, setForm] = useState({
    studentId: (prefill as any).studentId || '',
    month: (prefill as any).month || '',
    currency: monthlyFee?.currency || 'USD',
    amount: '',
    amountVES: '',
    method: 'efectivo',
    reference: '',
    bank: '',
  });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.studentId || !form.amount) return;
    onSubmit(form);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-[#C5CAD2] w-full max-w-md shadow-lg">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#E4E6EB] bg-[#EDEEF1]">
          <h3 className="text-sm font-bold uppercase tracking-wide">Registrar nuevo pago</h3>
          <button onClick={onClose} className="text-[#6B7280] hover:text-[#14181F]"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 grid grid-cols-2 gap-3">
          <Field label="Estudiante" className="col-span-2">
            <select value={form.studentId} onChange={set('studentId')} required className={inputCls}>
              <option value="" disabled>Seleccionar…</option>
              {students.map(s => <option key={s.inscriptionId} value={s.inscriptionId}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Mes">
            <select value={form.month} onChange={set('month')} className={inputCls}>
              <option value="">Automática (al primer mes con deuda)</option>
              {MONTHS.map(m => <option key={m} value={m}>{MONTH_FULL[m]}</option>)}
            </select>
          </Field>
          <Field label="Método">
            <select value={form.method} onChange={set('method')} className={inputCls}>
              {METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </Field>
          <Field label="Moneda">
            <select value={form.currency} onChange={set('currency')} className={inputCls}>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="VES">VES (Bolívares)</option>
            </select>
          </Field>
          <Field label={`Monto (${form.currency})`}>
            <input type="number" step="0.01" min="0" value={form.amount} onChange={set('amount')} required
              placeholder="0.00" className={inputCls} />
          </Field>
          {form.currency === 'VES' && (
            <>
              <Field label="Banco">
                <input type="text" value={form.bank} onChange={set('bank')} placeholder="BCV, Banesco…" className={inputCls} />
              </Field>
            </>
          )}
          <Field label="Referencia" className={form.currency === 'VES' ? 'col-span-2' : 'col-span-2'}>
            <input type="text" value={form.reference} onChange={set('reference')} placeholder="N° confirmación" className={inputCls} />
          </Field>
          <div className="col-span-2 flex items-center justify-end gap-2 pt-2 border-t border-[#E4E6EB] mt-1">
            <button type="button" onClick={onClose} className="text-sm font-semibold px-3 py-1.5 border border-[#C5CAD2] hover:bg-[#F4F5F8]">
              Cancelar
            </button>
            <button type="submit" className="text-sm font-semibold px-3 py-1.5 bg-[#2F5EA8] text-white hover:bg-[#284F8E]">
              Registrar pago
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal: Add Charge (debt) ──

function AddChargeModal({ students, prefill, monthlyFee, onClose, onSubmit }: {
  students: LedgerStudent[];
  prefill: { studentId?: number; month?: string } | {};
  monthlyFee: { amount: number; currency: string } | null;
  onClose: () => void;
  onSubmit: (form: any) => void;
}) {
  const [form, setForm] = useState({
    studentId: (prefill as any).studentId || '',
    month: (prefill as any).month || CURRENT_MONTH,
    type: 'mensualidad',
    description: 'Mensualidad',
    amount: String(monthlyFee?.amount ?? ''),
    currency: monthlyFee?.currency || 'USD',
  });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(f => ({ ...f, [k]: e.target.value }));
    if (k === 'type') {
      const descMap: Record<string, string> = {
        mensualidad: 'Mensualidad', matricula: 'Matrícula',
        gastos_administrativos: 'Gastos Administrativos', item: 'Item vendible', otro: 'Otro',
      };
      setForm(f => ({ ...f, type: e.target.value, description: descMap[e.target.value] || '' }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.studentId || !form.amount || !form.description) return;
    onSubmit(form);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-[#C5CAD2] w-full max-w-md shadow-lg">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#E4E6EB] bg-[#EDEEF1]">
          <h3 className="text-sm font-bold uppercase tracking-wide">Registrar deuda / cobro</h3>
          <button onClick={onClose} className="text-[#6B7280] hover:text-[#14181F]"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 grid grid-cols-2 gap-3">
          <Field label="Estudiante" className="col-span-2">
            <select value={form.studentId} onChange={set('studentId')} required className={inputCls}>
              <option value="" disabled>Seleccionar…</option>
              {students.map(s => <option key={s.inscriptionId} value={s.inscriptionId}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Tipo de cobro">
            <select value={form.type} onChange={set('type')} className={inputCls}>
              <option value="mensualidad">Mensualidad</option>
              <option value="matricula">Matrícula</option>
              <option value="gastos_administrativos">Gastos Administrativos</option>
              <option value="item">Item vendible</option>
              <option value="otro">Otro</option>
            </select>
          </Field>
          <Field label="Mes (opcional)">
            <select value={form.month} onChange={set('month')} className={inputCls}>
              <option value="">— Sin mes —</option>
              {MONTHS.map(m => <option key={m} value={m}>{MONTH_FULL[m]}</option>)}
            </select>
          </Field>
          <Field label="Descripción" className="col-span-2">
            <input type="text" value={form.description} onChange={set('description')} required className={inputCls} />
          </Field>
          <Field label={`Monto (${form.currency})`}>
            <input type="number" step="0.01" min="0" value={form.amount} onChange={set('amount')} required
              placeholder="0.00" className={inputCls} />
          </Field>
          <Field label="Moneda">
            <select value={form.currency} onChange={set('currency')} className={inputCls}>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="VES">VES (Bolívares)</option>
            </select>
          </Field>
          <div className="col-span-2 flex items-center justify-end gap-2 pt-2 border-t border-[#E4E6EB] mt-1">
            <button type="button" onClick={onClose} className="text-sm font-semibold px-3 py-1.5 border border-[#C5CAD2] hover:bg-[#F4F5F8]">
              Cancelar
            </button>
            <button type="submit" className="text-sm font-semibold px-3 py-1.5 bg-[#8A5A00] text-white hover:bg-[#6B4500]">
              Registrar deuda
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Stat & Legend ──

function Stat({ label, value, icon }: { label: string; value: string | number; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col justify-center px-4 py-1.5">
      <span className="text-[9px] font-semibold text-[#8B909A] uppercase tracking-wide flex items-center gap-1">{icon}{label}</span>
      <span className="text-sm font-bold tabular-nums">{value}</span>
    </div>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="w-3 h-3 border border-black/10" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

// ── Main Component ──

export default function PaymentLedger() {
  const { viewPeriod } = useSchool();
  const schoolPeriodId = viewPeriod?.id;

  const [sections, setSections] = useState<LedgerSection[]>([]);
  const [selectedSection, setSelectedSection] = useState<LedgerSection | null>(null);
  const [students, setStudents] = useState<LedgerStudent[]>([]);
  const [monthlyFee, setMonthlyFee] = useState<{ amount: number; currency: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [paymentModal, setPaymentModal] = useState<{ studentId?: number; month?: string } | null>(null);
  const [chargeModal, setChargeModal] = useState<{ studentId?: number; month?: string } | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  // Load sections when period changes
  useEffect(() => {
    if (!schoolPeriodId) return;
    getLedgerSections(schoolPeriodId).then(setSections).catch(() => setSections([]));
    setSelectedSection(null);
  }, [schoolPeriodId]);

  // Load ledger data when section changes
  const loadLedger = useCallback(async () => {
    if (!schoolPeriodId || !selectedSection) return;
    setLoading(true);
    try {
      const res = await getLedgerBySection(schoolPeriodId, selectedSection.gradeId, selectedSection.sectionId);
      setStudents(res.students);
      setMonthlyFee(res.monthlyFee);
    } catch {
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, [schoolPeriodId, selectedSection]);

  useEffect(() => {
    loadLedger();
  }, [loadLedger]);

  const filteredStudents = useMemo(
    () => students.filter(s => s.name.toLowerCase().includes(query.toLowerCase())),
    [students, query]
  );

  const toggle = (inscriptionId: number, month: string) => {
    const key = `${inscriptionId}-${month}`;
    setOpenKey(prev => prev === key ? null : key);
  };

  const handleAddPayment = async (form: any) => {
    if (!schoolPeriodId) return;
    try {
      await createPayment({
        inscriptionId: Number(form.studentId),
        schoolPeriodId,
        month: form.month || undefined,
        amount: parseFloat(form.amount),
        currency: form.currency,
        amountVES: form.currency === 'VES' ? parseFloat(form.amount) : null,
        method: form.method,
        reference: form.reference || undefined,
        bank: form.bank || undefined,
      });
      setPaymentModal(null);
      if (form.month) {
        setOpenKey(`${form.studentId}-${form.month}`);
        setFlash(`Pago de ${form.amount} ${form.currency} registrado · ${MONTH_FULL[form.month]}`);
      } else {
        setFlash(`Pago de ${form.amount} ${form.currency} registrado · distribución automática`);
      }
      setTimeout(() => setFlash(null), 3500);
      loadLedger();
    } catch {
      setFlash('Error al registrar pago');
      setTimeout(() => setFlash(null), 3500);
    }
  };

  const handleAddCharge = async (form: any) => {
    if (!schoolPeriodId) return;
    try {
      await createCharge({
        inscriptionId: Number(form.studentId),
        schoolPeriodId,
        type: form.type,
        month: form.month || null,
        description: form.description,
        amount: parseFloat(form.amount),
        currency: form.currency,
      });
      setChargeModal(null);
      setFlash(`Deuda de ${form.amount} ${form.currency} registrada · ${MONTH_FULL[form.month] || 'no mensual'}`);
      setTimeout(() => setFlash(null), 3500);
      loadLedger();
    } catch {
      setFlash('Error al registrar deuda');
      setTimeout(() => setFlash(null), 3500);
    }
  };

  const handleDeletePayment = async (paymentId: number) => {
    try {
      await deletePayment(paymentId);
      setFlash('Pago eliminado');
      setTimeout(() => setFlash(null), 3500);
      loadLedger();
    } catch {
      setFlash('Error al eliminar pago');
      setTimeout(() => setFlash(null), 3500);
    }
  };

  const totalCollected = students.reduce((sum, s) =>
    sum + MONTHS.reduce((m, mo) => m + (s.months[mo]?.totalPaid ?? 0), 0), 0);
  const avgCompletion = students.length > 0
    ? Math.round(students.reduce((s, st) => s + yearProgress(st, monthlyFee?.amount ?? 0), 0) / students.length * 100)
    : 0;
  const tableWidth = NAME_COL + MONTHS.length * MONTH_COL;

  return (
    <div className="min-h-screen bg-[#EDEEF1] font-sans text-[#14181F] p-6">
      <div className="w-full">
        {/* toolbar */}
        <div className="flex items-stretch justify-between bg-white border border-[#C5CAD2] mb-px flex-wrap">
          <div className="flex items-center gap-3 px-4 py-3 border-r border-[#E4E6EB]">
            <span className="text-[10px] font-semibold text-[#8B909A] uppercase tracking-wide">Sección</span>
            <select
              value={selectedSection ? `${selectedSection.gradeId}-${selectedSection.sectionId}` : ''}
              onChange={e => {
                const [gid, sid] = e.target.value.split('-').map(Number);
                const found = sections.find(s => s.gradeId === gid && s.sectionId === sid);
                setSelectedSection(found ?? null);
              }}
              className="text-sm font-bold border border-[#C5CAD2] px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#2F5EA8]"
            >
              <option value="" disabled>Seleccionar…</option>
              {sections.map(s => (
                <option key={`${s.gradeId}-${s.sectionId}`} value={`${s.gradeId}-${s.sectionId}`}>{s.gradeName} — {s.sectionName}</option>
              ))}
            </select>
          </div>
          {selectedSection && (
            <div className="flex items-stretch divide-x divide-[#E4E6EB]">
              <Stat label="Recaudado" value={`${totalCollected.toFixed(0)} ${monthlyFee?.currency ?? ''}`} icon={<DollarSign size={10} />} />
              <Stat label="Cumplimiento" value={`${avgCompletion}%`} icon={<TrendingUp size={10} />} />
              <Stat label="Estudiantes" value={students.length} />
            </div>
          )}
          <div className="flex items-stretch flex-1 justify-end">
            {selectedSection && (
              <div className="flex items-center px-3 py-2 border-l border-[#E4E6EB]">
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                  <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Buscar estudiante…"
                    className="pl-8 pr-3 py-1.5 text-sm border border-[#C5CAD2] w-48
                      focus:outline-none focus:ring-2 focus:ring-[#2F5EA8] focus:border-[#2F5EA8] placeholder:text-[#9CA3AF]"
                  />
                </div>
              </div>
            )}
            {selectedSection && (
              <>
                <button
                  onClick={() => setChargeModal({})}
                  className="flex items-center gap-1.5 text-sm font-semibold text-white bg-[#8A5A00] hover:bg-[#6B4500] px-4 border-l border-[#6B4500]"
                >
                  <AlertTriangle size={15} /> Agregar deuda
                </button>
              </>
            )}
          </div>
        </div>

        {/* legend */}
        {selectedSection && (
          <div className="flex items-center gap-4 px-4 py-2 bg-white border-x border-b border-[#C5CAD2] text-xs text-[#6B7280] flex-wrap">
            <LegendSwatch color={STATUS.paid.fill} label="Al día" />
            <LegendSwatch color={STATUS.partial.fill} label="Parcial" />
            <LegendSwatch color={STATUS.overdue.fill} label="Atrasado" />
            <LegendSwatch color={STATUS.none.fill} label="Aún no vence" />
            <span className="text-[#C5CAD2]">|</span>
            <span>Clic en una celda para ver el detalle · hover en celdas vacías para agregar</span>
            {monthlyFee && (
              <span className="text-[#C5CAD2]">|</span>
            )}
            {monthlyFee && (
              <span>Cuota mensual: <b>{monthlyFee.amount.toFixed(2)} {monthlyFee.currency}</b></span>
            )}
          </div>
        )}

        {flash && (
          <div className="px-4 py-2 bg-[#E9F7ED] border-x border-b border-[#B7EACB] text-sm text-[#1A4D2E] font-medium">
            {flash}
          </div>
        )}

        {!selectedSection ? (
          <div className="bg-white border-x border-b border-[#C5CAD2] p-12 text-center text-[#8B909A]">
            Selecciona una sección para ver el ledger de pagos.
          </div>
        ) : loading ? (
          <div className="bg-white border-x border-b border-[#C5CAD2] p-12 text-center text-[#8B909A]">
            Cargando…
          </div>
        ) : students.length === 0 ? (
          <div className="bg-white border-x border-b border-[#C5CAD2] p-12 text-center text-[#8B909A]">
            No hay estudiantes inscritos en esta sección.
          </div>
        ) : (
          /* table */
          <div className="bg-white border-x border-b border-[#C5CAD2] overflow-hidden">
            <div className="overflow-x-auto">
              <div style={{ width: tableWidth }}>
                <div className="flex bg-[#EDEEF1] border-b-2 border-[#B9BEC7]">
                  <div style={{ width: NAME_COL }}
                    className="sticky left-0 z-20 bg-[#EDEEF1] px-4 py-2.5 text-[11px] font-semibold text-[#5B6472] uppercase tracking-wide border-r-2 border-[#B9BEC7]">
                    Estudiante
                  </div>
                  {MONTHS.map(m => (
                    <div key={m} style={{ width: MONTH_COL }}
                      className={`py-2.5 text-[11px] font-semibold text-center border-r border-[#DBDEE4] uppercase tracking-wide
                        ${m === CURRENT_MONTH ? 'bg-[#DCE5F7] text-[#2F5EA8]' : 'text-[#5B6472]'}`}>
                      {m}
                    </div>
                  ))}
                </div>

                {filteredStudents.map((student, rowIndex) => {
                  const progress = yearProgress(student, monthlyFee?.amount ?? 0);
                  const [openInscription, openMonth] = openKey?.split('-') ?? ['', ''];
                  const isOpen = openKey === `${student.inscriptionId}-${openMonth}` && openInscription === String(student.inscriptionId);
                  const rowBg = rowIndex % 2 === 1 ? 'bg-[#FAFBFC]' : 'bg-white';

                  return (
                    <div key={student.inscriptionId}>
                      <div className={`flex ${rowBg}`}>
                        <div style={{ width: NAME_COL }}
                          className={`sticky left-0 z-10 ${rowBg} flex items-stretch min-w-0 border-r-2 border-[#B9BEC7] border-b border-[#DBDEE4]`}>
                          {/* Name — 80% */}
                          <div className="flex items-center gap-2.5 min-w-0 flex-1 px-4 py-2.5">
                            <span className="text-[10px] font-bold w-6 h-6 rounded-sm flex items-center justify-center shrink-0 bg-[#DEDBFB] text-[#3730A3]">
                              {initials(student.name)}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium truncate leading-tight">{student.name}</div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="flex-1 h-1.5 bg-[#EDEEF1] border border-[#DBDEE4] overflow-hidden max-w-[90px]">
                                  <span className="block h-full bg-[#2F5EA8]" style={{ width: `${progress * 100}%` }} />
                                </span>
                                <span className="text-[10px] text-[#8B909A] tabular-nums shrink-0">{Math.round(progress * 100)}%</span>
                              </div>
                            </div>
                          </div>
                          {/* Pay button — ~10% */}
                          <button
                            onClick={() => setPaymentModal({ studentId: student.inscriptionId })}
                            className="flex items-center justify-center bg-[#2F5EA8] hover:bg-[#284F8E] transition-colors border-l border-[#284F8E] shrink-0"
                            style={{ width: '10%' }}
                            title="Registrar pago (distribución automática)"
                          >
                            <svg width="18" height="18" viewBox="0 0 251 229" fill="currentColor" className="text-white">
                              <path d="M245.2,133.4l-62,62c-7.2,7.5-18,12.8-29.4,12.8h-46.6c-5.9,0-11.2,2.3-15.1,6.2L76.6,229H6l67.9-68.8l-0.1-0.1c7.2-7.2,17.3-11.7,28.4-11.8h67c7.1,0,12.8,5.7,12.8,12.8c0,7.1-5.7,12.8-12.8,12.8h-54c-2.3-0.2-4.2,1.7-4.2,4.2s1.9,4.3,4.3,4.3h53.7c5.7,0.2,11.1-2.2,15.1-6.2c4-4,6.2-9.5,6.2-15.1c0.2-2.6-0.5-5.4-1.4-7.8l38.1-38.1c5.1-5.1,13.1-5.1,18.1-0.2C250.3,120.1,250.2,128.4,245.2,133.4z M69,69c0-37.2,29.8-67.4,67-67.4c37.2,0,67.2,30,67.2,67.2S173.1,136,136.1,136C99.1,136,69,106,69,69z M144.9,84.5c0,4.6-3.8,8-11.5,8c-7.2,0-13.9-2.5-18.2-4.6l-3.4,13.6c3.9,2.2,12,4.3,20,4.3V116h9.3v-10.5c13.6-3,20-11.1,20-21.6s-5.9-17-18.6-21.6C133.3,58.5,129,56.7,129,52c0-3.4,3.7-6.8,10.5-6.8c6.8,0,11.8,2.1,14.9,3.4l3.8-13.3c-4.1-2.2-9.7-3.8-17.4-3.8V21.1h-9.3v11.1c-12.4,2.5-19.2,10.5-19.2,20.8c0,11.1,7.7,17.3,20,21.6C141.2,78,144.9,79.9,144.9,84.5z"/>
                            </svg>
                          </button>
                        </div>

                        {MONTHS.map(m => {
                          const data = student.months[m];
                          const key = `${student.inscriptionId}-${m}`;
                          return (
                            <MonthCell
                              key={m}
                              paid={data?.totalPaid ?? 0}
                              charged={data?.totalCharged ?? 0}
                              month={m}
                              isOpen={openKey === key}
                              onClick={() => toggle(student.inscriptionId, m)}
                            />
                          );
                        })}
                      </div>

                      {isOpen && openMonth && (
                        <div className="flex">
                          <div style={{ width: NAME_COL }}
                            className="sticky left-0 z-10 bg-[#FAFBFC] border-r-2 border-[#B9BEC7] border-b-2 border-b-[#B9BEC7] flex items-start justify-end pt-2.5 pr-2">
                            <ChevronDown size={13} className="text-[#2F5EA8]" />
                          </div>
                          <div style={{ width: tableWidth - NAME_COL }}>
                            <MonthDetail
                              month={openMonth}
                              data={student.months[openMonth]}
                              monthlyFee={monthlyFee}
                              onAddPayment={() => setPaymentModal({ studentId: student.inscriptionId, month: openMonth })}
                              onDeletePayment={handleDeletePayment}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {selectedSection && students.length > 0 && (
          <p className="text-xs text-[#8B909A] mt-3">
            Cuota mensual: {monthlyFee ? `${monthlyFee.amount.toFixed(2)} ${monthlyFee.currency}` : 'no configurada'} ·
            los pagos parciales se acumulan dentro del mes.
            Clic en una celda para ver el detalle y agregar pagos.
          </p>
        )}
      </div>

      {paymentModal !== null && (
        <AddPaymentModal
          students={students}
          prefill={paymentModal}
          monthlyFee={monthlyFee}
          onClose={() => setPaymentModal(null)}
          onSubmit={handleAddPayment}
        />
      )}

      {chargeModal !== null && (
        <AddChargeModal
          students={students}
          prefill={chargeModal}
          monthlyFee={monthlyFee}
          onClose={() => setChargeModal(null)}
          onSubmit={handleAddCharge}
        />
      )}
    </div>
  );
}
