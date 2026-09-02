import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Select, Button, Spin, Empty, message, Card } from 'antd';
import { PrinterOutlined, EditOutlined, EyeOutlined, SaveOutlined, PlusOutlined, DeleteOutlined, UploadOutlined } from '@ant-design/icons';
import api from '@/services/api';
import { useSchool } from '@/context/SchoolContext';
import dayjs from 'dayjs';

const PAGE_WIDTH_PT = 792; // 11in
const PAGE_HEIGHT_PT = 612; // 8.5in

type ElementType = 'fixed' | 'variable';
type FontFamily = '"Times New Roman", Times, serif' | 'Arial, Helvetica, sans-serif' | '"Courier New", Courier, monospace';

/** Cédula display formats. The format string itself encodes the separators:
 *  space, hyphen, or none between the prefix and the number, and dots for
 *  thousands grouping. */
type DocFormat = 'V 00000000' | 'V-00000000' | 'V00000000' | 'V 00.000.000' | 'V-00.000.000';

const DOC_FORMAT_OPTIONS: { value: DocFormat; label: string }[] = [
  { value: 'V 00000000', label: 'V 00000000' },
  { value: 'V-00000000', label: 'V-00000000' },
  { value: 'V00000000', label: 'V00000000' },
  { value: 'V 00.000.000', label: 'V 00.000.000' },
  { value: 'V-00.000.000', label: 'V-00.000.000' },
];

const DEFAULT_DOC_FORMAT: DocFormat = 'V 00.000.000';

/** Variables whose value is a cédula and therefore subject to docFormat. */
const DOCUMENT_VARIABLES = new Set([
  'student.document',
  'institution.directorDocument',
  'institution.sig2Id',
]);

/** Extracts the prefix (V/E/P/CE) and raw digits from any cédula string,
 *  regardless of how it was originally formatted. */
function parseCedula(raw: string): { prefix: string; digits: string } {
  if (!raw) return { prefix: '', digits: '' };
  const s = raw.trim();
  const m = s.match(/^([A-Za-z]{1,2})\s*[-\s.]?\s*([\d.\s]+)/);
  if (m) return { prefix: m[1].toUpperCase(), digits: m[2].replace(/[^\d]/g, '') };
  return { prefix: 'V', digits: s.replace(/[^\d]/g, '') };
}

/** Reformats a cédula string into the chosen display format. */
function formatCedula(raw: string, format: DocFormat): string {
  const { prefix, digits } = parseCedula(raw);
  if (!digits) return '';
  const hasThousands = format.includes('.');
  const sep = format[1] === '-' ? '-' : (format[1] === ' ' ? ' ' : '');
  const grouped = hasThousands
    ? digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
    : digits;
  return sep ? `${prefix}${sep}${grouped}` : `${prefix}${grouped}`;
}

interface TemplateElement {
  id: string;
  type: ElementType;
  variable?: string;
  text: string;           // fixed: real text; variable: sample text for editor/preview
  x: number;
  y: number;
  size: number;
  fontFamily: FontFamily;
  bold: boolean;
  /** Tracking between characters, in pt. Can be negative to tighten. */
  letterSpacing: number;
  /** Horizontal stretch, in percent. 100 = natural width. */
  scaleX: number;
  /** Cédula display format. Only meaningful when variable is a document field. */
  docFormat?: DocFormat;
}

const FONT_OPTIONS: { value: FontFamily; label: string }[] = [
  { value: '"Times New Roman", Times, serif', label: 'Times New Roman' },
  { value: 'Arial, Helvetica, sans-serif', label: 'Arial' },
  { value: '"Courier New", Courier, monospace', label: 'Courier New' },
];

// Available variables for type='variable' fields
const VARIABLE_OPTIONS: { value: string; label: string; group: string }[] = [
  { value: 'student.fullName', label: 'Nombre completo', group: 'Estudiante' },
  { value: 'student.document', label: 'Cédula', group: 'Estudiante' },
  { value: 'student.birthplace', label: 'Lugar de nacimiento', group: 'Estudiante' },
  { value: 'student.birthdate', label: 'Fecha de nacimiento', group: 'Estudiante' },
  { value: 'institution.name', label: 'Nombre del plantel', group: 'Institución' },
  { value: 'institution.code', label: 'Código del plantel', group: 'Institución' },
  { value: 'institution.level', label: 'Nivel (BACHILLER)', group: 'Institución' },
  { value: 'institution.program', label: 'Programa', group: 'Institución' },
  { value: 'institution.directorName', label: 'Director - Nombre', group: 'Institución' },
  { value: 'institution.directorDocument', label: 'Director - Cédula', group: 'Institución' },
  { value: 'institution.sig2Name', label: 'Control de Estudios - Nombre', group: 'Institución' },
  { value: 'institution.sig2Id', label: 'Control de Estudios - Cédula', group: 'Institución' },
  { value: 'derived.year', label: 'Año escolar', group: 'Derivados' },
  { value: 'derived.issuePlace', label: 'Lugar y fecha de emisión', group: 'Derivados' },
];

const TIMES: FontFamily = '"Times New Roman", Times, serif';

/** Fills the styling defaults so the template list below stays readable. */
const mk = (e: Omit<TemplateElement, 'fontFamily' | 'bold' | 'letterSpacing' | 'scaleX' | 'docFormat'>
  & Partial<Pick<TemplateElement, 'fontFamily' | 'bold' | 'letterSpacing' | 'scaleX' | 'docFormat'>>): TemplateElement => ({
  fontFamily: TIMES, bold: true, letterSpacing: 0, scaleX: 100, ...e,
});

