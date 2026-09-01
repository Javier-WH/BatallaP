import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Typography, Button, Spin, message, InputNumber, Select, AutoComplete } from 'antd';
import { PrinterOutlined, TrophyOutlined, FileExcelOutlined, SearchOutlined } from '@ant-design/icons';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
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

// Convert "Quinto Año" → "5to Año", "Primer Año" → "1er Año", etc.
// Keys are lowercase. Both apocopated ("primer", "tercer") and full
// ("primero", "tercero") forms are supported.
const ordinalToNumber: Record<string, string> = {
  'primero': '1ro', 'primer': '1er',
  'segundo': '2do',
  'tercero': '3ro', 'tercer': '3er',
  'cuarto': '4to',
  'quinto': '5to',
  'sexto': '6to',
  'séptimo': '7mo', 'septimo': '7mo',
  'octavo': '8vo',
  'noveno': '9no',
  'décimo': '10mo', 'decimo': '10mo',
  'undécimo': '11mo', 'undecimo': '11mo',
  'duodécimo': '12mo', 'duodecimo': '12mo',
  'decimotercero': '13ro',
  'decimocuarto': '14to',
  'decimoquinto': '15to',
  'decimosexto': '16to',
  'decimoséptimo': '17mo', 'decimoseptimo': '17mo',
  'decimoctavo': '18vo',
  'decimonoveno': '19no',
  'vigésimo': '20mo', 'vigesimo': '20mo',
};
const shortGradeName = (name: string): string => {
  const lower = name.toLowerCase().trim();
  // Sort entries by key length descending so "primero" matches before "primer"
  // when the input is "Primero Año".
  const entries = Object.entries(ordinalToNumber).sort((a, b) => b[0].length - a[0].length);
  for (const [word, num] of entries) {
    if (lower.startsWith(word)) {
      return num + name.slice(word.length);
    }
  }
  return name;
};

interface TermGrade { termId: number; termName: string; score: number | null; }
interface SubjectTermScore { termId: number; score: number | null; }
interface GeneralAverageSubject {
  includeInAverage: boolean;
  termScores: SubjectTermScore[];
  finalScore: number | null;
}
interface GeneralAverageStudent {
  inscriptionId: number;
  firstName: string;
  lastName: string;
  document: string;
  gender: string | null;
  gradeId: number;
  gradeName: string;
  gradeColor: string | null;
  sectionId: number;
  sectionName: string;
  termGrades: TermGrade[];
  generalAverage?: number | null;
  subjects: GeneralAverageSubject[];
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
  const [topN, setTopN] = useState<number | null>(null);
  const [selectedGender, setSelectedGender] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<string[]>([]);
  const [selectedInscriptionId, setSelectedInscriptionId] = useState<number | null>(null);
  const [searchText, setSearchText] = useState('');
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
    // Filter by gender
    if (selectedGender !== null) {
      filtered = filtered.filter((s) => s.gender === selectedGender);
    }

    // Determine which terms to average
    const termIds = selectedTerms.length > 0
      ? selectedTerms
      : data.terms.map((t) => t.id);

    // Compute average per student using the selected terms.
    // Method: for each eligible subject, compute the average of its term scores
    // for the selected terms, round it to an integer (roundFinalGrade, min=1),
    // then average those rounded subject finals with 2 decimals.
    // This matches the Def. shown in boletines and official actas/planillas.
    const withAvg = filtered.map((s) => {
      const eligible = s.subjects.filter((sub) => sub.includeInAverage !== false);
      const subjectFinals = eligible
        .map((sub) => {
          const selected = sub.termScores
            .filter((ts) => termIds.includes(ts.termId) && ts.score !== null);
          if (selected.length === 0) return null;
          const avg = selected.reduce((a, b) => a + (b.score as number), 0) / selected.length;
          return Math.max(1, Math.round(avg));
        })
        .filter((v): v is number => v !== null);
      const avg = subjectFinals.length > 0
        ? Number((subjectFinals.reduce((a, b) => a + b, 0) / subjectFinals.length).toFixed(2))
        : 0;
      return { ...s, average: avg };
    });

