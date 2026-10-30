import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Dropdown, Modal, type MenuProps } from 'antd';
import DiscountsModal from './components/DiscountsModal';
import {
  ChevronDown, Search, Banknote, Smartphone, Landmark, CreditCard, Hash,
  Plus, X, DollarSign, TrendingUp, AlertTriangle,
  ArrowDownAZ, ArrowUpAZ, ArrowUpDown, MoreHorizontal, CalendarClock, BadgePercent,
  ArrowRightLeft, Shirt, Trash2, UserX, Check, PackageCheck, Phone, Mail, Users, FileText, FileSpreadsheet,
} from 'lucide-react';
import { ItemGlyph } from './itemIcons';
import PaymentsReportModal from './components/PaymentsReportModal';
import DmyDateInput from './components/DmyDateInput';
import InscriptionPlanModal from './components/InscriptionPlanModal';
import PaymentCorrectionModal, { type CorrectionMode } from './components/PaymentCorrectionModal';
import { useSchool } from '@/context/SchoolContext';
import {
  getLedgerSections, getLedgerBySection, searchWithdrawnStudents,
  createPayment, createCharge, bulkCreateCharges, updateEntryMonth, listSellableItems,
  deliverItemUnits, undoItemDelivery, deleteCharge,
  getRatesAtDate, listExchangeRateTypes, getSharedStudents, previewSharedPayment, createSharedPayment, listCurrencyDiscounts,
  type LedgerStudent, type LedgerSection, type SellableItem, type LedgerPriorPeriod, type LedgerBucket, type LedgerGuardian,
  type RateAtDate, type ExchangeRateType, type SharedStudent, type SharedPortion, type CurrencyDiscount,
  type DuplicatePaymentInfo, type WithdrawnStudentResult,
} from '@/services/paymentsService';
import { listBanks, type Bank } from '@/services/bankService';
import { billingMonthsOf } from '@/utils/billingMonths';
import { PAYMENT_METHODS, PAYMENT_CURRENCIES, methodDef, formatTotals } from './paymentMethods';

// ── Constants ──
const DEFAULT_MONTHS = ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'];
const MONTH_FULL: Record<string, string> = {
  Sep: 'Septiembre', Oct: 'Octubre', Nov: 'Noviembre', Dec: 'Diciembre',
  Jan: 'Enero', Feb: 'Febrero', Mar: 'Marzo', Apr: 'Abril',
  May: 'Mayo', Jun: 'Junio', Jul: 'Julio', Aug: 'Agosto',
};
// Pseudo-month key of the column that groups enrollment and other one-time debts.
const OTHER = '__other';
/**
 * Click-and-drag horizontal scrolling for a wide container (mouse only — touch
 * already scrolls natively). A drag past a few pixels swallows the click that
 * would otherwise open the cell under the cursor.
 */