const DEFAULT_ELEMENTS: TemplateElement[] = [
  mk({ id: 'title', type: 'variable', variable: 'institution.name', text: 'UNIDAD EDUCATIVA COLEGIO BATALLA DE LA VICTORIA', x: 439.5, y: 181.5, size: 10 }),
  mk({ id: 'code', type: 'variable', variable: 'institution.code', text: 'PD00801209', x: 186.75, y: 196.5, size: 10 }),
  mk({ id: 'level', type: 'variable', variable: 'institution.level', text: 'BACHILLER', x: 186.75, y: 213, size: 10 }),
  mk({ id: 'program', type: 'variable', variable: 'institution.program', text: 'EDUCACIÓN MEDIA GENERAL, 31059', x: 310.5, y: 230.25, size: 10 }),
  mk({ id: 'studentName', type: 'variable', variable: 'student.fullName', text: 'JENNY ABIGAIL MARÍN ABACHE', x: 245.25, y: 245.25, size: 10 }),
  mk({ id: 'studentId', type: 'variable', variable: 'student.document', text: 'V 30.781.275', x: 283.5, y: 261, size: 10, docFormat: DEFAULT_DOC_FORMAT }),
  mk({ id: 'birthplace', type: 'variable', variable: 'student.birthplace', text: 'VENEZUELA, GUÁRICO, MUNICIPIO JOSÉ TADEO MONAGAS', x: 198, y: 279, size: 10 }),
  mk({ id: 'birthdate', type: 'variable', variable: 'student.birthdate', text: '04 DE ABRIL DE 2005', x: 186.75, y: 295.5, size: 10 }),
  mk({ id: 'issuePlace', type: 'variable', variable: 'derived.issuePlace', text: 'GUÁRICO, ALTAGRACIA DE ORITUCO, 20 DE JULIO DE 2026', x: 310.5, y: 326.25, size: 10 }),
  mk({ id: 'year', type: 'variable', variable: 'derived.year', text: '2026', x: 225, y: 342.75, size: 10 }),
  mk({ id: 'sig1Name', type: 'variable', variable: 'institution.directorName', text: 'MAGDALENA C. TORRES DE HERRERA', x: 166.5, y: 422.25, size: 8 }),
  mk({ id: 'sig1Id', type: 'variable', variable: 'institution.directorDocument', text: 'V 8.417.321', x: 166.5, y: 437.25, size: 8, docFormat: DEFAULT_DOC_FORMAT }),
  mk({ id: 'sig2Name', type: 'variable', variable: 'institution.sig2Name', text: 'GABRIELA DE LOS ÁNGELES ÁVILA PEREIRA', x: 381, y: 438.75, size: 8 }),
  mk({ id: 'sig2Id', type: 'variable', variable: 'institution.sig2Id', text: 'V 11.366.959', x: 381, y: 453.75, size: 8, docFormat: DEFAULT_DOC_FORMAT }),
  mk({ id: 'sig3Name', type: 'fixed', text: 'MARÍA I. BARÓN HERNÁNDEZ', x: 648.75, y: 440.25, size: 8 }),
  mk({ id: 'sig3Id', type: 'fixed', text: 'V 12.811.357', x: 648.75, y: 454.5, size: 8 }),
];

// Migration: old layouts stored elements without type/variable/fontFamily/bold.
// Map old ids to their variable so saved layouts upgrade transparently.
const OLD_ID_TO_VARIABLE: Record<string, string> = {
  title: 'institution.name',
  code: 'institution.code',
  level: 'institution.level',
  program: 'institution.program',
  studentName: 'student.fullName',
  studentId: 'student.document',
  birthplace: 'student.birthplace',
  birthdate: 'student.birthdate',
  issuePlace: 'derived.issuePlace',
  year: 'derived.year',
  sig1Name: 'institution.directorName',
  sig1Id: 'institution.directorDocument',
  sig2Name: 'institution.sig2Name',
  sig2Id: 'institution.sig2Id',
};
// Old ids that were manual fields become fixed text
const OLD_MANUAL_IDS = new Set(['sig3Name', 'sig3Id']);

function migrateElement(raw: any): TemplateElement {
  const common = {
    text: raw.text ?? '',
    x: Number(raw.x) || 0,
    y: Number(raw.y) || 0,
    size: Number(raw.size) || 10,
    letterSpacing: Number(raw.letterSpacing) || 0,
    scaleX: Number(raw.scaleX) || 100,
    docFormat: (raw.docFormat as DocFormat) || DEFAULT_DOC_FORMAT,
  };
  // Already new format
  if (raw && typeof raw.type === 'string') {
    return {
      ...common,
      id: raw.id,
      type: raw.type,
      variable: raw.variable,
      fontFamily: raw.fontFamily || TIMES,
      bold: raw.bold !== false, // default true
    };
  }
  // Old format: infer type from id
  const id = raw.id as string;
  if (OLD_MANUAL_IDS.has(id)) {
    return { ...common, id, type: 'fixed', fontFamily: TIMES, bold: true };
  }
  const variable = OLD_ID_TO_VARIABLE[id];
  return {
    ...common,
    id,
    type: variable ? 'variable' : 'fixed',
    variable,
    fontFamily: TIMES,
    bold: true,
  };
}

interface TituloStudent {
  inscriptionId: number;
  personId: number;
  fullName: string;
  document: string;
  birthplace: string;
  birthdate: string;
  finalAverage: string;
  graduatedAt: string | null;
  outcomeStatus: string | null;
  sectionName: string;
}

