import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Select, Button, Spin, Empty, message, Input, Card } from 'antd';
import { PrinterOutlined, EditOutlined, EyeOutlined, SaveOutlined } from '@ant-design/icons';
import api from '@/services/api';
import { useSchool } from '@/context/SchoolContext';
import dayjs from 'dayjs';

const PAGE_WIDTH_PT = 792; // 11in
const PAGE_HEIGHT_PT = 612; // 8.5in

interface TemplateElement {
  id: string;
  text: string;
  x: number;
  y: number;
  size: number;
}

const DEFAULT_ELEMENTS: TemplateElement[] = [
  { id: 'title', text: 'UNIDAD EDUCATIVA COLEGIO BATALLA DE LA VICTORIA', x: 439.5, y: 181.5, size: 10 },
  { id: 'code', text: 'PD00801209', x: 186.75, y: 196.5, size: 10 },
  { id: 'level', text: 'BACHILLER', x: 186.75, y: 213, size: 10 },
  { id: 'program', text: 'EDUCACIÓN MEDIA GENERAL, 31059', x: 310.5, y: 230.25, size: 10 },
  { id: 'studentName', text: 'JENNY ABIGAIL MARÍN ABACHE', x: 245.25, y: 245.25, size: 10 },
  { id: 'studentId', text: 'V 30.781.275', x: 283.5, y: 261, size: 10 },
  { id: 'birthplace', text: 'VENEZUELA, GUÁRICO, MUNICIPIO JOSÉ TADEO MONAGAS', x: 198, y: 279, size: 10 },
  { id: 'birthdate', text: '04 DE ABRIL DE 2005', x: 186.75, y: 295.5, size: 10 },
  { id: 'issuePlace', text: 'GUÁRICO, ALTAGRACIA DE ORITUCO, 20 DE JULIO DE 2026', x: 310.5, y: 326.25, size: 10 },
  { id: 'year', text: '2026', x: 225, y: 342.75, size: 10 },
  { id: 'sig1Name', text: 'MAGDALENA C. TORRES DE HERRERA', x: 166.5, y: 422.25, size: 8 },
  { id: 'sig1Id', text: 'V 8.417.321', x: 166.5, y: 437.25, size: 8 },
  { id: 'sig2Name', text: 'GABRIELA DE LOS ÁNGELES ÁVILA PEREIRA', x: 381, y: 438.75, size: 8 },
  { id: 'sig2Id', text: 'V 11.366.959', x: 381, y: 453.75, size: 8 },
  { id: 'sig3Name', text: 'MARÍA I. BARÓN HERNÁNDEZ', x: 648.75, y: 440.25, size: 8 },
  { id: 'sig3Id', text: 'V 12.811.357', x: 648.75, y: 454.5, size: 8 },
];

// Fields that are per-student (replaced during print)
const STUDENT_FIELDS = new Set(['studentName', 'studentId', 'birthplace', 'birthdate']);

// Fields that come from institution/settings
const INSTITUTION_FIELDS = new Set(['title', 'code', 'level', 'program', 'year', 'issuePlace', 'sig1Name', 'sig1Id', 'sig2Name', 'sig2Id']);

// Fields that are manually entered (sig3)
const MANUAL_FIELDS = new Set(['sig3Name', 'sig3Id']);

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

/**
 * Builds a self-contained HTML document with one page per element set.
 * Rendered inside an iframe so the preview is byte-for-byte what gets printed:
 * no app CSS can leak in, and the print output needs no visibility hacks.
 */
