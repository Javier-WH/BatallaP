import React, { useEffect, useMemo, useState } from 'react';
import { Select, Input, Button, Checkbox, Table, Tag, Switch, message } from 'antd';
import { PrinterOutlined, SearchOutlined } from '@ant-design/icons';
import type { SortOrder } from 'antd/es/table/interface';
import dayjs from 'dayjs';
import api from '@/services/api';
import { useSchool } from '@/context/SchoolContext';
import type { AttendanceCounts, AttendanceSummaryReport, SummaryStudent, ReportStudent } from './types';
import AbsenceDetailModal, { type DetailFilter } from './AbsenceDetailModal';
import { pct } from './summaryUtils';

interface StructureGrade {
  grade: { id: number; name: string; order?: number | null };
  sections: { id: number; name: string; isMateriaPendiente?: boolean }[];
}

interface TermOption {
  id: number;
  name: string;
  order: number;
  openDate?: string | null;
  closeDate?: string | null;
}

type OptionalCol = 'justified' | 'late' | 'kicked' | 'registered';

const OPTIONAL_COLS: { value: OptionalCol; label: string }[] = [
  { value: 'justified', label: 'Justificadas' },
  { value: 'late', label: 'Retardos' },
  { value: 'kicked', label: 'Retirado de clase' },
  { value: 'registered', label: 'Total registrado' },
];

/** One metric column: a count (with its percentage) in class hours or in days. */
interface MetricCol {
  key: string;
  label: string;
  group: string;
  optional?: OptionalCol;
  count: (c: AttendanceCounts) => number;
  total: (c: AttendanceCounts) => number;
  /** Clicking the number opens the detail with this filter. */
  detail?: DetailFilter;
  tone?: string;
}

const METRICS: MetricCol[] = [
  { key: 'attendedBlocks', group: 'Asistencia', label: 'Horas', count: c => c.attendedBlocks, total: c => c.totalBlocks, tone: 'text-green-700' },
  { key: 'absentBlocks', group: 'Inasistencias', label: 'Horas', count: c => c.absentBlocks, total: c => c.totalBlocks, detail: 'unjustified', tone: 'text-red-600' },
  { key: 'absentDays', group: 'Inasistencias', label: 'Días', count: c => c.absentDays, total: c => c.totalDays, detail: 'unjustified', tone: 'text-red-600' },
  { key: 'justifiedBlocks', group: 'Justificadas', label: 'Horas', optional: 'justified', count: c => c.justifiedBlocks, total: c => c.totalBlocks, detail: 'justified', tone: 'text-blue-600' },
  { key: 'justifiedDays', group: 'Justificadas', label: 'Días', optional: 'justified', count: c => c.justifiedDays, total: c => c.totalDays, detail: 'justified', tone: 'text-blue-600' },
  { key: 'lateBlocks', group: 'Retardos', label: 'Horas', optional: 'late', count: c => c.lateBlocks, total: c => c.totalBlocks, detail: 'late', tone: 'text-orange-600' },
  { key: 'kickedBlocks', group: 'Retirado de clase', label: 'Horas', optional: 'kicked', count: c => c.kickedBlocks, total: c => c.totalBlocks, detail: 'kicked', tone: 'text-orange-700' },
  { key: 'totalBlocks', group: 'Total registrado', label: 'Horas', optional: 'registered', count: c => c.totalBlocks, total: () => 0 },
  { key: 'totalDays', group: 'Total registrado', label: 'Días', optional: 'registered', count: c => c.totalDays, total: () => 0 },
];

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch] as string));

const cmpText = (a: string, b: string) => a.localeCompare(b, 'es', { sensitivity: 'base' });

/**
 * "Resumen": statistical list of students with their attendance totals in
 * class hours and days, filterable by term / grade / section / gender and
 * printable. Every absence figure opens the exact detail of when it happened.
 */