interface TituloInstitution {
  name: string;
  code: string;
  level: string;
  program: string;
  directorName: string;
  directorDocument: string;
  sig2Name: string;
  sig2Id: string;
  issueState: string;
  issueMunicipality: string;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const escapeHtml = (s: string): string =>
  (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Shared span style builder — used by both the editor DOM spans and the iframe HTML
// so they render identically.
function spanStyleStr(el: TemplateElement): string {
  const fontWeight = el.bold ? 'bold' : 'normal';
  const parts = [
    `left:${el.x}pt`,
    `top:${el.y}pt`,
    `font-size:${el.size}pt`,
    `font-family:${el.fontFamily}`,
    `font-weight:${fontWeight}`,
    'line-height:1',
    `letter-spacing:${el.letterSpacing}pt`,
  ];
  if (el.scaleX !== 100) {
    // Anchored at the left edge so x stays the reference point.
    parts.push(`transform:scaleX(${el.scaleX / 100})`, 'transform-origin:left top');
  }
  return parts.join(';');
}

function spanStyleObj(el: TemplateElement, extra: React.CSSProperties = {}): React.CSSProperties {
  return {
    position: 'absolute',
    left: `${el.x}pt`,
    top: `${el.y}pt`,
    fontFamily: el.fontFamily,
    fontWeight: el.bold ? 'bold' : 'normal',
    fontSize: `${el.size}pt`,
    lineHeight: 1,
    letterSpacing: `${el.letterSpacing}pt`,
    ...(el.scaleX !== 100
      ? { transform: `scaleX(${el.scaleX / 100})`, transformOrigin: 'left top' }
      : {}),
    whiteSpace: 'nowrap',
    color: '#000',
    ...extra,
  };
}

interface GridConfig {
  enabled: boolean;
  cols: number;
  rows: number;
}

const DEFAULT_GRID: GridConfig = { enabled: false, cols: 8, rows: 6 };

// Default background image — relative path so it works in deploy
const DEFAULT_BG_IMAGE_URL = '/uploads/images/title_Background.jpg';

// Backgrounds are expected to have the 11x8.5in page ratio, so they map 1:1 to
// the page box. `fill` is used (not `contain`) to avoid any letterbox rounding.
const BG_IMG_STYLE_STR = `position:absolute;left:0;top:0;width:${PAGE_WIDTH_PT}pt;height:${PAGE_HEIGHT_PT}pt;object-fit:fill;pointer-events:none;z-index:0`;

// Build grid overlay HTML for the iframe (used in test prints)
function buildGridHtml(grid: GridConfig): string {
  if (!grid.enabled || grid.cols < 1 || grid.rows < 1) return '';
  const colW = PAGE_WIDTH_PT / grid.cols;
  const rowH = PAGE_HEIGHT_PT / grid.rows;
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lines: string[] = [];
  // Vertical lines + column letters at top
  for (let i = 0; i <= grid.cols; i++) {
    const x = i * colW;
    lines.push(`<div style="position:absolute;left:${x}pt;top:0;width:0;height:100%;border-left:1px dashed #999"></div>`);
    if (i < grid.cols) {
      lines.push(`<div style="position:absolute;left:${x}pt;top:0;width:${colW}pt;text-align:center;font-size:7pt;color:#999;font-family:Arial,sans-serif">${letters[i] || ''}</div>`);
    }
  }
  // Horizontal lines + row numbers at left
  for (let j = 0; j <= grid.rows; j++) {
    const y = j * rowH;
    lines.push(`<div style="position:absolute;left:0;top:${y}pt;height:0;width:100%;border-top:1px dashed #999"></div>`);
    if (j < grid.rows) {
      lines.push(`<div style="position:absolute;left:0;top:${y}pt;height:${rowH}pt;display:flex;align-items:center;font-size:7pt;color:#999;font-family:Arial,sans-serif;padding-left:2pt">${j + 1}</div>`);
    }
  }
  return `<div class="grid-overlay" style="position:absolute;inset:0;pointer-events:none;z-index:9999">${lines.join('')}</div>`;
}

/**
 * Builds a self-contained HTML document with one page per element set.
 * Rendered inside an iframe so the preview is byte-for-byte what gets printed:
 * no app CSS can leak in, and the print output needs no visibility hacks.
 */
interface BuildOptions {
  grid?: GridConfig;
  /** Background image URL, or undefined/empty for no background. */
  bgUrl?: string;
  /** Editor mode: single page flush to the iframe box (no gray gutter/margins). */
  tight?: boolean;
}

// Builds the markup of a single page. Shared by the full-document builder and by
// the editor's imperative iframe sync, so both produce byte-identical pages.
function buildPageHtml(els: TemplateElement[], grid?: GridConfig, bgUrl?: string): string {
  // A CSS background is avoided because browsers may drop it when "background
  // graphics" is off in the print dialog.
  const bgHtml = bgUrl ? `<img src="${escapeHtml(bgUrl)}" alt="" style="${BG_IMG_STYLE_STR}">` : '';
  // The style string carries font stacks with double quotes (e.g. "Times New
  // Roman"), which would close the attribute and silently drop every
  // declaration after it, so it must be escaped like any other attribute value.
  const spans = els.map((el) => `<span style="${escapeHtml(spanStyleStr(el))}">${escapeHtml(el.text)}</span>`).join('');
  const gridHtml = grid ? buildGridHtml(grid) : '';
  return `<div class="page">${bgHtml}${spans}${gridHtml}</div>`;
}

const buildTituloHTML = (pages: TemplateElement[][], opts: BuildOptions = {}): string => {
  const { grid, bgUrl, tight } = opts;
  const pagesHtml = pages.map((els) => buildPageHtml(els, grid, bgUrl)).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Títulos</title>
<style>
  @page { size: 11in 8.5in; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    background: ${tight ? '#fff' : '#d9d9d9'};
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    overflow: ${tight ? 'hidden' : 'auto'};
  }
  .page {
    position: relative;
    width: ${PAGE_WIDTH_PT}pt;
    height: ${PAGE_HEIGHT_PT}pt;
    background: #fff;
    overflow: hidden;
    margin: ${tight ? '0' : '0 auto 12pt'};
  }
  .page span {
    position: absolute;
    white-space: nowrap;
    color: #000;
  }
  @media print {
    html, body { background: #fff; }
    .page {
      margin: 0;
      page-break-after: always;
      break-after: page;
    }
    .page:last-child { page-break-after: auto; break-after: auto; }
  }
</style>
</head>
<body>${pagesHtml}</body>
</html>`;
};

function formatIssueDate(date: dayjs.Dayjs, state: string, municipality: string): string {
  const months = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
    'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
  const dd = String(date.date()).padStart(2, '0');
  const mm = months[date.month()];
  const yyyy = date.year();
  const place = [state, municipality].filter(Boolean).join(', ');
  return `${place}, ${dd} DE ${mm} DE ${yyyy}`;
}

// Resolve a variable name to its real value for a given student/institution.
function resolveVariable(
  variable: string,
  student: TituloStudent,
  institution: TituloInstitution | null,
  schoolPeriodName: string,
  issueDate: dayjs.Dayjs,
): string {
  switch (variable) {
    case 'student.fullName': return student.fullName;
    case 'student.document': return student.document;
    case 'student.birthplace': return student.birthplace;
    case 'student.birthdate': return student.birthdate;
    case 'institution.name': return institution?.name || '';
    case 'institution.code': return institution?.code || '';
    case 'institution.level': return institution?.level || '';
    case 'institution.program': return institution?.program || '';
    case 'institution.directorName': return institution?.directorName || '';
    case 'institution.directorDocument': return institution?.directorDocument || '';
    case 'institution.sig2Name': return institution?.sig2Name || '';
    case 'institution.sig2Id': return institution?.sig2Id || '';
    case 'derived.year': {
      const m = schoolPeriodName.match(/(\d{4})/);
      return m ? m[1] : String(dayjs().year());
    }
    case 'derived.issuePlace':
      return formatIssueDate(issueDate, institution?.issueState || '', institution?.issueMunicipality || '');
    default: return '';
  }
}

const labelStyle: React.CSSProperties = { fontSize: 12, width: 56, color: '#555', flexShrink: 0 };
const numInputStyle: React.CSSProperties = { flex: 1, padding: '4px 6px', fontSize: 13, border: '1px solid #ccc', borderRadius: 4 };
const sectionLabelStyle: React.CSSProperties = { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: '#888', marginTop: 10, marginBottom: 4 };

/**
 * Numeric input that keeps what the user is typing intact.
 * Clamping a controlled input on every keystroke makes intermediate values
 * impossible to type (typing "150" with min=10 collapses to "10"), so the raw
 * draft is kept while focused, propagated only when already in range, and
 * clamped once on blur.
 */
const NumberField: React.FC<{
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  style?: React.CSSProperties;
  title?: string;
}> = ({ value, onChange, min, max, step, style, title }) => {
  const [draft, setDraft] = useState(String(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(String(value));
  }, [value, focused]);

  const clamp = (n: number) => {
    let r = n;
    if (min !== undefined) r = Math.max(min, r);
    if (max !== undefined) r = Math.min(max, r);
    return r;
  };

  return (
    <input
      type="number"
      step={step}
      min={min}
      max={max}
      title={title}
      style={style}
      value={draft}
      onFocus={() => setFocused(true)}
      onChange={e => {
        const raw = e.target.value;
        setDraft(raw);
        const n = parseFloat(raw);
        // Only push valid, in-range values so the preview updates live without
        // fighting what is being typed.
        if (!isNaN(n) && n === clamp(n)) onChange(n);
      }}
      onBlur={() => {
        setFocused(false);
        const n = parseFloat(draft);
        const next = isNaN(n) ? value : clamp(n);
        onChange(next);
        setDraft(String(next));
      }}
    />
  );
};

const TituloImpresion: React.FC = () => {
  const { allPeriods } = useSchool();
  const [mode, setMode] = useState<'print' | 'edit'>('print');
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | undefined>();
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState<TituloStudent[]>([]);
  const [institution, setInstitution] = useState<TituloInstitution | null>(null);
  const [schoolPeriodName, setSchoolPeriodName] = useState('');

  // Layout state
  const [elements, setElements] = useState<TemplateElement[]>(DEFAULT_ELEMENTS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Issue date — shared by both modes, shown in toolbar
  const [issueDate, setIssueDate] = useState(dayjs());

  // Grid overlay (editor + test prints)
  const [grid, setGrid] = useState<GridConfig>(DEFAULT_GRID);

  // Background image (editor + test prints)
  const [bgEnabled, setBgEnabled] = useState(false);
  const [bgUrl, setBgUrl] = useState(DEFAULT_BG_IMAGE_URL);
  const [images, setImages] = useState<{ name: string; url: string }[]>([]);
  const bgFileRef = useRef<HTMLInputElement>(null);

  // Selected students for printing
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<number>>(new Set());

  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Load layout from settings on mount
  useEffect(() => {
    const loadLayout = async () => {
      try {
        const res = await api.get('/settings');
        const layoutJson = res.data?.titulo_layout;
        if (layoutJson) {
          const parsed = JSON.parse(layoutJson);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setElements(parsed.map(migrateElement));
          }
        }
        if (res.data?.titulo_bg_url) setBgUrl(res.data.titulo_bg_url);
      } catch { /* use defaults */ }
    };
    loadLayout();
  }, []);

  // Available background images (uploads/images)
  const loadImages = useCallback(async () => {
    try {
      const res = await api.get<{ name: string; url: string }[]>('/upload/images');
      setImages(res.data || []);
    } catch { /* keep whatever we have */ }
  }, []);

  useEffect(() => {
    if (mode === 'edit') loadImages();
  }, [mode, loadImages]);

  const handleUploadBackground = async (file: File) => {
    const form = new FormData();
    form.append('image', file);
    try {
      const res = await api.post<{ url: string }>('/upload/title-background', form);
      await loadImages();
      setBgUrl(res.data.url);
      setBgEnabled(true);
      message.success('Imagen subida');
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Error al subir la imagen');
    }
  };

  // Fetch titulo data
  const fetchData = useCallback(async () => {
    if (!selectedPeriodId) return;
    setLoading(true);
    try {
      const res = await api.get('/performance-summary/titulo-data', {
        params: { schoolPeriodId: selectedPeriodId },
      });
      setStudents(res.data.students || []);
      setInstitution(res.data.institution || null);
      setSchoolPeriodName(res.data.schoolPeriodName || '');
      setSelectedStudentIds(new Set());
    } catch (e: any) {
      console.error('Error fetching titulo data:', e);
      message.error(e?.response?.data?.message || 'Error al cargar datos de títulos');
    } finally {
      setLoading(false);
    }
  }, [selectedPeriodId]);

  useEffect(() => {
    if (selectedPeriodId) fetchData();
  }, [selectedPeriodId, fetchData]);

  // Save layout to settings
  const saveLayout = async () => {
    try {
      await api.post('/settings', {
        settings: { titulo_layout: JSON.stringify(elements), titulo_bg_url: bgUrl },
      });
      message.success('Diseño guardado');
    } catch (e: any) {
      console.error('[saveLayout] Error:', e);
      message.error(e?.response?.data?.message || e?.message || 'Error al guardar el diseño');
    }
  };

  // Build elements with real data for a student
  const buildElementsForStudent = useCallback((student: TituloStudent): TemplateElement[] => {
    return elements.map(el => {
      if (el.type === 'variable' && el.variable) {
        let resolved = resolveVariable(el.variable, student, institution, schoolPeriodName, issueDate);
        // Apply cédula formatting for document variables
        if (DOCUMENT_VARIABLES.has(el.variable) && el.docFormat) {
          resolved = formatCedula(resolved, el.docFormat);
        }
        return { ...el, text: resolved };
      }
      return el;
    });
  }, [elements, institution, schoolPeriodName, issueDate]);

  // Editor: move selected element
  const moveSelected = useCallback((dx: number, dy: number) => {
    if (!selectedId) return;
    setElements(prev => prev.map(el =>
      el.id === selectedId ? { ...el, x: round2(el.x + dx), y: round2(el.y + dy) } : el
    ));
  }, [selectedId]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!selectedId || editingId) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as any).isContentEditable) return;
      const step = e.shiftKey ? 5 : 1;
      if (e.key === 'ArrowUp') { e.preventDefault(); moveSelected(0, -step); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); moveSelected(0, step); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); moveSelected(-step, 0); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); moveSelected(step, 0); }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, editingId, moveSelected]);

  const selected = elements.find(el => el.id === selectedId) || null;

  const studentsToPrint = useMemo(() => {
    if (selectedStudentIds.size === 0) return students;
    return students.filter(s => selectedStudentIds.has(s.inscriptionId));
  }, [students, selectedStudentIds]);

  const toggleStudent = (inscriptionId: number) => {
    setSelectedStudentIds(prev => {
      const next = new Set(prev);
      if (next.has(inscriptionId)) next.delete(inscriptionId);
      else next.add(inscriptionId);
      return next;
    });
  };

  const updateSelected = (patch: Partial<TemplateElement>) => {
    if (!selectedId) return;
    setElements(prev => prev.map(el => el.id === selectedId ? { ...el, ...patch } : el));
  };

  const addField = () => {
    const id = `field_${Date.now()}`;
    setElements(prev => [...prev, mk({ id, type: 'fixed', text: 'NUEVO CAMPO', x: 200, y: 200, size: 10 })]);
    setSelectedId(id);
  };

  const deleteField = (id: string) => {
    setElements(prev => prev.filter(el => el.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  // The very same HTML is used for the preview iframe and for printing, so what
  // you see is exactly what comes out of the printer.
  // In edit mode it renders a single page with the raw template (sample text).
  const previewHtml = useMemo(() => {
    if (mode === 'edit') return '';
    if (studentsToPrint.length === 0) return '';
    return buildTituloHTML(studentsToPrint.map(buildElementsForStudent));
  }, [mode, studentsToPrint, buildElementsForStudent]);

  // Editor canvas: the iframe is mounted once with an empty shell, then its page
  // is patched in place. This keeps the rendering identical to the printed
  // document without reloading (and flickering) the iframe on every keystroke.
  const editorShellHtml = useMemo(() => buildTituloHTML([], { tight: true }), []);
  const [editorFrameReady, setEditorFrameReady] = useState(false);

  useEffect(() => {
    if (mode !== 'edit') { setEditorFrameReady(false); }
  }, [mode]);

  useEffect(() => {
    if (mode !== 'edit' || !editorFrameReady) return;
    const doc = iframeRef.current?.contentDocument;
    if (!doc?.body) return;
    // Format document-variable sample text so the editor reflects the chosen
    // cédula format, matching what preview/print will show.
    const displayEls = elements.map(el =>
      el.type === 'variable' && el.variable && DOCUMENT_VARIABLES.has(el.variable) && el.docFormat
        ? { ...el, text: formatCedula(el.text, el.docFormat) }
        : el
    );
    doc.body.innerHTML = buildPageHtml(displayEls, grid, bgEnabled ? bgUrl : undefined);
  }, [mode, editorFrameReady, elements, grid, bgEnabled, bgUrl]);

  const handlePrint = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) {
      message.error('No se pudo preparar la impresión');
      return;
    }
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
  }, []);

  return (
    <div className="p-6">
      {/* Toolbar */}
      <div className="mb-4 flex items-center gap-4 flex-wrap">
        <Select
          placeholder="Seleccionar período escolar"
          style={{ width: 280 }}
          value={selectedPeriodId}
          onChange={setSelectedPeriodId}
          options={allPeriods.map(p => ({ value: p.id, label: p.name }))}
        />

        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500">Fecha de emisión</label>
          <input
            type="date"
            style={{ padding: '4px 8px', border: '1px solid #d9d9d9', borderRadius: 6, height: 32 }}
            value={issueDate.format('YYYY-MM-DD')}
            onChange={e => setIssueDate(dayjs(e.target.value))}
          />
        </div>

        <div className="flex gap-2 ml-auto">
          {mode !== 'edit' && (
            <Button icon={<EditOutlined />} onClick={() => setMode('edit')}>
              Editor de diseño
            </Button>
          )}
        </div>
      </div>

      {mode === 'edit' ? (
        /* ── EDITOR MODE ── */
        <div>
          <div className="mb-4 flex items-center gap-3 flex-wrap">
            <Button icon={<SaveOutlined />} onClick={saveLayout}>Guardar diseño</Button>
            <Button onClick={() => { setElements(DEFAULT_ELEMENTS.map(el => ({ ...el }))); setSelectedId(null); }}>Restablecer</Button>
            <span className="text-xs text-slate-400">
              Click en un campo para seleccionarlo. Use flechas para mover (Shift = 5pt). Doble-click para editar texto.
            </span>
          </div>

          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', overflowX: 'auto' }}>
            {/* Page — the visible content is the SAME iframe document that gets
                printed, so editor, preview and print cannot drift apart.
                Interaction (select / move / inline edit) happens in a transparent
                overlay of spans placed on top of it. */}
            <div
              style={{
                position: 'relative',
                width: `${PAGE_WIDTH_PT}pt`,
                height: `${PAGE_HEIGHT_PT}pt`,
                background: '#fff',
                border: '1px solid #999',
                boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                flexShrink: 0,
              }}
            >
              <iframe
                ref={iframeRef}
                srcDoc={editorShellHtml}
                onLoad={() => setEditorFrameReady(true)}
                title="Lienzo del título"
                scrolling="no"
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: `${PAGE_WIDTH_PT}pt`,
                  height: `${PAGE_HEIGHT_PT}pt`,
                  border: 0,
                  display: 'block',
                  pointerEvents: 'none',
                }}
              />

              {/* Transparent hit / selection layer: the iframe underneath already
                  draws the text, so these spans stay invisible. */}
              <div
                style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' }}
                onMouseDown={(e) => { if (e.target === e.currentTarget) setSelectedId(null); }}
              >
                {elements.map(el => (
                  <span
                    key={el.id}
                    contentEditable={editingId === el.id}
                    suppressContentEditableWarning
                    onMouseDown={(e) => { e.stopPropagation(); if (editingId !== el.id) setSelectedId(el.id); }}
                    onDoubleClick={(e) => { e.stopPropagation(); setSelectedId(el.id); setEditingId(el.id); }}
                    onBlur={(e) => {
                      if (editingId === el.id) {
                        setElements(prev => prev.map(x => x.id === el.id ? { ...x, text: e.target.innerText.trim() } : x));
                        setEditingId(null);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (editingId === el.id && e.key === 'Enter') { e.preventDefault(); (e.target as any).blur(); }
                    }}
                    style={spanStyleObj(el, {
                      cursor: editingId === el.id ? 'text' : 'pointer',
                      outline: selectedId === el.id ? '1px dashed #4f8cff' : 'none',
                      outlineOffset: '2px',
                      userSelect: editingId === el.id ? 'text' : 'none',
                      // Visible only while inline-editing so the user can see what
                      // they type; otherwise transparent over the iframe rendering.
                      color: editingId === el.id ? '#000' : 'transparent',
                      background: editingId === el.id ? '#fff' : 'transparent',
                    })}
                  >
                    {el.text}
                  </span>
                ))}
              </div>
            </div>

            {/* Sidebar + action buttons stacked above it, aligned to its width */}
            <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Action buttons + grid controls — fixed width to match sidebar */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="flex gap-2">
                  <Button icon={<PrinterOutlined />} onClick={handlePrint} style={{ flex: 1 }}>
                    Imprimir prueba
                  </Button>
                  <Button
                    type="primary"
                    icon={<EyeOutlined />}
                    onClick={() => setMode('print')}
                    style={{ flex: 1 }}
                  >
                    Volver a Impresión
                  </Button>
                </div>

                {/* Grid + background controls — fixed height container so checkboxes don't shift */}
                <div style={{ border: '1px solid #ddd', borderRadius: 6, padding: '6px 10px', background: '#f5f5f5', display: 'flex', alignItems: 'center', gap: 10, height: 38, boxSizing: 'border-box' }}>
                  <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer" style={{ flexShrink: 0 }}>
                    <input
                      type="checkbox"
                      checked={bgEnabled}
                      onChange={e => setBgEnabled(e.target.checked)}
                    />
                    Fondo
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer" style={{ flexShrink: 0 }}>
                    <input
                      type="checkbox"
                      checked={grid.enabled}
                      onChange={e => setGrid(g => ({ ...g, enabled: e.target.checked }))}
                    />
                    Rejilla
                  </label>
                  {/* Reserve space for cols/rows inputs always, just hide when disabled */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, visibility: grid.enabled ? 'visible' : 'hidden' }}>
                    <label className="text-xs text-slate-500">Cols</label>
                    <NumberField
                      min={1} max={26} value={grid.cols}
                      style={{ width: 48, padding: '2px 4px', fontSize: 12, border: '1px solid #ccc', borderRadius: 4 }}
                      onChange={n => setGrid(g => ({ ...g, cols: n }))}
                    />
                    <label className="text-xs text-slate-500">Fils</label>
                    <NumberField
                      min={1} max={50} value={grid.rows}
                      style={{ width: 48, padding: '2px 4px', fontSize: 12, border: '1px solid #ccc', borderRadius: 4 }}
                      onChange={n => setGrid(g => ({ ...g, rows: n }))}
                    />
                  </div>
                </div>

                {/* Background image picker + upload */}
                <div style={{ border: '1px solid #ddd', borderRadius: 6, padding: '6px 10px', background: '#f5f5f5', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <select
                    value={bgUrl}
                    onChange={e => setBgUrl(e.target.value)}
                    disabled={!bgEnabled}
                    title={bgUrl}
                    style={{ flex: 1, minWidth: 0, padding: '2px 4px', fontSize: 12, border: '1px solid #ccc', borderRadius: 4 }}
                  >
                    {/* Keep the current value selectable even if the listing hasn't loaded */}
                    {!images.some(i => i.url === bgUrl) && <option value={bgUrl}>{bgUrl.split('/').pop()}</option>}
                    {images.map(img => (
                      <option key={img.url} value={img.url}>{img.name}</option>
                    ))}
                  </select>
                  <input
                    ref={bgFileRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) handleUploadBackground(file);
                      e.target.value = '';
                    }}
                  />
                  <Button size="small" icon={<UploadOutlined />} onClick={() => bgFileRef.current?.click()}>
                    Subir
                  </Button>
                </div>
              </div>

              {/* Sidebar panel */}
              <div style={{ border: '1px solid #ddd', borderRadius: 6, padding: 12, background: '#fafafa' }}>
              {selected ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: '#888', marginBottom: 2 }}>Campo seleccionado</div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{selected.id}</div>
                    </div>
                    <Button
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => deleteField(selected.id)}
                    />
                  </div>

                  {/* Type selector */}
                  <div style={{ marginBottom: 8 }}>
                    <div style={sectionLabelStyle}>Tipo</div>
                    <select
                      style={{ width: '100%', padding: '4px 6px', fontSize: 13, border: '1px solid #ccc', borderRadius: 4 }}
                      value={selected.type}
                      onChange={e => {
                        const newType = e.target.value as ElementType;
                        updateSelected({ type: newType, variable: newType === 'variable' ? (selected.variable || 'student.fullName') : undefined });
                      }}
                    >
                      <option value="fixed">Texto fijo</option>
                      <option value="variable">Variable (dato dinámico)</option>
                    </select>
                  </div>

                  {/* Variable selector (only if type=variable) */}
                  {selected.type === 'variable' && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={sectionLabelStyle}>Variable</div>
                      <select
                        style={{ width: '100%', padding: '4px 6px', fontSize: 13, border: '1px solid #ccc', borderRadius: 4 }}
                        value={selected.variable || ''}
                        onChange={e => updateSelected({ variable: e.target.value })}
                      >
                        {['Estudiante', 'Institución', 'Derivados'].map(group => (
                          <optgroup key={group} label={group}>
                            {VARIABLE_OPTIONS.filter(v => v.group === group).map(v => (
                              <option key={v.value} value={v.value}>{v.label}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Cédula format selector — only for document variables */}
                  {selected.type === 'variable' && selected.variable && DOCUMENT_VARIABLES.has(selected.variable) && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={sectionLabelStyle}>Formato de cédula</div>
                      <select
                        style={{ width: '100%', padding: '4px 6px', fontSize: 13, border: '1px solid #ccc', borderRadius: 4 }}
                        value={selected.docFormat || DEFAULT_DOC_FORMAT}
                        onChange={e => updateSelected({ docFormat: e.target.value as DocFormat })}
                      >
                        {DOC_FORMAT_OPTIONS.map(f => (
                          <option key={f.value} value={f.value}>{f.label}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Text / sample text */}
                  <div style={sectionLabelStyle}>
                    {selected.type === 'variable' ? 'Texto de ejemplo (vista previa)' : 'Texto'}
                  </div>
                  <textarea
                    style={{ width: '100%', minHeight: 50, fontFamily: selected.fontFamily, fontSize: 13, padding: 6, border: '1px solid #ccc', borderRadius: 4, boxSizing: 'border-box', resize: 'vertical', fontWeight: selected.bold ? 'bold' : 'normal' }}
                    value={selected.text}
                    onChange={e => updateSelected({ text: e.target.value })}
                  />
                  {selected.type === 'variable' && (
                    <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                      Este texto es sólo para visualización. Al imprimir se usa el dato real.
                    </div>
                  )}

                  {/* Position */}
                  <div style={sectionLabelStyle}>Posición</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <label style={labelStyle}>X (pt)</label>
                    <NumberField
                      style={numInputStyle}
                      step={0.25} value={selected.x}
                      onChange={n => updateSelected({ x: n })}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <label style={labelStyle}>Y (pt)</label>
                    <NumberField
                      style={numInputStyle}
                      step={0.25} value={selected.y}
                      onChange={n => updateSelected({ y: n })}
                    />
                  </div>

                  {/* Typography */}
                  <div style={sectionLabelStyle}>Tipografía</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <label style={labelStyle}>Tamaño</label>
                    <NumberField
                      style={numInputStyle}
                      step={0.5} min={1} value={selected.size}
                      onChange={n => updateSelected({ size: n })}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <label style={labelStyle}>Fuente</label>
                    <select
                      style={numInputStyle}
                      value={selected.fontFamily}
                      onChange={e => updateSelected({ fontFamily: e.target.value as FontFamily })}
                    >
                      {FONT_OPTIONS.map(f => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <label style={labelStyle}>Negrita</label>
                    <input
                      type="checkbox"
                      checked={selected.bold}
                      onChange={e => updateSelected({ bold: e.target.checked })}
                    />
                  </div>

                  {/* Horizontal metrics — useful to match pre-printed forms */}
                  <div style={sectionLabelStyle}>Ancho del texto</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <label style={labelStyle} title="Espacio entre caracteres (pt). Puede ser negativo.">Espaciado</label>
                    <NumberField
                      style={numInputStyle}
                      step={0.05} value={selected.letterSpacing}
                      onChange={n => updateSelected({ letterSpacing: n })}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <label style={labelStyle} title="Estiramiento horizontal. 100 = ancho natural.">Escala %</label>
                    <NumberField
                      style={numInputStyle}
                      step={1} min={10} max={300} value={selected.scaleX}
                      onChange={n => updateSelected({ scaleX: n })}
                    />
                  </div>
                  <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>
                    Ambos se aplican igual en editor, vista previa e impresión.
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 13, color: '#888', lineHeight: 1.4 }}>
                  Seleccione un campo en la página para ver y editar sus propiedades.
                </div>
              )}

              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: '#888' }}>Todos los campos</div>
                  <Button size="small" icon={<PlusOutlined />} onClick={addField}>Agregar</Button>
                </div>
                {elements.map(el => (
                  <button
                    key={el.id}
                    onClick={() => setSelectedId(el.id)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left', padding: '5px 8px', fontSize: 12,
                      border: 'none', borderRadius: 4, background: el.id === selectedId ? '#e6efff' : 'transparent',
                      cursor: 'pointer', color: el.id === selectedId ? '#1a4fb4' : '#444',
                      fontWeight: el.id === selectedId ? 600 : 400,
                    }}
                  >
                    {el.id} <span style={{ color: '#aaa', fontSize: 10 }}>({el.type === 'variable' ? el.variable : 'fijo'})</span>
                  </button>
                ))}
              </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ── PRINT MODE ── */
        <div>
          {!selectedPeriodId ? (
            <Empty description="Seleccione un período escolar para ver los estudiantes graduados" />
          ) : loading ? (
            <div className="flex justify-center p-12"><Spin size="large" /></div>
          ) : students.length === 0 ? (
            <Empty description="No hay estudiantes de 5to año en este período" />
          ) : (
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              {/* Student selection — narrow left column */}
              <Card
                title={`Estudiantes (${students.length})`}
                size="small"
                style={{ width: 320, flexShrink: 0 }}
                extra={
                  <div className="flex gap-1">
                    <Button size="small" onClick={() => setSelectedStudentIds(new Set(students.map(s => s.inscriptionId)))}>Todos</Button>
                    <Button size="small" onClick={() => setSelectedStudentIds(new Set())}>Ninguno</Button>
                  </div>
                }
              >
                <div className="space-y-1" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                  {students.map(student => (
                    <label
                      key={student.inscriptionId}
                      className="flex items-center gap-2 p-1.5 rounded hover:bg-slate-50 cursor-pointer"
                      style={{ fontSize: 12 }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedStudentIds.has(student.inscriptionId)}
                        onChange={() => toggleStudent(student.inscriptionId)}
                      />
                      <span className="font-medium" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {student.fullName}
                      </span>
                      {student.outcomeStatus && (
                        <span
                          className="text-xs px-1.5 py-0.5 rounded"
                          style={{
                            background: student.outcomeStatus === 'aprobado' ? '#e9f1ea' : '#fef3e2',
                            color: student.outcomeStatus === 'aprobado' ? '#3e6e52' : '#b08d2b',
                            flexShrink: 0,
                          }}
                        >
                          {student.outcomeStatus === 'aprobado' ? 'Aprobado' :
                           student.outcomeStatus === 'materias_pendientes' ? 'Pendiente' :
                           student.outcomeStatus === 'reprobado' ? 'Reprobado' : student.outcomeStatus}
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </Card>

              {/* Preview — same document that gets printed */}
              {studentsToPrint.length > 0 && (
                <Card
                  title={
                    <span>
                      <EyeOutlined style={{ marginRight: 6 }} />
                      Vista previa ({studentsToPrint.length} {studentsToPrint.length === 1 ? 'título' : 'títulos'})
                    </span>
                  }
                  size="small"
                  style={{ flex: 1, minWidth: 0 }}
                  extra={
                    <Button
                      type="primary"
                      icon={<PrinterOutlined />}
                      onClick={handlePrint}
                    >
                      Imprimir
                    </Button>
                  }
                >
                  <iframe
                    ref={iframeRef}
                    srcDoc={previewHtml}
                    title="Vista previa de títulos"
                    style={{ width: '100%', height: '70vh', border: '1px solid #e2e8f0', borderRadius: 8 }}
                  />
                </Card>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TituloImpresion;