    // Filter by minimum average threshold
    const aboveThreshold = minAverage !== null
      ? withAvg.filter((s) => s.average >= minAverage!)
      : withAvg;

    // Apply "Mejores N" filter: take the top N students by average descending
    // This is applied AFTER all other filters (grade, section, gender, min average)
    // and BEFORE ranking, so the position is recalculated on the subset
    const afterTopN = topN !== null && topN > 0
      ? [...aboveThreshold].sort((a, b) => b.average - a.average).slice(0, topN)
      : aboveThreshold;

    // Compute ranking within the filtered set (by average descending)
    const sorted = [...afterTopN].sort((a, b) => b.average - a.average);
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

    // Build display rows — sorted by group fields first (if any), then by average desc
    const groupComparator = (a: any, b: any): number => {
      for (const field of groupBy) {
        let cmp = 0;
        if (field === 'grade') {
          cmp = (a.gradeName || '').localeCompare(b.gradeName || '');
        } else if (field === 'section') {
          cmp = (a.sectionName || '').localeCompare(b.sectionName || '');
        } else if (field === 'gender') {
          const ga = a.gender || 'Z';
          const gb = b.gender || 'Z';
          cmp = ga.localeCompare(gb);
        }
        if (cmp !== 0) return cmp;
      }
      return 0;
    };

    const displaySorted = [...afterTopN].sort((a, b) => {
      // Group fields take priority
      const groupCmp = groupComparator(a, b);
      if (groupCmp !== 0) return groupCmp;
      // Within group: by average descending, then by name
      if (b.average !== a.average) return b.average - a.average;
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
        gender: s.gender,
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
  }, [data, selectedTerms, selectedGrades, selectedSections, selectedGender, minAverage, topN, groupBy]);