function useDragScroll<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [dragging, setDragging] = useState(false);
  // Visible width of the scroll area (the detail panels are pinned inside it).
  const [viewWidth, setViewWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setViewWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const onMouseDown = useCallback((e: React.MouseEvent<T>) => {
    const el = ref.current;
    if (!el || e.button !== 0 || el.scrollWidth <= el.clientWidth) return;
    const startX = e.clientX;
    const startLeft = el.scrollLeft;
    let moved = false;
    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      if (!moved && Math.abs(dx) < 5) return;
      if (!moved) { moved = true; setDragging(true); }
      el.scrollLeft = startLeft - dx;
      ev.preventDefault();
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setDragging(false);
      if (moved) {
        const swallow = (ev: Event) => { ev.stopPropagation(); ev.preventDefault(); };
        window.addEventListener('click', swallow, { capture: true, once: true });
        setTimeout(() => window.removeEventListener('click', swallow, true), 0);
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);
  return { ref, onMouseDown, dragging, viewWidth };
}

const NAME_COL = 468;
const MONTH_COL = 143;
const METHODS = PAYMENT_METHODS;
const METHOD_ICON: Record<string, any> = {
  pago_movil: Smartphone, efectivo: Banknote, transferencia: Landmark,
  zelle: CreditCard, zinli: CreditCard, binance: Hash, bybit: Hash, okx: Hash,
  tarjeta: CreditCard, otro: Hash,
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

function statusFor(paid: number, charged: number, month: string, months: string[]): keyof typeof STATUS {
  if (charged <= 0) {
    // No charge yet — if month is past, it's overdue (missing charge)
    const idx = months.indexOf(month);
    const curIdx = months.indexOf(CURRENT_MONTH);
    return idx < curIdx ? 'overdue' : 'none';
  }
  const ratio = paid / charged;
  if (ratio >= 1) return 'paid';
  if (ratio > 0) return 'partial';
  const idx = months.indexOf(month);
  const curIdx = months.indexOf(CURRENT_MONTH);
  return idx < curIdx ? 'overdue' : 'none';
}

function initials(name: string): string {
  const parts = name.split(/[\s,]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0]?.slice(0, 2).toUpperCase() ?? '??';
}

// ── Sub-components ──

function MonthCell({ paid, charged, month, months, onClick, isOpen, forceStatus, corner, badges }: {
  paid: number; charged: number; month: string; months: string[]; onClick: () => void; isOpen: boolean;
  forceStatus?: keyof typeof STATUS;
  /** Small text pinned to the top-right corner (the student's pending debt in the last column). */
  corner?: React.ReactNode;
  /** Sellable-item badges pinned to the top-left corner (purchases of this month). */
  badges?: React.ReactNode;
}) {
  const pct = charged > 0 ? Math.min(Math.round((paid / charged) * 100), 100) : 0;
  const status = forceStatus ?? statusFor(paid, charged, month, months);
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
      {corner && (
        <span className="absolute top-0.5 right-1 text-[9px] leading-none font-semibold tabular-nums pointer-events-none">{corner}</span>
      )}
      {badges && (
        <span className="absolute top-0.5 left-1 flex items-center gap-0.5">{badges}</span>
      )}
      {hasData ? (
        <span className="relative text-[13px] font-semibold tabular-nums" style={{ color: s.text }}>{pct}%</span>
      ) : (
        <Plus size={14} className="text-transparent hover:text-[#9AA1AC] transition-colors" />
      )}
    </button>
  );
}

function TransactionRow({ txn, index, onCorrect, bucketChargeIds }: {
  txn: any; index: number; onCorrect?: (mode: CorrectionMode) => void;
  /** Charges shown in the enclosing block: allocations outside it are flagged as "also covered other debts". */
  bucketChargeIds?: Set<number>;
}) {
  const Icon = METHOD_ICON[txn.method] || Hash;
  const allocs: any[] = txn.allocations ?? [];
  const isOutside = (a: any) => !!bucketChargeIds && bucketChargeIds.size > 0 && !bucketChargeIds.has(a.chargeId);
  const ownAllocs = allocs.filter(a => !isOutside(a));
  const otherAllocs = allocs.filter(isOutside);
  const renderAlloc = (a: any, i: number) => (
    <span key={i} className="block truncate">
      → {Number(a.amount).toFixed(2)} {a.charge?.currency ?? '—'}
      {a.charge?.description ? ` · ${a.charge.description}` : ''}
      {a.atPar ? ' · a la par' : ''}
      {Number(a.bonus) > 0.005 && (
        <span className="text-[#0F7A45]"> · incl. {Number(a.bonus).toFixed(2)} {a.charge?.currency ?? ''} de descuento{a.currencyDiscount?.name ? ` (${a.currencyDiscount.name})` : ''}</span>
      )}
    </span>
  );
  return (
    <div className={`group flex flex-wrap items-stretch text-sm ${index % 2 === 1 ? 'bg-[#F4F5F8]' : 'bg-white'}`}>
      <div className="w-9 shrink-0 border-r border-[#E4E6EB] flex items-center justify-center py-2">
        <Icon size={13} className="text-[#5B6472]" />
      </div>
      <div className="w-24 shrink-0 border-r border-[#E4E6EB] flex items-center px-2.5 text-[#6B7280] tabular-nums text-xs py-2">
        {txn.paymentDate ? new Date(txn.paymentDate).toLocaleDateString('en-GB') : '—'}
      </div>
      <div className="flex-1 @[800px]:flex-none min-w-0 @[800px]:w-32 @[800px]:shrink-0 border-r border-[#E4E6EB] flex items-center px-2.5 py-2 text-xs">
        {METHODS.find(m => m.value === txn.method)?.label ?? txn.method}
      </div>
      <div className="order-5 @[800px]:order-none flex-1 basis-40 min-w-0 @[800px]:flex-none @[800px]:w-36 @[800px]:shrink-0 border-r border-[#E4E6EB] flex flex-col justify-center px-2.5 py-2 tabular-nums font-medium text-[#0F7A45]">
        {txn.sharedWith?.length > 0 ? (() => {
          // Shared payment: the operation total on top, this student's share
          // below, then every other student's share — each with its conversion.
          const conv = (p: any) => p.currency === 'VES'
            ? (p.equivalent != null && p.equivalentCurrency && p.equivalentCurrency !== p.currency
                ? `= ${Number(p.equivalent).toFixed(2)} ${p.equivalentCurrency}${p.atPar ? ' · a la par' : ''}` : null)
            : (p.amountVES != null ? `Bs. ${Number(p.amountVES).toLocaleString('es-VE')}` : null);
          const parts = [{ amount: txn.amount, currency: txn.currency, amountVES: txn.amountVES, equivalent: txn.equivalent, equivalentCurrency: txn.equivalentCurrency }, ...txn.sharedWith];
          const total = parts.reduce((s: number, p: any) => s + Number(p.amount), 0);
          const totalVES = parts.every(p => p.amountVES != null) ? parts.reduce((s: number, p: any) => s + Number(p.amountVES), 0) : null;
          const equivCurrencies = [...new Set(parts.filter(p => p.equivalent != null && p.equivalentCurrency && p.equivalentCurrency !== p.currency).map(p => p.equivalentCurrency))];
          const totalEquiv = equivCurrencies.length === 1
            ? parts.reduce((s: number, p: any) => s + (p.equivalentCurrency === equivCurrencies[0] ? Number(p.equivalent ?? 0) : 0), 0)
            : null;
          const totalConv = txn.currency === 'VES'
            ? (totalEquiv != null ? `= ${totalEquiv.toFixed(2)} ${equivCurrencies[0]}` : null)
            : (totalVES != null ? `Bs. ${totalVES.toLocaleString('es-VE')}` : null);
          const ownConv = conv(txn);
          return (
            <>
              <span title="Total del pago compartido (una sola operación repartida entre varios estudiantes)">
                Total: {total.toFixed(2)} {txn.currency}
                {totalConv && <span className="text-[10px] font-normal text-[#9CA3AF]"> ({totalConv})</span>}
              </span>
              <span className="text-[10px] font-semibold text-[#374151] tabular-nums" title="Parte adjudicada a este estudiante">
                Este estudiante: {Number(txn.amount).toFixed(2)} {txn.currency}{ownConv ? ` (${ownConv})` : ''}
              </span>
              {txn.sharedWith.map((o: any) => (
                <span key={o.paymentId} className="text-[10px] font-semibold text-[#2F5EA8] leading-tight" title="Parte adjudicada a otro estudiante de este mismo pago">
                  {o.name}: {Number(o.amount).toFixed(2)} {o.currency}{conv(o) ? ` (${conv(o)})` : ''}
                </span>
              ))}
            </>
          );
        })() : (
          <>
            {Number(txn.amount).toFixed(2)} {txn.currency}
            {txn.currency === 'VES' && txn.amountVES != null && (
              <span className="text-[10px] font-normal text-[#9CA3AF] tabular-nums">
                Bs. {Number(txn.amountVES).toLocaleString('es-VE')}
                {txn.equivalent != null && txn.equivalentCurrency && txn.equivalentCurrency !== txn.currency && (
                  <span title="Equivalente total en la moneda de la deuda, a la tasa de la fecha del pago"> ({Number(txn.equivalent).toFixed(2)} {txn.equivalentCurrency})</span>
                )}
              </span>
            )}
            {txn.currency !== 'VES' && txn.equivalent != null && txn.equivalentCurrency && txn.equivalentCurrency !== txn.currency && (
              <span className="text-[10px] font-semibold text-[#1A7A3E] tabular-nums" title={txn.atPar ? 'Dólares acreditados 1:1 contra una deuda en euros' : 'Equivalente total en la moneda de la deuda, a la tasa de la fecha del pago'}>
                = {Number(txn.equivalent).toFixed(2)} {txn.equivalentCurrency}{txn.atPar ? ' · a la par' : ''}
              </span>
            )}
          </>
        )}
        {allocs.length > 0 && (
          <span className="text-[10px] font-normal text-[#5B6472] tabular-nums leading-tight" title="Reparto del pago entre las deudas">
            {ownAllocs.map(renderAlloc)}
            {otherAllocs.length > 0 && (
              <span className="block mt-0.5 pt-0.5 border-t border-dashed border-[#C9CED6]">
                <span className="block font-semibold text-[#8A5A00] whitespace-normal">
                  Este pago también cubrió otras deudas (en otro bloque):
                </span>
                <span className="block text-[#8B909A]">{otherAllocs.map(renderAlloc)}</span>
              </span>
            )}
          </span>
        )}
      </div>
      <div className={`order-7 @[800px]:order-none w-full @[800px]:w-44 shrink-0 border-r border-[#E4E6EB] ${txn.reference || txn.bank || txn.account ? 'flex' : 'hidden @[800px]:flex'} flex-col justify-center px-2.5 text-xs text-[#6B7280] py-2 min-w-0`}>
        <span className="font-mono truncate">{txn.reference || '—'}</span>
        {(txn.bank || txn.account) && <span className="text-[10px] truncate" title={txn.bank || txn.account}>{txn.bank || txn.account}</span>}
      </div>
      <div className="order-6 @[800px]:order-none w-36 @[800px]:w-44 shrink-0 border-r border-[#E4E6EB] flex items-center px-2.5 text-xs text-[#4B5563] py-2 min-w-0">
        <span className="truncate" title={txn.registeredBy ? 'Pago registrado por este administrador' : 'Sin registro de quién lo cargó'}>
          {txn.registeredBy ? `${txn.registeredBy.firstName} ${txn.registeredBy.lastName}` : '—'}
        </span>
      </div>
      <div className="order-4 @[800px]:order-none @[800px]:flex-1 shrink-0 flex items-center justify-end @[800px]:justify-start gap-1 px-2.5 text-xs font-mono text-[#B7BBC3] py-2">
      <span className="mr-auto">#{txn.id}</span>
      {onCorrect && (
        <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onCorrect('move')} className="p-1 text-[#2F5EA8] hover:bg-[#DCE5F7]" title="Cambiar de estudiante (se cargó al estudiante equivocado)">
            <ArrowRightLeft size={14} />
          </button>
          <button onClick={() => onCorrect('destination')} className="p-1 text-[#8A5A00] hover:bg-[#F8EBCF]" title="Cambiar destino (p. ej. de mensualidades a uniformes)">
            <Shirt size={14} />
          </button>
          <button onClick={() => onCorrect('delete')} className="p-1 text-[#C0453A] hover:bg-[#FBE3E0]" title="Eliminar pago">
            <Trash2 size={14} />
          </button>
        </div>
      )}
      </div>
    </div>
  );
}

// ── Guardian card in the expanded row's empty column ──

const RELATIONSHIP_LABEL: Record<string, string> = {
  mother: 'Madre', father: 'Padre', sibling: 'Hermano/a',
  grandparent: 'Abuelo/a', uncle_aunt: 'Tío/a', representative: 'Representante', benefactor: 'Benefactor',
};

/** Contact card of the student's guardians, shown under their name in the expanded detail row. */
function GuardianPanel({ guardians, ownPending }: { guardians: LedgerGuardian[]; ownPending: Record<string, number> }) {
  if (!guardians?.length) {
    return <div className="px-3 pb-2 text-[10px] italic text-[#9CA3AF]">Sin representante registrado</div>;
  }
  const docPrefix = (g: LedgerGuardian) =>
    g.documentType === 'Venezolano' ? 'V-' : g.documentType === 'Extranjero' ? 'E-' : g.documentType === 'Pasaporte' ? 'P-' : '';
  const digits = (v?: string | null) => (v ?? '').replace(/\D/g, '');
  // Phone lines: skip phone2/whatsapp repeats; a whatsapp matching a shown
  // number flags that line as WhatsApp instead of printing it twice.
  const phoneLines = (g: LedgerGuardian) => {
    const byDigit = new Map<string, { value: string; whatsapp: boolean }>();
    for (const [value, whatsapp] of [[g.phone, false], [g.phone2, false], [g.whatsapp, true]] as const) {
      const d = digits(value);
      if (!d) continue;
      const hit = byDigit.get(d);
      if (hit) hit.whatsapp ||= whatsapp;
      else byDigit.set(d, { value: value as string, whatsapp });
    }
    return [...byDigit.values()];
  };
  return (
    <div className="px-3 pb-3 space-y-3 min-w-0">
      {guardians.map((g, i) => (
        <div key={i} className="min-w-0">
          <div className="text-[9px] font-semibold uppercase tracking-wide text-[#8B909A]">
            {[...g.relationships.map(r => RELATIONSHIP_LABEL[r] ?? 'Representante'),
              ...(g.isBenefactor && !g.relationships.includes('benefactor') ? ['Benefactor'] : [])].join(' · ')}
          </div>
          <div className="text-[12px] font-medium text-[#1F2937] leading-tight" title={`${g.firstName} ${g.lastName}`}>
            {g.firstName} {g.lastName}
          </div>
          {g.document && <div className="text-[10px] text-[#6B7280] tabular-nums">{docPrefix(g)}{g.document}</div>}
          {phoneLines(g).map((p, j) => (
            <div key={j} className="flex items-center gap-1 text-[10px] text-[#4B5563] min-w-0">
              {p.whatsapp
                ? <Smartphone size={10} className="shrink-0 text-[#9CA3AF]" />
                : <Phone size={10} className="shrink-0 text-[#9CA3AF]" />}
              <span className="truncate">{p.value}{p.whatsapp ? ' · WhatsApp' : ''}</span>
            </div>
          ))}
          {g.email && (
            <div className="flex items-center gap-1 text-[10px] text-[#4B5563] min-w-0">
              <Mail size={10} className="shrink-0 text-[#9CA3AF]" /><span className="truncate" title={g.email}>{g.email}</span>
            </div>
          )}
          {g.alsoRepresents?.length > 0 && (
            <div className="mt-1.5 border-t border-[#E4E6EB] pt-1.5 min-w-0">
              <div className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide text-[#9CA3AF]">
                <Users size={10} className="shrink-0" /> {g.isBenefactor && !g.isRepresentative ? 'También paga por' : 'También representa a'}
              </div>
              {g.alsoRepresents.map(s => (
                <div key={s.personId} className="text-[10px] text-[#4B5563] leading-snug" title={`${s.name}${s.where ? ` — ${s.where}` : ''}`}>
                  <div className="truncate">{s.name}{s.where ? <span className="text-[#9CA3AF]"> — {s.where}</span> : ''}</div>
                  {Object.keys(s.pending ?? {}).length > 0 && (
                    <div className="text-[#B42318] tabular-nums">Debe {formatTotals(s.pending!)}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      {(() => {
        // One grand total for who answers for the debt: the representative and the benefactor
        // (the person who pays), each student counted once however many cards list them.
        const payers = guardians.filter(g => g.isRepresentative || g.isBenefactor);
        const group = payers.length ? payers : guardians;
        const students = new Map<number, { pending?: Record<string, number> }>();
        for (const g of group) for (const s of g.alsoRepresents ?? []) students.set(s.personId, s);
        if (students.size === 0) return null;
        const total: Record<string, number> = { ...ownPending };
        for (const s of students.values()) for (const [cur, v] of Object.entries(s.pending ?? {})) total[cur] = (total[cur] ?? 0) + v;
        const owes = Object.values(total).some(v => v > 0.005);
        const withBenefactor = group.some(g => g.isBenefactor);
        return (
          <div className={`px-2 py-1 text-[10px] font-semibold tabular-nums border ${owes ? 'bg-[#FDECEA] border-[#F2B8B2] text-[#B42318]' : 'bg-[#E9F7ED] border-[#B7EACB] text-[#1A4D2E]'}`}
            title="Suma de la deuda pendiente de todos los estudiantes del representante y del benefactor, sin repetir ninguno, incluido este estudiante">
            Deuda total del representante{withBenefactor ? ' y benefactor' : ''}: {owes ? formatTotals(total) : 'sin deuda'}
          </div>
        );
      })()}
    </div>
  );
}

/** Unpaid amount of a bucket (summed over its debt currencies, never negative per currency). */
function pendingOf(data?: { totalCharged?: number; totalPaid?: number; byCurrency?: Record<string, { charged: number; paid: number }> } | null): number {
  if (!data) return 0;
  return data.byCurrency && Object.keys(data.byCurrency).length
    ? Object.values(data.byCurrency).reduce((s, v) => s + Math.max(v.charged - v.paid, 0), 0)
    : Math.max((data.totalCharged ?? 0) - (data.totalPaid ?? 0), 0);
}

/** PENDIENTE / SALDADO tag shown on every debt section header. */
function StateChip({ pending, charged }: { pending: number; charged: number }) {
  if (pending > 0.005) {
    return <span className="text-[10px] font-bold tracking-wide px-1.5 py-0.5 bg-[#B42318] text-white">PENDIENTE</span>;
  }
  return charged > 0
    ? <span className="text-[10px] font-bold tracking-wide px-1.5 py-0.5 bg-[#0F7A45] text-white">SALDADO</span>
    : null;
}

/** Emphasized "Falta X" amount: the one number the user is looking for. */
const MISSING_CLS = 'text-sm text-[#B42318] bg-[#FDECEA] border border-[#F2B8B2] px-2 py-0.5';

/** Sub-section divider inside a debt block ("Deudas" / "Pagos registrados"). */
function SubsectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#5B6472] bg-[#EEF0F4] border-y border-[#DBDEE4]">
      {children}
    </div>
  );
}

function MonthDetail({ month, data, monthlyFee, onAddPayment, onCorrectPayment, onChanged, label }: {
  month: string;
  data: { charges: any[]; payments: any[]; currency?: string | null; totalCharged: number; totalPaid: number; grossCharged?: number; totalDiscount?: number; byCurrency?: Record<string, { charged: number; paid: number }> } | undefined;
  monthlyFee: { amount: number; currency: string } | null;
  onAddPayment: () => void;
  onCorrectPayment: (txn: any, mode: CorrectionMode) => void;
  onChanged: () => void;
  label?: string;
}) {
  const paid = data?.totalPaid ?? 0;
  const charged = data?.totalCharged ?? 0;
  const remaining = Math.max(charged - paid, 0);
  const overflow = Math.max(paid - charged, 0);
  const feeAmount = monthlyFee?.amount ?? 0;
  // Header amounts display in the bucket's own currency — the single
  // byCurrency key when present (a EUR enrollment under USD monthly fees),
  // falling back to the bucket currency and then the expected fee's.
  const bucketCurrencies = Object.keys(data?.byCurrency ?? {});
  const feeCurrency = (bucketCurrencies.length === 1 ? bucketCurrencies[0] : null)
    ?? data?.currency ?? monthlyFee?.currency ?? 'USD';
  const title = label ?? (month === OTHER ? 'Inscripción y otros' : MONTH_FULL[month]);

  const pendingTotal = pendingOf(data);
  const hasPending = pendingTotal > 0.005;

  return (
    <div className={`border-b-4 border-[#B9BEC7] border-l-4 bg-[#FAFBFC] ${hasPending ? 'border-l-[#B42318]' : charged > 0 ? 'border-l-[#0F7A45]' : 'border-l-[#B9BEC7]'}`}>
      <div className={`flex items-center gap-4 px-3 py-2 border-b border-[#E4E6EB] flex-wrap ${hasPending ? 'bg-[#FFF6F4]' : charged > 0 ? 'bg-[#F1F8F3]' : ''}`}>
        <span className="text-sm font-bold text-[#14181F] uppercase tracking-wide">{title}</span>
        <StateChip pending={pendingTotal} charged={charged} />
        {charged > 0 && (
          <span className="text-xs text-[#6B7280]">{month === OTHER ? 'Total' : 'Cuota'} <b className="text-[#14181F] font-semibold">{charged.toFixed(2)} {feeCurrency}</b></span>
        )}
        {(data?.totalDiscount ?? 0) > 0 && (
          <span className="text-xs text-[#0F7A45]">Descuento <b className="font-semibold">-{(data!.totalDiscount ?? 0).toFixed(2)} {feeCurrency}</b></span>
        )}
        {Object.keys(data?.byCurrency ?? {}).length > 1 ? (
          <>
            <span className="text-xs text-[#0F7A45]">Pagado <b className="font-semibold">
              {Object.entries(data!.byCurrency!).map(([c, v]) => `${v.paid.toFixed(2)} ${c}`).join(' + ')}
            </b></span>
            {Object.entries(data!.byCurrency!).map(([c, v]) => {
              const r = Math.max(v.charged - v.paid, 0);
              return r > 0.005 ? <span key={c} className={MISSING_CLS}>Falta <b className="font-bold">{r.toFixed(2)} {c}</b></span> : null;
            })}
          </>
        ) : (
          <>
            <span className="text-xs text-[#0F7A45]">Pagado <b className="font-semibold">{paid.toFixed(2)} {feeCurrency}</b></span>
            {remaining > 0 && <span className={MISSING_CLS}>Falta <b className="font-bold">{remaining.toFixed(2)} {feeCurrency}</b></span>}
            {overflow > 0 && <span className="text-xs text-[#2F5EA8]">Excedente <b className="font-semibold">{overflow.toFixed(2)} {feeCurrency}</b></span>}
          </>
        )}
        {charged === 0 && month !== OTHER && (
          <span className="text-xs text-[#8A5A00]">Sin cobro registrado — cuota esperada: <b>{feeAmount.toFixed(2)} {feeCurrency}</b></span>
        )}
        {charged === 0 && month === OTHER && (
          <span className="text-xs text-[#8A5A00]">Sin deudas de inscripción u otros conceptos.</span>
        )}
        <button
          onClick={onAddPayment}
          className="ml-auto flex items-center gap-1 text-xs font-semibold text-[#2F5EA8] hover:bg-[#DCE5F7] px-2 py-1 border border-[#B7C7E6]"
        >
          <Plus size={13} /> Agregar pago
        </button>
      </div>
      {data?.charges?.length ? (
        <div className="border-b border-[#E4E6EB] bg-white">
          <SubsectionLabel>Deudas</SubsectionLabel>
          {(() => { const paidBy = chargePaidBy(data); return data.charges.map((c: any) => {
            const net = Math.round((Number(c.amount) - Number(c.discountAmount ?? 0)) * 100) / 100;
            const paid = Math.min(paidBy.get(c.id) ?? 0, net);
            const pending = Math.max(net - paid, 0);
            return (
            <div key={c.id} className={`px-3 py-1.5 text-xs border-b border-[#F0F1F4] last:border-b-0 ${pending > 0.005 ? 'bg-[#FFFBFA]' : ''}`}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                <span className="flex-1 basis-48 min-w-0 break-words">{c.description}</span>
                <span className="tabular-nums text-[#6B7280]">
                  {c.discountAmount > 0 ? `${Number(c.amount).toFixed(2)} −${Number(c.discountAmount).toFixed(2)} = ` : ''}
                  <b className="font-semibold text-[#14181F]">{net.toFixed(2)} {c.currency}</b>
                </span>
                <span className="tabular-nums text-[#0F7A45] min-w-24 text-right">
                  {paid > 0.005 ? `Pagado ${paid.toFixed(2)}` : ''}
                </span>
                <span className="tabular-nums text-[#B42318] font-bold min-w-24 text-right">
                  {pending > 0.005 ? `Falta ${pending.toFixed(2)}` : ''}
                </span>
                <DeleteChargeButton charge={c} paid={paid} onChanged={onChanged} />
              </div>
              {c.type === 'item' && <ChargeDeliveries charge={c} onChanged={onChanged} />}
            </div>
            );
          }); })()}
        </div>
      ) : null}
      {data?.payments?.length ? (
        <div>
          <SubsectionLabel>Pagos registrados ({data.payments.length})</SubsectionLabel>
          <div className="hidden @[800px]:flex items-stretch text-[10px] font-semibold text-[#8B909A] uppercase tracking-wide bg-[#EDEEF1] border-b border-[#DBDEE4]">
            <div className="w-9 shrink-0 border-r border-[#DBDEE4] py-1.5" />
            <div className="w-24 shrink-0 border-r border-[#DBDEE4] px-2.5 py-1.5">Fecha</div>
            <div className="w-32 shrink-0 border-r border-[#DBDEE4] px-2.5 py-1.5">Método</div>
            <div className="w-36 shrink-0 border-r border-[#DBDEE4] px-2.5 py-1.5">Monto</div>
            <div className="w-44 shrink-0 border-r border-[#DBDEE4] px-2.5 py-1.5">Referencia / Banco o cuenta</div>
            <div className="w-44 shrink-0 border-r border-[#DBDEE4] px-2.5 py-1.5">Registró</div>
            <div className="flex-1 px-2.5 py-1.5">ID</div>
          </div>
          {data.payments.map((t, i) => (
            <TransactionRow key={t.id} txn={t} index={i} onCorrect={(mode) => onCorrectPayment(t, mode)}
              bucketChargeIds={new Set((data.charges ?? []).map((c: any) => c.id))} />
          ))}
        </div>
      ) : (
        <p className="text-xs text-[#9CA3AF] py-3 px-3">{month === OTHER ? 'Sin pagos registrados para estos conceptos.' : 'Sin pagos registrados este mes.'}</p>
      )}
    </div>
  );
}

// ── Prior-period debts ──

/**
 * Aggregates several buckets into one (charged, paid) pair.
 *
 * Payments are always recorded in the DEBT's currency (allocations credit
 * `charge.currency` — a VES payment settles the right USD amount, and an
 * at-par USD payment settles EUR 1:1). So progress compares per currency,
 * never converting payments: $80 last week is $80 today.
 *
 * - One currency → compare in that currency directly.
 * - Mixed currencies → weight each currency by the charged-side VES rate of
 *   the bucket that carries it; paid is capped at charged per currency, so
 *   overpaying one currency never offsets another currency's debt.
 * - No byCurrency breakdown (legacy) → VES sums.
 */
function mergedTotals(...buckets: (LedgerBucket | undefined | null)[]): { charged: number; paid: number } {
  const list = buckets.filter(Boolean) as LedgerBucket[];
  const byCurrency: Record<string, { charged: number; paid: number }> = {};
  for (const b of list) {
    for (const [cur, v] of Object.entries(b.byCurrency ?? {})) {
      const t = (byCurrency[cur] ??= { charged: 0, paid: 0 });
      t.charged += v.charged;
      t.paid += v.paid;
    }
  }
  const currencies = Object.keys(byCurrency);
  if (currencies.length === 1) {
    const t = byCurrency[currencies[0]];
    return { charged: t.charged, paid: t.paid };
  }
  if (currencies.length === 0) {
    return {
      charged: list.reduce((s, b) => s + (b.totalChargedVES ?? 0), 0),
      paid: list.reduce((s, b) => s + (b.totalPaidVES ?? 0), 0),
    };
  }
  // Mixed: progress = fraction of debt value settled, weighted per currency.
  let charged = 0, paid = 0;
  for (const b of list) {
    const entries = Object.values(b.byCurrency ?? {});
    const chargedSum = entries.reduce((s, v) => s + v.charged, 0);
    const implied = chargedSum > 0 ? (b.totalChargedVES ?? chargedSum) / chargedSum : 0;
    for (const v of entries) {
      charged += v.charged * implied;
      paid += Math.min(v.paid, v.charged) * implied;
    }
  }
  return { charged, paid };
}

/**
 * Pending debt of several buckets, kept per currency ({ USD: 30, EUR: 165 }).
 * A cell shows this in its corner — it drops to nothing as the debts get paid.
 */
function pendingByCurrency(...buckets: (LedgerBucket | undefined | null)[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const b of buckets.filter(Boolean) as LedgerBucket[]) {
    const entries = Object.entries(b.byCurrency ?? {});
    if (entries.length === 0) {
      const pending = Math.max((b.totalCharged ?? 0) - (b.totalPaid ?? 0), 0);
      if (pending > 0.005) out[b.currency ?? 'VES'] = (out[b.currency ?? 'VES'] ?? 0) + pending;
      continue;
    }
    for (const [cur, v] of entries) {
      const pending = Math.max(v.charged - v.paid, 0);
      if (pending > 0.005) out[cur] = (out[cur] ?? 0) + pending;
    }
  }
  for (const cur of Object.keys(out)) out[cur] = Math.round(out[cur] * 100) / 100;
  return out;
}

/**
 * Every bucket of every prior period, flattened. Prior-period debts fold into
 * the student's entry-month cell (that year's enrollment cannot be paid until
 * the old debt is settled anyway — the payment order already enforces it).
 */
function priorBucketsOf(student: LedgerStudent): LedgerBucket[] {
  return (student.priorPeriods ?? []).flatMap(g =>
    [...Object.values(g.months ?? {}), g.enrollment, g.other].filter(Boolean) as LedgerBucket[]);
}

/** Display merge of month-less buckets (prior periods show them as one "Otras deudas" row). */
function mergeBuckets(...buckets: (LedgerBucket | undefined | null)[]) {
  const list = buckets.filter(Boolean) as LedgerBucket[];
  const currencies = new Set(list.map(b => b.currency).filter(Boolean));
  const byCurrency: Record<string, { charged: number; paid: number }> = {};
  for (const b of list) {
    for (const [cur, v] of Object.entries(b.byCurrency ?? {})) {
      const t = (byCurrency[cur] ??= { charged: 0, paid: 0 });
      t.charged += v.charged;
      t.paid += v.paid;
    }
  }
  return {
    charges: list.flatMap(b => b.charges ?? []),
    payments: list.flatMap(b => b.payments ?? []),
    totalCharged: list.reduce((s, b) => s + (b.totalCharged ?? 0), 0),
    totalPaid: list.reduce((s, b) => s + (b.totalPaid ?? 0), 0),
    currency: currencies.size === 1 ? [...currencies][0] : null,
    byCurrency: Object.keys(byCurrency).length ? byCurrency : undefined,
  };
}

function priorStatus(paid: number, charged: number): keyof typeof STATUS {
  if (charged <= 0) return 'none';
  if (paid >= charged - 0.005) return 'paid';
  if (paid > 0.005) return 'partial';
  return 'overdue'; // prior-period debts are always past due
}

// ── Sellable-item badges ("buffs") inside the month cells ──

/** Paid amount credited to each charge of a bucket set (via its payments' allocations). */
function chargePaidBy(...buckets: ({ payments?: any[] } | undefined | null)[]): Map<number, number> {
  const paidBy = new Map<number, number>();
  const seenPay = new Set<number>();
  for (const b of buckets) {
    if (!b) continue;
    for (const p of b.payments ?? []) {
      if (seenPay.has(p.id)) continue;
      seenPay.add(p.id);
      for (const a of p.allocations ?? []) {
        paidBy.set(a.chargeId, (paidBy.get(a.chargeId) ?? 0) + Number(a.amount));
      }
      if ((!p.allocations?.length) && p.chargeId) {
        paidBy.set(p.chargeId, (paidBy.get(p.chargeId) ?? 0) + Number(p.equivalent ?? p.amount ?? 0));
      }
    }
  }
  return paidBy;
}

const deliveredOf = (c: any): number =>
  (c.deliveries ?? []).reduce((s: number, d: any) => s + Number(d.quantity ?? 0), 0);

/**
 * Trash button on a charge row. Disabled when the charge already has payments
 * or deliveries recorded — the backend refuses those deletes too, but the
 * disabled state explains why upfront.
 */
function DeleteChargeButton({ charge, paid, onChanged }: { charge: any; paid: number; onChanged: () => void }) {
  const delivered = deliveredOf(charge);
  const blocked = paid > 0.005
    ? 'No se puede eliminar: tiene pagos registrados (elimina primero el pago)'
    : delivered > 0
      ? 'No se puede eliminar: tiene entregas registradas (deshaz las entregas primero)'
      : null;
  if (blocked) {
    return (
      <span title={blocked} className="shrink-0 p-1 text-[#C3C9D2] cursor-not-allowed">
        <Trash2 size={13} />
      </span>
    );
  }
  return (
    <button
      title="Eliminar deuda"
      className="shrink-0 p-1 text-[#C0453A] hover:bg-[#FBE3E0]"
      onClick={() => {
        Modal.confirm({
          title: 'Eliminar deuda',
          content: `¿Eliminar "${charge.description}" (${Number(charge.amount).toFixed(2)} ${charge.currency})? Esta acción no se puede deshacer.`,
          okText: 'Eliminar',
          okButtonProps: { danger: true },
          cancelText: 'Cancelar',
          onOk: async () => {
            try {
              await deleteCharge(charge.id);
              onChanged();
            } catch (err: any) {
              Modal.error({ title: 'No se pudo eliminar la deuda', content: err?.response?.data?.message ?? 'Error al eliminar la deuda' });
            }
          },
        });
      }}
    >
      <Trash2 size={13} />
    </button>
  );
}

/**
 * One badge per sellable-item charge: gray while unpaid, colored once paid.
 * A green check marks fully delivered charges; a "d/q" chip counts partial
 * deliveries. Shows the item's configured icon (image > Lucide > box).
 */
function ItemBadges({ charges, paidBy }: { charges: any[]; paidBy: Map<number, number> }) {
  const items = (charges ?? []).filter(c => c.type === 'item');
  if (items.length === 0) return null;
  return (
    <>
      {items.map(c => {
        const net = Number(c.amount) - Number(c.discountAmount ?? 0);
        const paid = (paidBy.get(c.id) ?? 0) >= net - 0.005;
        const qty = Math.max(1, Number(c.quantity ?? 1));
        const delivered = deliveredOf(c);
        const name = c.sellableItem?.name ?? c.description ?? 'Item';
        const tip = `${name} — ${paid ? 'pagado' : 'pendiente de pago'} — entregado ${delivered}/${qty}`;
        return (
          <span
            key={c.id}
            title={tip}
            className={`relative inline-flex items-center justify-center w-[18px] h-[18px] rounded-[3px] border bg-white/90
              ${paid ? 'border-[#9AA6B5] text-[#2F5EA8]' : 'border-[#C3C9D2] text-[#8B909A] opacity-60'}`}
          >
            <ItemGlyph icon={c.sellableItem?.icon} iconImage={c.sellableItem?.iconImage} size={12} className={paid ? '' : 'grayscale'} />
            {delivered >= qty ? (
              <span className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full bg-[#0F7A45] flex items-center justify-center">
                <Check size={8} strokeWidth={4} className="text-white" />
              </span>
            ) : delivered > 0 ? (
              <span className="absolute -bottom-1.5 -right-1 rounded-sm bg-[#2F5EA8] text-white text-[7px] leading-none px-0.5 font-semibold">
                {delivered}/{qty}
              </span>
            ) : null}
          </span>
        );
      })}
    </>
  );
}

/** Item charges of several buckets (a cell can merge enrollment + priors). */
function itemChargesOf(...buckets: (LedgerBucket | undefined | null)[]): any[] {
  const out: any[] = [];
  const seen = new Set<number>();
  for (const b of buckets) {
    for (const c of b?.charges ?? []) {
      if (c.type !== 'item' || seen.has(c.id)) continue;
      seen.add(c.id);
      out.push(c);
    }
  }
  return out;
}

// ── Delivery tracking inside a cell's charge detail ──

function ChargeDeliveries({ charge, onChanged }: { charge: any; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState('');
  const [size, setSize] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const sizes: string[] = charge.sellableItem?.sizes ?? [];
  const qtyTotal = Math.max(1, Number(charge.quantity ?? 1));
  const delivered = deliveredOf(charge);
  const pending = qtyTotal - delivered;

  const submit = async () => {
    const q = Math.round(Number(qty || pending));
    if (!q || q < 1) return;
    if (sizes.length && !size) { alert('Elige la talla entregada'); return; }
    setSaving(true);
    try {
      const res = await deliverItemUnits(charge.id, { quantity: q, size: size || undefined, note: note.trim() || undefined });
      setOpen(false); setQty(''); setSize(''); setNote('');
      if (res.stockWarning) alert(res.stockWarning);
      onChanged();
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Error al registrar la entrega');
    } finally {
      setSaving(false);
    }
  };

  const undo = async (d: any) => {
    if (!confirm(`¿Deshacer la entrega de ${d.quantity} unidad(es)?`)) return;
    try {
      await undoItemDelivery(d.id);
      onChanged();
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Error al deshacer la entrega');
    }
  };

  return (
    <div className="mt-0.5 space-y-0.5">
      {(charge.deliveries ?? []).map((d: any) => (
        <div key={d.id} className="group/del flex items-center gap-1.5 text-[10px] text-[#0F7A45]">
          <PackageCheck size={11} />
          <span>
            {d.quantity} und. entregada{d.quantity > 1 ? 's' : ''}
            {d.size ? ` · talla ${d.size}` : ''}
            {d.deliveredBy ? ` por ${d.deliveredBy.firstName} ${d.deliveredBy.lastName}` : ''}
            {' · '}{new Date(d.createdAt).toLocaleDateString('en-GB')}
            {d.note ? ` · ${d.note}` : ''}
          </span>
          <button
            onClick={() => undo(d)}
            className="opacity-0 group-hover/del:opacity-100 text-[#B42318] hover:bg-[#FDE8E6] p-0.5"
            title="Deshacer esta entrega"
          >
            <X size={10} />
          </button>
        </div>
      ))}
      {pending > 0 && !open && (
        <button
          onClick={() => { setOpen(true); setQty(String(pending)); }}
          className="flex items-center gap-1 text-[10px] font-semibold text-[#2F5EA8] hover:bg-[#DCE5F7] px-1.5 py-0.5 border border-[#B7C7E6]"
        >
          <PackageCheck size={11} /> Entregar ({pending} pendiente{pending > 1 ? 's' : ''})
        </button>
      )}
      {open && (
        <div className="flex items-center gap-1.5">
          <input
            type="number" min={1} max={pending} value={qty} onChange={e => setQty(e.target.value)}
            className="w-14 border border-[#C5CAD2] px-1 py-0.5 text-[11px] tabular-nums"
          />
          {sizes.length > 0 && (
            <select
              value={size} onChange={e => setSize(e.target.value)}
              className="border border-[#C5CAD2] px-1 py-0.5 text-[11px] bg-white"
              title="Talla entregada"
            >
              <option value="">Talla…</option>
              {sizes.map(sz => <option key={sz} value={sz}>{sz}</option>)}
            </select>
          )}
          <input
            type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Nota (opcional)"
            className="flex-1 border border-[#C5CAD2] px-1.5 py-0.5 text-[11px]"
          />
          <button onClick={submit} disabled={saving} className="text-[10px] font-semibold text-white bg-[#2F5EA8] hover:bg-[#284F8E] px-2 py-0.5 disabled:opacity-50">
            {saving ? '…' : 'Entregar'}
          </button>
          <button onClick={() => setOpen(false)} className="text-[10px] text-[#6B7280] hover:text-[#14181F] px-1">✕</button>
        </div>
      )}
    </div>
  );
}

function PriorPeriodDetail({ group, onAddPayment, onCorrectPayment, onChanged }: {
  group: LedgerPriorPeriod;
  onAddPayment: (monthKey: string) => void;
  onCorrectPayment: (txn: any, mode: CorrectionMode) => void;
  onChanged: () => void;
}) {
  const flat = mergeBuckets(group.enrollment, group.other);
  const ordered = [
    ...group.billingMonths.filter(m => group.months[m]).map(m => ({ key: m, data: group.months[m] })),
    ...(flat.charges.length || flat.payments.length ? [{ key: OTHER, data: flat }] : []),
  ];
  const groupPending = ordered.reduce((s, o) => s + pendingOf(o.data), 0);
  const groupCharged = ordered.reduce((s, o) => s + (o.data.totalCharged ?? 0), 0);
  const settled = groupPending <= 0.005;
  // A settled old debt is just context: collapsed by default so the pending debt is what the user sees.
  const [expanded, setExpanded] = useState(!settled);
  return (
    <div className={`border-b-4 border-[#B9BEC7] border-l-4 bg-[#FAFBFC] ${settled ? 'border-l-[#0F7A45]' : 'border-l-[#B42318]'}`}>
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className={`w-full flex items-center gap-3 px-3 py-1.5 border-b border-[#E4E6EB] text-left ${settled ? 'bg-[#F1F8F3]' : 'bg-[#FFF6F4]'}`}
      >
        <ChevronDown size={13} className={`shrink-0 transition-transform ${expanded ? '' : '-rotate-90'}`} />
        <span className="text-[11px] font-bold uppercase tracking-wide text-[#14181F]">Deuda del período {group.periodName}</span>
        <StateChip pending={groupPending} charged={groupCharged} />
        {!expanded && <span className="text-[10px] text-[#6B7280]">Ver detalle</span>}
      </button>
      {expanded && [...ordered].sort((a, b) => Number(pendingOf(b.data) > 0.005) - Number(pendingOf(a.data) > 0.005)).map(({ key, data }) => (
        <div key={key} className="border-b border-[#E4E6EB] last:border-b-0">
          <div className="flex items-center gap-4 px-3 py-1.5 flex-wrap">
            <span className="text-xs font-bold text-[#14181F] uppercase tracking-wide">
              {key === OTHER ? 'Otras deudas' : MONTH_FULL[key]}
            </span>
            <StateChip pending={pendingOf(data)} charged={data.totalCharged ?? 0} />
            {data.byCurrency && Object.keys(data.byCurrency).length > 1 ? (
              <>
                <span className="text-xs text-[#6B7280]">Cargado <b className="text-[#14181F] font-semibold">
                  {Object.entries(data.byCurrency).map(([c, v]) => `${v.charged.toFixed(2)} ${c}`).join(' + ')}
                </b></span>
                <span className="text-xs text-[#0F7A45]">Pagado <b className="font-semibold">
                  {Object.entries(data.byCurrency).map(([c, v]) => `${v.paid.toFixed(2)} ${c}`).join(' + ')}
                </b></span>
                {Object.entries(data.byCurrency).map(([c, v]) => {
                  const r = Math.max(v.charged - v.paid, 0);
                  return r > 0.005 ? <span key={c} className={MISSING_CLS}>Falta <b className="font-bold">{r.toFixed(2)} {c}</b></span> : null;
                })}
              </>
            ) : (
              <>
                <span className="text-xs text-[#6B7280]">Cargado <b className="text-[#14181F] font-semibold">{(data.totalCharged ?? 0).toFixed(2)} {data.currency ?? ''}</b></span>
                <span className="text-xs text-[#0F7A45]">Pagado <b className="font-semibold">{(data.totalPaid ?? 0).toFixed(2)} {data.currency ?? ''}</b></span>
                {Math.max((data.totalCharged ?? 0) - (data.totalPaid ?? 0), 0) > 0 && (
                  <span className={MISSING_CLS}>Falta <b className="font-bold">{((data.totalCharged ?? 0) - (data.totalPaid ?? 0)).toFixed(2)} {data.currency ?? ''}</b></span>
                )}
              </>
            )}
            <button
              onClick={() => onAddPayment(`p:${group.periodId}:${key}`)}
              className="ml-auto flex items-center gap-1 text-xs font-semibold text-[#2F5EA8] hover:bg-[#DCE5F7] px-2 py-1 border border-[#B7C7E6]"
            >
              <Plus size={13} /> Agregar pago
            </button>
          </div>
          {data.charges?.length ? (
            <div className="bg-white">
              <SubsectionLabel>Deudas</SubsectionLabel>
              {(() => { const paidBy = chargePaidBy(data); return data.charges.map((c: any) => {
                const net = Math.round((Number(c.amount) - Number(c.discountAmount ?? 0)) * 100) / 100;
                const paid = Math.min(paidBy.get(c.id) ?? 0, net);
                const pending = Math.max(net - paid, 0);
                return (
                <div key={c.id} className="px-3 py-1 text-xs border-b border-[#F0F1F4] last:border-b-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                    <span className="flex-1 basis-48 min-w-0 break-words">{c.description}</span>
                    <span className="tabular-nums text-[#6B7280]">
                      {c.discountAmount > 0 ? `${Number(c.amount).toFixed(2)} −${Number(c.discountAmount).toFixed(2)} = ` : ''}
                      <b className="font-semibold text-[#14181F]">{net.toFixed(2)} {c.currency}</b>
                    </span>
                    <span className="tabular-nums text-[#0F7A45] min-w-24 text-right">
                      {paid > 0.005 ? `Pagado ${paid.toFixed(2)}` : ''}
                    </span>
                    <span className="tabular-nums text-[#B42318] font-bold min-w-24 text-right">
                      {pending > 0.005 ? `Falta ${pending.toFixed(2)}` : ''}
                    </span>
                    <DeleteChargeButton charge={c} paid={paid} onChanged={onChanged} />
                  </div>
                  {c.type === 'item' && <ChargeDeliveries charge={c} onChanged={onChanged} />}
                </div>
                );
              }); })()}
            </div>
          ) : null}
          {data.payments?.length ? (
            <div>
              <SubsectionLabel>Pagos registrados ({data.payments.length})</SubsectionLabel>
              {data.payments.map((t: any, i: number) => (
                <TransactionRow key={t.id} txn={t} index={i} onCorrect={(mode) => onCorrectPayment(t, mode)}
                  bucketChargeIds={new Set((data.charges ?? []).map((c: any) => c.id))} />
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/**
 * What one student has paid and still owes, per debt currency, across every
 * period and bucket (months, enrollment, extraordinary, prior periods).
 * Pending never goes negative per bucket.
 */
function studentTotals(student: LedgerStudent, months: string[], upToMonth: string): { paid: Record<string, number>; pending: Record<string, number> } {
  const paid: Record<string, number> = {};
  const pending: Record<string, number> = {};
  const cutoff = months.indexOf(upToMonth);
  const add = (b: LedgerBucket | undefined | null, countsDebt = true) => {
    if (!b) return;
    const parts: [string, { charged: number; paid: number }][] = b.byCurrency && Object.keys(b.byCurrency).length
      ? Object.entries(b.byCurrency)
      : b.currency ? [[b.currency, { charged: b.totalCharged, paid: b.totalPaid }]] : [];
    for (const [cur, v] of parts) {
      paid[cur] = (paid[cur] ?? 0) + v.paid;
      if (countsDebt) pending[cur] = (pending[cur] ?? 0) + Math.max(v.charged - v.paid, 0);
    }
  };
  // Months after the cutoff are not due yet: their payments still count as paid, their debt does not.
  Object.entries(student.months).forEach(([m, b]) => add(b, cutoff < 0 || months.indexOf(m) <= cutoff));
  add(student.enrollment);
  add(student.other);
  for (const g of student.priorPeriods ?? []) {
    Object.values(g.months).forEach(b => add(b));
    add(g.enrollment);
    add(g.other);
  }
  return { paid, pending };
}

/**
 * Paid vs due up to `upToMonth` (inclusive): months after the cutoff are not
 * due yet and advance payments on them are ignored. Enrollment, extraordinary
 * debts and debts of other periods always count.
 */
function yearProgress(student: LedgerStudent, feeFor: (month: string) => number, months: string[], upToMonth: string): number {
  const cutoff = months.indexOf(upToMonth);
  const due: { paid: number; charged: number }[] = [];
  const addDue = (b: LedgerBucket | undefined | null, fallback = 0) => {
    const charged = b?.totalCharged || fallback;
    if (b && charged > 0) due.push({ paid: Math.min(b.totalPaid, charged), charged });
  };
  for (const m of months) {
    if (student.months[m] && (cutoff < 0 || months.indexOf(m) <= cutoff)) addDue(student.months[m], feeFor(m));
  }
  addDue(student.enrollment);
  addDue(student.other);
  for (const g of student.priorPeriods ?? []) {
    Object.values(g.months).forEach(b => addDue(b));
    addDue(g.enrollment);
    addDue(g.other);
  }
  const dueTotal = due.reduce((s, d) => s + d.charged, 0);
  return dueTotal > 0 ? due.reduce((s, d) => s + d.paid, 0) / dueTotal : 0;
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

// ── Modal: Debt to a withdrawn student ──

/**
 * Search withdrawn students (whose latest inscription was withdrawn) so a
 * manual/historical debt can be attached to that inscription. Picking a result
 * hands it to `onPick`, which opens the regular AddChargeModal prefilled.
 */
function WithdrawnDebtModal({ onPick, onClose }: {
  onPick: (s: WithdrawnStudentResult) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<WithdrawnStudentResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    const t = setTimeout(() => {
      searchWithdrawnStudents(q.trim())
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-[#C5CAD2] w-full max-w-md shadow-lg max-h-[95vh] overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#E4E6EB] bg-[#EDEEF1]">
          <h3 className="text-sm font-bold uppercase tracking-wide">Deuda a estudiante retirado</h3>
          <button onClick={onClose} className="text-[#6B7280] hover:text-[#14181F]"><X size={16} /></button>
        </div>
        <div className="p-4">
          <Field label="Buscar por nombre o cédula">
            <input autoFocus value={q} onChange={e => setQ(e.target.value)}
              placeholder="Ej: Díaz, Nirmaris o V-12345678"
              className={inputCls} />
          </Field>
          <div className="mt-3 border border-[#E4E6EB] divide-y divide-[#E4E6EB] max-h-72 overflow-y-auto">
            {q.trim().length < 2 ? (
              <div className="px-3 py-6 text-center text-xs text-[#8B909A]">Escribe al menos 2 letras para buscar.</div>
            ) : searching && results.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-[#8B909A]">Buscando…</div>
            ) : results.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-[#8B909A]">Sin estudiantes retirados que coincidan.</div>
            ) : results.map(r => (
              <button key={r.inscriptionId} type="button" onClick={() => onPick(r)}
                className="w-full text-left px-3 py-2.5 hover:bg-[#F5F7FA] flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-[#14181F]">{r.name}</div>
                  <div className="text-[11px] text-[#8B909A]">
                    {r.documentType ? `${r.documentType}-` : ''}{r.document || 's/ced'} · {r.gradeName} · {r.periodName}
                  </div>
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-[#B42318] shrink-0">
                  Retirado{r.withdrawnAt ? ` ${new Date(r.withdrawnAt).toLocaleDateString('en-GB')}` : ''}
                </span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-[#8B909A]">
            La deuda se registrará sobre la última inscripción del estudiante, sin reactivarlo.
          </p>
        </div>
      </div>
    </div>
  );
}

function AddPaymentModal({ students, months, prefill, monthlyFee, usdAtPar, schoolPeriodId, onClose, onSubmit }: {
  months: string[];
  schoolPeriodId: number | undefined;
  /** The school period accepts USD/USDT at par (1:1) against EUR debts. */
  usdAtPar: boolean;
  students: LedgerStudent[];
  prefill: { studentId?: number } | {};
  monthlyFee: { amount: number; currency: string } | null;
  onClose: () => void;
  onSubmit: (form: any) => Promise<void> | void;
}) {
  const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
  const [form, setForm] = useState({
    studentId: (prefill as any).studentId || '',
    scope: 'auto' as 'auto' | 'tuition' | 'item',
    chargeId: '',
    method: 'transferencia',
    currency: 'VES',
    amount: '',
    paymentDate: todayStr,
    bank: '',
    account: '',
    reference: '',
    notes: '',
  });
  const [banks, setBanks] = useState<Bank[]>([]);
  const [submitting, setSubmitting] = useState(false);
  // One id per modal opening: retries/double clicks of the same form can never create two payments.
  const [requestId] = useState(() => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`));
  useEffect(() => {
    listBanks({ active: true }).then(setBanks).catch(() => setBanks([]));
  }, []);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));
  const def = methodDef(form.method);
  const selectedStudent = students.find(s => s.inscriptionId === Number(form.studentId));

  // Buckets in payment order: prior periods first, then enrollment, extraordinary
  // debts ("Otros") and the billing months. `tuition` skips extraordinary debts.
  const orderedBuckets = (s: LedgerStudent): LedgerBucket[] => {
    const prior = [...(s.priorPeriods ?? [])]
      .sort((a, b) => a.periodId - b.periodId)
      .flatMap(g => [g.enrollment, g.other, ...g.billingMonths.map(m => g.months[m])]);
    const flat = [s.enrollment, s.other];
    const monthly = months.map(m => s.months[m]);
    const all = [...prior, ...flat, ...monthly].filter(Boolean);
    return form.scope === 'tuition' ? all.filter(b => b !== s.other) : all;
  };

  // Unpaid sellable-item charges of the selected student (any period).
  const pendingItems = useMemo(() => {
    if (!selectedStudent) return [] as { id: number; description: string; remaining: number; currency: string }[];
    const buckets: LedgerBucket[] = [
      selectedStudent.enrollment, selectedStudent.other,
      ...Object.values(selectedStudent.months ?? {}),
      ...(selectedStudent.priorPeriods ?? []).flatMap(g => [g.enrollment, g.other, ...Object.values(g.months ?? {})]),
    ].filter(Boolean);
    const paidBy = new Map<number, number>();
    const seenPay = new Set<number>();
    for (const b of buckets) for (const p of b.payments ?? []) {
      if (seenPay.has(p.id)) continue;
      seenPay.add(p.id);
      for (const a of p.allocations ?? []) paidBy.set(a.chargeId, (paidBy.get(a.chargeId) ?? 0) + Number(a.amount));
      if ((!p.allocations?.length) && p.chargeId) {
        paidBy.set(p.chargeId, (paidBy.get(p.chargeId) ?? 0) + Number(p.equivalent ?? p.amount ?? 0));
      }
    }
    const out = new Map<number, { id: number; description: string; remaining: number; currency: string }>();
    for (const b of buckets) for (const c of b.charges ?? []) {
      if (c.type !== 'item') continue;
      const rem = Math.round((Number(c.amount) - Number(c.discountAmount ?? 0) - (paidBy.get(c.id) ?? 0)) * 100) / 100;
      if (rem > 0.005) out.set(c.id, { id: c.id, description: c.description ?? c.sellableItem?.name ?? 'Item', remaining: rem, currency: c.currency });
    }
    return [...out.values()];
  }, [selectedStudent]);

  // Currency of the debt this payment will settle first (drives the at-par hint).
  const targetDebtCurrency = (() => {
    if (!selectedStudent) return null;
    if (form.scope === 'item') {
      return pendingItems.find(i => i.id === Number(form.chargeId))?.currency ?? pendingItems[0]?.currency ?? null;
    }
    for (const b of orderedBuckets(selectedStudent)) {
      for (const [cur, t] of Object.entries(b.byCurrency ?? {})) {
        if (t.charged - t.paid > 0.005) return cur;
      }
    }
    return monthlyFee?.currency ?? null;
  })();
  const atParNote = usdAtPar && targetDebtCurrency === 'EUR' && (form.currency === 'USD' || form.currency === 'USDT') && Number(form.amount) > 0;

  // Discount for paying in this currency on this date (the server applies it by itself).
  const [currencyDiscounts, setCurrencyDiscounts] = useState<CurrencyDiscount[]>([]);
  useEffect(() => {
    if (!schoolPeriodId) return;
    listCurrencyDiscounts(schoolPeriodId).then(setCurrencyDiscounts).catch(() => setCurrencyDiscounts([]));
  }, [schoolPeriodId]);
  const activeDiscount = useMemo(() => currencyDiscounts.find(d =>
    d.active && d.currency === form.currency
    && (!d.validFrom || d.validFrom <= form.paymentDate) && (!d.validTo || d.validTo >= form.paymentDate)) ?? null,
  [currencyDiscounts, form.currency, form.paymentDate]);

  // ── Live estimate: what this payment will cover, in each debt's currency ──
  // Uses the rate in force on the payment date, exactly like distributePayment.
  const [rateRows, setRateRows] = useState<RateAtDate[]>([]);
  const [rateTypes, setRateTypes] = useState<ExchangeRateType[]>([]);
  useEffect(() => {
    listExchangeRateTypes().then(setRateTypes).catch(() => setRateTypes([]));
  }, []);
  useEffect(() => {
    let alive = true;
    getRatesAtDate(form.paymentDate || undefined)
      .then(r => { if (alive) setRateRows(r.rates); })
      .catch(() => { if (alive) setRateRows([]); });
    return () => { alive = false; };
  }, [form.paymentDate]);

  // VES per unit of `currency` on the payment date; the default rate type of
  // the currency wins (same choice the backend makes). USDT follows the USD rate.
  const vesRateFor = (currency: string): number | null => {
    if (currency === 'VES') return 1;
    let rows = rateRows.filter(r => r.currency === currency && r.rate != null);
    let def = rateTypes.find(t => t.active && t.isDefault && t.currency === currency);
    if (!rows.length && currency === 'USDT') {
      rows = rateRows.filter(r => r.currency === 'USD' && r.rate != null);
      def = rateTypes.find(t => t.active && t.isDefault && t.currency === 'USD');
    }
    if (!rows.length) return null;
    return (def ? rows.find(r => r.typeId === def.id) ?? rows[0] : rows[0]).rate;
  };

  // Pending charges in the backend's allocation order (prior periods first;
  // inside a period: enrollment package > items/extraordinary > monthly debts),
  // reduced to what the selected scope can touch.
  const scopedCharges = useMemo((): { currency: string; remaining: number }[] => {
    if (!selectedStudent) return [];
    if (form.scope === 'item') {
      const chosen = pendingItems.filter(i => i.id === Number(form.chargeId));
      return [...chosen, ...pendingItems.filter(i => i.id !== Number(form.chargeId))]
        .map(i => ({ currency: i.currency, remaining: i.remaining }));
    }
    const allBuckets = [
      selectedStudent.enrollment, selectedStudent.other,
      ...Object.values(selectedStudent.months ?? {}),
      ...(selectedStudent.priorPeriods ?? []).flatMap(g => [g.enrollment, g.other, ...Object.values(g.months ?? {})]),
    ].filter(Boolean) as LedgerBucket[];
    const paidBy = chargePaidBy(...allBuckets);
    const remaining = (c: any) => Math.round((Number(c.amount) - Number(c.discountAmount ?? 0) - (paidBy.get(c.id) ?? 0)) * 100) / 100;
    const ENR_RANK: Record<string, number> = { matricula: 0, gastos_administrativos: 1, mensualidad: 2 };
    const groups = [
      ...[...(selectedStudent.priorPeriods ?? [])].sort((a, b) => a.periodId - b.periodId)
        .map(g => ({ enr: g.enrollment, oth: g.other, byMonth: g.months ?? {}, billing: g.billingMonths ?? months })),
      { enr: selectedStudent.enrollment, oth: selectedStudent.other, byMonth: selectedStudent.months ?? {}, billing: months },
    ];
    const out: { currency: string; remaining: number }[] = [];
    const pushSorted = (charges: any[] | undefined, key: (c: any) => [number, number]) => {
      for (const c of [...(charges ?? [])].sort((a, b) => { const x = key(a), y = key(b); return x[0] - y[0] || x[1] - y[1]; })) {
        const rem = remaining(c);
        if (rem > 0.005) out.push({ currency: c.currency, remaining: rem });
      }
    };
    for (const g of groups) {
      pushSorted(g.enr?.charges, c => [ENR_RANK[c.type] ?? 2, c.id]);
      if (form.scope !== 'tuition') pushSorted(g.oth?.charges, c => [c.month ? g.billing.indexOf(c.month) : 0, c.id]);
      for (const m of g.billing) pushSorted(g.byMonth[m]?.charges, c => [0, c.id]);
    }
    return out;
  }, [selectedStudent, form.scope, form.chargeId, pendingItems, months]);

  const coverageEstimate = useMemo(() => {
    const amt = Number(form.amount);
    if (!(amt > 0) || !scopedCharges.length) return null;
    const payRate = vesRateFor(form.currency);
    if (payRate == null) return { parts: [] as { currency: string; amount: number }[], missing: [form.currency] };
    let vesLeft = amt * payRate;
    const parts = new Map<string, number>();
    const missing = new Set<string>();
    const ratesUsed = new Map<string, number>();
    let last: { currency: string; cost: number } | null = null;
    for (const { currency, remaining } of scopedCharges) {
      if (vesLeft <= 0.005) break;
      const par = usdAtPar && currency === 'EUR' && (form.currency === 'USD' || form.currency === 'USDT');
      const cost = (form.currency === currency || par) ? payRate : vesRateFor(currency);
      if (cost == null) { missing.add(currency); continue; }
      // A percent discount makes every unit paid settle 1 / (1 - p) units of debt.
      const keep = activeDiscount?.kind === 'percent' ? 1 - activeDiscount.value / 100 : 1;
      const cover = Math.min(remaining, vesLeft / (cost * keep));
      parts.set(currency, (parts.get(currency) ?? 0) + cover);
      vesLeft -= cover * cost * keep;
      ratesUsed.set(currency, cost);
      last = { currency, cost };
    }
    // The excess stays credited to the last touched debt, like the backend does.
    if (vesLeft > 0.005 && last) parts.set(last.currency, (parts.get(last.currency) ?? 0) + vesLeft / last.cost); // excess is not boosted
    if (form.currency !== 'VES') ratesUsed.set(form.currency, payRate);
    return { parts: [...parts.entries()].map(([currency, amount]) => ({ currency, amount })), missing: [...missing], ratesUsed };
  }, [form.amount, form.currency, scopedCharges, rateRows, rateTypes, usdAtPar, activeDiscount]);

  // ── Shared payment: other students of the same representative ──
  // They come pre-selected when they owe something; unchecking one pays for the rest only.
  const [sharedStudents, setSharedStudents] = useState<SharedStudent[]>([]);
  const [sharedPicked, setSharedPicked] = useState<Set<number>>(new Set());
  const [portions, setPortions] = useState<SharedPortion[] | null>(null);
  const [portionEdits, setPortionEdits] = useState<Record<number, string> | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    setSharedStudents([]);
    setSharedPicked(new Set());
    if (!form.studentId || !schoolPeriodId) return;
    let alive = true;
    getSharedStudents(Number(form.studentId), schoolPeriodId)
      .then(list => {
        if (!alive) return;
        setSharedStudents(list);
        setSharedPicked(new Set(list.filter(x => x.hasDebt).map(x => x.inscriptionId)));
      })
      .catch(() => { if (alive) setSharedStudents([]); });
    return () => { alive = false; };
  }, [form.studentId, schoolPeriodId]);

  const sharedIds = useMemo(
    () => (form.studentId ? [Number(form.studentId), ...[...sharedPicked]] : []),
    [form.studentId, sharedPicked],
  );
  // A specific item can only be paid for one student, so the shared split is off then.
  const sharedActive = sharedPicked.size > 0 && !(form.scope === 'item' && form.chargeId);

  useEffect(() => {
    setPortionEdits(null);
    if (!sharedActive || !(Number(form.amount) > 0)) { setPortions(null); setPreviewError(null); return; }
    let alive = true;
    setPreviewing(true);
    const timer = setTimeout(() => {
      previewSharedPayment({
        inscriptionIds: sharedIds, amount: Number(form.amount), currency: form.currency,
        paymentDate: form.paymentDate || undefined, scope: form.scope === 'auto' ? undefined : form.scope,
        schoolPeriodId,
      })
        .then(r => { if (alive) { setPortions(r.portions); setPreviewError(null); } })
        .catch(err => { if (alive) { setPortions(null); setPreviewError(err?.response?.data?.message ?? 'No se pudo calcular el reparto'); } })
        .finally(() => { if (alive) setPreviewing(false); });
    }, 400);
    return () => { alive = false; clearTimeout(timer); };
  }, [sharedActive, sharedIds, form.amount, form.currency, form.paymentDate, form.scope, schoolPeriodId]);

  const portionAmount = (p: SharedPortion) => portionEdits?.[p.inscriptionId] ?? p.amount.toFixed(2);
  const portionsSum = (portions ?? []).reduce((sum, p) => sum + (Number(portionAmount(p)) || 0), 0);
  const portionsOk = !sharedActive || (!!portions && !previewing && Math.abs(portionsSum - Number(form.amount)) < 0.005
    && (portions ?? []).every(p => Number(portionAmount(p)) >= 0));
  const togglePicked = (id: number) => setSharedPicked(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const changeMethod = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = methodDef(e.target.value);
    // Fields that do not apply to the new method are cleared; the currency follows the method's default.
    setForm(f => ({ ...f, method: next.value, currency: next.defaultCurrency, bank: '', account: '', reference: '', notes: '' }));
  };

  const referenceOk = !def.referenceLast4 || /^\d{4}$/.test(form.reference);
  const complete = !!form.studentId && Number(form.amount) > 0 && !!form.paymentDate
    && (form.scope !== 'item' || pendingItems.length > 0 || sharedActive)
    && portionsOk
    && (!def.bank || !!form.bank) && (!def.account || !!form.account.trim())
    && referenceOk && (!def.notesRequired || !!form.notes.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complete || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit({
        ...form,
        clientRequestId: requestId,
        shared: sharedActive && portions
          ? { inscriptionIds: sharedIds, portions: portions.map(p => ({ inscriptionId: p.inscriptionId, amount: Number(portionAmount(p)) })) }
          : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-[#C5CAD2] w-full max-w-md shadow-lg max-h-[95vh] overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#E4E6EB] bg-[#EDEEF1]">
          <h3 className="text-sm font-bold uppercase tracking-wide">Registrar nuevo pago</h3>
          <button onClick={onClose} className="text-[#6B7280] hover:text-[#14181F]"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 grid grid-cols-2 gap-3">
          <Field label="Estudiante" className="col-span-2">
            <select value={form.studentId} onChange={set('studentId')} required className={inputCls}>
              <option value="" disabled>Seleccionar…</option>
              {students.map(s => <option key={s.inscriptionId} value={s.inscriptionId}>{s.rosterNumber != null ? `${s.rosterNumber}. ` : ''}{s.name}</option>)}
            </select>
          </Field>
          <Field label="Aplicar a" className="col-span-2">
            <select value={form.scope} onChange={set('scope')} className={inputCls}>
              <option value="auto">Automático (en orden de deudas)</option>
              <option value="tuition">Inscripción y mensualidades</option>
              <option value="item">Item vendible</option>
            </select>
            <span className="text-[11px] text-[#8B909A]">
              {form.scope === 'auto' && 'Deudas anteriores primero, luego inscripción, items y mensualidades en orden.'}
              {form.scope === 'tuition' && 'Solo inscripción y mensualidades, en orden. Ignora items vendibles.'}
              {form.scope === 'item' && 'Compra directa: va al item elegido (o se reparte entre los items pendientes) aunque haya otras deudas pendientes.'}
            </span>
          </Field>
          {form.scope === 'item' && (
            <Field label="Item" className="col-span-2">
              <select value={form.chargeId} onChange={set('chargeId')} className={inputCls}>
                <option value="">Automático (repartir entre todos los items pendientes)</option>
                {pendingItems.map(i => (
                  <option key={i.id} value={i.id}>{i.description} — pendiente {i.remaining.toFixed(2)} {i.currency}</option>
                ))}
              </select>
              {selectedStudent && pendingItems.length === 0 && (
                <span className="text-[11px] text-[#8B909A]">El estudiante no tiene items vendibles pendientes.</span>
              )}
            </Field>
          )}

          <Field label="Método de pago" className="col-span-2">
            <select value={form.method} onChange={changeMethod} className={inputCls}>
              {METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </Field>

          <Field label="Moneda">
            <select value={form.currency} onChange={set('currency')} className={inputCls}>
              {PAYMENT_CURRENCIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="Fecha del pago">
            <DmyDateInput value={form.paymentDate} max={todayStr} onChange={v => setForm(f => ({ ...f, paymentDate: v }))} />
          </Field>
          <Field label={`Monto (${form.currency})`} className="col-span-2">
            <input type="number" step="0.01" min="0" value={form.amount} onChange={set('amount')} required
              inputMode="decimal" placeholder="0.00" className={inputCls} />
          </Field>
          {atParNote && (
            <div className="col-span-2 text-xs bg-[#E8F5EC] border border-[#B7DEC3] text-[#1A4D2E] px-3 py-2">
              <b>A la par:</b> {Number(form.amount).toFixed(2)} {form.currency} saldan {Number(form.amount).toFixed(2)} EUR
              (no se convierten por tasa).
            </div>
          )}
          {activeDiscount && (
            <div className="col-span-2 text-xs bg-[#E8F5EC] border border-[#B7DEC3] text-[#1A4D2E] px-3 py-2">
              <b>Descuento por pagar en {form.currency}{activeDiscount.name ? ` · ${activeDiscount.name}` : ''}:</b>{' '}
              {activeDiscount.kind === 'percent'
                ? `${activeDiscount.value}% menos. Cada ${form.currency} pagado salda ${(1 / (1 - activeDiscount.value / 100)).toFixed(2)} de deuda.`
                : `${activeDiscount.value.toFixed(2)} menos en cada deuda que este pago salde completa (en la moneda de esa deuda).`}
              {' '}Se aplica automáticamente.
            </div>
          )}
          {!sharedActive && coverageEstimate && (() => {
            const fmt = (n: number) => n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const parts = coverageEstimate.parts;
            const foreign = parts.filter(p => p.currency !== form.currency);
            if (!foreign.length && !coverageEstimate.missing.length) return null;
            const ratesUsed = coverageEstimate.ratesUsed ?? new Map<string, number>();
            const ddmmyyyy = form.paymentDate ? form.paymentDate.split('-').reverse().join('/') : '';
            return (
              <div className="col-span-2 text-xs bg-[#EEF2F9] border border-[#C9D6EC] text-[#274060] px-3 py-2">
                {foreign.length > 0 && (
                  <div>
                    <b>Abonaría ≈</b> {parts.map(p => `${fmt(p.amount)} ${p.currency}`).join(' + ')}
                    {ratesUsed.size > 0 && (
                      <span className="text-[#61738F]">
                        {' '}(tasa del {ddmmyyyy}: {[...ratesUsed.entries()].map(([c, r]) => `1 ${c} = Bs. ${fmt(r)}`).join(' · ')})
                      </span>
                    )}
                  </div>
                )}
                {coverageEstimate.missing.length > 0 && (
                  <div className="text-[#8A5A00]">
                    Sin tasa de {coverageEstimate.missing.join(', ')} registrada para esa fecha — no se puede estimar esa parte.
                  </div>
                )}
              </div>
            );
          })()}

          {sharedStudents.length > 0 && (
            <div className="col-span-2 border border-[#C9D6EC] bg-[#F6F8FC] px-3 py-2 text-xs text-[#274060]">
              <div className="font-semibold uppercase tracking-wide text-[10px] mb-1">Pago compartido con otros representados</div>
              <div className="space-y-1">
                {sharedStudents.map(st => (
                  <label key={st.inscriptionId} className="flex items-start gap-2 cursor-pointer">
                    <input type="checkbox" className="mt-0.5" checked={sharedPicked.has(st.inscriptionId)}
                      onChange={() => togglePicked(st.inscriptionId)} />
                    <span className="flex-1 min-w-0">
                      <b className="font-semibold">{st.name}</b>
                      <span className="text-[#61738F]"> — {st.where}{st.withdrawn ? ' · retirado' : ''}</span>
                      <span className={st.hasDebt ? 'block text-[#8A5A00]' : 'block text-[#8B909A]'}>
                        {st.hasDebt ? `Debe ${formatTotals(st.pending)}` : 'Sin deuda pendiente'}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
              {sharedPicked.size === 0 && (
                <p className="mt-1 text-[#61738F]">Sin otros estudiantes marcados: el pago es solo para {selectedStudent?.name ?? 'el estudiante'}.</p>
              )}
              {sharedActive && (
                <div className="mt-2 border-t border-[#D5DEEE] pt-2">
                  {!(Number(form.amount) > 0) && <p className="text-[#61738F]">Escribe el monto para ver cómo se reparte.</p>}
                  {previewing && <p className="text-[#61738F]">Calculando reparto…</p>}
                  {previewError && <p className="text-[#C0453A]">{previewError}</p>}
                  {portions && !previewing && (
                    <>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold">Reparto por prioridad (editable)</span>
                        {portionEdits && (
                          <button type="button" className="text-[#2F5EA8] hover:underline" onClick={() => setPortionEdits(null)}>
                            Recalcular
                          </button>
                        )}
                      </div>
                      {portions.map(p => (
                        <div key={p.inscriptionId} className="py-1 border-b border-[#E3E9F4] last:border-b-0">
                          <div className="flex items-center gap-2">
                            <span className="flex-1 min-w-0 font-semibold truncate">{p.name}</span>
                            <input
                              type="number" step="0.01" min="0" inputMode="decimal"
                              value={portionAmount(p)}
                              onChange={e => setPortionEdits(prev => ({
                                ...(prev ?? Object.fromEntries(portions.map(x => [x.inscriptionId, x.amount.toFixed(2)]))),
                                [p.inscriptionId]: e.target.value,
                              }))}
                              className="w-28 border border-[#C5CAD2] px-2 py-1 text-right tabular-nums bg-white"
                            />
                            <span className="w-10 text-[#61738F]">{form.currency}</span>
                          </div>
                          <div className="text-[11px] text-[#61738F] pl-1">
                            {p.allocations.length
                              ? p.allocations.map(a => `${a.amount.toFixed(2)} ${a.currency} · ${a.description ?? a.type ?? 'Deuda'}`).join(' + ')
                              : Number(portionAmount(p)) > 0 ? 'Excedente a favor' : 'No recibe pago'}
                          </div>
                        </div>
                      ))}
                      <div className={`mt-1 text-right font-semibold ${portionsOk ? 'text-[#1A4D2E]' : 'text-[#C0453A]'}`}>
                        Suma: {portionsSum.toFixed(2)} de {Number(form.amount).toFixed(2)} {form.currency}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {def.bank && (
            <Field label="Banco" className="col-span-2">
              <select value={form.bank} onChange={set('bank')} required className={inputCls}>
                <option value="">Seleccionar…</option>
                {banks.map(b => <option key={b.id} value={b.shortName}>{b.code} — {b.shortName}</option>)}
              </select>
            </Field>
          )}
          {def.account && (
            <Field label={def.accountLabel ?? 'Usuario o cuenta'} className="col-span-2">
              <input type="text" value={form.account} onChange={set('account')} required
                placeholder="Quién realizó el pago" className={inputCls} />
            </Field>
          )}
          {def.referenceLast4 && (
            <Field label="Referencia (últimos 4 dígitos)" className="col-span-2">
              <input type="text" inputMode="numeric" maxLength={4} pattern="\d{4}" value={form.reference}
                onChange={e => setForm(f => ({ ...f, reference: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                required placeholder="0000" className={inputCls} />
            </Field>
          )}
          {def.referenceOptional && (
            <Field label="ID de la operación (opcional)" className="col-span-2">
              <input type="text" value={form.reference} onChange={set('reference')}
                placeholder="Ayuda a detectar pagos repetidos" className={inputCls} />
            </Field>
          )}
          {def.notesRequired && (
            <Field label="Describa el método de pago" className="col-span-2">
              <textarea value={form.notes} onChange={set('notes')} required rows={2}
                placeholder="Ej.: cheque N° 0045 del Banco X" className={inputCls} />
            </Field>
          )}

          <div className="col-span-2 flex items-center justify-end gap-2 pt-2 border-t border-[#E4E6EB] mt-1">
            <button type="button" onClick={onClose} className="text-sm font-semibold px-3 py-1.5 border border-[#C5CAD2] hover:bg-[#F4F5F8]">
              Cancelar
            </button>
            <button type="submit" disabled={!complete || submitting}
              className="text-sm font-semibold px-3 py-1.5 bg-[#2F5EA8] text-white hover:bg-[#284F8E] disabled:opacity-50 disabled:cursor-not-allowed">
              {submitting ? 'Registrando…' : sharedActive ? 'Registrar pago compartido' : 'Registrar pago'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal: Add Charge (debt) ──

function AddChargeModal({ students, months, periods, currentPeriodId, feeByMonth, sellableItems, prefill, monthlyFee, onClose, onSubmit }: {
  months: string[];
  periods: any[];
  currentPeriodId: number;
  sellableItems: SellableItem[];
  feeByMonth: Record<string, { amount: number; currency: string } | null>;
  students: LedgerStudent[];
  prefill: { studentId?: number; month?: string } | {};
  monthlyFee: { amount: number; currency: string } | null;
  onClose: () => void;
  onSubmit: (form: any) => void;
}) {
  const [form, setForm] = useState({
    studentId: (prefill as any).studentId || '',
    periodId: currentPeriodId,
    month: (prefill as any).month || (months.includes(CURRENT_MONTH) ? CURRENT_MONTH : months[0]),
    type: 'mensualidad',
    description: 'Mensualidad',
    amount: String((feeByMonth[(prefill as any).month || CURRENT_MONTH] ?? monthlyFee)?.amount ?? ''),
    currency: (feeByMonth[(prefill as any).month || CURRENT_MONTH] ?? monthlyFee)?.currency || 'USD',
  });
  // Sellable-item debts: one line per item (e.g. 1 shirt, 1 pants, 2 badges).
  const [lines, setLines] = useState<{ sellableItemId: string; quantity: string }[]>([{ sellableItemId: '', quantity: '1' }]);
  const selectedPeriod = periods.find(p => p.id === Number(form.periodId));
  const isCurrentPeriod = Number(form.periodId) === currentPeriodId;
  // Months follow the billing calendar of the chosen debt period
  const periodMonths = isCurrentPeriod ? months : billingMonthsOf(selectedPeriod);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = e.target.value;
    if (k === 'periodId') {
      const period = periods.find(p => p.id === Number(value));
      const newMonths = Number(value) === currentPeriodId ? months : billingMonthsOf(period);
      setForm(f => ({ ...f, periodId: value as any, month: f.month && newMonths.includes(f.month) ? f.month : (f.type === 'mensualidad' ? newMonths[0] : '') }));
    } else if (k === 'month') {
      // Monthly fee in force for the chosen month (only known for the current period)
      const fee = isCurrentPeriod ? feeByMonth[value] : null;
      setForm(f => (f.type === 'mensualidad' && fee
        ? { ...f, month: value, amount: String(fee.amount), currency: fee.currency }
        : { ...f, month: value }));
    } else if (k === 'type') {
      const descMap: Record<string, string> = {
        mensualidad: 'Mensualidad', matricula: 'Matrícula',
        gastos_administrativos: 'Gastos Administrativos', item: '', otro: '',
      };
      setForm(f => ({
        ...f,
        type: value,
        description: descMap[value] ?? '',
        // Only monthly fees belong to a month; everything else is a one-time debt
        month: value === 'mensualidad' ? (f.month || (periodMonths.includes(CURRENT_MONTH) ? CURRENT_MONTH : periodMonths[0])) : '',
      }));
    } else {
      setForm(f => ({ ...f, [k]: value }));
    }
  };

  const setLine = (i: number, patch: Partial<{ sellableItemId: string; quantity: string }>) =>
    setLines(ls => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const itemOf = (id: string) => sellableItems.find(i => i.id === Number(id));
  const lineCost = (l: { sellableItemId: string; quantity: string }) =>
    Math.round((itemOf(l.sellableItemId)?.amount ?? 0) * Math.max(1, Math.round(Number(l.quantity) || 1)) * 100) / 100;
  const filledLines = lines.filter(l => itemOf(l.sellableItemId));
  const itemTotals = filledLines.reduce<Record<string, number>>((acc, l) => {
    const cur = itemOf(l.sellableItemId)?.exchangeRateType?.currency ?? '';
    acc[cur] = Math.round(((acc[cur] ?? 0) + lineCost(l)) * 100) / 100;
    return acc;
  }, {});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.studentId) return;
    if (form.type === 'item') {
      if (filledLines.length === 0) return;
      onSubmit({
        ...form,
        itemLines: filledLines.map(l => {
          const item = itemOf(l.sellableItemId)!;
          const quantity = Math.max(1, Math.round(Number(l.quantity) || 1));
          return {
            sellableItemId: item.id, description: item.name, quantity,
            amount: Math.round(item.amount * quantity * 100) / 100,
            currency: item.exchangeRateType?.currency ?? form.currency,
          };
        }),
      });
      return;
    }
    if (!form.amount || !form.description) return;
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
              {students.map(s => <option key={s.inscriptionId} value={s.inscriptionId}>{s.rosterNumber != null ? `${s.rosterNumber}. ` : ''}{s.name}</option>)}
            </select>
          </Field>
          <Field label="Tipo de cobro">
            <select value={form.type} onChange={set('type')} className={inputCls}>
              <option value="mensualidad">Mensualidad</option>
              <option value="matricula">Matrícula</option>
              <option value="gastos_administrativos">Gastos Administrativos</option>
              <option value="item">Item vendible</option>
              <option value="otro">Extraordinaria (daños, etc.)</option>
            </select>
          </Field>
          <Field label="Período de la deuda">
            <select value={form.periodId} onChange={set('periodId')} className={inputCls}>
              {periods.map((p: any) => (
                <option key={p.id} value={p.id}>{p.name ?? p.period}{p.id === currentPeriodId ? ' (actual)' : ''}</option>
              ))}
            </select>
          </Field>
          <Field label="Mes (opcional)">
            <select value={form.month} onChange={set('month')} className={inputCls}>
              <option value="">— Sin mes —</option>
              {periodMonths.map(m => <option key={m} value={m}>{MONTH_FULL[m]}</option>)}
            </select>
          </Field>
          {form.type === 'item' ? (
            <div className="col-span-2 space-y-2">
              <div className="text-xs font-semibold text-[#6B7280]">Items vendibles</div>
              {lines.map((l, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select value={l.sellableItemId} onChange={e => setLine(i, { sellableItemId: e.target.value })} required className={`${inputCls} flex-1 min-w-0`}>
                    <option value="" disabled>Seleccionar…</option>
                    {sellableItems.map(it => (
                      <option key={it.id} value={it.id}>{it.name} — {Number(it.amount).toFixed(2)} {it.exchangeRateType?.currency ?? ''}</option>
                    ))}
                  </select>
                  <div className="flex items-stretch shrink-0" title="Cantidad">
                    <button type="button" tabIndex={-1} onClick={() => setLine(i, { quantity: String(Math.max(1, (Math.round(Number(l.quantity)) || 1) - 1)) })}
                      className="w-7 border border-r-0 border-[#C5CAD2] text-[#14181F] hover:bg-[#F4F5F8] font-bold">−</button>
                    <input type="number" min={1} step={1} value={l.quantity} onChange={e => setLine(i, { quantity: e.target.value })}
                      required className={`${inputCls} !w-12 !px-1 text-center tabular-nums`} />
                    <button type="button" tabIndex={-1} onClick={() => setLine(i, { quantity: String((Math.round(Number(l.quantity)) || 0) + 1) })}
                      className="w-7 border border-l-0 border-[#C5CAD2] text-[#14181F] hover:bg-[#F4F5F8] font-bold">+</button>
                  </div>
                  <button type="button" disabled={lines.length === 1} title="Quitar item"
                    onClick={() => setLines(ls => ls.filter((_, j) => j !== i))}
                    className="p-1 text-[#C0453A] hover:bg-[#FBE3E0] disabled:opacity-30 disabled:hover:bg-transparent">
                    <X size={14} />
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => setLines(ls => [...ls, { sellableItemId: '', quantity: '1' }])}
                className="text-xs font-semibold text-[#2F5EA8] hover:underline">
                + Agregar otro item
              </button>
              {filledLines.length > 0 && (
                <div className="text-xs bg-[#F4F5F8] border border-[#E4E6EB] px-3 py-2">
                  {filledLines.length} deuda(s) · Total: <b>{Object.entries(itemTotals).map(([c, v]) => `${v.toFixed(2)} ${c}`).join(' + ')}</b>
                </div>
              )}
            </div>
          ) : (
            <>
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
            </>
          )}
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

// ── Modal: change entry month ──

function EntryMonthModal({ student, months, onClose, onSubmit }: {
  student: LedgerStudent;
  months: string[];
  onClose: () => void;
  onSubmit: (month: string) => void;
}) {
  const [month, setMonth] = useState(student.entryMonth && months.includes(student.entryMonth) ? student.entryMonth : months[0]);
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-[#C5CAD2] w-full max-w-sm shadow-lg">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#E4E6EB] bg-[#EDEEF1]">
          <h3 className="text-sm font-bold uppercase tracking-wide">Mes de ingreso</h3>
          <button onClick={onClose} className="text-[#6B7280] hover:text-[#14181F]"><X size={16} /></button>
        </div>
        <div className="p-4 grid gap-3">
          <p className="text-sm">{student.name}</p>
          <Field label="Mes en que ingresó al período">
            <select value={month} onChange={e => setMonth(e.target.value)} className={inputCls}>
              {months.map(m => <option key={m} value={m}>{MONTH_FULL[m]}</option>)}
            </select>
          </Field>
          <p className="text-xs text-[#6B7280]">
            Se generan las deudas que falten desde ese mes (inscripción y mensualidades). Las deudas y pagos
            existentes no se eliminan.
          </p>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E4E6EB]">
            <button type="button" onClick={onClose} className="text-sm font-semibold px-3 py-1.5 border border-[#C5CAD2] hover:bg-[#F4F5F8]">Cancelar</button>
            <button type="button" onClick={() => onSubmit(month)} className="text-sm font-semibold px-3 py-1.5 bg-[#2F5EA8] text-white hover:bg-[#284F8E]">Guardar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Stat & Legend ──

function Stat({ label, value, icon, tone, large }: {
  label: string; value: string | number; icon?: React.ReactNode; tone?: string; large?: boolean;
}) {
  return (
    <div className="flex flex-col justify-center px-4 py-1.5">
      <span className="text-[9px] font-semibold text-[#8B909A] uppercase tracking-wide flex items-center gap-1">{icon}{label}</span>
      <span className={`font-bold tabular-nums ${large ? 'text-lg leading-tight' : 'text-sm'} ${tone ?? ''}`}>{value}</span>
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
  const dragScroll = useDragScroll<HTMLDivElement>();
  const { viewPeriod, activePeriod, allPeriods } = useSchool();
  const schoolPeriodId = viewPeriod?.id;

  const [sections, setSections] = useState<LedgerSection[]>([]);
  const [selectedSection, setSelectedSection] = useState<LedgerSection | null>(null);
  const [students, setStudents] = useState<LedgerStudent[]>([]);
  const [months, setMonths] = useState<string[]>(DEFAULT_MONTHS);
  const [monthlyFeeByMonth, setMonthlyFeeByMonth] = useState<Record<string, { amount: number; currency: string } | null>>({});
  const [monthlyFee, setMonthlyFee] = useState<{ amount: number; currency: string } | null>(null);
  const [totals, setTotals] = useState<Record<string, { charged: number; paid: number; pending: number }>>({});
  // Debts are counted up to this month (null = the default: the current month of the active period, else the whole period).
  const [cutoffChoice, setCutoffChoice] = useState<string | null>(null);
  const defaultCutoff = viewPeriod?.id === activePeriod?.id && months.includes(CURRENT_MONTH) ? CURRENT_MONTH : months[months.length - 1];
  const cutoffMonth = cutoffChoice && months.includes(cutoffChoice) ? cutoffChoice : defaultCutoff;
  // Which section the loaded `students` belong to. While it matches the selected
  // section the table stays mounted during reloads (no "Cargando…" flicker).
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const sectionKey = selectedSection && schoolPeriodId
    ? `${schoolPeriodId}/${selectedSection.gradeId}/${selectedSection.sectionId}`
    : null;
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [paymentModal, setPaymentModal] = useState<{ studentId?: number; month?: string } | null>(null);
  const [chargeModal, setChargeModal] = useState<{ studentId?: number; month?: string } | null>(null);
  const [entryModal, setEntryModal] = useState<LedgerStudent | null>(null);
  const [planModal, setPlanModal] = useState<LedgerStudent | null>(null);
  const [discountStudentId, setDiscountStudentId] = useState<number | null>(null);
  const [sellableItems, setSellableItems] = useState<SellableItem[]>([]);
  const [flash, setFlash] = useState<string | null>(null);
  // Withdrawn-debt flow: search modal + the picked student injected into AddChargeModal.
  const [withdrawnModal, setWithdrawnModal] = useState(false);
  const [reportModal, setReportModal] = useState(false);
  const [extraChargeStudent, setExtraChargeStudent] = useState<LedgerStudent | null>(null);

  // Load sections when period changes
  const loadSections = useCallback(() => {
    if (!schoolPeriodId) return;
    getLedgerSections(schoolPeriodId).then(setSections).catch(() => setSections([]));
  }, [schoolPeriodId]);

  useEffect(() => {
    loadSections();
    setSelectedSection(null);
    setCutoffChoice(null);
  }, [loadSections]);

  // Load ledger data when section changes
  const loadLedger = useCallback(async () => {
    if (!schoolPeriodId || !selectedSection) return;
    const key = `${schoolPeriodId}/${selectedSection.gradeId}/${selectedSection.sectionId}`;
    try {
      const res = await getLedgerBySection(schoolPeriodId, selectedSection.gradeId, selectedSection.sectionId, cutoffMonth);
      setStudents(res.students);
      setMonths(res.months?.length ? res.months : DEFAULT_MONTHS);
      setMonthlyFeeByMonth(res.monthlyFeeByMonth ?? {});
      setMonthlyFee(res.monthlyFee);
      setTotals(res.totals ?? {});
    } catch {
      setStudents([]);
    } finally {
      setLoadedKey(key);
    }
  }, [schoolPeriodId, selectedSection, cutoffMonth]);

  useEffect(() => {
    loadLedger();
  }, [loadLedger]);

  // Name-sort cycle: canonical (roster number) → A-Z → Z-A → canonical.
  const [nameSort, setNameSort] = useState<'canonical' | 'asc' | 'desc'>('canonical');
  const nameCollator = useMemo(() => new Intl.Collator('es', { sensitivity: 'base' }), []);

  const filteredStudents = useMemo(() => {
    const list = students.filter(s => s.name.toLowerCase().includes(query.toLowerCase()));
    if (nameSort === 'asc') list.sort((a, b) => nameCollator.compare(a.name, b.name));
    else if (nameSort === 'desc') list.sort((a, b) => nameCollator.compare(b.name, a.name));
    else list.sort((a, b) =>
      (a.rosterNumber ?? Number.MAX_SAFE_INTEGER) - (b.rosterNumber ?? Number.MAX_SAFE_INTEGER)
      || nameCollator.compare(a.name, b.name));
    return list;
  }, [students, query, nameSort, nameCollator]);

  const cycleNameSort = () =>
    setNameSort(m => m === 'canonical' ? 'asc' : m === 'asc' ? 'desc' : 'canonical');

  // Prior-period debts are NOT a column: they fold into the student's first
  // cell (entry month) — that year's enrollment cannot be paid until the old
  // debt is settled, and the payment order already enforces it.

  // Opening a student's detail brings it into view (it may expand below the visible edge).
  useEffect(() => {
    if (!openKey) return;
    const id = openKey.split('-')[0];
    const timer = setTimeout(() => {
      const box = dragScroll.ref.current;
      const block = box?.querySelector(`[data-ledger-student="${id}"]`);
      if (!box || !block) return;
      const head = box.querySelector('[data-ledger-head]')?.getBoundingClientRect().height ?? 0;
      const b = block.getBoundingClientRect();
      const c = box.getBoundingClientRect();
      const top = b.top - c.top - head;
      if (top >= 0 && b.bottom - c.top <= c.height) return;
      const room = c.height - head;
      const offset = b.height >= room ? 0 : (room - b.height) / 2;
      box.scrollBy({ top: top - offset, behavior: 'smooth' });
    }, 60);
    return () => clearTimeout(timer);
  }, [openKey, dragScroll.ref]);

  const [exporting, setExporting] = useState(false);
  const handleExport = async () => {
    if (!selectedSection) return;
    setExporting(true);
    try {
      const { exportLedgerExcel } = await import('./exportLedgerExcel');
      await exportLedgerExcel({
        sectionLabel: `${selectedSection.gradeName} ${selectedSection.sectionName}`,
        periodLabel: viewPeriod?.name ?? viewPeriod?.period ?? '',
        cutoffLabel: MONTH_FULL[cutoffMonth] ?? cutoffMonth,
        rows: filteredStudents.map(st => ({
          name: st.name, document: st.document, rosterNumber: st.rosterNumber,
          paid: totalsByStudent.get(st.inscriptionId)?.paid ?? {},
          pending: totalsByStudent.get(st.inscriptionId)?.pending ?? {},
          progress: yearProgress(st, feeAmountFor, months, cutoffMonth),
        })),
      });
    } finally {
      setExporting(false);
    }
  };

  const toggle = (inscriptionId: number, month: string) => {
    const key = `${inscriptionId}-${month}`;
    setOpenKey(prev => prev === key ? null : key);
  };

  const handleAddPayment = async (form: any, allowDuplicate = false, allowNoDebt = false): Promise<void> => {
    if (!schoolPeriodId) return;
    try {
      if (form.shared) {
        const result = await createSharedPayment({
          inscriptionIds: form.shared.inscriptionIds,
          schoolPeriodId,
          scope: form.scope === 'auto' ? undefined : form.scope,
          amount: parseFloat(form.amount),
          currency: form.currency,
          amountVES: form.currency === 'VES' ? parseFloat(form.amount) : null,
          method: form.method,
          reference: form.reference || undefined,
          bank: form.bank || undefined,
          account: form.account || undefined,
          notes: form.notes || undefined,
          paymentDate: form.paymentDate || undefined,
          clientRequestId: form.clientRequestId,
          allowDuplicate: allowDuplicate || undefined,
          portions: form.shared.portions,
        });
        setPaymentModal(null);
        setFlash(`Pago de ${form.amount} ${form.currency} registrado y repartido entre ${result.payments.length} estudiantes`);
        setTimeout(() => setFlash(null), 5000);
        loadLedger();
        return;
      }
      const created = await createPayment({
        inscriptionId: Number(form.studentId),
        schoolPeriodId,
        // Debts always settle in order; the scope just narrows the universe.
        scope: form.scope === 'auto' ? undefined : form.scope,
        chargeId: form.scope === 'item' && form.chargeId ? Number(form.chargeId) : undefined,
        amount: parseFloat(form.amount),
        currency: form.currency,
        amountVES: form.currency === 'VES' ? parseFloat(form.amount) : null,
        method: form.method,
        reference: form.reference || undefined,
        bank: form.bank || undefined,
        account: form.account || undefined,
        notes: form.notes || undefined,
        paymentDate: form.paymentDate || undefined,
        clientRequestId: form.clientRequestId,
        allowDuplicate: allowDuplicate || undefined,
        allowNoDebt: allowNoDebt || undefined,
      });
      setPaymentModal(null);
      const allocs: { amount: number; currency: string; description: string | null; atPar: boolean; bonus?: number }[] = created?.allocations ?? [];
      // The total in the debt currency plus the breakdown of which debts the payment settled.
      const totalNote = created?.equivalent != null && created?.equivalentCurrency && created.equivalentCurrency !== form.currency
        ? ` = ${Number(created.equivalent).toFixed(2)} ${created.equivalentCurrency}${created.atPar ? ' a la par' : ''}`
        : '';
      const splitNote = allocs.length
        ? ' → ' + allocs.map(a => `${Number(a.amount).toFixed(2)} ${a.currency}${a.atPar ? ' a la par' : ''}${a.description ? ` · ${a.description}` : ''}${(a.bonus ?? 0) > 0.005 ? ` (incl. ${Number(a.bonus).toFixed(2)} de descuento)` : ''}`).join(' + ')
        : '';
      setFlash(`Pago de ${form.amount} ${form.currency} registrado${totalNote}${splitNote || (form.scope === 'auto' ? ' · distribución automática' : '')}`);
      setTimeout(() => setFlash(null), allocs.length > 1 ? 8000 : 3500);
      loadLedger();
    } catch (err: any) {
      const data = err?.response?.data;
      if (err?.response?.status === 409 && data?.code === 'DUPLICATE_PAYMENT') {
        const d = data.duplicate as DuplicatePaymentInfo | undefined;
        // Possible duplicate: show who registered the original and let the admin decide.
        Modal.confirm({
          title: 'Posible pago duplicado',
          width: 460,
          okText: 'Registrar de todas formas',
          cancelText: 'Cancelar',
          okButtonProps: { danger: true },
          content: d ? (
            <div className="text-sm space-y-1">
              <p>Ya existe un pago igual registrado:</p>
              <ul className="list-disc pl-5">
                <li>Estudiante: <b>{d.studentName}</b></li>
                <li>Monto: <b>{Number(d.amount).toFixed(2)} {d.currency}</b>{d.reference ? ` · ref. ${d.reference}` : ''}</li>
                <li>Fecha del pago: {new Date(d.paymentDate).toLocaleDateString('en-GB')}</li>
                <li>Registrado por: <b>{d.registeredBy ?? 'sin registro'}</b> el {new Date(d.createdAt).toLocaleString('en-GB')}</li>
              </ul>
              <p>Si es el mismo pago, cancele. Registre solo si es una operación distinta.</p>
            </div>
          ) : 'Este pago ya fue registrado.',
          onOk: () => handleAddPayment(form, true, allowNoDebt),
        });
        return;
      }
      if (err?.response?.status === 409 && data?.code === 'NO_PENDING_DEBT') {
        const name = students.find(s => s.inscriptionId === Number(form.studentId))?.name;
        Modal.confirm({
          title: 'El estudiante no tiene deudas pendientes',
          width: 460,
          okText: 'Registrar de todas formas',
          cancelText: 'Cancelar',
          okButtonProps: { danger: true },
          content: (
            <div className="text-sm space-y-1">
              <p>{name ? <b>{name}</b> : 'Este estudiante'} no tiene ninguna deuda pendiente, así que este pago de <b>{form.amount} {form.currency}</b> no se aplicaría a nada y quedaría como saldo a favor.</p>
              <p>Verifique que el estudiante y el monto sean correctos. Registre solo si el pago es adelantado o intencional.</p>
            </div>
          ),
          onOk: () => handleAddPayment(form, allowDuplicate, true),
        });
        return;
      }
      // The payment modal stays open, so surface the error in a modal on top of it
      // (the page flash would be hidden behind it).
      if (data?.code === 'OUT_OF_ORDER_PAYMENT') {
        const blocking: { description: string; amount: number; currency: string }[] = data.blocking ?? [];
        Modal.error({
          title: 'Pago fuera de orden',
          content: (
            <div className="text-sm space-y-2">
              <p>Los pagos deben seguir el orden de las deudas. Primero debe saldar:</p>
              <ul className="list-disc pl-5">
                {blocking.map((b, i) => (
                  <li key={i}><b>{b.description}</b> — {Number(b.amount).toFixed(2)} {b.currency}</li>
                ))}
              </ul>
            </div>
          ),
        });
        return;
      }
      Modal.error({ title: 'No se pudo registrar el pago', content: data?.message || 'Error al registrar pago' });
      setFlash(data?.message || 'Error al registrar pago');
      setTimeout(() => setFlash(null), 5000);
    }
  };

  useEffect(() => {
    listSellableItems({ active: true }).then(setSellableItems).catch(() => setSellableItems([]));
  }, []);

  const handleChangeEntryMonth = async (month: string) => {
    if (!entryModal) return;
    try {
      const res = await updateEntryMonth(entryModal.inscriptionId, month);
      setEntryModal(null);
      setFlash(`Mes de ingreso: ${MONTH_FULL[month]} · se generaron ${res.generated} deuda(s)`);
      setTimeout(() => setFlash(null), 3500);
      loadLedger();
    } catch (err: any) {
      setFlash(err.response?.data?.message || 'Error al cambiar el mes de ingreso');
      setTimeout(() => setFlash(null), 3500);
    }
  };

  // Right-click (or the ⋯ button) menu of a student row
  const studentMenu = (student: LedgerStudent): MenuProps => ({
    items: [
      { key: 'charge', icon: <AlertTriangle size={14} />, label: 'Agregar deuda…' },
      { key: 'payment', icon: <DollarSign size={14} />, label: 'Registrar pago…' },
      { key: 'discount', icon: <BadgePercent size={14} />, label: 'Descuentos y becas…' },
      { key: 'plan', icon: <Shirt size={14} />, label: 'Plan de inscripción…' },
      { key: 'entry', icon: <CalendarClock size={14} />, label: `Mes de ingreso (${MONTH_FULL[student.entryMonth ?? months[0]] ?? '—'})…` },
    ],
    onClick: ({ key }) => {
      if (key === 'charge') setChargeModal({ studentId: student.inscriptionId });
      else if (key === 'payment') setPaymentModal({ studentId: student.inscriptionId });
      else if (key === 'discount') setDiscountStudentId(student.inscriptionId);
      else if (key === 'plan') setPlanModal(student);
      else if (key === 'entry') setEntryModal(student);
    },
  });

  const handleAddCharge = async (form: any) => {
    if (!schoolPeriodId) return;
    try {
      const base = {
        inscriptionId: Number(form.studentId),
        schoolPeriodId: Number(form.periodId) || schoolPeriodId,
        month: form.month || null,
      };
      if (form.type === 'item' && Array.isArray(form.itemLines)) {
        // One debt per item line, created together.
        await bulkCreateCharges(form.itemLines.map((l: any) => ({ ...base, type: 'item', ...l })));
        setFlash(`${form.itemLines.length} deuda(s) de items registrada(s) · ${MONTH_FULL[form.month] || 'no mensual'}`);
      } else {
        await createCharge({
          ...base,
          type: form.type,
          description: form.description,
          amount: parseFloat(form.amount),
          currency: form.currency,
        });
        setFlash(`Deuda de ${form.amount} ${form.currency} registrada · ${MONTH_FULL[form.month] || 'no mensual'}`);
      }
      setChargeModal(null);
      setExtraChargeStudent(null);
      setTimeout(() => setFlash(null), 3500);
      loadLedger();
      // A debt on a withdrawn student can create a new "Sin sección" group.
      loadSections();
    } catch {
      setFlash('Error al registrar deuda');
      setTimeout(() => setFlash(null), 3500);
    }
  };

  // Wrong-student / duplicate entries: both corrections ask for a reason and leave an audit trail.
  const [correction, setCorrection] = useState<{ txn: any; mode: CorrectionMode; studentName: string } | null>(null);
  const handleCorrectPayment = (txn: any, mode: CorrectionMode) => {
    const owner = students.find(s => s.inscriptionId === txn.inscriptionId);
    setCorrection({ txn, mode, studentName: owner?.name ?? '' });
  };
  const handleCorrectionDone = (message: string) => {
    setCorrection(null);
    setFlash(message);
    setTimeout(() => setFlash(null), 4000);
    loadLedger();
  };

  // Withdrawn student picked in the search modal → open AddChargeModal with a
  // stub entry so their inscription can be selected even though they are not
  // in the currently loaded ledger.
  const pickWithdrawn = (r: WithdrawnStudentResult) => {
    const emptyBucket = (): LedgerBucket => ({
      charges: [], payments: [], byCurrency: {}, currency: null,
      grossCharged: 0, totalDiscount: 0, totalCharged: 0, totalPaid: 0,
      totalChargedVES: 0, totalPaidVES: 0,
    });
    setExtraChargeStudent({
      inscriptionId: r.inscriptionId,
      personId: r.personId,
      name: r.name,
      document: r.document,
      rosterNumber: null,
      entryMonth: null,
      guardians: [],
      gradeName: r.gradeName,
      sectionName: 'Sin sección',
      months: {},
      enrollment: emptyBucket(),
      other: emptyBucket(),
      priorPeriods: [],
      discounts: [],
    });
    setChargeModal({ studentId: r.inscriptionId });
    setWithdrawnModal(false);
  };

  // Per-student totals, computed once per ledger load (shown in the row corners).
  const totalsByStudent = useMemo(() => new Map(students.map(s => [s.inscriptionId, studentTotals(s, months, cutoffMonth)])), [students, months, cutoffMonth]);
  const totalsOf = (s: LedgerStudent) => totalsByStudent.get(s.inscriptionId) ?? { paid: {}, pending: {} };

  const feeAmountFor = (m: string) => (monthlyFeeByMonth[m] ?? monthlyFee)?.amount ?? 0;
  const totalPaidText = formatTotals(Object.fromEntries(Object.entries(totals).map(([c, t]) => [c, t.paid])));
  const totalPendingText = formatTotals(students.reduce((acc, s) => {
    for (const [c, v] of Object.entries(totalsOf(s).pending)) acc[c] = (acc[c] ?? 0) + v;
    return acc;
  }, {} as Record<string, number>));
  const avgCompletion = students.length > 0
    ? Math.round(students.reduce((s, st) => s + yearProgress(st, feeAmountFor, months, cutoffMonth), 0) / students.length * 100)
    : 0;
  // The "Otros" column only exists when some student has extraordinary debts
  const hasOther = useMemo(
    () => students.some(s => (s.other?.totalCharged ?? 0) > 0 || (s.other?.totalPaid ?? 0) > 0),
    [students],
  );

  // Entry month of a student (its enrollment-plan debts display inside this cell)
  const entryMonthOf = (s: LedgerStudent) =>
    s.entryMonth && months.includes(s.entryMonth) ? s.entryMonth : months[0];

  // Extra columns: prior debt periods + extraordinary debts ("Otros")
  const tableWidth = NAME_COL + (months.length + (hasOther ? 1 : 0)) * MONTH_COL;

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#EDEEF1] font-sans text-[#14181F] px-6 pt-6 pb-1">
      <div className="w-full flex-1 min-h-0 flex flex-col">
        {/* toolbar */}
        <div className="shrink-0 flex items-stretch justify-between bg-white border border-[#C5CAD2] mb-px flex-wrap">
          <div className="flex items-center gap-3 px-4 py-3 border-r border-[#E4E6EB]">
            <span className="text-[10px] font-semibold text-[#8B909A] uppercase tracking-wide">Sección</span>
            <select
              value={selectedSection ? `${selectedSection.gradeId}-${selectedSection.sectionId ?? 'null'}` : ''}
              onChange={e => {
                const [gidStr, sidStr] = e.target.value.split('-');
                const gid = Number(gidStr);
                const sid = sidStr === 'null' ? null : Number(sidStr);
                const found = sections.find(s => s.gradeId === gid && s.sectionId === sid);
                setSelectedSection(found ?? null);
              }}
              className="text-sm font-bold border border-[#C5CAD2] px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#2F5EA8]"
            >
              <option value="" disabled>Seleccionar…</option>
              {sections.map(s => (
                <option key={`${s.gradeId}-${s.sectionId ?? 'null'}`} value={`${s.gradeId}-${s.sectionId ?? 'null'}`}>{s.gradeName} — {s.sectionName}</option>
              ))}
            </select>
          </div>
          {selectedSection && (
            <div className="flex items-stretch divide-x divide-[#E4E6EB]">
              <Stat label="Total pagado" value={totalPaidText} icon={<DollarSign size={10} />} tone="text-[#0F7A45]" large />
              <div className="flex flex-col justify-center px-3 py-1 gap-0.5" title="La deuda se calcula hasta este mes de cobro, inclusive (inscripción y deudas de otros períodos siempre cuentan)">
                <span className="text-[9px] font-semibold text-[#8B909A] uppercase tracking-wide">Deuda hasta</span>
                <select value={cutoffMonth} onChange={e => setCutoffChoice(e.target.value)}
                  className="text-xs font-bold border border-[#C5CAD2] px-1 py-0.5 focus:outline-none focus:ring-2 focus:ring-[#2F5EA8]">
                  {months.map(m => <option key={m} value={m}>{MONTH_FULL[m] ?? m}</option>)}
                </select>
              </div>
              <Stat label="Deuda pendiente" value={totalPendingText} icon={<AlertTriangle size={10} />} tone="text-[#B42318]" large />
              <Stat label="Cumplimiento" value={`${avgCompletion}%`} icon={<TrendingUp size={10} />} />
              <Stat label="Estudiantes" value={students.length} />
            </div>
          )}
          {/* Always right-aligned. Section-only tools (search, export) enter from the LEFT, so the two always-present buttons never move. */}
          <div className="flex items-stretch flex-1 min-w-full min-[1500px]:min-w-0 justify-end border-t border-[#E4E6EB] min-[1500px]:border-t-0">
            {selectedSection && (
              <div className="flex items-center px-3 py-2 min-[1500px]:border-l border-[#E4E6EB] flex-1 min-[1500px]:flex-none">
                <div className="relative w-full min-[1500px]:w-auto">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                  <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Buscar estudiante…"
                    className="pl-8 pr-3 py-1.5 text-sm border border-[#C5CAD2] w-full min-[1500px]:w-48
                      focus:outline-none focus:ring-2 focus:ring-[#2F5EA8] focus:border-[#2F5EA8] placeholder:text-[#9CA3AF]"
                  />
                </div>
              </div>
            )}
            {selectedSection && (
              <div className="flex items-center px-3 py-2 border-l border-[#E4E6EB]">
                <button type="button" onClick={handleExport} disabled={exporting || filteredStudents.length === 0}
                  title="Descargar en Excel la lista de estudiantes (en el orden mostrado) con sus totales pagados y deudas hasta el mes elegido"
                  className="flex items-center gap-1.5 text-xs font-semibold text-[#2F5EA8] hover:text-[#1E4478] disabled:opacity-50 disabled:cursor-not-allowed">
                  <FileSpreadsheet size={14} /> {exporting ? 'Exportando…' : 'Exportar a Excel'}
                </button>
              </div>
            )}
            <div className="flex items-center px-3 py-2 border-l border-[#E4E6EB]">
              <button type="button" onClick={() => setWithdrawnModal(true)}
                title="Registrar una deuda a un estudiante retirado (incluidas deudas históricas)"
                className="flex items-center gap-1.5 text-xs font-semibold text-[#2F5EA8] hover:text-[#1E4478]">
                <UserX size={14} /> Deuda a retirado…
              </button>
            </div>
            <div className="flex items-center px-3 py-2 border-l border-[#E4E6EB]">
              <button type="button" onClick={() => setReportModal(true)}
                title="Resumen de pagos y entregas de items de todas las secciones: filtrar por fecha o usuario, totales e impresión"
                className="flex items-center gap-1.5 text-xs font-semibold text-[#2F5EA8] hover:text-[#1E4478]">
                <FileText size={14} /> Resumen de movimientos
              </button>
            </div>
          </div>
        </div>

        {/* legend */}
        {selectedSection && (
          <div className="shrink-0 flex items-center gap-4 px-4 py-2 bg-white border-x border-b border-[#C5CAD2] text-xs text-[#6B7280] flex-wrap">
            <LegendSwatch color={STATUS.paid.fill} label="Al día" />
            <LegendSwatch color={STATUS.partial.fill} label="Parcial" />
            <LegendSwatch color={STATUS.overdue.fill} label="Atrasado" />
            <LegendSwatch color={STATUS.none.fill} label="Aún no vence" />
            <span className="text-[#C5CAD2]">|</span>
            <span>Clic en una celda para ver el detalle · clic derecho (o ⋯) sobre un estudiante para agregar deuda, pago o cambiar su mes de ingreso</span>
            {monthlyFee && (
              <span className="text-[#C5CAD2]">|</span>
            )}
            {monthlyFee && (
              <span>Cuota mensual: <b>{monthlyFee.amount.toFixed(2)} {monthlyFee.currency}</b></span>
            )}
          </div>
        )}

        {flash && (
          <div className="shrink-0 px-4 py-2 bg-[#E9F7ED] border-x border-b border-[#B7EACB] text-sm text-[#1A4D2E] font-medium">
            {flash}
          </div>
        )}

        {!selectedSection ? (
          <div className="bg-white border-x border-b border-[#C5CAD2] p-12 text-center text-[#8B909A]">
            Selecciona una sección para ver el ledger de pagos.
          </div>
        ) : sectionKey !== loadedKey ? (
          <div className="bg-white border-x border-b border-[#C5CAD2] p-12 text-center text-[#8B909A]">
            Cargando…
          </div>
        ) : students.length === 0 ? (
          <div className="bg-white border-x border-b border-[#C5CAD2] p-12 text-center text-[#8B909A]">
            No hay estudiantes inscritos en esta sección.
          </div>
        ) : (
          /* table */
          <div className="flex-1 min-h-0 flex flex-col bg-white border-x border-b border-[#C5CAD2] overflow-hidden">
            <div
              ref={dragScroll.ref}
              onMouseDown={dragScroll.onMouseDown}
              className={`flex-1 min-h-0 overflow-auto ${dragScroll.dragging ? 'cursor-grabbing select-none' : ''}`}
            >
              <div style={{ width: tableWidth }}>
                <div data-ledger-head className="sticky top-0 z-30 flex bg-[#EDEEF1] border-b-2 border-[#B9BEC7]">
                  <button
                    type="button"
                    onClick={cycleNameSort}
                    title={nameSort === 'canonical' ? 'Orden canónico (número de lista) — clic para ordenar por nombre' : nameSort === 'asc' ? 'Nombre A→Z — clic para Z→A' : 'Nombre Z→A — clic para volver al orden canónico'}
                    style={{ width: NAME_COL }}
                    className="sticky left-0 z-20 bg-[#EDEEF1] px-4 py-2.5 text-[11px] font-semibold text-[#5B6472] uppercase tracking-wide border-r-2 border-[#B9BEC7] flex items-center gap-1.5 cursor-pointer select-none hover:text-[#2F5EA8] transition-colors"
                  >
                    Estudiante
                    {nameSort === 'asc' && <ArrowDownAZ size={13} className="text-[#2F5EA8]" />}
                    {nameSort === 'desc' && <ArrowUpAZ size={13} className="text-[#2F5EA8]" />}
                    {nameSort === 'canonical' && <ArrowUpDown size={12} className="opacity-50" />}
                  </button>
                  {hasOther && (
                    <div style={{ width: MONTH_COL }}
                      className="py-2.5 text-[11px] font-semibold text-center border-r border-[#DBDEE4] uppercase tracking-wide text-[#5B6472]">
                      Otros
                    </div>
                  )}
                  {months.map(m => (
                    <div key={m} style={{ width: MONTH_COL }}
                      className={`py-2.5 text-[11px] font-semibold text-center border-r border-[#DBDEE4] uppercase tracking-wide
                        ${m === CURRENT_MONTH ? 'bg-[#DCE5F7] text-[#2F5EA8]' : 'text-[#5B6472]'}`}>
                      {MONTH_FULL[m] ?? m}
                    </div>
                  ))}
                </div>

                {filteredStudents.map((student, rowIndex) => {
                  const progress = yearProgress(student, feeAmountFor, months, cutoffMonth);
                  const [openInscription, openMonth] = openKey?.split('-') ?? ['', ''];
                  const isOpen = openKey === `${student.inscriptionId}-${openMonth}` && openInscription === String(student.inscriptionId);
                  // The student whose detail is open stands out: tinted row, blue accent bar and a blue frame around row + detail.
                  const rowBg = isOpen ? 'bg-[#E6EEFA]' : rowIndex % 2 === 1 ? 'bg-[#FAFBFC]' : 'bg-white';
                  // Paid credited per charge (drives the item-badge paid/pending color).
                  const paidByCharges = chargePaidBy(
                    student.enrollment, student.other,
                    ...Object.values(student.months ?? {}),
                    ...priorBucketsOf(student),
                  );

                  return (
                    <div key={student.inscriptionId} data-ledger-student={student.inscriptionId} className={isOpen ? 'border-y-2 border-[#2F5EA8]' : ''}>
                      <Dropdown trigger={['contextMenu']} menu={studentMenu(student)}>
                      <div className={`flex ${rowBg}`}>
                        <div style={{ width: NAME_COL }}
                          className={`sticky left-0 z-10 ${rowBg} flex items-stretch min-w-0 border-r-2 border-[#B9BEC7] border-b border-[#DBDEE4] ${isOpen ? 'border-l-[6px] border-l-[#2F5EA8]' : ''}`}>
                          <span
                            className="absolute top-0.5 left-1.5 text-[9px] leading-none font-semibold tabular-nums text-[#0F7A45] pointer-events-none"
                            title="Total pagado por este estudiante"
                          >
                            Pagado {formatTotals(totalsOf(student).paid)}
                          </span>
                          {/* Name — 80% */}
                          <div className="relative flex items-center gap-2.5 min-w-0 flex-1 px-4 py-2.5">
                            {formatTotals(totalsOf(student).pending) !== '0' && (
                              <span
                                className="absolute top-0.5 right-1 text-[9px] leading-none font-semibold tabular-nums text-[#B42318] pointer-events-none"
                                title="Deuda pendiente total de este estudiante"
                              >
                                Debe {formatTotals(totalsOf(student).pending)}
                              </span>
                            )}
                            <span className="text-[10px] font-bold w-6 text-right tabular-nums shrink-0 text-[#8B909A]">
                              {student.rosterNumber ?? '—'}
                            </span>
                            <span className="text-[10px] font-bold w-6 h-6 rounded-sm flex items-center justify-center shrink-0 bg-[#DEDBFB] text-[#3730A3]">
                              {initials(student.name)}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium truncate leading-tight">
                                {student.name}
                                {student.discounts?.length > 0 && (
                                  <span
                                    className="inline-flex items-center gap-0.5 ml-1.5 align-middle text-[#0F7A45]"
                                    title={student.discounts.map(d => `${d.reasonName}: ${d.kind === 'percent' ? d.value + '%' : d.value}`).join(' · ')}
                                  >
                                    <BadgePercent size={13} />
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="flex-1 h-1.5 bg-[#EDEEF1] border border-[#DBDEE4] overflow-hidden max-w-[90px]">
                                  <span className="block h-full bg-[#2F5EA8]" style={{ width: `${progress * 100}%` }} />
                                </span>
                                <span className="text-[10px] text-[#8B909A] tabular-nums shrink-0">{Math.round(progress * 100)}%</span>
                              </div>
                            </div>
                          </div>
                          <Dropdown trigger={['click']} menu={studentMenu(student)}>
                            <button
                              className="flex items-center justify-center text-[#5B6472] hover:text-[#2F5EA8] hover:bg-[#EDEEF1] shrink-0 px-2"
                              title="Más acciones"
                            >
                              <MoreHorizontal size={16} />
                            </button>
                          </Dropdown>
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

                        {hasOther && (() => {
                          const { charged, paid } = mergedTotals(student.other);
                          const pending = pendingByCurrency(student.other);
                          return (
                            <MonthCell
                              paid={paid}
                              charged={charged}
                              month={OTHER}
                              months={months}
                              isOpen={openKey === `${student.inscriptionId}-${OTHER}`}
                              onClick={() => toggle(student.inscriptionId, OTHER)}
                              corner={Object.keys(pending).length ? (
                                <span className="text-[#B42318]" title="Deuda pendiente de estas deudas extraordinarias">
                                  {formatTotals(pending)}
                                </span>
                              ) : undefined}
                            />
                          );
                        })()}
                        {months.map(m => {
                          const data = student.months[m];
                          const key = `${student.inscriptionId}-${m}`;
                          const priors = priorBucketsOf(student);
                          const priorT = mergedTotals(...priors);
                          const isEntry = m === entryMonthOf(student);
                          // The entry month's cell carries the enrollment-plan
                          // debts AND any prior-period debt (which is always
                          // past due — it must be settled before this year's).
                          const { charged, paid } = isEntry
                            ? mergedTotals(data, student.enrollment, ...priors)
                            : { charged: data?.totalCharged ?? 0, paid: data?.totalPaid ?? 0 };
                          const priorDue = isEntry && priorT.charged - priorT.paid > 0.005;
                          const badges = isEntry
                            ? itemChargesOf(data, student.enrollment, ...priors)
                            : itemChargesOf(data);
                          // Corner: this cell's pending debt, per currency
                          // (entry month = enrollment + prior periods + month).
                          const pending = isEntry
                            ? pendingByCurrency(data, student.enrollment, ...priors)
                            : pendingByCurrency(data);
                          return (
                            <MonthCell
                              key={m}
                              paid={paid}
                              charged={charged}
                              month={m}
                              months={months}
                              forceStatus={priorDue ? priorStatus(paid, charged) : undefined}
                              isOpen={openKey === key}
                              onClick={() => toggle(student.inscriptionId, m)}
                              badges={badges.length ? <ItemBadges charges={badges} paidBy={paidByCharges} /> : undefined}
                              corner={Object.keys(pending).length ? (
                                <span className="text-[#B42318]"
                                  title={isEntry ? 'Deuda pendiente: inscripción + deudas de períodos anteriores + este mes' : 'Deuda pendiente de este mes'}>
                                  {formatTotals(pending)}
                                </span>
                              ) : undefined}
                            />
                          );
                        })}
                      </div>
                      </Dropdown>

                      {isOpen && openMonth && (
                        <div className="flex">
                          <div style={{ width: NAME_COL }}
                            className="sticky left-0 z-10 bg-[#E6EEFA] border-l-[6px] border-l-[#2F5EA8] border-r-2 border-[#B9BEC7] flex flex-col pt-2.5 min-w-0">
                            <div className="flex justify-end pr-2 shrink-0">
                              <ChevronDown size={13} className="text-[#2F5EA8]" />
                            </div>
                            <GuardianPanel guardians={student.guardians ?? []} ownPending={totalsOf(student).pending} />
                          </div>
                          {/* Pinned next to the name column and capped to the visible width, so amounts and action buttons never leave the screen. */}
                          <div className="sticky @container" style={{
                            left: NAME_COL,
                            width: Math.min(tableWidth - NAME_COL, Math.max(dragScroll.viewWidth - NAME_COL, 360)),
                          }}>
                            {openMonth === OTHER ? (
                              <MonthDetail
                                label="Otras deudas"
                                month={OTHER}
                                data={student.other}
                                monthlyFee={monthlyFee ? { amount: 0, currency: monthlyFee.currency } : null}
                                onAddPayment={() => setPaymentModal({ studentId: student.inscriptionId })}
                                onCorrectPayment={handleCorrectPayment}
                                onChanged={loadLedger}
                              />
                            ) : openMonth === entryMonthOf(student) ? (
                              <>
                                {/* Pending debt first (old or current); settled blocks follow in their natural order. */}
                                {[
                                  ...(student.priorPeriods ?? []).map(g => ({
                                    key: `prior-${g.periodId}`,
                                    pending: priorBucketsOf({ priorPeriods: [g] } as LedgerStudent).reduce((s, b) => s + pendingOf(b), 0),
                                    node: (
                                      <PriorPeriodDetail
                                        key={g.periodId}
                                        group={g}
                                        onAddPayment={() => setPaymentModal({ studentId: student.inscriptionId })}
                                        onCorrectPayment={handleCorrectPayment}
                                        onChanged={loadLedger}
                                      />
                                    ),
                                  })),
                                  ...((student.enrollment?.charges?.length || student.enrollment?.payments?.length) ? [{
                                    key: 'enrollment',
                                    pending: pendingOf(student.enrollment),
                                    node: (
                                      <MonthDetail
                                        key="enrollment"
                                        label="Inscripción"
                                        month={OTHER}
                                        data={student.enrollment}
                                        monthlyFee={monthlyFee ? { amount: 0, currency: monthlyFee.currency } : null}
                                        onAddPayment={() => setPaymentModal({ studentId: student.inscriptionId })}
                                        onCorrectPayment={handleCorrectPayment}
                                        onChanged={loadLedger}
                                      />
                                    ),
                                  }] : []),
                                  ...(student.months[openMonth] ? [{
                                    key: 'month',
                                    pending: pendingOf(student.months[openMonth]),
                                    node: (
                                      <MonthDetail
                                        key="month"
                                        month={openMonth}
                                        data={student.months[openMonth]}
                                        monthlyFee={monthlyFeeByMonth[openMonth] ?? monthlyFee}
                                        onAddPayment={() => setPaymentModal({ studentId: student.inscriptionId })}
                                        onCorrectPayment={handleCorrectPayment}
                                        onChanged={loadLedger}
                                      />
                                    ),
                                  }] : []),
                                ]
                                  .sort((a, b) => Number(b.pending > 0.005) - Number(a.pending > 0.005))
                                  .map(b => b.node)}
                              </>
                            ) : (
                              <MonthDetail
                                month={openMonth}
                                data={student.months[openMonth]}
                                monthlyFee={monthlyFeeByMonth[openMonth] ?? monthlyFee}
                                onAddPayment={() => setPaymentModal({ studentId: student.inscriptionId })}
                                onCorrectPayment={handleCorrectPayment}
                                onChanged={loadLedger}
                              />
                            )}
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
      </div>

      {paymentModal !== null && (
        <AddPaymentModal
          students={students}
          months={months}
          prefill={paymentModal}
          monthlyFee={monthlyFee}
          usdAtPar={!!allPeriods.find((p: any) => p.id === schoolPeriodId)?.usdAtPar}
          schoolPeriodId={schoolPeriodId}
          onClose={() => setPaymentModal(null)}
          onSubmit={handleAddPayment}
        />
      )}

      {correction && (
        <PaymentCorrectionModal
          txn={correction.txn}
          mode={correction.mode}
          studentName={correction.studentName}
          schoolPeriodId={schoolPeriodId!}
          onClose={() => setCorrection(null)}
          onDone={handleCorrectionDone}
        />
      )}

      {discountStudentId !== null && (
        <DiscountsModal
          student={students.find(s => s.inscriptionId === discountStudentId) ?? null}
          months={months}
          onClose={() => setDiscountStudentId(null)}
          onChanged={loadLedger}
        />
      )}

      {planModal && (
        <InscriptionPlanModal
          inscriptionId={planModal.inscriptionId}
          studentName={planModal.name}
          onClose={() => setPlanModal(null)}
          onDone={(msg) => { setPlanModal(null); setFlash(msg); setTimeout(() => setFlash(null), 4000); loadLedger(); }}
        />
      )}
      {entryModal && (
        <EntryMonthModal
          student={entryModal}
          months={months}
          onClose={() => setEntryModal(null)}
          onSubmit={handleChangeEntryMonth}
        />
      )}

      {chargeModal !== null && (
        <AddChargeModal
          students={extraChargeStudent ? [...students, extraChargeStudent] : students}
          months={months}
          periods={allPeriods}
          currentPeriodId={schoolPeriodId!}
          prefill={chargeModal}
          feeByMonth={monthlyFeeByMonth}
          sellableItems={sellableItems}
          monthlyFee={monthlyFee}
          onClose={() => { setChargeModal(null); setExtraChargeStudent(null); }}
          onSubmit={handleAddCharge}
        />
      )}

      {reportModal && <PaymentsReportModal onClose={() => setReportModal(false)} />}

      {withdrawnModal && (
        <WithdrawnDebtModal
          onPick={pickWithdrawn}
          onClose={() => setWithdrawnModal(false)}
        />
      )}
    </div>
  );
}
