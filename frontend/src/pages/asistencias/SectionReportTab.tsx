import React, { useEffect, useMemo, useState } from 'react';
import { Select, DatePicker, Button, message } from 'antd';
import { LeftOutlined, RightOutlined, ArrowLeftOutlined, FileExcelOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import api from '@/services/api';
import { useSchool } from '@/context/SchoolContext';
import AttendanceDatasheet, { type DatasheetColumn, type DatasheetRow } from './AttendanceDatasheet';
import type { SectionWeekReport, SectionDayReport } from './types';
import { DAY_FULL_BY_SHORT, mondayOf, timeRange } from './reportUtils';
import { exportDatasheetExcel } from './exportSessionExcel';

interface StructureGrade {
  grade: { id: number; name: string; order?: number | null };
  sections: { id: number; name: string; isMateriaPendiente?: boolean }[];
}

const LEAD = [
  { label: 'Cédula', width: 90, mono: true },
  { label: 'Apellidos', width: 170 },
  { label: 'Nombres', width: 170 },
];

/**
 * "Por Sección": one section's nomina × weekdays. Clicking a day header opens
 * the day detail (one column per class block of the section's timetable).
 */
const SectionReportTab: React.FC = () => {
  const { viewPeriod } = useSchool();
  const [structure, setStructure] = useState<StructureGrade[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState<Dayjs>(mondayOf(dayjs()));
  const [day, setDay] = useState<string | null>(null);
  const [weekData, setWeekData] = useState<SectionWeekReport | null>(null);
  const [dayData, setDayData] = useState<SectionDayReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!viewPeriod?.id) return;
    api.get(`/academic/structure/${viewPeriod.id}`)
      .then(res => setStructure(
        [...(res.data ?? [])].sort((a: StructureGrade, b: StructureGrade) => (a.grade.order ?? 0) - (b.grade.order ?? 0))
      ))
      .catch(() => setStructure([]));
  }, [viewPeriod?.id]);

  const sectionOptions = useMemo(() => structure.flatMap(pg =>
    // Materia Pendiente is a period-closure artifact, not a real section.
    pg.sections
      .filter(s => !s.isMateriaPendiente)
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
      .map(s => ({ value: `${pg.grade.id}:${s.id}`, label: `${pg.grade.name} ${s.name}` }))
  ), [structure]);

  const [gradeId, sectionId] = selected ? selected.split(':').map(Number) : [null, null];
  const weekEnd = weekStart.add(4, 'day');

  useEffect(() => {
    if (!viewPeriod?.id || !gradeId || !sectionId) return;
    let cancelled = false;
    setLoading(true);
    const request = day
      ? api.get('/attendance/reports/section-day', {
        params: { schoolPeriodId: viewPeriod.id, gradeId, sectionId, date: day },
      })
      : api.get('/attendance/reports/section-week', {
        params: {
          schoolPeriodId: viewPeriod.id, gradeId, sectionId,
          dateFrom: weekStart.format('YYYY-MM-DD'), dateTo: weekEnd.format('YYYY-MM-DD'),
        },
      });
    request
      .then(res => {
        if (cancelled) return;
        if (day) setDayData(res.data); else setWeekData(res.data);
      })
      .catch(err => { if (!cancelled) message.error(err?.response?.data?.message || 'Error al cargar el reporte'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // weekEnd derives from weekStart
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewPeriod?.id, gradeId, sectionId, weekStart, day]);

  const header = day ? dayData : weekData;
  const sectionTitle = header ? `${header.gradeName} ${header.sectionName}` : '';

  let columns: DatasheetColumn[] = [];
  let rows: DatasheetRow[] = [];
  let subtitle = '';
  if (day && dayData) {
    columns = dayData.columns.map(c => ({
      key: c.key, label: c.label, title: c.title, sub: timeRange(c.start, c.end),
    }));
    rows = dayData.students.map(s => ({
      key: s.inscriptionId, number: s.rosterNumber, lead: [s.document, s.lastName, s.firstName], cells: s.cells,
    }));
    subtitle = `${DAY_FULL_BY_SHORT[dayData.dayShort] ?? dayData.dayShort} ${dayjs(dayData.date).format('DD/MM/YYYY')}`;
  } else if (!day && weekData) {
    columns = weekData.days.map(d => ({
      key: d.date,
      label: d.dayShort,
      sub: dayjs(d.date).format('DD/MM'),
      title: 'Ver detalle por materia',
      onClick: () => setDay(d.date),
    }));
    rows = weekData.students.map(s => ({
      key: s.inscriptionId, number: s.rosterNumber, lead: [s.document, s.lastName, s.firstName], cells: s.cells,
    }));
    subtitle = `Semana del ${dayjs(weekData.dateFrom).format('DD/MM/YYYY')} al ${dayjs(weekData.dateTo).format('DD/MM/YYYY')}`;
  }

  const handleExport = async () => {
    setExporting(true);
    try {
      const when = day ?? `semana_${weekStart.format('YYYY-MM-DD')}`;
      await exportDatasheetExcel({
        title: sectionTitle, subtitle, leadColumns: LEAD, columns, rows,
        fileName: `asistencia_${sectionTitle}_${when}`,
      });
    } catch {
      message.error('No se pudo exportar a Excel');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-xs font-semibold text-slate-500">Sección</span>
        <Select
          style={{ width: 240 }}
          placeholder="Seleccione una sección"
          options={sectionOptions}
          value={selected}
          onChange={v => { setSelected(v); setDay(null); }}
          showSearch
          optionFilterProp="label"
        />
        <span className="text-xs font-semibold text-slate-500 ml-2">Semana</span>
        <Button icon={<LeftOutlined />} onClick={() => { setWeekStart(w => w.subtract(7, 'day')); setDay(null); }} />
        <DatePicker
          value={weekStart}
          format={() => `${weekStart.format('DD/MM')} – ${weekEnd.format('DD/MM/YYYY')}`}
          onChange={d => { if (d) { setWeekStart(mondayOf(d)); setDay(null); } }}
          allowClear={false}
        />
        <Button icon={<RightOutlined />} onClick={() => { setWeekStart(w => w.add(7, 'day')); setDay(null); }} />
        {day && (
          <Button icon={<ArrowLeftOutlined />} onClick={() => setDay(null)} className="ml-2">
            Volver a la semana
          </Button>
        )}
        <Button
          icon={<FileExcelOutlined />}
          className="ml-auto"
          onClick={handleExport}
          loading={exporting}
          disabled={!selected || loading || rows.length === 0}
        >
          Exportar a Excel
        </Button>
      </div>

      {!selected ? (
        <p className="text-sm text-slate-500">Seleccione una sección para ver su asistencia.</p>
      ) : (
        <AttendanceDatasheet
          title={sectionTitle}
          subtitle={subtitle}
          leadColumns={LEAD}
          columns={columns}
          rows={rows}
          loading={loading}
          emptyText={day ? 'La sección no tiene clases en el horario ese día' : 'Sin estudiantes inscritos'}
        />
      )}
      {selected && !day && !loading && (
        <p className="text-[11px] text-slate-500 mt-1">Haga clic en un día para ver el detalle por materia.</p>
      )}
    </div>
  );
};

export default SectionReportTab;
