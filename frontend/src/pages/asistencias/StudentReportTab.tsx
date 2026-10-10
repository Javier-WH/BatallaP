import React, { useEffect, useRef, useState } from 'react';
import { Select, DatePicker, Button, message } from 'antd';
import { ArrowLeftOutlined, FileExcelOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import api from '@/services/api';
import { useSchool } from '@/context/SchoolContext';
import AttendanceDatasheet, { type DatasheetColumn, type DatasheetRow } from './AttendanceDatasheet';
import type { ReportStudent, StudentWeeksReport, SectionDayReport } from './types';
import { DAY_FULL_BY_SHORT, timeRange } from './reportUtils';
import { exportDatasheetExcel } from './exportSessionExcel';

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'];

const studentLabel = (s: ReportStudent) =>
  `${s.lastName}, ${s.firstName} · ${s.document} · ${s.gradeName} ${s.sectionName}`;

/**
 * "Por Estudiante": search a student; rows = weeks of the selected range,
 * columns = Lun–Vie. Clicking a day cell opens that day's detail by class block.
 */
const StudentReportTab: React.FC = () => {
  const { viewPeriod } = useSchool();
  const [options, setOptions] = useState<ReportStudent[]>([]);
  const [searching, setSearching] = useState(false);
  const [student, setStudent] = useState<ReportStudent | null>(null);
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().startOf('month'), dayjs()]);
  const [day, setDay] = useState<string | null>(null);
  const [weeksData, setWeeksData] = useState<StudentWeeksReport | null>(null);
  const [dayData, setDayData] = useState<SectionDayReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = (q: string) => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!viewPeriod?.id || q.trim().length < 2) { setOptions([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.get('/attendance/reports/student-search', {
          params: { schoolPeriodId: viewPeriod.id, q },
        });
        setOptions(res.data ?? []);
      } catch {
        setOptions([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  };

  useEffect(() => () => { if (searchTimer.current) clearTimeout(searchTimer.current); }, []);

  const dateFrom = range[0].format('YYYY-MM-DD');
  const dateTo = range[1].format('YYYY-MM-DD');

  useEffect(() => {
    if (!student) return;
    let cancelled = false;
    setLoading(true);
    const request = day
      ? api.get('/attendance/reports/student-day', { params: { inscriptionId: student.inscriptionId, date: day } })
      : api.get('/attendance/reports/student-weeks', { params: { inscriptionId: student.inscriptionId, dateFrom, dateTo } });
    request
      .then(res => {
        if (cancelled) return;
        if (day) setDayData(res.data); else setWeeksData(res.data);
      })
      .catch(err => { if (!cancelled) message.error(err?.response?.data?.message || 'Error al cargar el reporte'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [student, day, dateFrom, dateTo]);

  const title = student ? `${student.lastName}, ${student.firstName}` : '';
  const identity = student ? `C.I. ${student.document} · ${student.gradeName} ${student.sectionName}` : '';

  let columns: DatasheetColumn[] = [];
  let rows: DatasheetRow[] = [];
  let leadColumns = [{ label: 'Semana', width: 120 }];
  let subtitle = identity;

  if (day && dayData) {
    leadColumns = [
      { label: 'Cédula', width: 90 },
      { label: 'Apellidos', width: 170 },
      { label: 'Nombres', width: 170 },
    ];
    columns = dayData.columns.map(c => ({
      key: c.key, label: c.label, title: c.title, sub: timeRange(c.start, c.end),
    }));
    rows = dayData.students.map(s => ({
      key: s.inscriptionId, number: s.rosterNumber, lead: [s.document, s.lastName, s.firstName], cells: s.cells,
    }));
    subtitle = `${identity} · ${DAY_FULL_BY_SHORT[dayData.dayShort] ?? dayData.dayShort} ${dayjs(dayData.date).format('DD/MM/YYYY')}`;
  } else if (!day && weeksData) {
    columns = WEEKDAYS.map((label, i) => ({ key: String(i), label }));
    rows = weeksData.weeks.map(w => {
      const cells: DatasheetRow['cells'] = {};
      const disabled = new Set<string>();
      w.days.forEach((d, i) => {
        cells[String(i)] = d.cell;
        if (!d.inRange) disabled.add(String(i));
      });
      return {
        key: w.weekStart,
        lead: [`${dayjs(w.weekStart).format('DD/MM')} – ${dayjs(w.weekEnd).format('DD/MM/YYYY')}`],
        cells,
        disabled,
        onCellClick: (colKey: string) => {
          const d = w.days[Number(colKey)];
          if (d?.inRange) setDay(d.date);
        },
      };
    });
    subtitle = `${identity} · Del ${dayjs(weeksData.dateFrom).format('DD/MM/YYYY')} al ${dayjs(weeksData.dateTo).format('DD/MM/YYYY')}`;
  }

  const handleExport = async () => {
    if (!student) return;
    setExporting(true);
    try {
      const when = day ?? `${dateFrom}_${dateTo}`;
      await exportDatasheetExcel({
        title, subtitle, leadColumns, columns, rows,
        fileName: `asistencia_${student.lastName}_${student.firstName}_${when}`,
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
        <span className="text-xs font-semibold text-slate-500">Estudiante</span>
        <Select
          style={{ width: 420 }}
          showSearch
          placeholder="Escriba apellido, nombre o cédula"
          filterOption={false}
          onSearch={handleSearch}
          loading={searching}
          notFoundContent={searching ? 'Buscando…' : 'Sin resultados'}
          value={student?.inscriptionId ?? null}
          onChange={id => { setStudent(options.find(o => o.inscriptionId === id) ?? null); setDay(null); }}
          options={options.map(o => ({ value: o.inscriptionId, label: studentLabel(o) }))}
        />
        <span className="text-xs font-semibold text-slate-500 ml-2">Rango</span>
        <DatePicker.RangePicker
          value={range}
          format="DD/MM/YYYY"
          allowClear={false}
          onChange={v => { if (v?.[0] && v?.[1]) { setRange([v[0], v[1]]); setDay(null); } }}
        />
        {day && (
          <Button icon={<ArrowLeftOutlined />} onClick={() => setDay(null)} className="ml-2">
            Volver a las semanas
          </Button>
        )}
        <Button
          icon={<FileExcelOutlined />}
          className="ml-auto"
          onClick={handleExport}
          loading={exporting}
          disabled={!student || loading || rows.length === 0}
        >
          Exportar a Excel
        </Button>
      </div>

      {!student ? (
        <p className="text-sm text-slate-500">Busque un estudiante por apellido, nombre o cédula.</p>
      ) : (
        <AttendanceDatasheet
          title={title}
          subtitle={subtitle}
          leadColumns={leadColumns}
          columns={columns}
          rows={rows}
          loading={loading}
          emptyText={day ? 'La sección del estudiante no tiene clases en el horario ese día' : 'Sin semanas en el rango'}
        />
      )}
      {student && !day && !loading && (
        <p className="text-[11px] text-slate-500 mt-1">Haga clic en un día para ver el detalle por materia.</p>
      )}
    </div>
  );
};

export default StudentReportTab;
