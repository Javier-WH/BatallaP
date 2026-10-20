import { useEffect, useMemo, useState } from 'react';
import { X, Printer, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { getPaymentsReport, type PaymentReportRow, type PaymentsReport } from '@/services/paymentsService';
import { PAYMENT_METHODS, PAYMENT_CURRENCIES, formatTotals } from '../paymentMethods';

type SortKey = 'date' | 'student' | 'user' | 'method' | 'amount';

const money = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-VE');
const methodLabel = (v: string) => PAYMENT_METHODS.find(m => m.value === v)?.label ?? v;
const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const inputCls = 'border border-[#C5CAD2] px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2F5EA8] focus:border-[#2F5EA8] bg-white';

/**
 * Totals of a set of payments: per ORIGINAL currency (never converted) and per
 * registrant. Bolívar payments additionally get an informative equivalent in
 * the debt currency, each at the rate of its own payment date (`equivalent`).
 */
function summarize(rows: PaymentReportRow[]) {
  const byCurrency: Record<string, number> = {};
  const byUser = new Map<string, { count: number; byCurrency: Record<string, number> }>();
  const vesEquivalent: Record<string, number> = {};
  let vesWithoutEquivalent = 0;
  for (const r of rows) {
    byCurrency[r.currency] = (byCurrency[r.currency] ?? 0) + r.amount;
    if (r.currency === 'VES') {
      if (r.equivalent != null && r.equivalentCurrency && r.equivalentCurrency !== 'VES') {
        vesEquivalent[r.equivalentCurrency] = (vesEquivalent[r.equivalentCurrency] ?? 0) + r.equivalent;
      } else vesWithoutEquivalent += 1;
    }
    const u = r.registeredBy ?? 'Sin registro';
    const e = byUser.get(u) ?? { count: 0, byCurrency: {} };
    e.count += 1;
    e.byCurrency[r.currency] = (e.byCurrency[r.currency] ?? 0) + r.amount;
    byUser.set(u, e);
  }
  return { byCurrency, vesEquivalent, vesWithoutEquivalent, byUser: [...byUser.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es')) };
}

const equivalentText = (r: PaymentReportRow) => {
  const parts: string[] = [];
  if (r.currency === 'VES' && r.amountVES != null && r.equivalent != null && r.equivalentCurrency && r.equivalentCurrency !== 'VES') {
    parts.push(`${money(r.equivalent)} ${r.equivalentCurrency}${r.atPar ? ' (a la par)' : ''}`);
  } else if (r.currency !== 'VES' && r.atPar && r.equivalent != null && r.equivalentCurrency && r.equivalentCurrency !== r.currency) {
    parts.push(`${money(r.equivalent)} ${r.equivalentCurrency} (a la par)`);
  }
  return parts.join(' · ');
};

const allocText = (r: PaymentReportRow) =>
  r.allocations.map(a => `${money(a.amount)} ${a.currency ?? ''} ${a.description ?? ''}${a.month ? ` (${a.month})` : ''}`.trim()).join('; ');

const referenceText = (r: PaymentReportRow) =>
  [r.reference, r.bank, r.account].filter(Boolean).join(' · ');

/** Opens a clean, printable (landscape) copy of the sheet in a new window. */
function printSheet(rows: PaymentReportRow[], filtersLabel: string) {
  const s = summarize(rows);
  const body = rows.map(r => `<tr>
    <td>${esc(fmtDate(r.paymentDate))}</td>
    <td>${esc(r.student)}<br><small>${esc([r.document, r.gradeName && `${r.gradeName}${r.sectionName ? ` ${r.sectionName}` : ''}`].filter(Boolean).join(' · '))}</small></td>
    <td>${esc(methodLabel(r.method))}</td>
    <td class="num"><b>${esc(money(r.amount))} ${esc(r.currency)}</b><br><small>${esc(equivalentText(r))}</small></td>
    <td>${esc(referenceText(r))}</td>
    <td><small>${esc(allocText(r))}</small></td>
    <td>${esc(r.registeredBy ?? '—')}</td>
    <td><small>${esc(r.notes ?? '')}</small></td>
  </tr>`).join('');
  const userRows = s.byUser.map(([u, e]) => `<tr><td>${esc(u)}</td><td class="num">${e.count}</td><td class="num">${esc(formatTotals(e.byCurrency))}</td></tr>`).join('');
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Resumen de movimientos</title>
    <style>
      @page { size: landscape; margin: 12mm; }
      body { font-family: Arial, sans-serif; font-size: 11px; color: #111; }
      h1 { font-size: 16px; margin: 0 0 2px; } .meta { color: #555; margin-bottom: 10px; }
      table { border-collapse: collapse; width: 100%; } th, td { border: 1px solid #999; padding: 3px 5px; vertical-align: top; text-align: left; }
      th { background: #eee; } td.num { text-align: right; white-space: nowrap; } small { color: #555; }
      tr { page-break-inside: avoid; } h2 { font-size: 13px; margin: 14px 0 4px; } .totals { width: auto; min-width: 50%; }
    </style></head><body>
    <h1>Resumen de movimientos</h1>
    <div class="meta">${esc(filtersLabel)} · ${rows.length} pago(s) · Impreso ${esc(new Date().toLocaleString('es-VE'))}</div>
    <table><thead><tr><th>Fecha</th><th>Estudiante</th><th>Método</th><th>Monto</th><th>Referencia / Banco / Cuenta</th><th>Aplicado a</th><th>Registró</th><th>Notas</th></tr></thead>
    <tbody>${body}</tbody></table>
    <h2>Totales</h2>
    <table class="totals"><tbody>
      <tr><th>Por moneda</th><td class="num"><b>${esc(formatTotals(s.byCurrency))}</b></td></tr>
      ${s.byCurrency.VES ? `<tr><th>Pagos en Bs. equivalen a</th><td class="num"><b>${esc(formatTotals(s.vesEquivalent))}</b><br><small>Informativo: cada pago en Bs. convertido a la tasa de su propia fecha${s.vesWithoutEquivalent ? `; ${s.vesWithoutEquivalent} pago(s) sin equivalente` : ''}.</small></td></tr>` : ''}
    </tbody></table>
    <h2>Por usuario que registró</h2>
    <table class="totals"><thead><tr><th>Usuario</th><th>Pagos</th><th>Monto</th></tr></thead><tbody>${userRows}</tbody></table>
  </body></html>`;
  const w = window.open('', '_blank', 'width=1100,height=800');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  w.onload = () => w.print();
  setTimeout(() => { try { w.print(); } catch { /* window already closed */ } }, 400);
}

export default function PaymentsReportModal({ onClose }: { onClose: () => void }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [user, setUser] = useState('');
  const [method, setMethod] = useState('');
  const [currency, setCurrency] = useState('');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'date', dir: 'desc' });
  const [report, setReport] = useState<PaymentsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getPaymentsReport({ from: from || undefined, to: to || undefined })
      .then(r => { if (!cancelled) setReport(r); })
      .catch(() => { if (!cancelled) setError('No se pudo cargar el resumen de movimientos.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [from, to]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = (report?.rows ?? []).filter(r =>
      (!user || String(r.registeredById ?? 'none') === user)
      && (!method || r.method === method)
      && (!currency || r.currency === currency)
      && (!needle || [r.student, r.document, r.reference, r.bank, r.account, r.notes].some(v => (v ?? '').toLowerCase().includes(needle))));
    const dir = sort.dir === 'asc' ? 1 : -1;
    const val = (r: PaymentReportRow): string | number => {
      switch (sort.key) {
        case 'student': return r.student.toLowerCase();
        case 'user': return (r.registeredBy ?? '').toLowerCase();
        case 'method': return methodLabel(r.method).toLowerCase();
        case 'amount': return r.amountVES ?? r.amount;
        default: return new Date(r.paymentDate).getTime();
      }
    };
    return [...filtered].sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      const c = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'es');
      return c * dir || a.id - b.id;
    });
  }, [report, user, method, currency, q, sort]);

  const totals = useMemo(() => summarize(rows), [rows]);

  const filtersLabel = [
    from || to ? `Fechas: ${from ? fmtDate(`${from}T12:00:00`) : 'inicio'} – ${to ? fmtDate(`${to}T12:00:00`) : 'hoy'}` : 'Todas las fechas',
    user ? `Usuario: ${report?.registrants.find(r => String(r.id) === user)?.name ?? 'Sin registro'}` : '',
    method ? `Método: ${methodLabel(method)}` : '',
    currency ? `Moneda: ${currency}` : '',
    q.trim() ? `Búsqueda: "${q.trim()}"` : '',
  ].filter(Boolean).join(' · ');

  const toggleSort = (key: SortKey) =>
    setSort(s => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'date' || key === 'amount' ? 'desc' : 'asc' }));

  const SortTh = ({ k, children, className = '' }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <th className={`px-2.5 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-[#5B6472] ${className}`}>
      <button type="button" onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 hover:text-[#14181F]">
        {children}
        {sort.key === k ? (sort.dir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : <ArrowUpDown size={11} className="opacity-40" />}
      </button>
    </th>
  );
  const plainTh = 'px-2.5 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-[#5B6472]';

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-3">
      <div className="bg-white border border-[#C5CAD2] w-full max-w-[1400px] shadow-lg h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#E4E6EB] bg-[#EDEEF1] shrink-0">
          <h3 className="text-sm font-bold uppercase tracking-wide">Resumen de movimientos</h3>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => printSheet(rows, filtersLabel)} disabled={rows.length === 0}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#2F5EA8] hover:text-[#1E4478] disabled:opacity-40">
              <Printer size={14} /> Imprimir
            </button>
            <button onClick={onClose} className="text-[#6B7280] hover:text-[#14181F]"><X size={16} /></button>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3 px-4 py-3 border-b border-[#E4E6EB] shrink-0">
          <label className="text-[10px] font-bold uppercase tracking-wide text-[#5B6472] flex flex-col gap-1">
            Desde
            <input type="date" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)} className={inputCls} />
          </label>
          <label className="text-[10px] font-bold uppercase tracking-wide text-[#5B6472] flex flex-col gap-1">
            Hasta
            <input type="date" value={to} min={from || undefined} onChange={e => setTo(e.target.value)} className={inputCls} />
          </label>
          <label className="text-[10px] font-bold uppercase tracking-wide text-[#5B6472] flex flex-col gap-1">
            Registrado por
            <select value={user} onChange={e => setUser(e.target.value)} className={inputCls}>
              <option value="">Todos</option>
              {report?.registrants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              {report?.rows.some(r => r.registeredById == null) && <option value="none">Sin registro</option>}
            </select>
          </label>
          <label className="text-[10px] font-bold uppercase tracking-wide text-[#5B6472] flex flex-col gap-1">
            Método
            <select value={method} onChange={e => setMethod(e.target.value)} className={inputCls}>
              <option value="">Todos</option>
              {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </label>
          <label className="text-[10px] font-bold uppercase tracking-wide text-[#5B6472] flex flex-col gap-1">
            Moneda
            <select value={currency} onChange={e => setCurrency(e.target.value)} className={inputCls}>
              <option value="">Todas</option>
              {PAYMENT_CURRENCIES.map(c => <option key={c.value} value={c.value}>{c.value}</option>)}
            </select>
          </label>
          <label className="text-[10px] font-bold uppercase tracking-wide text-[#5B6472] flex flex-col gap-1 flex-1 min-w-[10rem]">
            Buscar
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Estudiante, cédula, referencia…" className={inputCls} />
          </label>
          {(from || to || user || method || currency || q) && (
            <button type="button" onClick={() => { setFrom(''); setTo(''); setUser(''); setMethod(''); setCurrency(''); setQ(''); }}
              className="text-xs font-semibold text-[#6B7280] hover:text-[#14181F] pb-2">Limpiar filtros</button>
          )}
        </div>

        <div className="flex-1 overflow-auto min-h-0">
          {error ? (
            <div className="p-8 text-center text-sm text-[#B42318]">{error}</div>
          ) : loading && !report ? (
            <div className="p-8 text-center text-sm text-[#8B909A]">Cargando…</div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center text-sm text-[#8B909A]">No hay pagos que coincidan con los filtros.</div>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 bg-[#EDEEF1] z-10">
                <tr>
                  <SortTh k="date">Fecha</SortTh>
                  <SortTh k="student">Estudiante</SortTh>
                  <SortTh k="method">Método</SortTh>
                  <SortTh k="amount">Monto</SortTh>
                  <th className={plainTh}>Referencia / Banco / Cuenta</th>
                  <th className={plainTh}>Aplicado a</th>
                  <SortTh k="user">Registró</SortTh>
                  <th className={plainTh}>Notas</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id} className={`align-top border-b border-[#E4E6EB] ${i % 2 ? 'bg-[#F7F8FA]' : 'bg-white'}`}>
                    <td className="px-2.5 py-1.5 whitespace-nowrap tabular-nums">{fmtDate(r.paymentDate)}</td>
                    <td className="px-2.5 py-1.5">
                      <div className="font-medium">{r.student}</div>
                      <div className="text-[10px] text-[#8B909A]">
                        {[r.document, r.gradeName && `${r.gradeName}${r.sectionName ? ` ${r.sectionName}` : ''}`].filter(Boolean).join(' · ')}
                      </div>
                    </td>
                    <td className="px-2.5 py-1.5 whitespace-nowrap">{methodLabel(r.method)}</td>
                    <td className="px-2.5 py-1.5 whitespace-nowrap tabular-nums">
                      <div className="font-semibold text-[#0F7A45]">{money(r.amount)} {r.currency}</div>
                      <div className="text-[10px] text-[#8B909A]">{equivalentText(r)}</div>
                    </td>
                    <td className="px-2.5 py-1.5 text-[#4B5563]">{referenceText(r) || '—'}</td>
                    <td className="px-2.5 py-1.5 text-[10px] text-[#4B5563]">
                      {r.allocations.length === 0 ? '—' : r.allocations.map((a, j) => (
                        <div key={j}>{money(a.amount)} {a.currency} · {a.description}{a.month ? ` (${a.month})` : ''}</div>
                      ))}
                    </td>
                    <td className="px-2.5 py-1.5 whitespace-nowrap">{r.registeredBy ?? '—'}</td>
                    <td className="px-2.5 py-1.5 text-[10px] text-[#4B5563]">{r.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="shrink-0 border-t-2 border-[#B9BEC7] bg-[#F4F5F8] px-4 py-2.5 flex flex-wrap items-start gap-x-8 gap-y-2 text-xs">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wide text-[#5B6472]">Pagos</div>
            <div className="text-sm font-semibold tabular-nums">{rows.length}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wide text-[#5B6472]">Total por moneda (original)</div>
            <div className="text-sm font-semibold text-[#0F7A45] tabular-nums">{formatTotals(totals.byCurrency)}</div>
          </div>
          {totals.byCurrency.VES != null && (
            <div title="Solo informativo: cada pago hecho en Bs. convertido a divisa con la tasa de la fecha en que se pagó">
              <div className="text-[10px] font-bold uppercase tracking-wide text-[#5B6472]">Pagos en Bs. equivalen a</div>
              <div className="text-sm font-semibold tabular-nums">
                {Object.keys(totals.vesEquivalent).length ? `≈ ${formatTotals(totals.vesEquivalent)}` : '—'}
                {totals.vesWithoutEquivalent > 0 && <span className="text-[10px] font-normal text-[#B54708]"> ({totals.vesWithoutEquivalent} sin equivalente)</span>}
              </div>
              <div className="text-[10px] text-[#8B909A]">A la tasa de la fecha de cada pago</div>
            </div>
          )}
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wide text-[#5B6472]">Por usuario</div>
            {totals.byUser.map(([name, e]) => (
              <div key={name} className="tabular-nums text-[11px]">
                <span className="font-medium">{name}</span> · {e.count} · {formatTotals(e.byCurrency)}
              </div>
            ))}
          </div>
          {report?.truncated && (
            <div className="text-[11px] text-[#B54708] self-center">
              Se muestran los {report.limit} pagos más recientes; acota el rango de fechas para ver el resto.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