  // Build search options from all students in the current data (not filtered)
  const searchOptions = useMemo(() => {
    if (!data) return [];
    return data.students.map((s) => ({
      value: String(s.inscriptionId),
      label: (
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>{s.lastName}, {s.firstName}</span>
          <span style={{ color: '#999', fontSize: 12 }}>{s.document}</span>
        </div>
      ),
      inscriptionId: s.inscriptionId,
      searchText: `${s.lastName} ${s.firstName} ${s.document}`.toLowerCase(),
    }));
  }, [data]);

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
      headerName: 'Género',
      field: 'gender',
      width: 80,
      filter: 'agTextColumnFilter',
      sortable: true,
      cellClass: 'ag-center-aligned-cell',
      cellRenderer: (params: any) => {
        const g = params.value;
        if (!g) return <span style={{ color: '#bbb' }}>—</span>;
        if (g === 'M') return <span style={{ fontWeight: 700, color: '#1890ff' }}>M</span>;
        if (g === 'F') return <span style={{ fontWeight: 700, color: '#cf1322' }}>F</span>;
        return <span>{g}</span>;
      },
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
    sortable: groupBy.length === 0,
  }), [groupBy]);

  const onGridReady = useCallback((event: GridReadyEvent) => {
    event.api.setGridOption('datasource', undefined);
  }, []);

  const onSortChanged = useCallback(() => {
    gridRef.current?.api.refreshCells({ force: true });
  }, []);

  // Deselect rows only when pressing Escape (click-outside is too aggressive
  // because Ant Design portals like AutoComplete dropdowns render outside the
  // container ref, which would clear the selection before onSelect fires).
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        gridRef.current?.api.deselectAll();
        setSelectedInscriptionId(null);
        setSearchText('');
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Re-select and scroll to the selected student when rows change (filters/sort)
  useEffect(() => {
    if (selectedInscriptionId == null) return;
    const api = gridRef.current?.api;
    if (!api) return;
    // Use a microtask delay to ensure AG-Grid has finished processing the new rowData
    const timer = setTimeout(() => {
      let found = false;
      api.forEachNode((node) => {
        if (node.data?.inscriptionId === selectedInscriptionId) {
          node.setSelected(true, true);
          api.ensureNodeVisible(node);
          found = true;
        }
      });
      if (!found) {
        // Student filtered out — clear grid selection but keep state
        // so it re-selects when the student becomes visible again
        api.deselectAll();
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [rows, selectedInscriptionId]);

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
    const topNLabel = topN !== null ? `Mejores ${topN}` : 'Todos los estudiantes';
    const genderLabel = selectedGender !== null ? (selectedGender === 'M' ? 'Masculino' : 'Femenino') : 'Todos';

    // Get rows in the current grid order (respects user sorting)
    const gridRows: any[] = [];
    gridRef.current?.api.forEachNodeAfterFilterAndSort((node: any) => {
      if (node.data) gridRows.push(node.data);
    });
    const printRows = gridRows.length > 0 ? gridRows : rows;

    const tableRows = printRows.map((r: any, i: number) => `
      <tr>
        <td class="num">${i + 1}</td>
        <td>${r.document || '—'}</td>
        <td>${r.lastName}</td>
        <td>${r.firstName}</td>
        <td class="center" style="font-weight:700;color:${r.gender === 'M' ? '#1890ff' : r.gender === 'F' ? '#cf1322' : '#bbb'}">${r.gender === 'M' ? 'M' : r.gender === 'F' ? 'F' : '—'}</td>
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
      <span><strong>Mejores:</strong> ${topNLabel}</span>
      <span><strong>Género:</strong> ${genderLabel}</span>
      ${groupBy.length > 0 ? `<span><strong>Agrupar por:</strong> ${groupBy.map(g => g === 'grade' ? 'Año' : g === 'section' ? 'Sección' : 'Género').join(', ')}</span>` : ''}
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Cédula</th>
        <th>Apellidos</th>
        <th>Nombres</th>
        <th>Género</th>
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
  <div class="footer">Total: ${printRows.length} estudiantes · ${new Date().toLocaleDateString('es-VE')}</div>
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

  const handleExportExcel = async () => {
    // Get rows in the current grid order (respects user sorting + grouping)
    const gridRows: any[] = [];
    gridRef.current?.api.forEachNodeAfterFilterAndSort((node: any) => {
      if (node.data) gridRows.push(node.data);
    });
    const exportRows = gridRows.length > 0 ? gridRows : rows;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Promedios Generales');

    // Title row
    const periodName = viewPeriod?.name || viewPeriod?.period || '';
    worksheet.mergeCells('A1:I1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'Promedios Generales';
    titleCell.font = { size: 14, bold: true, color: { argb: 'FF1B2A4A' } };
    titleCell.alignment = { horizontal: 'center' };

    // Subtitle with filters
    const termLabel = selectedTerms.length === 0
      ? 'Todos los lapsos'
      : data?.terms.filter((t) => selectedTerms.includes(t.id)).map((t) => t.name).join(', ');
    const gradeLabel = selectedGrades.length === 0
      ? 'Todos los años'
      : data?.grades.filter((g) => selectedGrades.includes(g.id)).map((g) => shortGradeName(g.name)).join(', ');
    const groupLabel = groupBy.length > 0
      ? groupBy.map(g => g === 'grade' ? 'Año' : g === 'section' ? 'Sección' : 'Género').join(', ')
      : '';
    const topNLabel = topN !== null ? `Mejores ${topN}` : '';
    const genderLabel = selectedGender !== null ? (selectedGender === 'M' ? 'Masculino' : 'Femenino') : '';

    worksheet.mergeCells('A2:I2');
    const subCell = worksheet.getCell('A2');
    subCell.value = `Período: ${periodName}  |  Lapsos: ${termLabel}  |  Años: ${gradeLabel}${topNLabel ? `  |  ${topNLabel}` : ''}${genderLabel ? `  |  Género: ${genderLabel}` : ''}${groupLabel ? `  |  Agrupar por: ${groupLabel}` : ''}`;
    subCell.font = { size: 9, color: { argb: 'FF666666' } };
    subCell.alignment = { horizontal: 'center' };

    // Header row
    const headers = ['#', 'Cédula', 'Apellidos', 'Nombres', 'Género', 'Año', 'Sección', 'Promedio', 'Posición'];
    const headerRow = worksheet.addRow(headers);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B2A4A' } };
      cell.alignment = { horizontal: 'center' as const, vertical: 'middle' as const };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFB08D2B' } } };
    });

    // Data rows
    exportRows.forEach((r: any, i: number) => {
      const row = worksheet.addRow([
        i + 1,
        r.document || '—',
        r.lastName,
        r.firstName,
        r.gender === 'M' ? 'M' : r.gender === 'F' ? 'F' : '—',
        r.gradeName,
        r.sectionName,
        r.average === 0 ? null : r.average,
        r.rank === 0 ? '—' : `${r.rank}/${r.totalRanked}`,
      ]);

      // Color the row background based on section color
      if (r.sectionColor) {
        const hex = r.sectionColor.replace('#', '');
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${lightenColor(hex, 0.85).replace('#', '')}` } };
        });
      }

      // Gender color
      const genderCell = row.getCell(5);
      if (r.gender === 'M') {
        genderCell.font = { bold: true, color: { argb: 'FF1890FF' } };
      } else if (r.gender === 'F') {
        genderCell.font = { bold: true, color: { argb: 'FFCF1322' } };
      }

      // Average color
      const avgCell = row.getCell(8);
      if (r.average > 0) {
        avgCell.font = { bold: true, color: { argb: r.average >= 10 ? 'FF389E0D' : 'FFCF1322' } };
      }
      avgCell.alignment = { horizontal: 'center' };
      avgCell.numFmt = '0.00';

      // Center alignment for #, Género, Año, Sección, Posición
      row.getCell(1).alignment = { horizontal: 'center' };
      row.getCell(5).alignment = { horizontal: 'center' };
      row.getCell(6).alignment = { horizontal: 'center' };
      row.getCell(7).alignment = { horizontal: 'center' };
      row.getCell(9).alignment = { horizontal: 'center' };
    });

    // Column widths
    worksheet.getColumn(1).width = 6;
    worksheet.getColumn(2).width = 14;
    worksheet.getColumn(3).width = 22;
    worksheet.getColumn(4).width = 22;
    worksheet.getColumn(5).width = 8;
    worksheet.getColumn(6).width = 10;
    worksheet.getColumn(7).width = 10;
    worksheet.getColumn(8).width = 12;
    worksheet.getColumn(9).width = 12;

    // Freeze header
    worksheet.views = [{ state: 'frozen', ySplit: 3 }];

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `promedios-generales.xlsx`);
    message.success('Excel generado correctamente');
  };
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
        .ag-theme-quartz .ag-row.ag-row-hover {
          background-color: rgba(0, 0, 0, 0.04) !important;
        }
        .ag-theme-quartz .ag-row.ag-row-hover .ag-cell {
          background-color: transparent !important;
        }
      `}</style>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Title level={4} style={{ margin: 0 }}>
          <TrophyOutlined style={{ marginRight: 8, color: '#B08D2B' }} />
          Promedios Generales
        </Title>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            type="primary"
            icon={<PrinterOutlined />}
            onClick={handlePrint}
            style={{ background: '#1B2A4A', borderColor: '#1B2A4A' }}
          >
            Imprimir
          </Button>
          <Button
            type="primary"
            icon={<FileExcelOutlined />}
            onClick={handleExportExcel}
            style={{ background: '#389e0d', borderColor: '#389e0d' }}
          >
            Excel
          </Button>
        </div>
      </div>

      {/* Student search bar — selects and scrolls to a student without filtering */}
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        <SearchOutlined style={{ color: '#8c8c8c', fontSize: 16 }} />
        <AutoComplete
          style={{ width: 350 }}
          options={searchOptions}
          value={searchText}
          placeholder="Buscar estudiante por nombre o cédula..."
          filterOption={(input, option) =>
            (option?.searchText as string)?.includes(input.toLowerCase())
          }
          onSelect={(value) => {
            const inscriptionId = Number(value);
            const student = data?.students.find((s) => s.inscriptionId === inscriptionId);
            if (student) {
              setSearchText(`${student.lastName}, ${student.firstName}`);
            }
            setSelectedInscriptionId(inscriptionId);
            const api = gridRef.current?.api;
            if (api) {
              let found = false;
              api.forEachNode((node) => {
                if (node.data?.inscriptionId === inscriptionId) {
                  node.setSelected(true, true);
                  api.ensureNodeVisible(node);
                  found = true;
                }
              });
              if (!found) {
                message.info('Estudiante seleccionado. Ajusta los filtros para verlo en la lista.');
              }
            }
          }}
          allowClear
          onChange={(value) => {
            setSearchText(value || '');
            if (!value) {
              setSelectedInscriptionId(null);
              gridRef.current?.api.deselectAll();
            }
          }}
        />
      </div>

      {/* Filters + Group By */}
      <div style={{ marginBottom: 12, padding: 12, background: '#fafafa', borderRadius: 12, border: '1px solid #f0f0f0', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {/* Left: Filters */}
        <div>
          {/* Minimum average + Top N filters (side by side) */}
          <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Mejores:</span>
              <InputNumber
                size="small"
                min={1}
                max={9999}
                step={1}
                placeholder="Todos"
                value={topN}
                onChange={(val) => setTopN(val ?? null)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setTopN(null);
                }}
                style={{ width: 100 }}
              />
              {topN !== null && (
                <FilterButton active={false} onClick={() => setTopN(null)}>Todos</FilterButton>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Género:</span>
              <Select
                size="small"
                value={selectedGender ?? undefined}
                onChange={(val) => setSelectedGender(val ?? null)}
                placeholder="Todos"
                allowClear
                style={{ width: 110 }}
                options={[
                  { value: 'M', label: 'Masculino' },
                  { value: 'F', label: 'Femenino' },
                ]}
              />
            </div>
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

        {/* Vertical separator */}
        <div style={{ width: 1, background: '#e0e0e0', flexShrink: 0 }} />

        {/* Right: Group by */}
        <div style={{ flexShrink: 0, marginLeft: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Agrupar por:</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <FilterButton active={groupBy.includes('grade')} onClick={() => setGroupBy(prev => prev.includes('grade') ? prev.filter(g => g !== 'grade') : [...prev, 'grade'])}>
              Año
            </FilterButton>
            <FilterButton active={groupBy.includes('section')} onClick={() => setGroupBy(prev => prev.includes('section') ? prev.filter(g => g !== 'section') : [...prev, 'section'])}>
              Sección
            </FilterButton>
            <FilterButton active={groupBy.includes('gender')} onClick={() => setGroupBy(prev => prev.includes('gender') ? prev.filter(g => g !== 'gender') : [...prev, 'gender'])}>
              Género
            </FilterButton>
            {groupBy.length > 0 && (
              <FilterButton active={false} onClick={() => setGroupBy([])}>Sin agrupar</FilterButton>
            )}
          </div>
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
            rowSelection="single"
            suppressCellFocus={true}
            onSelectionChanged={(e) => {
              // Only update state when there IS a selection.
              // When rows change, AG-Grid clears selection and fires this event
              // with empty selection — we must NOT clear selectedInscriptionId
              // here, otherwise the useEffect can't re-select after data changes.
              // Deselection is handled by the click-outside / Escape handlers.
              const selected = e.api.getSelectedNodes();
              if (selected.length > 0) {
                setSelectedInscriptionId(selected[0].data?.inscriptionId ?? null);
              }
            }}
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
        {topN !== null ? ` · Mejores ${topN}` : ''}
        {selectedGender !== null ? ` · ${selectedGender === 'M' ? 'Masculino' : 'Femenino'}` : ''}
        {groupBy.length > 0 ? ` · Agrupado por: ${groupBy.map(g => g === 'grade' ? 'Año' : g === 'section' ? 'Sección' : 'Género').join(', ')}` : ''}
      </div>
    </div>
  );
}