const SummaryReportTab: React.FC<{
  onOpenStudent: (student: ReportStudent, dateFrom: string | null, dateTo: string | null) => void;
}> = ({ onOpenStudent }) => {
  const { viewPeriod } = useSchool();
  const [structure, setStructure] = useState<StructureGrade[]>([]);
  const [terms, setTerms] = useState<TermOption[]>([]);
  const [termId, setTermId] = useState<number | null>(null);
  const [termReady, setTermReady] = useState(false);
  const [gradeId, setGradeId] = useState<number | null>(null);
  const [sectionId, setSectionId] = useState<number | null>(null);
  const [gender, setGender] = useState<'M' | 'F' | null>(null);
  const [query, setQuery] = useState('');
  const [includeWithdrawn, setIncludeWithdrawn] = useState(true);
  const [optional, setOptional] = useState<OptionalCol[]>([]);
  const [sort, setSort] = useState<{ key: string; order: SortOrder }>({ key: '', order: null });
  const [report, setReport] = useState<AttendanceSummaryReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<{ inscriptionId: number; filter: DetailFilter } | null>(null);

  useEffect(() => {
    if (!viewPeriod?.id) return;
    api.get(`/academic/structure/${viewPeriod.id}`)
      .then(res => setStructure([...(res.data ?? [])].sort((a: StructureGrade, b: StructureGrade) => (a.grade.order ?? 0) - (b.grade.order ?? 0))))
      .catch(() => setStructure([]));
    setGradeId(null);
    setSectionId(null);
    setTermReady(false);
    api.get('/terms', { params: { schoolPeriodId: viewPeriod.id } })
      .then(res => {
        const list: TermOption[] = [...(res.data ?? [])].sort((a, b) => a.order - b.order);
        setTerms(list);
        // Default to the term running today (if its dates are set), else the whole year.
        const today = dayjs();
        const current = list.find(t => t.openDate && t.closeDate
          && !today.isBefore(dayjs(t.openDate), 'day') && !today.isAfter(dayjs(t.closeDate), 'day'));
        setTermId(current?.id ?? null);
      })
      .catch(() => { setTerms([]); setTermId(null); })
      .finally(() => setTermReady(true));
  }, [viewPeriod?.id]);

  useEffect(() => {
    if (!viewPeriod?.id || !termReady) return;
    let cancelled = false;
    setLoading(true);
    api.get('/attendance/reports/summary', {
      params: { schoolPeriodId: viewPeriod.id, termId: termId ?? undefined, gradeId: gradeId ?? undefined, sectionId: sectionId ?? undefined },
    })
      .then(res => { if (!cancelled) setReport(res.data); })
      .catch(err => {
        if (cancelled) return;
        setReport(null);
        message.error(err?.response?.data?.message || 'Error al cargar el resumen');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [viewPeriod?.id, termId, gradeId, sectionId, termReady]);

  // Sections of the selected grade only (the grade selector already narrows the list).
  const sectionOptions = useMemo(() => {
    if (!gradeId) return [];
    const seen = new Set<number>();
    return structure
      .filter(g => g.grade.id === gradeId)
      .flatMap(g => g.sections)
      .filter(s => !s.isMateriaPendiente && !seen.has(s.id) && seen.add(s.id))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
      .map(s => ({ value: s.id, label: s.name }));
  }, [structure, gradeId]);

  const visibleMetrics = METRICS.filter(m => !m.optional || optional.includes(m.optional));

  const sortValue = (s: SummaryStudent, key: string): string | number => {
    switch (key) {
      case 'document': return s.document;
      case 'lastName': return s.lastName;
      case 'firstName': return s.firstName;
      case 'gender': return s.gender ?? '';
      case 'gradeName': return s.gradeName;
      case 'sectionName': return s.sectionName;
      default: {
        const m = METRICS.find(x => x.key === key);
        return m ? m.count(s) : 0;
      }
    }
  };

  const rows = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let list = (report?.students ?? [])
      .filter(s => includeWithdrawn || !s.withdrawn)
      .filter(s => !gender || s.gender === gender)
      .filter(s => words.every(w => `${s.document} ${s.firstName} ${s.lastName}`.toLowerCase().includes(w)));
    if (sort.order) {
      const dir = sort.order === 'ascend' ? 1 : -1;
      list = [...list].sort((a, b) => {
        const va = sortValue(a, sort.key);
        const vb = sortValue(b, sort.key);
        const r = typeof va === 'number' && typeof vb === 'number' ? va - vb : cmpText(String(va), String(vb));
        return r * dir || cmpText(a.lastName, b.lastName) || cmpText(a.firstName, b.firstName);
      });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report, query, gender, includeWithdrawn, sort]);

  // Totals of what is on screen (respects every filter).
  const totals = useMemo(() => rows.reduce<AttendanceCounts>((acc, s) => {
    (Object.keys(acc) as (keyof AttendanceCounts)[]).forEach(k => { acc[k] += s[k]; });
    return acc;
  }, {
    totalBlocks: 0, attendedBlocks: 0, lateBlocks: 0, absentBlocks: 0, justifiedBlocks: 0, kickedBlocks: 0,
    totalDays: 0, absentDays: 0, justifiedDays: 0, kickedDays: 0, attendedDays: 0,
  }), [rows]);

  const sorterProps = (key: string) => ({
    sorter: true as const,
    sortOrder: sort.key === key ? sort.order : null,
  });

  const columns = [
    { title: 'Cédula', dataIndex: 'document', key: 'document', width: 100, ...sorterProps('document'), render: (v: string) => <span className="font-mono text-xs">{v || '—'}</span> },
    {
      title: 'Apellidos', dataIndex: 'lastName', key: 'lastName', ...sorterProps('lastName'),
      render: (v: string, s: SummaryStudent) => <>{v}{s.withdrawn && <Tag color="orange" className="ml-1">Retirado</Tag>}</>,
    },
    { title: 'Nombres', dataIndex: 'firstName', key: 'firstName', ...sorterProps('firstName') },
    {
      title: 'Sexo', dataIndex: 'gender', key: 'gender', width: 70, align: 'center' as const, ...sorterProps('gender'),
      render: (v: string | null) => <span className={v === 'M' ? 'font-bold text-blue-500' : v === 'F' ? 'font-bold text-red-500' : 'text-slate-300'}>{v ?? '—'}</span>,
    },
    { title: 'Grado', dataIndex: 'gradeName', key: 'gradeName', width: 120, ...sorterProps('gradeName') },
    { title: 'Sección', dataIndex: 'sectionName', key: 'sectionName', width: 80, align: 'center' as const, ...sorterProps('sectionName') },
    ...groupMetrics(visibleMetrics).map(([group, metrics]) => ({
      title: group,
      key: `g-${group}`,
      children: metrics.map(m => ({
        title: m.label,
        key: m.key,
        width: 92,
        align: 'center' as const,
        ...sorterProps(m.key),
        render: (_: unknown, s: SummaryStudent) => {
          const n = m.count(s);
          const percent = m.total(s) ? pct(n, m.total(s)) : null;
          return (
            <div className="leading-tight">
              {m.detail && n > 0 ? (
                <button
                  type="button"
                  className={`font-bold underline decoration-dotted ${m.tone ?? ''}`}
                  title="Ver cuándo ocurrió"
                  onClick={() => setDetail({ inscriptionId: s.inscriptionId, filter: m.detail! })}
                >{n}</button>
              ) : (
                <span className={n > 0 ? `font-bold ${m.tone ?? ''}` : 'text-slate-300'}>{n}</span>
              )}
              {percent && <div className="text-[10px] text-slate-400">{percent}</div>}
            </div>
          );
        },
      })),
    })),
  ];

  const termLabel = report?.termName ?? 'Todo el año';
  const rangeLabel = report?.dateFrom && report?.dateTo
    ? `${dayjs(report.dateFrom).format('DD/MM/YYYY')} – ${dayjs(report.dateTo).format('DD/MM/YYYY')}`
    : null;
  const gradeLabel = gradeId ? structure.find(g => g.grade.id === gradeId)?.grade.name : null;
  const sectionLabel = sectionId ? sectionOptions.find(s => s.value === sectionId)?.label : null;

  const handlePrint = () => {
    const metricCell = (m: MetricCol, c: AttendanceCounts) => {
      const n = m.count(c);
      return m.total(c) ? `${n} <span class="pc">(${pct(n, m.total(c))})</span>` : String(n);
    };
    const head2 = groupMetrics(visibleMetrics).map(([g, ms]) => `<th colspan="${ms.length}">${esc(g)}</th>`).join('');
    const head3 = visibleMetrics.map(m => `<th>${esc(m.label)}</th>`).join('');
    const body = rows.map((s, i) => `<tr>
      <td class="num">${i + 1}</td><td>${esc(s.document || '—')}</td>
      <td>${esc(s.lastName)}${s.withdrawn ? ' <i>(Retirado)</i>' : ''}</td><td>${esc(s.firstName)}</td>
      <td class="c">${esc(s.gender ?? '—')}</td><td class="c">${esc(s.gradeName)}</td><td class="c">${esc(s.sectionName)}</td>
      ${visibleMetrics.map(m => `<td class="c">${metricCell(m, s)}</td>`).join('')}
    </tr>`).join('');
    const foot = `<tr class="tot"><td colspan="7">GENERAL (${rows.length} estudiantes)</td>${visibleMetrics.map(m => `<td class="c">${metricCell(m, totals)}</td>`).join('')}</tr>`;
    const filters = [
      `${termLabel}${rangeLabel ? ` (${rangeLabel})` : ''}`,
      gradeLabel && `Grado: ${gradeLabel}`,
      sectionLabel && `Sección: ${sectionLabel}`,
      gender && `Sexo: ${gender === 'M' ? 'Masculino' : 'Femenino'}`,
      !includeWithdrawn && 'Sin retirados',
    ].filter(Boolean).join(' · ');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Resumen de asistencia</title><style>
      @page { size: letter landscape; margin: 12mm; }
      * { box-sizing: border-box; }
      body { font-family: Arial, sans-serif; font-size: 10px; color: #111; margin: 0; }
      h1 { font-size: 15px; margin: 0 0 2px; } .sub { color: #555; margin-bottom: 8px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #999; padding: 3px 5px; } th { background: #e8e8e8; }
      td.c, th { text-align: center; } td.num { text-align: right; color: #666; width: 22px; }
      .pc { color: #666; font-size: 9px; } tr.tot td { font-weight: 700; background: #f0f0f0; }
      thead { display: table-header-group; } tr { page-break-inside: avoid; }
      .foot { margin-top: 6px; color: #666; font-size: 9px; }
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    </style></head><body>
      <h1>Resumen de asistencia — ${esc(viewPeriod?.name || viewPeriod?.period || '')}</h1>
      <div class="sub">${esc(filters)}</div>
      <table><thead>
        <tr><th rowspan="2">#</th><th rowspan="2">Cédula</th><th rowspan="2">Apellidos</th><th rowspan="2">Nombres</th><th rowspan="2">Sexo</th><th rowspan="2">Grado</th><th rowspan="2">Sección</th>${head2}</tr>
        <tr>${head3}</tr>
      </thead><tbody>${body}${foot}</tbody></table>
      <div class="foot">Horas = bloques de clase · Días = días con al menos una inasistencia injustificada · ${new Date().toLocaleDateString('es-VE')}</div>
    </body></html>`;

    const iframe = document.createElement('iframe');
    Object.assign(iframe.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (!doc) { document.body.removeChild(iframe); message.error('No se pudo preparar la impresión'); return; }
    doc.open();
    doc.write(html);
    doc.close();
    iframe.contentWindow?.focus();
    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 300);
  };

  const summaryRow = () => (
    <Table.Summary.Row className="bg-slate-100 font-semibold">
      <Table.Summary.Cell index={0} colSpan={6}>GENERAL · {rows.length} estudiantes</Table.Summary.Cell>
      {visibleMetrics.map((m, i) => (
        <Table.Summary.Cell key={m.key} index={i + 1} align="center">
          <div className="leading-tight">
            <span className={m.tone}>{m.count(totals)}</span>
            {m.total(totals) > 0 && <div className="text-[10px] text-slate-500">{pct(m.count(totals), m.total(totals))}</div>}
          </div>
        </Table.Summary.Cell>
      ))}
    </Table.Summary.Row>
  );

  return (
    <div>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Select
          style={{ width: 200 }}
          value={termId ?? 0}
          onChange={v => setTermId(v || null)}
          options={[
            { value: 0, label: 'Todo el año' },
            ...terms.map(t => ({
              value: t.id,
              label: t.openDate && t.closeDate ? t.name : `${t.name} (sin fechas)`,
              disabled: !t.openDate || !t.closeDate,
            })),
          ]}
        />
        <Select
          style={{ width: 160 }}
          allowClear
          placeholder="Todos los grados"
          value={gradeId ?? undefined}
          onChange={v => { setGradeId(v ?? null); setSectionId(null); }}
          options={structure.map(g => ({ value: g.grade.id, label: g.grade.name }))}
        />
        <Select
          style={{ width: 190 }}
          allowClear
          disabled={!gradeId}
          placeholder={gradeId ? 'Todas las secciones' : 'Elija un grado'}
          value={sectionId ?? undefined}
          onChange={v => setSectionId(v ?? null)}
          options={sectionOptions}
        />
        <Select
          style={{ width: 130 }}
          allowClear
          placeholder="Sexo"
          value={gender ?? undefined}
          onChange={v => setGender(v ?? null)}
          options={[{ value: 'M', label: 'Masculino' }, { value: 'F', label: 'Femenino' }]}
        />
        <Input
          style={{ width: 220 }}
          allowClear
          prefix={<SearchOutlined />}
          placeholder="Buscar nombre o cédula"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <label className="flex items-center gap-1 text-xs text-slate-600">
          <Switch size="small" checked={includeWithdrawn} onChange={setIncludeWithdrawn} /> Incluir retirados
        </label>
        <Button icon={<PrinterOutlined />} onClick={handlePrint} disabled={rows.length === 0} className="ml-auto">
          Imprimir
        </Button>
      </div>

      <div className="flex items-center gap-3 mb-3 flex-wrap text-xs text-slate-500">
        <span className="font-semibold">Mostrar también:</span>
        <Checkbox.Group value={optional} onChange={v => setOptional(v as OptionalCol[])} options={OPTIONAL_COLS} />
        {rangeLabel && <span className="ml-auto">{termLabel}: {rangeLabel}</span>}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <Card label="Estudiantes" value={String(rows.length)} />
        <Card label="Asistencia general (horas)" value={pct(totals.attendedBlocks, totals.totalBlocks)} tone="text-green-700" />
        <Card label="Inasistencia general (horas)" value={pct(totals.absentBlocks, totals.totalBlocks)} sub={`${totals.absentBlocks} h`} tone="text-red-600" />
        <Card label="Días con inasistencia" value={pct(totals.absentDays, totals.totalDays)} sub={`${totals.absentDays} de ${totals.totalDays} días-estudiante`} tone="text-red-600" />
      </div>

      <Table<SummaryStudent>
        size="small"
        bordered
        loading={loading}
        rowKey="inscriptionId"
        dataSource={rows}
        columns={columns as any}
        pagination={false}
        scroll={{ x: 'max-content' }}
        sticky
        summary={() => (rows.length > 0 ? summaryRow() : null)}
        locale={{ emptyText: 'Sin estudiantes para los filtros seleccionados' }}
        onChange={(_p, _f, sorter: any) => {
          const s = Array.isArray(sorter) ? sorter[0] : sorter;
          setSort({ key: s?.order ? String(s.columnKey ?? s.field) : '', order: s?.order ?? null });
        }}
      />
      <p className="text-xs text-slate-400 mt-2">
        Horas = bloques de clase · Días = días con al menos una inasistencia injustificada. Haz clic en una cifra de inasistencia para ver exactamente cuándo faltó.
      </p>

      <AbsenceDetailModal
        open={detail !== null}
        inscriptionId={detail?.inscriptionId ?? null}
        termId={termId}
        initialFilter={detail?.filter}
        onClose={() => setDetail(null)}
        onOpenStudent={d => {
          setDetail(null);
          onOpenStudent(d.student, d.dateFrom, d.dateTo);
        }}
      />
    </div>
  );
};

function groupMetrics(metrics: MetricCol[]): [string, MetricCol[]][] {
  const out: [string, MetricCol[]][] = [];
  for (const m of metrics) {
    const last = out[out.length - 1];
    if (last && last[0] === m.group) last[1].push(m); else out.push([m.group, [m]]);
  }
  return out;
}

const Card: React.FC<{ label: string; value: string; sub?: string; tone?: string }> = ({ label, value, sub, tone }) => (
  <div className="rounded-lg bg-slate-50 px-3 py-2">
    <div className={`text-xl font-bold ${tone ?? 'text-slate-800'}`}>{value}</div>
    {sub && <div className="text-[11px] text-slate-500">{sub}</div>}
    <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
  </div>
);

export default SummaryReportTab;
