import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Typography, Button, Spin, message, InputNumber } from 'antd';
import { PrinterOutlined, TrophyOutlined } from '@ant-design/icons';
import { AllCommunityModule } from 'ag-grid-community';
import type { ColDef, GridReadyEvent } from 'ag-grid-community';
import { AgGridProvider, AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import { useSchool } from '@/context/SchoolContext';
import api from '@/services/api';

const { Title } = Typography;

/** Converts hex color to rgba with given alpha */
const withAlpha = (hex: string, alpha: number): string => {
  const clean = (hex || '').replace('#', '');
  if (clean.length !== 6) return hex;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/** Lightens a hex color by mixing with white. amount: 0=original, 1=white */
const lightenColor = (hex: string, amount: number): string => {
  const clean = (hex || '').replace('#', '');
  if (clean.length !== 6) return hex;
  const r = Math.round(parseInt(clean.slice(0, 2), 16) + (255 - parseInt(clean.slice(0, 2), 16)) * amount);
  const g = Math.round(parseInt(clean.slice(2, 4), 16) + (255 - parseInt(clean.slice(2, 4), 16)) * amount);
  const b = Math.round(parseInt(clean.slice(4, 6), 16) + (255 - parseInt(clean.slice(4, 6), 16)) * amount);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};

const DEFAULT_GRADE_COLOR = '#1890ff';

// Convert "Quinto Año" → "5to Año", "Primero Año" → "1ro Año", etc.
const ordinalToNumber: Record<string, string> = {
  'primero': '1ro', 'segundo': '2do', 'tercero': '3ro',
  'cuarto': '4to', 'quinto': '5to', 'sexto': '6to',
  'séptimo': '7mo', 'octavo': '8vo', 'noveno': '9no',
  'décimo': '10mo', 'undécimo': '11mo', 'duodécimo': '12mo',
  'decimotercero': '13ro', 'decimocuarto': '14to', 'decimoquinto': '15to',
  'decimosexto': '16to', 'decimoséptimo': '17mo', 'decimoctavo': '18vo',
  'decimonoveno': '19no', 'vigésimo': '20mo',
};
const shortGradeName = (name: string): string => {
  const lower = name.toLowerCase().trim();
  for (const [word, num] of Object.entries(ordinalToNumber)) {
    if (lower.startsWith(word)) {
      return num + name.slice(word.length);
    }
  }
  return name;
};

interface TermGrade { termId: number; termName: string; score: number; }
interface GeneralAverageStudent {
  inscriptionId: number;
  firstName: string;
  lastName: string;
  document: string;
  gradeId: number;
  gradeName: string;
  gradeColor: string | null;
  sectionId: number;
  sectionName: string;
  termGrades: TermGrade[];
}
interface GeneralAveragesResponse {
  terms: { id: number; name: string; order: number }[];
  grades: { id: number; name: string }[];
  sections: { id: number; name: string; gradeId: number }[];
  students: GeneralAverageStudent[];
}

export default function GeneralAverages() {
  const { viewPeriod } = useSchool();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<GeneralAveragesResponse | null>(null);
  const [selectedTerms, setSelectedTerms] = useState<number[]>([]);
  const [selectedGrades, setSelectedGrades] = useState<number[]>([]);
  const [selectedSections, setSelectedSections] = useState<number[]>([]);
  const [minAverage, setMinAverage] = useState<number | null>(null);
  const gridRef = useRef<AgGridReact<any>>(null);

  useEffect(() => {
    if (!viewPeriod?.id) return;
    setLoading(true);
    api.get('/performance-summary/general-averages', { params: { schoolPeriodId: viewPeriod.id } })
      .then((res) => setData(res.data))
      .catch((err) => {
        console.error('Error loading general averages:', err);
        message.error('Error al cargar promedios generales');
      })
      .finally(() => setLoading(false));
  }, [viewPeriod?.id]);

  // Compute filtered students + averages + ranking
  const { rows, totalCount } = useMemo(() => {
    if (!data) return { rows: [] as any[], totalCount: 0 };

    let filtered = data.students;

    // Filter by grades
    if (selectedGrades.length > 0) {
      filtered = filtered.filter((s) => selectedGrades.includes(s.gradeId));
    }
    // Filter by sections
    if (selectedSections.length > 0) {
      filtered = filtered.filter((s) => selectedSections.includes(s.sectionId));
    }

    // Determine which terms to average
    const termIds = selectedTerms.length > 0
      ? selectedTerms
      : data.terms.map((t) => t.id);

    // Compute average per student
    const withAvg = filtered.map((s) => {
      const scores = s.termGrades
        .filter((tg) => termIds.includes(tg.termId))
        .map((tg) => tg.score)
        .filter((v) => v > 0);
      const avg = scores.length > 0
        ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2))
        : 0;
      return { ...s, average: avg };
    });

    // Filter by minimum average threshold
    const aboveThreshold = minAverage !== null
      ? withAvg.filter((s) => s.average >= minAverage!)
      : withAvg;

    // Compute ranking within the filtered set (by average descending)
    const sorted = [...aboveThreshold].sort((a, b) => b.average - a.average);
    const rankMap = new Map<number, number>();
    let currentRank = 0;
    let prevAvg: number | null = null;
    sorted.forEach((s, idx) => {
      if (prevAvg === null || s.average !== prevAvg) {
        currentRank = idx + 1;
        prevAvg = s.average;
      }
      rankMap.set(s.inscriptionId, currentRank);
    });

    // Build display rows (sorted by grade, section, lastName, firstName)
    const displaySorted = [...aboveThreshold].sort((a, b) => {
      if (a.gradeName !== b.gradeName) return a.gradeName.localeCompare(b.gradeName);
      if (a.sectionName !== b.sectionName) return a.sectionName.localeCompare(b.sectionName);
      if (a.lastName !== b.lastName) return a.lastName.localeCompare(b.lastName);
      return a.firstName.localeCompare(b.firstName);
    });

    // Build section index map: (gradeId-sectionId) -> index within that grade
    const sectionIndexMap = new Map<string, number>();
    const gradeSectionSet = new Map<number, string[]>();
    displaySorted.forEach((s) => {
      const key = `${s.gradeId}-${s.sectionId}`;
      if (!sectionIndexMap.has(key)) {
        const sections = gradeSectionSet.get(s.gradeId) || [];
        sections.push(key);
        gradeSectionSet.set(s.gradeId, sections);
        sectionIndexMap.set(key, sections.length - 1);
      }
    });

    const rows = displaySorted.map((s, idx) => {
      const sectionIdx = sectionIndexMap.get(`${s.gradeId}-${s.sectionId}`) || 0;
      const gradeColor = s.gradeColor || DEFAULT_GRADE_COLOR;
      const sectionColor = lightenColor(gradeColor, 0.25 + sectionIdx * 0.25);
      return {
        inscriptionId: s.inscriptionId,
        index: idx + 1,
        document: s.document,
        lastName: s.lastName,
        firstName: s.firstName,
        gradeName: shortGradeName(s.gradeName),
        gradeColor,
        sectionColor,
        sectionName: s.sectionName.replace(/^SECCION\s+/i, '').replace(/^SECCIÓN\s+/i, ''),
        average: s.average,
        rank: rankMap.get(s.inscriptionId) || 0,
        totalRanked: sorted.length,
      };
    });

    return { rows, totalCount: rows.length };
  }, [data, selectedTerms, selectedGrades, selectedSections, minAverage]);

  // Column definitions
  const columnDefs = useMemo<ColDef<any>[]>(() => [
    {
      headerName: '#',
      width: 60,
      pinned: 'left',
      sortable: false,
      filter: false,
      suppressMenu: true,
      cellClass: 'ag-center-aligned-cell',
      cellRenderer: (params: any) => (params.node?.rowIndex ?? 0) + 1,
    },
    {
      headerName: 'Cédula',
      field: 'document',
      width: 120,
      filter: 'agTextColumnFilter',
      sortable: true,
    },
    {
      headerName: 'Apellidos',
      field: 'lastName',
      width: 180,
      filter: 'agTextColumnFilter',
      sortable: true,
    },
    {
      headerName: 'Nombres',
      field: 'firstName',
      width: 180,
      filter: 'agTextColumnFilter',
      sortable: true,
    },
    {
      headerName: 'Año',
      field: 'gradeName',
      width: 100,
      filter: true,
      sortable: true,
      cellRenderer: (params: any) => {
        return <span style={{ fontWeight: 700, color: '#1a1a1a' }}>{params.value}</span>;
      },
    },
    {
      headerName: 'Sección',
      field: 'sectionName',
      width: 90,
      filter: true,
      sortable: true,
      cellClass: 'ag-center-aligned-cell',
      cellRenderer: (params: any) => {
        return <span style={{ fontWeight: 600, color: '#1a1a1a' }}>{params.value}</span>;
      },
    },
    {
      headerName: 'Promedio',
      field: 'average',
      width: 110,
      sortable: true,
      filter: 'agNumberColumnFilter',
      cellClass: 'ag-center-aligned-cell',
      cellRenderer: (params: any) => {
        const val = params.value;
        if (val === 0) return <span style={{ color: '#bbb' }}>—</span>;
        const color = val >= 10 ? '#389e0d' : '#cf1322';
        return <span style={{ fontWeight: 700, color }}>{val.toFixed(2)}</span>;
      },
    },
    {
      headerName: 'Posición',
      field: 'rank',
      width: 110,
      sortable: true,
      filter: 'agNumberColumnFilter',
      cellClass: 'ag-center-aligned-cell',
      cellRenderer: (params: any) => {
        const rank = params.value;
        const total = params.data?.totalRanked || 0;
        if (rank === 0) return <span style={{ color: '#bbb' }}>—</span>;
        const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';
        return <span style={{ fontWeight: 600 }}>{medal} {rank}/{total}</span>;
      },
    },
  ], []);

  const defaultColDef = useMemo<ColDef<any>>(() => ({
    resizable: true,
    sortable: true,
  }), []);

  const onGridReady = useCallback((event: GridReadyEvent) => {
    event.api.setGridOption('datasource', null);
  }, []);

  const onSortChanged = useCallback(() => {
    gridRef.current?.api.refreshCells({ force: true });
  }, []);

  // Toggle helpers
  const toggleTerm = (id: number) => {
    setSelectedTerms((prev) => prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]);
  };
  const toggleGrade = (id: number) => {
    setSelectedGrades((prev) => prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]);
  };
  const toggleSection = (id: number) => {
    setSelectedSections((prev) => prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]);
  };

  // Print function
  const handlePrint = () => {
    const periodName = viewPeriod?.name || viewPeriod?.period || '';
    const termLabel = selectedTerms.length === 0
      ? 'Todos los lapsos'
      : data?.terms.filter((t) => selectedTerms.includes(t.id)).map((t) => t.name).join(', ');
    const gradeLabel = selectedGrades.length === 0
      ? 'Todos los años'
      : data?.grades.filter((g) => selectedGrades.includes(g.id)).map((g) => shortGradeName(g.name)).join(', ');
    const sectionLabel = selectedSections.length === 0
      ? 'Todas las secciones'
      : data?.sections.filter((s) => selectedSections.includes(s.id)).map((s) => s.name).join(', ');
    const avgLabel = minAverage !== null ? `Promedio ≥ ${minAverage}` : 'Sin límite de promedio';

    const tableRows = rows.map((r: any) => `
      <tr>
        <td class="num">${r.index}</td>
        <td>${r.document || '—'}</td>
        <td>${r.lastName}</td>
        <td>${r.firstName}</td>
        <td class="center">${r.gradeName}</td>
        <td class="center">${r.sectionName}</td>
        <td class="center ${r.average >= 10 ? 'pass' : r.average === 0 ? 'na' : 'fail'}">${r.average === 0 ? '—' : r.average.toFixed(2)}</td>
        <td class="center">${r.rank === 0 ? '—' : `${r.rank}/${r.totalRanked}`}</td>
      </tr>
    `).join('');

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Promedios Generales</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
    color: #1a1a1a;
    padding: 20px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .header {
    text-align: center;
    margin-bottom: 16px;
    border-bottom: 2px solid #1B2A4A;
    padding-bottom: 10px;
  }
  .header h1 {
    font-size: 18px;
    color: #1B2A4A;
    margin-bottom: 4px;
  }
  .header .filters {
    font-size: 11px;
    color: #666;
  }
  .header .filters span { margin: 0 8px; }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
  }
  th {
    background: #1B2A4A;
    color: #fff;
    padding: 6px 8px;
    text-align: left;
    font-weight: 600;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  td {
    padding: 4px 8px;
    border-bottom: 1px solid #e0e0e0;
  }
  td.num { color: #999; width: 30px; text-align: center; }
  td.center { text-align: center; }
  td.pass { color: #389e0d; font-weight: 700; }
  td.fail { color: #cf1322; font-weight: 700; }
  td.na { color: #bbb; }
  tr:nth-child(even) td { background: #f9f9f7; }
  .footer {
    margin-top: 12px;
    font-size: 10px;
    color: #999;
    text-align: right;
  }
  @media print {
    body { padding: 10px; }
    @page { margin: 0.5in; }
  }
</style>
</head>
<body>
  <div class="header">
    <h1>Promedios Generales</h1>
    <div class="filters">
      <span><strong>Período:</strong> ${periodName}</span>
      <span><strong>Lapsos:</strong> ${termLabel}</span>
      <span><strong>Años:</strong> ${gradeLabel}</span>
      <span><strong>Secciones:</strong> ${sectionLabel}</span>
      <span><strong>Promedio:</strong> ${avgLabel}</span>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Cédula</th>
        <th>Apellidos</th>
        <th>Nombres</th>
        <th>Año</th>
        <th>Sección</th>
        <th>Promedio</th>
        <th>Posición</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>
  <div class="footer">Total: ${totalCount} estudiantes · ${new Date().toLocaleDateString('es-VE')}</div>
</body>
</html>`;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
      iframe.contentWindow?.focus();
      setTimeout(() => {
        iframe.contentWindow?.print();
        setTimeout(() => document.body.removeChild(iframe), 1000);
      }, 300);
    }
  };

  // Filtered sections (only show sections for selected grades if any grade is selected)
  const availableSections = useMemo(() => {
    if (!data) return [];
    if (selectedGrades.length === 0) return data.sections;
    return data.sections.filter((s) => selectedGrades.includes(s.gradeId));
  }, [data, selectedGrades]);

  // Button-style filter component
  const FilterButton = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button
      onClick={onClick}
      style={{
        padding: '4px 14px',
        borderRadius: 8,
        border: active ? '1px solid #1B2A4A' : '1px solid #d9d9d9',
        background: active ? '#1B2A4A' : '#fff',
        color: active ? '#fff' : '#595959',
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.2s',
        marginRight: 6,
        marginBottom: 4,
      }}
    >
      {children}
    </button>
  );

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center' }}><Spin size="large" /></div>;
  }

  if (!data) {
    return <div style={{ padding: 40, textAlign: 'center' }}><Typography.Text type="secondary">No hay datos disponibles</Typography.Text></div>;
  }

  return (
    <div style={{ padding: 16, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        .ag-theme-quartz .ag-row.ag-row-grade-colored {
          background-color: var(--grade-row-bg) !important;
        }
        .ag-theme-quartz .ag-row.ag-row-grade-colored .ag-cell {
          background-color: transparent !important;
        }
      `}</style>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Title level={4} style={{ margin: 0 }}>
          <TrophyOutlined style={{ marginRight: 8, color: '#B08D2B' }} />
          Promedios Generales
        </Title>
        <Button
          type="primary"
          icon={<PrinterOutlined />}
          onClick={handlePrint}
          style={{ background: '#1B2A4A', borderColor: '#1B2A4A' }}
        >
          Imprimir
        </Button>
      </div>

      {/* Filters */}
      <div style={{ marginBottom: 12, padding: 12, background: '#fafafa', borderRadius: 12, border: '1px solid #f0f0f0' }}>
        {/* Minimum average filter */}
        <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Promedio mínimo:</span>
          <InputNumber
            size="small"
            min={0}
            max={20}
            step={0.5}
            placeholder="Todos"
            value={minAverage}
            onChange={(val) => setMinAverage(val ?? null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setMinAverage(null);
            }}
            style={{ width: 100 }}
          />
          {minAverage !== null && (
            <FilterButton active={false} onClick={() => setMinAverage(null)}>Sin límite</FilterButton>
          )}
        </div>
        {/* Term filters */}
        <div style={{ marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 8 }}>Lapsos:</span>
          {data.terms.map((t) => (
            <FilterButton key={t.id} active={selectedTerms.includes(t.id)} onClick={() => toggleTerm(t.id)}>
              {t.name}
            </FilterButton>
          ))}
          {selectedTerms.length > 0 && (
            <FilterButton active={false} onClick={() => setSelectedTerms([])}>Todos</FilterButton>
          )}
        </div>
        {/* Grade filters */}
        <div style={{ marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 8 }}>Años:</span>
          {data.grades.map((g) => (
            <FilterButton key={g.id} active={selectedGrades.includes(g.id)} onClick={() => toggleGrade(g.id)}>
              {shortGradeName(g.name)}
            </FilterButton>
          ))}
          {selectedGrades.length > 0 && (
            <FilterButton active={false} onClick={() => setSelectedGrades([])}>Todos</FilterButton>
          )}
        </div>
        {/* Section filters */}
        <div>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 8 }}>Secciones:</span>
          {availableSections.map((s) => (
            <FilterButton key={s.id} active={selectedSections.includes(s.id)} onClick={() => toggleSection(s.id)}>
              {s.name}
            </FilterButton>
          ))}
          {selectedSections.length > 0 && (
            <FilterButton active={false} onClick={() => setSelectedSections([])}>Todas</FilterButton>
          )}
        </div>
      </div>

      {/* AG Grid */}
      <div className="ag-theme-quartz" style={{ flex: 1, minHeight: 400 }}>
        <AgGridProvider modules={[AllCommunityModule]}>
          <AgGridReact<any>
            ref={gridRef}
            rowData={rows}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            onGridReady={onGridReady}
            onSortChanged={onSortChanged}
            onFilterChanged={onSortChanged}
            animateRows={true}
            rowSelection="multiple"
            suppressCellFocus={true}
            getRowId={(params) => String(params.data.inscriptionId)}
            rowClassRules={{
              'ag-row-grade-colored': (params) => !!params.data?.sectionColor,
            }}
            getRowStyle={(params) => {
              const color = params.data?.sectionColor;
              if (!color) return undefined;
              return { ['--grade-row-bg' as any]: withAlpha(color, 0.25) };
            }}
          />
        </AgGridProvider>
      </div>

      {/* Footer */}
      <div style={{ marginTop: 8, fontSize: 12, color: '#8c8c8c', textAlign: 'right' }}>
        {totalCount} estudiantes · {selectedTerms.length > 0 ? `${selectedTerms.length} lapso(s)` : 'Todos los lapsos'}
        {selectedGrades.length > 0 ? ` · ${selectedGrades.length} año(s)` : ''}
        {selectedSections.length > 0 ? ` · ${selectedSections.length} sección(es)` : ''}
        {minAverage !== null ? ` · Promedio ≥ ${minAverage}` : ''}
      </div>
    </div>
  );
}