const buildTituloHTML = (pages: TemplateElement[][]): string => {
  const pagesHtml = pages.map((els) => {
    const spans = els.map((el) => `<span style="left:${el.x}pt;top:${el.y}pt;font-size:${el.size}pt">${escapeHtml(el.text)}</span>`).join('');
    return `<div class="page">${spans}</div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Títulos</title>
<style>
  @page { size: 11in 8.5in; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    background: #d9d9d9;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page {
    position: relative;
    width: ${PAGE_WIDTH_PT}pt;
    height: ${PAGE_HEIGHT_PT}pt;
    background: #fff;
    overflow: hidden;
    margin: 0 auto 12pt;
  }
  .page span {
    position: absolute;
    font-family: "Times New Roman", Times, serif;
    font-weight: bold;
    white-space: nowrap;
    color: #000;
    line-height: 1;
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


  // Manual signature input (sig3)
  const [sig3Name, setSig3Name] = useState('');
  const [sig3Id, setSig3Id] = useState('');
  // Manual override for issue date
  const [issueDate, setIssueDate] = useState(dayjs());

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
            setElements(parsed);
          }
        }
      } catch { /* use defaults */ }
    };
    loadLayout();
  }, []);

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
      await api.put('/settings', { titulo_layout: JSON.stringify(elements) });
      message.success('Diseño guardado');
    } catch {
      message.error('Error al guardar el diseño');
    }
  };

  // Build elements with real data for a student
  const buildElementsForStudent = useCallback((student: TituloStudent): TemplateElement[] => {
    const yearMatch = schoolPeriodName.match(/(\d{4})/);
    const year = yearMatch ? yearMatch[1] : String(dayjs().year());

    return elements.map(el => {
      if (STUDENT_FIELDS.has(el.id)) {
        if (el.id === 'studentName') return { ...el, text: student.fullName };
        if (el.id === 'studentId') return { ...el, text: student.document };
        if (el.id === 'birthplace') return { ...el, text: student.birthplace };
        if (el.id === 'birthdate') return { ...el, text: student.birthdate };
      }
      if (INSTITUTION_FIELDS.has(el.id) && institution) {
        if (el.id === 'title') return { ...el, text: institution.name };
        if (el.id === 'code') return { ...el, text: institution.code };
        if (el.id === 'level') return { ...el, text: institution.level };
        if (el.id === 'program') return { ...el, text: institution.program };
        if (el.id === 'year') return { ...el, text: year };
        if (el.id === 'issuePlace') return { ...el, text: formatIssueDate(issueDate, institution.issueState, institution.issueMunicipality) };
        if (el.id === 'sig1Name') return { ...el, text: institution.directorName };
        if (el.id === 'sig1Id') return { ...el, text: institution.directorDocument };
        if (el.id === 'sig2Name') return { ...el, text: institution.sig2Name };
        if (el.id === 'sig2Id') return { ...el, text: institution.sig2Id };
      }
      if (MANUAL_FIELDS.has(el.id)) {
        if (el.id === 'sig3Name') return { ...el, text: sig3Name.toUpperCase() };
        if (el.id === 'sig3Id') return { ...el, text: sig3Id.toUpperCase() };
      }
      return el;
    });
  }, [elements, institution, schoolPeriodName, issueDate, sig3Name, sig3Id]);

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

  // The very same HTML is used for the preview iframe and for printing, so what
  // you see is exactly what comes out of the printer.
  // In edit mode it renders a single page with the raw template (sample text).
  const previewHtml = useMemo(() => {
    if (mode === 'edit') return buildTituloHTML([elements]);
    if (studentsToPrint.length === 0) return '';
    return buildTituloHTML(studentsToPrint.map(buildElementsForStudent));
  }, [mode, elements, studentsToPrint, buildElementsForStudent]);

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

        <div className="flex gap-2 ml-auto">
          {mode === 'edit' ? (
            <>
              <Button icon={<PrinterOutlined />} onClick={handlePrint}>
                Imprimir prueba
              </Button>
              <Button
                type="primary"
                icon={<EyeOutlined />}
                onClick={() => setMode('print')}
              >
                Volver a Impresión
              </Button>
            </>
          ) : (
            <Button icon={<EditOutlined />} onClick={() => setMode('edit')}>
              Editor de diseño
            </Button>
          )}
        </div>
      </div>

      {mode === 'edit' ? (
        /* ── EDITOR MODE ── */
        <div>
          <div className="mb-4 flex items-center gap-3">
            <Button icon={<SaveOutlined />} onClick={saveLayout}>Guardar diseño</Button>
            <Button onClick={() => { setElements(DEFAULT_ELEMENTS.map(el => ({ ...el }))); setSelectedId(null); }}>Restablecer</Button>
            <span className="text-xs text-slate-400">
              Click en un campo para seleccionarlo. Use flechas para mover (Shift = 5pt). Doble-click para editar texto.
            </span>
          </div>

          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', overflowX: 'auto' }}>
            {/* Page */}
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
                  style={{
                    position: 'absolute',
                    left: `${el.x}pt`,
                    top: `${el.y}pt`,
                    fontFamily: '"Times New Roman", Times, serif',
                    fontWeight: 'bold',
                    fontSize: `${el.size}pt`,
                    whiteSpace: 'nowrap',
                    color: '#000',
                    cursor: editingId === el.id ? 'text' : 'pointer',
                    outline: selectedId === el.id ? '1px dashed #4f8cff' : 'none',
                    outlineOffset: '2px',
                    userSelect: editingId === el.id ? 'text' : 'none',
                  }}
                >
                  {el.text}
                </span>
              ))}
            </div>

            {/* Sidebar */}
            <div style={{ width: 280, flexShrink: 0, border: '1px solid #ddd', borderRadius: 6, padding: 12, background: '#fafafa' }}>
              {selected ? (
                <div>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: '#888', marginBottom: 4 }}>Campo seleccionado</div>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>{selected.id}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <label style={{ fontSize: 12, width: 46, color: '#555' }}>X (pt)</label>
                    <input
                      style={{ flex: 1, padding: '4px 6px', fontSize: 13, border: '1px solid #ccc', borderRadius: 4 }}
                      type="number" step="0.25" value={selected.x}
                      onChange={e => setElements(prev => prev.map(el => el.id === selected.id ? { ...el, x: parseFloat(e.target.value) || 0 } : el))}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <label style={{ fontSize: 12, width: 46, color: '#555' }}>Y (pt)</label>
                    <input
                      style={{ flex: 1, padding: '4px 6px', fontSize: 13, border: '1px solid #ccc', borderRadius: 4 }}
                      type="number" step="0.25" value={selected.y}
                      onChange={e => setElements(prev => prev.map(el => el.id === selected.id ? { ...el, y: parseFloat(e.target.value) || 0 } : el))}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <label style={{ fontSize: 12, width: 46, color: '#555' }}>Size</label>
                    <input
                      style={{ flex: 1, padding: '4px 6px', fontSize: 13, border: '1px solid #ccc', borderRadius: 4 }}
                      type="number" step="0.5" value={selected.size}
                      onChange={e => setElements(prev => prev.map(el => el.id === selected.id ? { ...el, size: parseFloat(e.target.value) || 8 } : el))}
                    />
                  </div>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: '#888', marginTop: 10, marginBottom: 4 }}>Texto</div>
                  <textarea
                    style={{ width: '100%', minHeight: 50, fontFamily: '"Times New Roman", Times, serif', fontSize: 13, padding: 6, border: '1px solid #ccc', borderRadius: 4, boxSizing: 'border-box', resize: 'vertical' }}
                    value={selected.text}
                    onChange={e => setElements(prev => prev.map(el => el.id === selected.id ? { ...el, text: e.target.value } : el))}
                  />
                </div>
              ) : (
                <div style={{ fontSize: 13, color: '#888', lineHeight: 1.4 }}>
                  Seleccione un campo en la página para ver y editar su posición.
                </div>
              )}

              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: '#888', marginBottom: 4 }}>Todos los campos</div>
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
                    {el.id}
                  </button>
                ))}
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
            <div className="space-y-4">
              {/* Manual inputs */}
              <Card title="Datos manuales" size="small" className="mb-4">
                <div className="flex gap-4 flex-wrap">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Tercera firma - Nombre</label>
                    <Input
                      style={{ width: 300 }}
                      placeholder="Nombre completo"
                      value={sig3Name}
                      onChange={e => setSig3Name(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Tercera firma - Cédula</label>
                    <Input
                      style={{ width: 180 }}
                      placeholder="V 00.000.000"
                      value={sig3Id}
                      onChange={e => setSig3Id(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Fecha de emisión</label>
                    <input
                      type="date"
                      style={{ padding: '4px 8px', border: '1px solid #d9d9d9', borderRadius: 6, height: 32 }}
                      value={issueDate.format('YYYY-MM-DD')}
                      onChange={e => setIssueDate(dayjs(e.target.value))}
                    />
                  </div>
                </div>
              </Card>

              {/* Student selection */}
              <Card
                title={`Estudiantes de 5to año (${students.length})`}
                size="small"
                extra={
                  <div className="flex gap-2">
                    <Button size="small" onClick={() => setSelectedStudentIds(new Set(students.map(s => s.inscriptionId)))}>Todos</Button>
                    <Button size="small" onClick={() => setSelectedStudentIds(new Set())}>Ninguno</Button>
                  </div>
                }
              >
                <div className="space-y-1">
                  {students.map(student => (
                    <label
                      key={student.inscriptionId}
                      className="flex items-center gap-3 p-2 rounded hover:bg-slate-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedStudentIds.has(student.inscriptionId)}
                        onChange={() => toggleStudent(student.inscriptionId)}
                      />
                      <span className="font-medium">{student.fullName}</span>
                      <span className="text-slate-500 text-sm">{student.document}</span>
                      <span className="text-slate-400 text-sm">Prom: {student.finalAverage || '—'}</span>
                      <span className="text-slate-400 text-sm">Sección: {student.sectionName}</span>
                      {student.outcomeStatus && (
                        <span
                          className="text-xs px-2 py-0.5 rounded"
                          style={{
                            background: student.outcomeStatus === 'aprobado' ? '#e9f1ea' : '#fef3e2',
                            color: student.outcomeStatus === 'aprobado' ? '#3e6e52' : '#b08d2b',
                          }}
                        >
                          {student.outcomeStatus === 'aprobado' ? 'Aprobado' :
                           student.outcomeStatus === 'materias_pendientes' ? 'Materias pendientes' :
                           student.outcomeStatus === 'reprobado' ? 'Reprobado' : student.outcomeStatus}
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </Card>

              {!sig3Name.trim() && (
                <div style={{ color: '#cf1322', fontSize: 13, fontWeight: 500 }}>
                  Debe ingresar el nombre de la tercera firma para poder imprimir.
                </div>
              )}

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
                  extra={
                    <Button
                      type="primary"
                      icon={<PrinterOutlined />}
                      onClick={handlePrint}
                      disabled={!sig3Name.trim()}
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

      {/* Hidden iframe used to print the editor layout ("Imprimir prueba") */}
      {mode === 'edit' && (
        <iframe
          ref={iframeRef}
          srcDoc={previewHtml}
          title="Impresión de prueba"
          style={{ display: 'none' }}
        />
      )}
    </div>
  );
};

export default TituloImpresion;
