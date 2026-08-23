import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Select, Button, Spin, message, Alert, Input, Popover } from 'antd';
import { PrinterOutlined } from '@ant-design/icons';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import api from '@/services/api';
import { compareStudents } from '@/utils/studentSort';
import TemplateManagerModal from '@/components/TemplateManagerModal';
import type { LetterGrade } from '@/components/pdf/BoletinPDF';
import { generateBoletinHTML } from '@/components/pdf/BoletinHTML';
import type { BoletinHTMLData } from '@/components/pdf/BoletinHTML';

/* ------------------------------------------------------------------ */
/* Icons — tiny inline SVGs, zero dependencies                         */
/* ------------------------------------------------------------------ */
const Icon = ({ children, size = 16, ...props }: any) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    {children}
  </svg>
);

const IconBarChart = (p: any) => <Icon {...p}><path d="M3 3v18h18" /><rect x="7" y="12" width="3" height="6" /><rect x="12" y="8" width="3" height="10" /><rect x="17" y="5" width="3" height="13" /></Icon>;
const IconFileCode = (p: any) => <Icon {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M9.5 13.5 8 15l1.5 1.5M14.5 13.5 16 15l-1.5 1.5" /></Icon>;
const IconFileSpreadsheet = (p: any) => <Icon {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M8 13h8M8 17h8M11 13v6" /></Icon>;
const IconSettings = (p: any) => <Icon {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56V21a2 2 0 0 1-4 0v-.09A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.04H3a2 2 0 0 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1.04-1.56V3a2 2 0 0 1 4 0v.09A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.36.62 1 1.02 1.72 1.04H21a2 2 0 0 1 0 4h-.09A1.7 1.7 0 0 0 19.4 15Z" /></Icon>;
const IconInfo = (p: any) => <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M12 16v-5M12 8h.01" /></Icon>;
const IconDownload = (p: any) => <Icon {...p}><path d="M12 3v12M7 10l5 5 5-5" /><path d="M4 19h16" /></Icon>;
const IconAlert = (p: any) => <Icon {...p}><path d="M10.3 3.9 2.4 18a1.5 1.5 0 0 0 1.3 2.2h16.6a1.5 1.5 0 0 0 1.3-2.2L13.7 3.9a1.5 1.5 0 0 0-2.6 0Z" /><path d="M12 9v4M12 17h.01" /></Icon>;
const IconUsers = (p: any) => <Icon {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></Icon>;
const IconGrad = (p: any) => <Icon {...p}><path d="M22 10 12 5 2 10l10 5 10-5Z" /><path d="M6 12v5c0 1.5 3 3 6 3s6-1.5 6-3v-5" /></Icon>;
const IconCalendar = (p: any) => <Icon {...p}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></Icon>;
const IconCheck = (p: any) => <Icon {...p}><path d="M20 6 9 17l-5-5" /></Icon>;
const IconSearch = (p: any) => <Icon {...p}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></Icon>;

/* ------------------------------------------------------------------ */
/* Report types                                                        */
/* ------------------------------------------------------------------ */
const REPORT_TYPES = [
  { id: 'resumen', label: 'Resumen de Rendimiento', icon: IconBarChart, desc: 'Genera un Excel con el promedio final de notas por estudiante.' },
  { id: 'html', label: 'Boletines HTML', icon: IconFileCode, desc: 'Genera boletines en formato HTML para publicar o compartir por enlace.' },
  { id: 'certified', label: 'Notas Certificadas', icon: IconFileSpreadsheet, desc: 'Genera un Excel oficial con las notas certificadas del período.' },
] as const;

type ReportType = typeof REPORT_TYPES[number]['id'];

/* ------------------------------------------------------------------ */
/* CSS styles                                                          */
/* ------------------------------------------------------------------ */
const STYLES = `
  .rb-root {
    --navy-900: #131F3A;
    --navy-700: #1E3A66;
    --gold-600: #A8752E;
    --gold-bg: #FBF3E6;
    --page-bg: #F7F8FA;
    --border: #E2E5EA;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif;
    background: var(--page-bg);
    color: #1A2233;
    display: flex;
    flex-direction: column;
    min-height: 100%;
    width: 100%;
  }
  .rb-serif { font-family: Georgia, "Times New Roman", serif; }

  /* Top bar */
  .rb-topbar {
    background: #fff; border-bottom: 1px solid var(--border);
    display: flex; align-items: center; gap: 4px;
    padding: 0 20px; overflow-x: auto; flex-shrink: 0;
  }
  .rb-nav-item {
    display: flex; align-items: center; gap: 8px; white-space: nowrap;
    padding: 14px 14px; border: none; background: transparent; color: #667085;
    cursor: pointer; font-size: 13.5px; font-weight: 500;
    position: relative; border-bottom: 2px solid transparent;
  }
  .rb-nav-item:hover { color: var(--navy-700); }
  .rb-nav-item.active { color: var(--navy-900); border-bottom-color: var(--gold-600); }

  /* Main */
  .rb-main { flex: 1; padding: 28px 24px; min-width: 0; }
  .rb-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 26px; }
  .rb-title { font-size: 26px; line-height: 1.2; color: var(--navy-900); margin: 0; }
  .rb-desc { font-size: 13.5px; color: #667085; margin: 6px 0 0; max-width: 460px; }
  .rb-utility-btns { display: flex; gap: 8px; flex-wrap: wrap; }
  .rb-btn-ghost {
    display: flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 500;
    padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border); background: #fff;
    color: #475066; cursor: pointer;
  }
  .rb-btn-ghost:hover { background: #F4F5F7; }

  .rb-columns { display: flex; gap: 24px; align-items: flex-start; flex-wrap: wrap; }
  .rb-config { flex: 1 1 480px; display: flex; flex-direction: column; gap: 20px; min-width: 0; }
  .rb-preview-col { flex: 0 0 300px; width: 300px; }

  .rb-card { background: #fff; border: 1px solid var(--border); border-radius: 16px; padding: 20px; }
  .rb-card-label { font-size: 11px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; color: #98A2B3; margin: 0 0 16px; }

  /* Compact scope picker: one labelled row per dimension */
  .rb-scope { display: flex; flex-direction: column; gap: 14px; }
  .rb-scope-row { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
  .rb-scope-label {
    display: inline-flex; align-items: center; gap: 6px;
    flex: 0 0 118px; font-size: 11px; font-weight: 600;
    letter-spacing: 0.03em; text-transform: uppercase; color: #98A2B3;
  }
  .rb-period-select { min-width: 280px; }
  .rb-chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .rb-chip {
    padding: 7px 16px; border-radius: 8px; font-size: 13px; font-weight: 500;
    border: 1px solid var(--border); background: #fff; color: #475569;
    cursor: pointer; white-space: nowrap; user-select: none;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
  }
  .rb-chip:hover { border-color: #94A3B8; background: #F8FAFC; }
  .rb-chip.active { background: var(--navy-700); border-color: var(--navy-700); color: #fff; font-weight: 600; }
  .rb-chip.active:hover { background: #1d3f60; }
  .rb-scope-summary {
    display: flex; align-items: flex-start; gap: 8px;
    padding: 10px 14px; border-radius: 10px;
    background: #F0FBF4; border: 1px solid #D3F0DE;
    font-size: 12.5px; color: #2C6E4A; line-height: 1.5;
  }
  .rb-scope-summary svg { flex-shrink: 0; margin-top: 2px; }

  .rb-field-empty { font-size: 13px; color: #C2C7D0; }

  .rb-segmented { display: inline-flex; border: 1px solid var(--border); border-radius: 12px; padding: 4px; background: #F8F9FB; }
  .rb-segmented-btn { border: none; background: transparent; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 500; color: #667085; cursor: pointer; }
  .rb-segmented-btn.active { background: var(--navy-700); color: #fff; }

  .rb-info-card { border-radius: 16px; padding: 20px; background: #F0FBF4; border: 1px solid #D3F0DE; }
  .rb-info-title { font-size: 13px; font-weight: 600; color: #1F6B45; margin: 0 0 12px; }
  .rb-info-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
  .rb-info-list li { display: flex; gap: 8px; font-size: 13px; color: #2C6E4A; line-height: 1.45; }
  .rb-info-list svg { margin-top: 2px; flex-shrink: 0; }

  /* Preview card */
  .rb-preview-card { background: #fff; border: 1px solid var(--border); border-radius: 16px; overflow: hidden; position: sticky; top: 20px; }
  .rb-preview-head { background: var(--navy-900); padding: 16px 20px; }
  .rb-preview-head-title { color: #fff; font-size: 13px; font-weight: 600; }
  .rb-preview-head-sub { color: rgba(255,255,255,0.5); font-size: 11.5px; margin-top: 2px; }
  .rb-preview-body { padding: 18px 20px; display: flex; flex-direction: column; gap: 12px; }
  .rb-preview-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .rb-preview-label { font-size: 12.5px; color: #667085; }
  .rb-preview-value { font-size: 13px; font-weight: 500; color: #1A2233; text-align: right; }
  .rb-muted { color: #C2C7D0; }
  .rb-preview-total { display: flex; justify-content: space-between; padding-top: 12px; margin-top: 2px; border-top: 1px dashed var(--border); }
  .rb-preview-total-label { font-size: 12.5px; color: #667085; }
  .rb-preview-total-value { font-size: 13.5px; font-weight: 600; color: var(--navy-700); }

  .rb-perforation { position: relative; height: 0; }
  .rb-notch { position: absolute; top: -12px; width: 24px; height: 24px; border-radius: 50%; background: var(--page-bg); border: 1px solid var(--border); }
  .rb-notch-left { left: -12px; }
  .rb-notch-right { right: -12px; }
  .rb-dashed-divider { margin: 0 20px; border-top: 1px dashed var(--border); }

  .rb-preview-footer { padding: 18px 20px; }
  .rb-warning { display: flex; gap: 8px; border-radius: 10px; padding: 10px 12px; background: var(--gold-bg); margin-bottom: 16px; }
  .rb-warning svg { color: var(--gold-600); margin-top: 2px; flex-shrink: 0; }
  .rb-warning-text { font-size: 12px; color: #8A5E20; line-height: 1.4; }
  .rb-warning-link { display: block; background: none; border: none; padding: 0; margin-top: 3px; font-size: 12px; font-weight: 600; color: #8A5E20; text-decoration: underline; cursor: pointer; }

  .rb-export-btn {
    width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;
    padding: 12px; border-radius: 12px; border: none; font-size: 13.5px; font-weight: 600; cursor: pointer;
    background: var(--navy-700); color: #fff;
  }
  .rb-export-btn:disabled { background: #EEF0F3; color: #A7ADB8; cursor: not-allowed; }
  .rb-export-hint { text-align: center; font-size: 11.5px; color: #98A2B3; margin: 8px 0 0; }

  /* Boletin layout */
  .rb-boletin-layout { display: flex; flex-direction: column; gap: 20px; }
  .rb-boletin-content { display: flex; gap: 16px; align-items: flex-start; }
  .rb-student-list { flex: 0 0 280px; width: 280px; }
  .rb-preview-area { flex: 1; min-width: 0; }

  .rb-student-list-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
  .rb-student-list-body { max-height: 65vh; overflow-y: auto; border: 1px solid var(--border); border-radius: 12px; background: #fff; }
  .rb-student-item { padding: 10px 14px; cursor: pointer; border-bottom: 1px solid #f1f5f9; display: flex; align-items: center; gap: 10px; transition: background 0.15s; }
  .rb-student-item:hover { background: #f8fafc; }
  .rb-student-item.selected { background: #e0f2fe; }
  .rb-student-num { flex-shrink: 0; width: 24px; height: 24px; border-radius: 6px; background: #e2e8f0; color: #64748b; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
  .rb-student-item.selected .rb-student-num { background: #0284c7; color: #fff; }
  .rb-student-name { font-weight: 600; font-size: 13px; }
  .rb-student-doc { font-size: 11px; color: #64748b; }

  .rb-empty-preview { display: flex; justify-content: center; align-items: center; height: 60vh; color: #94a3b8; }
  .rb-empty-preview-inner { text-align: center; }
  .rb-empty-preview-inner svg { font-size: 48px; margin-bottom: 12px; display: block; }

  .rb-empty-state { text-align: center; padding: 60px 20px; color: #98A2B3; font-size: 14px; }

  /* Responsive */
  @media (max-width: 860px) {
    .rb-preview-col { width: 100%; flex-basis: 100%; }
    .rb-preview-card { position: static; }
    .rb-boletin-content { flex-direction: column; }
    .rb-student-list { width: 100%; flex-basis: 100%; }
  }
`;

/* ------------------------------------------------------------------ */
/* Helper components                                                   */
/* ------------------------------------------------------------------ */
const LegendRow: React.FC<{ name: string; desc: string }> = ({ name, desc }) => (
  <div style={{ display: 'flex', gap: 10, padding: '3px 0', borderBottom: '1px dashed #e2e8f0' }}>
    <code style={{ color: '#15803d', fontWeight: 700, whiteSpace: 'nowrap', minWidth: 110, fontSize: 12 }}>{name}</code>
    <span style={{ color: '#475569', fontSize: 12.5, flex: 1 }}>{desc}</span>
  </div>
);

function PreviewRow({ label, value, muted }: { label: string; value: React.ReactNode; muted?: boolean }) {
  return (
    <div className="rb-preview-row">
      <span className="rb-preview-label">{label}</span>
      <span className={`rb-preview-value${muted ? ' rb-muted' : ''}`}>{value}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Interfaces                                                          */
/* ------------------------------------------------------------------ */
interface Grade { id: number; name: string; isDiversified: boolean; order: number; }
interface Section { id: number; name: string; }
interface PeriodGradeStructure { id: number; grade: Grade; sections: Section[]; }
interface SchoolPeriod { id: number; period: string; name: string; status: 'preinscripcion' | 'activo' | 'historico' | 'externo'; isActive: boolean; }

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */
const PerformanceSummary: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [annualLoading, setAnnualLoading] = useState(false);
  const [structure, setStructure] = useState<PeriodGradeStructure[]>([]);
  const [allPeriods, setAllPeriods] = useState<SchoolPeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | null>(null);
  const [selectedGradeIds, setSelectedGradeIds] = useState<number[]>([]);
  const [selectedSectionIds, setSelectedSectionIds] = useState<number[]>([]);
  const [studentGroup, setStudentGroup] = useState<'regulares' | 'revision'>('regulares');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [userOverrodeTemplate, setUserOverrodeTemplate] = useState(false);
  const [reportType, setReportType] = useState<ReportType>('resumen');

  // boletin tab state
  const [boletinPeriodId, setBoletinPeriodId] = useState<number | null>(null);
  const [boletinGradeId, setBoletinGradeId] = useState<number | null>(null);
  const [boletinSectionId, setBoletinSectionId] = useState<number | null>(null);
  const [boletinStudents, setBoletinStudents] = useState<{ inscriptionId: number; firstName: string; lastName: string; document: string; documentType?: string }[]>([]);
  const [letterGrades, setLetterGrades] = useState<LetterGrade[]>([]);
  const [maxGrade, setMaxGrade] = useState<number>(20);
  const [boletinLogoBase64, setBoletinLogoBase64] = useState<string | null>(null);

  // boletin HTML tab state (shares selectors with PDF tab)
  const [boletinHtmlLoading, setBoletinHtmlLoading] = useState(false);
  const [boletinHtmlString, setBoletinHtmlString] = useState<string | null>(null);
  const [boletinHtmlSelectedInscriptionId, setBoletinHtmlSelectedInscriptionId] = useState<number | null>(null);
  const boletinHtmlIframeRef = useRef<HTMLIFrameElement>(null);

  // certified tab state
  const [certPersonId, setCertPersonId] = useState<number | null>(null);
  const [certTemplate, setCertTemplate] = useState<string | null>(null);
  const [certTemplateList, setCertTemplateList] = useState<string[]>([]);
  const [certSearchQuery, setCertSearchQuery] = useState('');
  const [certSearchResults, setCertSearchResults] = useState<{ label: string; value: number }[]>([]);
  const [certLoading, setCertLoading] = useState(false);

  const boletinSelectedGrade = structure.find(s => s.grade.id === boletinGradeId);
  const boletinAvailableSections = [...(boletinSelectedGrade?.sections || [])].sort((a, b) =>
    (a.name || '').localeCompare(b.name || '', 'es')
  );

  // --- Derived selection state (declared before any handler that depends on it) ---
  // Sections are global records shared across grades (Section.name is UNIQUE and the
  // grade<->section link lives in PeriodGradeSection), so the same sectionId can belong
  // to several grades. A course is therefore identified by the (gradeId, sectionId) pair.

  // Union of the sections belonging to the selected grades, deduped by id.
  const availableSections = useMemo(() => {
    const byId = new Map<number, Section>();
    structure.forEach(s => {
      if (!selectedGradeIds.includes(s.grade.id)) return;
      s.sections.forEach(sec => byId.set(sec.id, sec));
    });
    return [...byId.values()].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'es'));
  }, [structure, selectedGradeIds]);

  // Only the (grade, section) pairs that actually exist in the academic structure.
  // Selecting 2 grades x 2 sections does not necessarily yield 4 courses.
  const validCombinations = useMemo(() => {
    const combos: { gradeId: number; gradeName: string; sectionId: number; sectionName: string }[] = [];
    structure.forEach(s => {
      if (!selectedGradeIds.includes(s.grade.id)) return;
      s.sections.forEach(sec => {
        if (!selectedSectionIds.includes(sec.id)) return;
        combos.push({ gradeId: s.grade.id, gradeName: s.grade.name, sectionId: sec.id, sectionName: sec.name });
      });
    });
    return combos;
  }, [structure, selectedGradeIds, selectedSectionIds]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [activeRes, periodsRes] = await Promise.all([
        api.get('/academic/active'),
        api.get('/academic/periods'),
      ]);
      const period = activeRes.data;
      const periods: SchoolPeriod[] = Array.isArray(periodsRes.data) ? periodsRes.data : [];
      setAllPeriods(periods);
      const initialPeriodId = period?.id ?? periods[0]?.id ?? null;
      setSelectedPeriodId((prev) => prev ?? initialPeriodId);
      setBoletinPeriodId((prev) => prev ?? initialPeriodId);
    } catch (error) {
      console.error('Error fetching data', error);
      message.error('Error al cargar la información inicial');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStructure = useCallback(async (periodId: number | null) => {
    if (!periodId) {
      setStructure([]);
      return;
    }
    try {
      const structureRes = await api.get(`/academic/structure/${periodId}`);
      const data = Array.isArray(structureRes.data) ? structureRes.data : [];
      setStructure(data.sort((a: PeriodGradeStructure, b: PeriodGradeStructure) =>
        (a.grade.order || 0) - (b.grade.order || 0)
      ));
    } catch (error) {
      console.error('Error fetching structure', error);
      setStructure([]);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    if (!selectedPeriodId) { setStructure([]); return; }
    fetchStructure(selectedPeriodId);
  }, [selectedPeriodId, fetchStructure]);

  // Template assignment is resolved from the first selected course.
  useEffect(() => {
    const gradeId = selectedGradeIds[0];
    if (!gradeId) { setSelectedTemplate(null); return; }
    const sectionId = selectedSectionIds[0];
    const params = sectionId ? `?sectionId=${sectionId}` : '';
    api.get(`/templates/assignment/${gradeId}${params}`)
      .then((res) => { setSelectedTemplate(res.data?.templateName || null); })
      .catch(() => setSelectedTemplate(null));
  }, [selectedGradeIds, selectedSectionIds]);

  useEffect(() => {
    setUserOverrodeTemplate(false);
    setSelectedGradeIds([]);
    setSelectedSectionIds([]);
  }, [selectedPeriodId]);

  useEffect(() => { setUserOverrodeTemplate(false); }, [selectedGradeIds, selectedSectionIds]);

  // Drop sections that no longer belong to any selected grade.
  useEffect(() => {
    setSelectedSectionIds(prev => {
      if (prev.length === 0) return prev;
      const valid = new Set(availableSections.map(s => s.id));
      const next = prev.filter(id => valid.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [availableSections]);

  // Load letter grades for boletin tab
  useEffect(() => {
    api.get('/settings').then((res) => {
      if (res.data?.letter_grades) {
        try {
          const parsed = typeof res.data.letter_grades === 'string'
            ? JSON.parse(res.data.letter_grades)
            : res.data.letter_grades;
          if (parsed.scale && Array.isArray(parsed.scale)) setLetterGrades(parsed.scale);
          else if (Array.isArray(parsed)) setLetterGrades(parsed);
        } catch { /* ignore */ }
      }
      if (res.data?.max_grade) setMaxGrade(Number(res.data.max_grade));
    }).catch(() => { /* ignore */ });
  }, []);

  // Load institution logo for boletin tabs (resized to 100x100 to keep base64 small)
  useEffect(() => {
    let cancelled = false;
    api.get('/upload/logo', { responseType: 'blob' })
      .then((res) => {
        if (cancelled) return;
        const blob = res.data as Blob;
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
          URL.revokeObjectURL(url);
          if (cancelled) return;
          const canvas = document.createElement('canvas');
          canvas.width = 100;
          canvas.height = 100;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          ctx.drawImage(img, 0, 0, 100, 100);
          if (!cancelled) setBoletinLogoBase64(canvas.toDataURL('image/png'));
        };
        img.onerror = () => { URL.revokeObjectURL(url); };
        img.src = url;
      })
      .catch(() => { /* no logo available */ });
    return () => { cancelled = true; };
  }, []);

  // Load students for boletin tab when section is selected
  useEffect(() => {
    if (!boletinPeriodId || !boletinGradeId || !boletinSectionId) {
      setBoletinStudents([]);
      return;
    }
    let cancelled = false;
    api.get('/inscriptions', {
      params: { schoolPeriodId: boletinPeriodId, gradeId: boletinGradeId, sectionId: boletinSectionId },
    }).then((res) => {
      if (cancelled) return;
      const list = (res.data || []).map((ins: any) => ({
        inscriptionId: ins.id,
        firstName: ins.student?.firstName || '',
        lastName: ins.student?.lastName || '',
        document: ins.student?.document || '',
        documentType: ins.student?.documentType || '',
      })).sort((a: any, b: any) => compareStudents(a, b));
      setBoletinStudents(list);
    }).catch(() => { if (!cancelled) setBoletinStudents([]); });
    return () => { cancelled = true; };
  }, [boletinPeriodId, boletinGradeId, boletinSectionId]);

  // Load templates for certified tab
  useEffect(() => {
    let cancelled = false;
    api.get('/templates').then((res) => {
      if (cancelled) return;
      const names = (res.data || []).map((t: any) => t.name || t.filename || t).filter(Boolean);
      setCertTemplateList(names);
    }).catch(() => { if (!cancelled) setCertTemplateList([]); });
    return () => { cancelled = true; };
  }, []);

  const handleExport = async () => {
    if (!selectedPeriodId || validCombinations.length === 0) {
      message.warning('Seleccione periodo, grado y sección');
      return;
    }
    if (!selectedTemplate) {
      setTemplateModalOpen(true);
      return;
    }
    setExporting(true);
    try {
      // One file per (grade, section) course.
      for (const combo of validCombinations) {
        const response = await api.get('/performance-summary/export', {
          params: {
            schoolPeriodId: selectedPeriodId,
            gradeId: combo.gradeId,
            sectionId: combo.sectionId,
            template: selectedTemplate || undefined,
            group: studentGroup,
          },
          responseType: 'blob',
        });
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        const fileName = response.headers['content-disposition']
          ?.split('filename="')[1]?.split('"')[0] || 'resumen-rendimiento.xlsx';
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      }
      const n = validCombinations.length;
      message.success(`${n} ${n === 1 ? 'planilla exportada' : 'planillas exportadas'} correctamente`);
    } catch (error: any) {
      console.error('Error exporting', error);
      if (error.response?.data) {
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const err = JSON.parse(reader.result as string);
            message.error(err.message || 'Error al exportar');
          } catch { message.error('Error al exportar el resumen'); }
        };
        reader.readAsText(error.response.data);
      } else { message.error('Error al exportar el resumen'); }
    } finally { setExporting(false); }
  };

  // --- Resumen del Rendimiento Anual ---
  // Generates an Excel from boletin-data, cloning the CourseCouncil format
  // but with L1, L2, L3, NF columns (no PC, no double border separator).
  // Appends one sheet for a single (grade, section) course. Returns false when the
  // course has no students so the caller can skip it without aborting the batch.
  const buildAnnualSheet = useCallback(async (
    workbook: ExcelJS.Workbook,
    schoolPeriodId: number,
    gradeId: number,
    sectionId: number,
  ): Promise<boolean> => {
    {
      // Fetch boletin data (same endpoint used for PDF/HTML boletines)
      const res = await api.get('/performance-summary/boletin-data', {
        params: { schoolPeriodId, gradeId, sectionId },
      });
      const data = res.data as any;
      if (!data.students || data.students.length === 0) {
        return false;
      }

      const gradeName = data.grade?.name || '';
      const sectionName = (data.students[0]?.sectionName || '').replace(/sección/gi, '').trim();

      const terms = data.terms || [];
      const termCount = terms.length;
      const passingGrade = data.passingGrade || 10;
      const maxGradeValue = 20;

      // ── Build column definitions ──
      // Group subjects (same subjectGroupId) are collapsed into one column.
      // A separate "Grupos" column shows the individual subject name per lapso.
      type ColDef =
        | { kind: 'regular'; title: string; subjectId: number }
        | { kind: 'group'; title: string; subjectGroupId: number }
        | { kind: 'groupNames'; title: 'Grupos'; subjectGroupId: number };

      const columnDefinitions: ColDef[] = [];
      const seenSubjectIds = new Set<number>();
      const seenGroupIds = new Set<number>();

      // Collect all unique subjects across all students, preserving order
      data.students.forEach((s: any) => {
        (s.subjects || []).forEach((sub: any) => {
          if (sub.subjectGroupId) {
            // Group subject — collapse by subjectGroupId
            if (!seenGroupIds.has(sub.subjectGroupId)) {
              seenGroupIds.add(sub.subjectGroupId);
              columnDefinitions.push({ kind: 'group', title: sub.name, subjectGroupId: sub.subjectGroupId });
              columnDefinitions.push({ kind: 'groupNames', title: 'Grupos', subjectGroupId: sub.subjectGroupId });
            }
          } else {
            // Regular subject
            if (!seenSubjectIds.has(sub.id)) {
              seenSubjectIds.add(sub.id);
              columnDefinitions.push({ kind: 'regular', title: sub.name, subjectId: sub.id });
            }
          }
        });
      });

      // Fixed headers
      const fixedHeaders = ['#', 'Documento', 'Estudiante', 'Pos', 'Promedio', 'Rep'];
      const leafHeaders: string[] = [...fixedHeaders];
      const groupRanges: { title: string; start: number; end: number }[] = [
        { title: 'Información del estudiante', start: 1, end: fixedHeaders.length }
      ];

      // Build leaf headers per column definition
      // - regular: L1, L2, L3, ..., NF
      // - group:   L1, L2, L3, ..., NF  (notes from whichever subject the student took)
      // - groupNames: L1, L2, L3, ...   (subject name per lapso, no NF)
      const colDefHasNF: boolean[] = [];
      columnDefinitions.forEach(colDef => {
        const start = leafHeaders.length + 1;
        for (let i = 0; i < termCount; i++) {
          leafHeaders.push(`L${i + 1}`);
        }
        if (colDef.kind === 'groupNames') {
          // No NF column for group names
          colDefHasNF.push(false);
        } else {
          leafHeaders.push('NF');
          colDefHasNF.push(true);
        }
        groupRanges.push({ title: colDef.title, start, end: leafHeaders.length });
      });

      // One sheet per course. Excel sheet names are capped at 31 chars and cannot
      // contain : \ / ? * [ ]. Truncation could collide, so append a counter if needed.
      const baseSheetName = `${gradeName} - ${sectionName}`.replace(/[:\\/?*[\]]/g, '').trim() || 'Resumen Anual';
      let sheetName = baseSheetName.substring(0, 31);
      for (let dedupe = 2; workbook.getWorksheet(sheetName); dedupe++) {
        const suffix = ` (${dedupe})`;
        sheetName = `${baseSheetName.substring(0, 31 - suffix.length)}${suffix}`;
      }
      const worksheet = workbook.addWorksheet(sheetName, {
        pageSetup: {
          orientation: 'landscape',
          paperSize: 9,
          fitToPage: true,
          fitToWidth: 1,
          fitToHeight: 0,
          horizontalCentered: true,
          margins: { left: 0.25, right: 0.25, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 }
        }
      });
      worksheet.pageSetup.printTitlesRow = '6:7';

      // Column widths
      const widthFromPx = (px: number): number => (px - 5) / 7;
      worksheet.getColumn(1).width = 2.86;
      worksheet.getColumn(2).width = 12.86;
      worksheet.getColumn(3).width = 42;
      worksheet.getColumn(4).width = widthFromPx(29);
      worksheet.getColumn(5).width = widthFromPx(57);
      worksheet.getColumn(6).width = widthFromPx(29);
      for (let i = 7; i <= leafHeaders.length; i++) {
        worksheet.getColumn(i).width = 4;
      }
      // Widen "Grupos" columns so subject abbreviations fit
      columnDefinitions.forEach((colDef, idx) => {
        if (colDef.kind === 'groupNames') {
          const range = groupRanges[idx + 1];
          for (let c = range.start; c <= range.end; c++) {
            worksheet.getColumn(c).width = 5;
          }
        }
      });

      // Compute 1/3 and 2/3 cut points for header layout
      const colWidths: number[] = [];
      let totalWidth = 0;
      for (let i = 1; i <= leafHeaders.length; i++) {
        const w = worksheet.getColumn(i).width || 0;
        colWidths.push(w);
        totalWidth += w;
      }
      const third = totalWidth / 3;
      let cut1 = 1, cut2 = 1, acc = 0;
      for (let i = 0; i < colWidths.length; i++) {
        acc += colWidths[i];
        if (cut1 === 1 && acc >= third) cut1 = i + 1;
        if (cut2 === 1 && acc >= third * 2) cut2 = i + 1;
      }
      cut1 = Math.max(2, Math.min(cut1, leafHeaders.length - 2));
      cut2 = Math.max(cut1 + 1, Math.min(cut2, leafHeaders.length - 1));
      const lastCol = leafHeaders.length;

      // Header rows (1-5)
      for (let i = 0; i < 5; i++) worksheet.addRow([]);

      // Row 1: institution name (center)
      worksheet.mergeCells(1, 1, 1, cut1);
      worksheet.mergeCells(1, cut1 + 1, 1, cut2);
      worksheet.mergeCells(1, cut2 + 1, 1, lastCol);
      const nameCell = worksheet.getCell(1, cut1 + 1);
      nameCell.value = data.institution?.name || '';
      nameCell.alignment = { horizontal: 'center', vertical: 'middle' };
      nameCell.font = { bold: true, size: 20, color: { argb: '17324D' } };
      worksheet.getRow(1).height = 48;

      // Row 3: school period (right)
      worksheet.mergeCells(3, cut2 + 1, 3, lastCol);
      const periodCell = worksheet.getCell(3, cut2 + 1);
      periodCell.value = data.institution?.period || '';
      periodCell.alignment = { horizontal: 'right', vertical: 'middle', indent: 1 };
      periodCell.font = { bold: true, size: 14, color: { argb: '17324D' } };

      // Row 4: title (center) — "Resumen de Rendimiento Anual"
      worksheet.mergeCells(4, 1, 4, 2);
      const profesorLabelCell = worksheet.getCell(4, 1);
      profesorLabelCell.value = 'Profesor:';
      profesorLabelCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
      profesorLabelCell.font = { size: 14, color: { argb: '17324D' } };

      const profesorNameCell = worksheet.getCell(4, 3);
      const guideTeacher = data.students[0]?.guideTeacher || '';
      profesorNameCell.value = guideTeacher
        ? guideTeacher.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
        : '';
      profesorNameCell.alignment = { horizontal: 'left', vertical: 'middle' };
      profesorNameCell.font = { bold: true, size: 14, color: { argb: '17324D' } };

      worksheet.mergeCells(4, cut1 + 1, 4, cut2);
      const titleCell = worksheet.getCell(4, cut1 + 1);
      titleCell.value = 'Resumen de Rendimiento Anual';
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      titleCell.font = { bold: true, size: 14, color: { argb: '17324D' } };

      worksheet.mergeCells(4, cut2 + 1, 4, lastCol);
      const dateCell = worksheet.getCell(4, cut2 + 1);
      const councilDate = data.lastCouncilCompletedAt
        ? new Date(data.lastCouncilCompletedAt).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : '__/__/____';
      dateCell.value = `Fecha: ${councilDate}`;
      dateCell.alignment = { horizontal: 'right', vertical: 'middle', indent: 1 };
      dateCell.font = { size: 14, color: { argb: '17324D' } };

      // Row 5: curso (left)
      worksheet.mergeCells(5, 1, 5, 2);
      const cursoLabelCell = worksheet.getCell(5, 1);
      cursoLabelCell.value = 'Curso:';
      cursoLabelCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
      cursoLabelCell.font = { size: 14, color: { argb: '17324D' } };

      const cursoNameCell = worksheet.getCell(5, 3);
      cursoNameCell.value = `${gradeName}, Sección ${sectionName}`.trim();
      cursoNameCell.alignment = { horizontal: 'left', vertical: 'middle' };
      cursoNameCell.font = { bold: true, size: 14, color: { argb: '17324D' } };

      // Row 5 center: empty (no lapso name for annual report)
      worksheet.mergeCells(5, cut1 + 1, 5, cut2);

      worksheet.getRow(2).height = 24.75;
      worksheet.getRow(3).height = 24.75;
      worksheet.getRow(4).height = 24.75;
      worksheet.getRow(5).height = 24.75;

      // Logo
      const pxToColUnits = (px: number): number => {
        let remaining = px;
        for (let c = 1; c <= leafHeaders.length; c++) {
          const w = worksheet.getColumn(c).width || 0;
          const colPx = Math.round(w >= 1 ? w * 7 + 5 : w * 7);
          if (remaining <= colPx) return (c - 1) + remaining / colPx;
          remaining -= colPx;
        }
        return leafHeaders.length;
      };
      try {
        const logoResponse = await api.get('/upload/logo', { responseType: 'arraybuffer' });
        const logoBuffer = logoResponse.data as ArrayBuffer;
        const view = new DataView(logoBuffer);
        const pngWidth = view.getUint32(16, false);
        const pngHeight = view.getUint32(20, false);
        const targetHeightPx = Math.round(1.28 * 96);
        const targetWidthPx = pngHeight > 0 ? Math.round((pngWidth / pngHeight) * targetHeightPx) : targetHeightPx;
        const logoId = workbook.addImage({ buffer: logoBuffer, extension: 'png' });
        worksheet.addImage(logoId, {
          tl: { col: pxToColUnits(28), row: 5 / 48 },
          ext: { width: targetWidthPx, height: targetHeightPx }
        });
      } catch (error) {
        console.warn('No se pudo incluir el logo institucional en el Excel:', error);
      }

      // Header rows (6 = group titles, 7 = leaf headers)
      const topRow = worksheet.addRow([]);
      const headerRow = worksheet.addRow(leafHeaders);
      groupRanges.forEach(range => {
        topRow.getCell(range.start).value = range.title;
        worksheet.mergeCells(6, range.start, 6, range.end);
      });

      // Helper: get subject from student by subjectId (for regular subjects)
      const getSubjectById = (student: any, subjectId: number) =>
        student.subjects?.find((s: any) => s.id === subjectId);

      // Helper: get the group subject from student by subjectGroupId
      // A student has at most one subject per group (mutually exclusive).
      const getGroupSubject = (student: any, subjectGroupId: number) =>
        student.subjects?.find((s: any) => s.subjectGroupId === subjectGroupId);

      // Average: average of NF (finalScore) for subjects with includeInAverage
      // For group subjects, count the one subject the student actually took.
      const averageOf = (student: any) => {
        const eligible = (student.subjects || []).filter((s: any) => s.includeInAverage !== false);
        const scores = eligible
          .map((s: any) => (s.finalScore != null ? Math.max(1, Number(s.finalScore)) : null))
          .filter((v: number | null): v is number => v !== null);
        return scores.length > 0 ? Number((scores.reduce((a: number, b: number) => a + b, 0) / scores.length).toFixed(2)) : 0;
      };

      // Pre-compute positions
      const sortedByAvg = [...data.students].sort((a: any, b: any) => averageOf(b) - averageOf(a));
      const positionMap = new Map<number, number>();
      sortedByAvg.forEach((s: any, idx: number) => {
        positionMap.set(s.inscriptionId, idx + 1);
      });

      // Count failing subjects
      const failedCount = (student: any) => {
        return (student.subjects || []).filter((s: any) => {
          if (s.finalScore == null) return false;
          return Number(s.finalScore) < passingGrade;
        }).length;
      };

      const zebraFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'F7FAFC' } };
      const maxDigits = String(maxGradeValue).length;
      const gradeNumFmt = '0'.repeat(maxDigits);

      data.students.forEach((student: any, studentIndex: number) => {
        const docPrefix = student.documentType === 'Venezolano' ? 'V'
          : student.documentType === 'Extranjero' ? 'E'
          : student.documentType === 'Pasaporte' ? 'P' : 'CE';
        const row: (string | number)[] = [
          studentIndex + 1,
          `${docPrefix}-${student.document || '—'}`,
          `${student.lastName} ${student.firstName}`.trim(),
          positionMap.get(student.inscriptionId) ?? studentIndex + 1,
          Number(averageOf(student).toFixed(2)),
          failedCount(student),
        ];

        columnDefinitions.forEach(colDef => {
          if (colDef.kind === 'regular') {
            const subject = getSubjectById(student, colDef.subjectId);
            if (subject) {
              for (let i = 0; i < termCount; i++) {
                const lapso = subject.lapsos?.find((l: any) => l.termId === terms[i].id);
                row.push(lapso && lapso.score != null ? Math.max(1, Number(lapso.score)) : '-');
              }
              row.push(subject.finalScore != null ? Math.max(1, Number(subject.finalScore)) : '-');
            } else {
              for (let i = 0; i < termCount; i++) row.push('-');
              row.push('-');
            }
          } else if (colDef.kind === 'group') {
            // The student took one of the group's subjects — use that subject's notes
            const subject = getGroupSubject(student, colDef.subjectGroupId);
            if (subject) {
              for (let i = 0; i < termCount; i++) {
                const lapso = subject.lapsos?.find((l: any) => l.termId === terms[i].id);
                row.push(lapso && lapso.score != null ? Math.max(1, Number(lapso.score)) : '-');
              }
              row.push(subject.finalScore != null ? Math.max(1, Number(subject.finalScore)) : '-');
            } else {
              for (let i = 0; i < termCount; i++) row.push('-');
              row.push('-');
            }
          } else {
            // groupNames: show the individual subject name per lapso
            const subject = getGroupSubject(student, colDef.subjectGroupId);
            if (subject) {
              for (let i = 0; i < termCount; i++) {
                // Use the individual subject abbreviation (fallback to name)
                row.push(subject.subjectAbbreviation || subject.subjectName || subject.name || '-');
              }
            } else {
              for (let i = 0; i < termCount; i++) row.push('-');
            }
            // No NF for groupNames
          }
        });

        const dataRow = worksheet.addRow(row);
        const isZebraRow = studentIndex % 2 === 1;

        dataRow.eachCell(cell => {
          cell.font = { size: 10 };
          if (isZebraRow) cell.fill = zebraFill;
          cell.border = {
            top: { style: 'thin', color: { argb: 'D6DEE5' } },
            left: { style: 'thin', color: { argb: 'D6DEE5' } },
            bottom: { style: 'thin', color: { argb: 'D6DEE5' } },
            right: { style: 'thin', color: { argb: 'D6DEE5' } }
          };
        });
        dataRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        dataRow.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
        dataRow.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };
        for (let ci = 4; ci <= leafHeaders.length; ci++) {
          dataRow.getCell(ci).alignment = { horizontal: 'center', vertical: 'middle' };
        }
        dataRow.getCell(5).numFmt = '0.00';

        const repCell = dataRow.getCell(6);
        if (failedCount(student) > 0) {
          repCell.font = { size: 10, color: { argb: 'FF0000' }, bold: true };
        }

        // Apply grade number format to L and NF columns (skip groupNames columns)
        let colIdx = 7;
        columnDefinitions.forEach((colDef, idx) => {
          if (colDef.kind === 'groupNames') {
            // Text columns — no number format, smaller font for names
            for (let i = 0; i < termCount; i++) {
              const cell = dataRow.getCell(colIdx);
              cell.font = { size: 9, ...(isZebraRow ? { color: { argb: '475569' } } : {}) };
              colIdx += 1;
            }
          } else {
            for (let i = 0; i < termCount; i++) {
              dataRow.getCell(colIdx).numFmt = gradeNumFmt;
              colIdx += 1;
            }
            dataRow.getCell(colIdx).numFmt = gradeNumFmt; // NF
            colIdx += 1;
          }
        });
      });

      // Signature row
      const signatureRow = worksheet.addRow([]);
      worksheet.mergeCells(signatureRow.number, 1, signatureRow.number, 6);
      const sigLabelCell = signatureRow.getCell(1);
      sigLabelCell.value = 'Firma de los Docentes:';
      sigLabelCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
      sigLabelCell.font = { bold: true, size: 10, color: { argb: '17324D' } };
      // Merge signature cells: regular subjects get their own cell, but
      // group + groupNames pairs (same subjectGroupId) are merged together.
      let i = 1; // skip "Información del estudiante"
      while (i < groupRanges.length) {
        const range = groupRanges[i];
        const colDef = columnDefinitions[i - 1];
        if (colDef.kind === 'group' && i + 1 < groupRanges.length) {
          // Merge this group range with the next groupNames range
          const nextRange = groupRanges[i + 1];
          worksheet.mergeCells(signatureRow.number, range.start, signatureRow.number, nextRange.end);
          i += 2;
        } else {
          worksheet.mergeCells(signatureRow.number, range.start, signatureRow.number, range.end);
          i += 1;
        }
      }
      signatureRow.height = 54;

      // Header styling
      const headerFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'D9EAF7' } };
      const subHeaderFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'F3F6F9' } };
      const headerBorder = {
        top: { style: 'thin' as const, color: { argb: 'B8C7D3' } },
        left: { style: 'thin' as const, color: { argb: 'B8C7D3' } },
        bottom: { style: 'thin' as const, color: { argb: 'B8C7D3' } },
        right: { style: 'thin' as const, color: { argb: 'B8C7D3' } }
      };
      for (let ci = 1; ci <= leafHeaders.length; ci++) {
        const groupCell = topRow.getCell(ci);
        groupCell.fill = headerFill;
        groupCell.font = { bold: true, size: 10, color: { argb: '17324D' } };
        groupCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        groupCell.border = headerBorder;

        const leafCell = headerRow.getCell(ci);
        leafCell.fill = subHeaderFill;
        leafCell.font = { bold: true, size: 9, color: { argb: '40566B' } };
        leafCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        leafCell.border = headerBorder;
      }
      topRow.height = 24;
      headerRow.height = 32;

      // Thick separator between subject groups (same as council)
      const thickEdge = { style: 'medium' as const, color: { argb: '5A7085' } };
      const lastRow = worksheet.rowCount;
      const sigRowNumber = signatureRow.number;
      groupRanges.forEach(range => {
        const mergedCell = worksheet.getCell(6, range.start);
        mergedCell.border = { ...mergedCell.border, left: thickEdge, right: thickEdge };
        for (let rowNumber = 7; rowNumber <= lastRow; rowNumber++) {
          if (rowNumber === sigRowNumber) continue;
          const startCell = worksheet.getCell(rowNumber, range.start);
          startCell.border = { ...startCell.border, left: thickEdge };
          const endCell = worksheet.getCell(rowNumber, range.end);
          endCell.border = { ...endCell.border, right: thickEdge };
        }
      });

      // Thick outline (top + bottom)
      for (let ci = 1; ci <= lastCol; ci++) {
        const topCell = worksheet.getCell(6, ci);
        topCell.border = { ...topCell.border, top: thickEdge };
        const bottomCell = worksheet.getCell(lastRow, ci);
        bottomCell.border = { ...bottomCell.border, bottom: thickEdge };
      }

      // Signature row borders
      for (let ci = 1; ci <= lastCol; ci++) {
        const sigTopCell = worksheet.getCell(sigRowNumber, ci);
        sigTopCell.border = { ...sigTopCell.border, top: thickEdge };
      }
      const sigLabelMaster = worksheet.getCell(sigRowNumber, 1);
      sigLabelMaster.border = { ...sigLabelMaster.border, left: thickEdge, right: thickEdge };
      // Apply thick lateral borders on merged signature cells (same logic as above)
      let sigIdx = 1;
      while (sigIdx < groupRanges.length) {
        const range = groupRanges[sigIdx];
        const colDef = columnDefinitions[sigIdx - 1];
        let endCol: number;
        if (colDef.kind === 'group' && sigIdx + 1 < groupRanges.length) {
          endCol = groupRanges[sigIdx + 1].end;
          sigIdx += 2;
        } else {
          endCol = range.end;
          sigIdx += 1;
        }
        const sigGroupMaster = worksheet.getCell(sigRowNumber, range.start);
        sigGroupMaster.border = { ...sigGroupMaster.border, left: thickEdge, right: thickEdge };
        // Also set right border on the end cell if it's different from start
        if (endCol !== range.start) {
          const sigGroupEnd = worksheet.getCell(sigRowNumber, endCol);
          sigGroupEnd.border = { ...sigGroupEnd.border, right: thickEdge };
        }
      }

      worksheet.pageSetup.printArea = `A1:${worksheet.getColumn(leafHeaders.length).letter}${worksheet.rowCount}`;

      return true;
    }
  }, []);

  // Builds a single workbook holding one sheet per selected course.
  const handleExportAnnual = useCallback(async () => {
    if (!selectedPeriodId || validCombinations.length === 0) {
      message.warning('Seleccione periodo, grado y sección');
      return;
    }
    setAnnualLoading(true);
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'BatallaProject';
      workbook.created = new Date();

      const skipped: string[] = [];
      let built = 0;
      for (const combo of validCombinations) {
        const ok = await buildAnnualSheet(workbook, selectedPeriodId, combo.gradeId, combo.sectionId);
        if (ok) built++;
        else skipped.push(`${combo.gradeName} ${combo.sectionName}`);
      }

      if (built === 0) {
        message.warning('No hay estudiantes con notas en los cursos seleccionados');
        return;
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const safe = (v: string) => v.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_-]+/g, '_');
      const fileName = validCombinations.length === 1
        ? `resumen_rendimiento_anual_${safe(validCombinations[0].gradeName)}_${safe(validCombinations[0].sectionName)}.xlsx`
        : 'resumen_rendimiento_anual.xlsx';
      saveAs(new Blob([buffer]), fileName);

      message.success(`Resumen del Rendimiento Anual generado (${built} ${built === 1 ? 'hoja' : 'hojas'})`);
      if (skipped.length > 0) {
        message.warning(`Sin estudiantes con notas: ${skipped.join(', ')}`);
      }
    } catch (error: any) {
      console.error('[AnnualReport] Error:', error);
      const errMsg = error?.response?.data?.message || 'Error al generar el resumen del rendimiento anual.';
      message.error(errMsg);
    } finally {
      setAnnualLoading(false);
    }
  }, [selectedPeriodId, validCombinations, buildAnnualSheet]);

  // --- boletin HTML handlers ---
  const generateBoletinHtmlString = useCallback(async (params: { schoolPeriodId: number; gradeId: number; sectionId?: number; inscriptionId?: number }) => {
    const res = await api.get('/performance-summary/boletin-data', { params });
    const data = { ...res.data, letterGrades, logoBase64: boletinLogoBase64, maxGrade } as BoletinHTMLData;
    if (!data.students || data.students.length === 0) {
      return null;
    }
    return generateBoletinHTML(data);
  }, [letterGrades, boletinLogoBase64, maxGrade]);

  const handlePreviewStudentHtml = useCallback(async (inscriptionId: number) => {
    if (!boletinPeriodId || !boletinGradeId) return;
    setBoletinHtmlSelectedInscriptionId(inscriptionId);
    setBoletinHtmlLoading(true);
    setBoletinHtmlString(null);
    try {
      const html = await generateBoletinHtmlString({
        schoolPeriodId: boletinPeriodId,
        gradeId: boletinGradeId,
        sectionId: boletinSectionId || undefined,
        inscriptionId,
      });
      if (html) {
        setBoletinHtmlString(html);
      } else {
        message.warning('No se encontraron notas para este estudiante en el período seleccionado');
      }
    } catch (error: any) {
      console.error('[BoletinHTML] Error al previsualizar:', error);
      const errMsg = error?.response?.data?.message || 'Error al generar la vista previa del boletín HTML.';
      message.error(errMsg);
    } finally { setBoletinHtmlLoading(false); }
  }, [boletinPeriodId, boletinGradeId, boletinSectionId, generateBoletinHtmlString]);

  const handleEmitSectionHtml = useCallback(async () => {
    if (!boletinPeriodId || !boletinGradeId || !boletinSectionId) {
      message.warning('Seleccione período, grado y sección');
      return;
    }
    if (boletinStudents.length === 0) {
      message.warning('No hay estudiantes inscritos en la sección seleccionada');
      return;
    }
    setBoletinHtmlLoading(true);
    setBoletinHtmlString(null);
    setBoletinHtmlSelectedInscriptionId(null);
    try {
      const html = await generateBoletinHtmlString({
        schoolPeriodId: boletinPeriodId,
        gradeId: boletinGradeId,
        sectionId: boletinSectionId,
      });
      if (html) {
        setBoletinHtmlString(html);
        message.success('Boletines HTML generados correctamente');
      } else {
        message.warning('No se encontraron estudiantes con notas en la sección seleccionada');
      }
    } catch (error: any) {
      console.error('[BoletinHTML] Error al emitir sección:', error);
      const errMsg = error?.response?.data?.message || 'Error al generar los boletines HTML de la sección.';
      message.error(errMsg);
    } finally { setBoletinHtmlLoading(false); }
  }, [boletinPeriodId, boletinGradeId, boletinSectionId, boletinStudents.length, generateBoletinHtmlString]);

  const handlePrintBoletinHtml = useCallback(() => {
    const iframe = boletinHtmlIframeRef.current;
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    }
  }, []);

  // --- certified handlers ---
  const certSearch = useCallback(async (query: string) => {
    setCertSearchQuery(query);
    if (query.trim().length < 3) { setCertSearchResults([]); return; }
    try {
      const res = await api.get('/users', { params: { q: query.trim() } });
      setCertSearchResults((res.data || []).map((p: any) => ({
        label: `${p.lastName || ''} ${p.firstName || ''} (C.I. ${p.document || '—'})`,
        value: p.id,
      })));
    } catch { setCertSearchResults([]); }
  }, []);

  const exportCertified = useCallback(async () => {
    if (!certPersonId) { message.warning('Seleccione un estudiante'); return; }
    if (!certTemplate) { message.warning('Seleccione una plantilla'); return; }
    setCertLoading(true);
    try {
      const response = await api.get('/certified-grades/export', {
        params: { personId: certPersonId, template: certTemplate },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const fileName = response.headers['content-disposition']
        ?.split('filename="')[1]?.split('"')[0] || 'notas-certificadas.xlsx';
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      message.success('Notas certificadas exportadas correctamente');
    } catch (error: any) {
      console.error('[Certified] Error:', error);
      if (error.response?.data) {
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const err = JSON.parse(reader.result as string);
            message.error(err.message || 'Error al exportar');
          } catch { message.error('Error al exportar las notas certificadas'); }
        };
        reader.readAsText(error.response.data);
      } else { message.error('Error al exportar las notas certificadas'); }
    } finally { setCertLoading(false); }
  }, [certPersonId, certTemplate]);

  // --- Legend popover contents ---
  const resumenLegendContent = (
    <div style={{ maxWidth: 520, fontSize: 12.5, lineHeight: 1.5 }}>
      <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>Datos de la institución y el período</div>
      <LegendRow name="inst_period" desc="Nombre del período académico activo (ej. 2025-2026)." />
      <LegendRow name="inst_eval_type" desc="Tipo de evaluación: Final (aprobados) o Revisión (reprobados)." />
      <LegendRow name="inst_code" desc="Código DEA de la institución." />
      <LegendRow name="inst_education_code" desc="Código del nivel/modalidad educativa según el MPPE (ej. 31059)." />
      <LegendRow name="inst_level" desc="Tipo/nivel de educación del plantel (ej. EDUCACIÓN MEDIA GENERAL)." />
      <LegendRow name="inst_name" desc="Nombre de la institución." />
      <LegendRow name="inst_address" desc="Dirección de la institución." />
      <LegendRow name="inst_phone" desc="Teléfono de la institución." />
      <LegendRow name="inst_municipality" desc="Municipio de la institución." />
      <LegendRow name="inst_state" desc="Estado de la institución." />
      <LegendRow name="inst_cdcee" desc="Código CDCEE de la institución." />
      <LegendRow name="inst_director" desc="Nombre del director(a)." />
      <LegendRow name="inst_director_doc" desc="Cédula del director(a)." />
      <LegendRow name="inst_grade" desc="Nombre del grado/año cursado (ej. 1er Año, PRIMERO)." />
      <LegendRow name="inst_section" desc="Nombre de la sección (ej. B)." />
      <div style={{ borderTop: '1px solid #e2e8f0', margin: '10px 0' }} />
      <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>Datos por estudiante — <span style={{ fontWeight: 400, color: '#475569' }}>reemplaza <b>n</b> por el número de estudiante (1 a 35)</span></div>
      <LegendRow name="std_num_n" desc="Nº de lista del estudiante (01, 02, …)." />
      <LegendRow name="std_doc_n" desc="Cédula del estudiante con tipo (ej. V-12345)." />
      <LegendRow name="std_ln_n" desc="Apellidos del estudiante." />
      <LegendRow name="std_fn_n" desc="Nombres del estudiante." />
      <LegendRow name="std_bp_n" desc="Lugar de nacimiento (municipio)." />
      <LegendRow name="std_ef_n" desc="Estado de nacimiento (abreviado, 2 letras)." />
      <LegendRow name="std_sx_n" desc="Sexo del estudiante (M/F)." />
      <LegendRow name="std_bd_n" desc="Día de nacimiento (2 dígitos)." />
      <LegendRow name="std_bm_n" desc="Mes de nacimiento (2 dígitos)." />
      <LegendRow name="std_by_n" desc="Año de nacimiento (4 dígitos)." />
      <LegendRow name="std_part_n" desc="Nombre de la materia pendiente (si tiene)." />
      <div style={{ borderTop: '1px solid #e2e8f0', margin: '10px 0' }} />
      <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>Encabezados de materias</div>
      <LegendRow name="subj_i" desc="Abreviatura de la materia i en los encabezados de notas de la fila 15." />
      <LegendRow name="subjname_i" desc="Nombre completo de la materia i en la tabla de materias." />
      <LegendRow name="area_subj_i" desc="Abreviatura de la materia i en la sección 'Profesores por Áreas'." />
      <LegendRow name="area_subjname_i" desc="Nombre completo de la materia i en la sección 'Profesores por Áreas'." />
      <div style={{ borderTop: '1px solid #e2e8f0', margin: '10px 0' }} />
      <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>Notas por estudiante y materia</div>
      <LegendRow name="grade_i_n" desc="Nota final del estudiante n en la materia de la columna i." />
      <div style={{ borderTop: '1px solid #e2e8f0', margin: '10px 0' }} />
      <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>Totales por hoja</div>
      <LegendRow name="std_total" desc="Total de estudiantes en la hoja." />
      <LegendRow name="std_page_count" desc="Número de estudiantes en la página actual." />
      <div style={{ borderTop: '1px solid #e2e8f0', margin: '10px 0' }} />
      <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>Datos del docente por materia</div>
      <LegendRow name="teacher_name_i" desc="Nombre del docente de la materia i." />
      <LegendRow name="teacher_doc_i" desc="Cédula del docente de la materia i." />
      <div style={{ borderTop: '1px solid #e2e8f0', margin: '10px 0' }} />
      <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>Conteos por materia (fila 67-71)</div>
      <LegendRow name="subj_count_i" desc="Total inscritos en la materia i." />
      <LegendRow name="subj_failed_i" desc="Reprobados en la materia i." />
      <LegendRow name="subj_passed_i" desc="Aprobados en la materia i." />
      <LegendRow name="subj_zero_i" desc="Inasistentes (exactamente 0) en la materia i." />
      <LegendRow name="subj_unenrolled_i" desc="No inscritos en la materia i." />
      <div style={{ borderTop: '1px solid #e2e8f0', margin: '10px 0' }} />
      <div style={{ color: '#94a3b8', fontSize: 11.5 }}>Los <b>named ranges</b> deben estar definidos en el .xlsx. El sistema solo rellena los que existan.</div>
    </div>
  );

  const certifiedLegendContent = (
    <div style={{ maxWidth: 520, maxHeight: 420, overflowY: 'auto', fontSize: 12, lineHeight: 1.4 }}>
      <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>Datos del Plantel / Institución</div>
      <LegendRow name="plantel_code" desc="Código DEA de la institución." />
      <LegendRow name="plantel_name" desc="Nombre de la institución." />
      <LegendRow name="education_code" desc="Código del nivel/modalidad educativa según el MPPE (ej. 31059)." />
      <LegendRow name="education_type" desc="Tipo/nivel de educación (ej. EDUCACIÓN MEDIA GENERAL)." />
      <LegendRow name="plantel_address" desc="Dirección de la institución." />
      <LegendRow name="plantel_municipality" desc="Municipio de la institución." />
      <LegendRow name="plantel_phone" desc="Teléfono de la institución." />
      <LegendRow name="plantel_state" desc="Estado de la institución." />
      <LegendRow name="cdcee" desc="Código CDCEE de la institución." />
      <LegendRow name="expedition_place_date" desc="Lugar y fecha de expedición." />
      <div style={{ fontWeight: 700, color: '#0f172a', marginTop: 10, marginBottom: 4 }}>Datos del Estudiante</div>
      <LegendRow name="student_doc" desc="Cédula del estudiante." />
      <LegendRow name="student_birthdate" desc="Fecha de nacimiento en formato texto." />
      <LegendRow name="student_lastname" desc="Apellidos del estudiante." />
      <LegendRow name="student_firstname" desc="Nombres del estudiante." />
      <LegendRow name="student_birth_country" desc="País de nacimiento." />
      <LegendRow name="student_birth_state" desc="Estado de nacimiento del estudiante." />
      <LegendRow name="student_birth_municipality" desc="Municipio de nacimiento del estudiante." />
      <div style={{ fontWeight: 700, color: '#0f172a', marginTop: 10, marginBottom: 4 }}>Datos por Año Aprobado</div>
      <LegendRow name="year_N_name" desc="Nombre del grado del año N." />
      <LegendRow name="year_N_period" desc="Período escolar del año N." />
      <LegendRow name="yN_lapso_K" desc="Nombre del lapso K del año N." />
      <div style={{ fontWeight: 700, color: '#0f172a', marginTop: 10, marginBottom: 4 }}>Notas por Materia</div>
      <LegendRow name="yN_sM_name" desc="Nombre de la materia M del año N." />
      <LegendRow name="yN_sM_lK" desc="Calificación del lapso K." />
      <LegendRow name="yN_sM_num" desc="Definitiva de la materia en número." />
      <LegendRow name="yN_sM_letters" desc="Definitiva de la materia en letras." />
      <LegendRow name="yN_sM_month" desc="Mes de aprobación en letras." />
      <LegendRow name="yN_sM_year" desc="Año de aprobación." />
      <div style={{ marginTop: 10, fontSize: 11, color: '#666', borderTop: '1px solid #e2e8f0', paddingTop: 6 }}>
        <b>N</b> = año aprobado (1,2,3…), <b>M</b> = materia (1,2,3…), <b>K</b> = lapso (1,2,3…). Los named ranges deben estar definidos en el .xlsx.
      </div>
    </div>
  );

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  const current = REPORT_TYPES.find(rt => rt.id === reportType) || REPORT_TYPES[0];
  const showTemplateBtn = reportType === 'resumen';
  const showLegendBtn = reportType === 'resumen' || reportType === 'certified';
  const readyToExport = validCombinations.length > 0;
  const certStudentLabel = certSearchResults.find(r => r.value === certPersonId)?.label || '';

  return (
    <div className="rb-root">
      <style>{STYLES}</style>

      {/* Top bar: switch between report types */}
      <nav className="rb-topbar">
        {REPORT_TYPES.map((rt) => {
          const RtIcon = rt.icon;
          const active = rt.id === reportType;
          return (
            <button
              key={rt.id}
              className={`rb-nav-item${active ? ' active' : ''}`}
              onClick={() => setReportType(rt.id)}
            >
              <RtIcon size={16} />
              <span>{rt.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Main content */}
      <main className="rb-main">
        <div className="rb-header">
          <div>
            <h1 className="rb-title rb-serif">{current.label}</h1>
            <p className="rb-desc">{current.desc}</p>
          </div>
          <div className="rb-utility-btns">
            {showTemplateBtn && (
              <button className="rb-btn-ghost" onClick={() => setTemplateModalOpen(true)}>
                <IconSettings size={14} /> Plantillas
              </button>
            )}
            {showLegendBtn && (
              <Popover
                trigger="click"
                placement="bottom"
                title={reportType === 'resumen' ? 'Nombres de celda (named ranges) que rellena el sistema' : 'Named ranges que rellena el sistema (Notas Certificadas)'}
                content={reportType === 'resumen' ? resumenLegendContent : certifiedLegendContent}
              >
                <button className="rb-btn-ghost"><IconInfo size={14} /> Leyenda</button>
              </Popover>
            )}
          </div>
        </div>

        {/* ── Resumen de Rendimiento ── */}
        {reportType === 'resumen' && (
          <div className="rb-config" style={{ flex: '1 1 100%' }}>
            {structure.length === 0 ? (
              <div className="rb-empty-state">No hay estructura académica configurada para el período activo</div>
            ) : (
              <>
                <section className="rb-card">
                  <h2 className="rb-card-label">1. Alcance del reporte</h2>
                  <div className="rb-scope">
                    <div className="rb-scope-row">
                      <span className="rb-scope-label"><IconCalendar size={13} /> Año escolar</span>
                      <Select
                        className="rb-period-select"
                        value={selectedPeriodId ?? undefined}
                        onChange={(val) => setSelectedPeriodId(val)}
                        options={allPeriods.map(p => ({ label: `${p.name}${p.status === 'activo' ? ' (activo)' : ''}`, value: p.id }))}
                        placeholder="Seleccione…"
                      />
                    </div>

                    <div className="rb-scope-row">
                      <span className="rb-scope-label"><IconGrad size={13} /> Grados</span>
                      <div className="rb-chips">
                        {structure.map(s => {
                          const on = selectedGradeIds.includes(s.grade.id);
                          return (
                            <button
                              key={s.grade.id}
                              type="button"
                              aria-pressed={on}
                              className={`rb-chip${on ? ' active' : ''}`}
                              onClick={() => setSelectedGradeIds(prev =>
                                prev.includes(s.grade.id) ? prev.filter(id => id !== s.grade.id) : [...prev, s.grade.id]
                              )}
                            >
                              {s.grade.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="rb-scope-row">
                      <span className="rb-scope-label"><IconUsers size={13} /> Secciones</span>
                      {selectedGradeIds.length === 0 ? (
                        <span className="rb-field-empty">Elija uno o más grados primero</span>
                      ) : (
                        <div className="rb-chips">
                          {availableSections.map(sec => {
                            const on = selectedSectionIds.includes(sec.id);
                            return (
                              <button
                                key={sec.id}
                                type="button"
                                aria-pressed={on}
                                className={`rb-chip${on ? ' active' : ''}`}
                                onClick={() => setSelectedSectionIds(prev =>
                                  prev.includes(sec.id) ? prev.filter(id => id !== sec.id) : [...prev, sec.id]
                                )}
                              >
                                {sec.name}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {validCombinations.length > 0 && (
                      <div className="rb-scope-summary">
                        <IconCheck size={14} />
                        <span>
                          <strong>{validCombinations.length}</strong>{' '}
                          {validCombinations.length === 1 ? 'planilla' : 'planillas'}:{' '}
                          {validCombinations.map(c => `${c.gradeName} ${c.sectionName}`).join(' · ')}
                        </span>
                      </div>
                    )}
                  </div>
                </section>

                <section className="rb-card">
                  <h2 className="rb-card-label">2. Tipo de Resumen</h2>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <button
                      className="rb-export-btn"
                      style={{ width: 'auto', flex: '1 1 220px', minHeight: 48 }}
                      disabled={!readyToExport || exporting}
                      onClick={handleExport}
                    >
                      {exporting ? <Spin size="small" /> : <IconDownload size={16} />}
                      {exporting ? 'Exportando…' : 'Resumen Final'}
                    </button>
                    <button
                      className="rb-export-btn"
                      style={{ width: 'auto', flex: '1 1 220px', minHeight: 48, background: '#EEF0F3', color: '#A7ADB8' }}
                      disabled
                      title="Próximamente"
                    >
                      <IconDownload size={16} />
                      Resumen de Revisión
                    </button>
                    <button
                      className="rb-export-btn"
                      style={{ width: 'auto', flex: '1 1 260px', minHeight: 48 }}
                      disabled={!readyToExport || annualLoading}
                      onClick={handleExportAnnual}
                    >
                      {annualLoading ? <Spin size="small" /> : <IconBarChart size={16} />}
                      {annualLoading ? 'Generando…' : 'Resumen del Rendimiento Anual'}
                    </button>
                  </div>
                  {!readyToExport && <p className="rb-export-hint">Seleccione al menos un grado y una sección para continuar</p>}
                  {!selectedTemplate && readyToExport && (
                    <div className="rb-warning" style={{ marginTop: 12 }}>
                      <IconAlert size={15} />
                      <div className="rb-warning-text">
                        Sin plantilla asignada para el Resumen Final. El reporte usará el diseño predeterminado.
                        <button className="rb-warning-link" onClick={() => setTemplateModalOpen(true)}>Elegir plantilla</button>
                      </div>
                    </div>
                  )}
                </section>

                <section className="rb-info-card">
                  <h2 className="rb-info-title">Qué incluye cada reporte</h2>
                  <ul className="rb-info-list">
                    <li><IconCheck size={15} /><span><b>Resumen Final</b>: Excel con el promedio final de notas por estudiante, usando plantilla configurada. Columnas: Nro, Apellidos, Nombres, Lugar de Nacimiento, EF, Día, Mes, Año, y materias con encabezados abreviados.</span></li>
                    <li><IconCheck size={15} /><span><b>Resumen del Rendimiento Anual</b>: Planilla tipo consejo de curso con columnas L1, L2, L3 y NF por materia. Muestra las notas finales de cada lapso y la definitiva.</span></li>
                  </ul>
                </section>
              </>
            )}
          </div>
        )}

        {/* ── Boletines HTML ── */}
        {reportType === 'html' && (
          <div className="rb-boletin-layout">
            {/* Selectors card */}
            <section className="rb-card">
              <h2 className="rb-card-label">Configuración del boletín</h2>
              <div className="rb-scope">
                <div className="rb-scope-row">
                  <span className="rb-scope-label"><IconCalendar size={13} /> Año escolar</span>
                  <Select
                    className="rb-period-select"
                    value={boletinPeriodId ?? undefined}
                    onChange={(v: number) => { setBoletinPeriodId(v); setBoletinGradeId(null); setBoletinSectionId(null); setBoletinHtmlString(null); }}
                    options={allPeriods.map(p => ({ label: `${p.name}${p.status === 'activo' ? ' (activo)' : ''}`, value: p.id }))}
                    placeholder="Seleccione…"
                  />
                </div>

                <div className="rb-scope-row">
                  <span className="rb-scope-label"><IconGrad size={13} /> Grado</span>
                  {!boletinPeriodId ? (
                    <span className="rb-field-empty">Elija un año escolar primero</span>
                  ) : (
                    <div className="rb-chips">
                      {structure.map(s => {
                        const on = boletinGradeId === s.grade.id;
                        return (
                          <button
                            key={s.grade.id}
                            type="button"
                            aria-pressed={on}
                            className={`rb-chip${on ? ' active' : ''}`}
                            onClick={() => { setBoletinGradeId(s.grade.id); setBoletinSectionId(null); setBoletinHtmlString(null); }}
                          >
                            {s.grade.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="rb-scope-row">
                  <span className="rb-scope-label"><IconUsers size={13} /> Sección</span>
                  {!boletinGradeId ? (
                    <span className="rb-field-empty">Elija un grado primero</span>
                  ) : (
                    <div className="rb-chips">
                      {boletinAvailableSections.map(sec => {
                        const on = boletinSectionId === sec.id;
                        return (
                          <button
                            key={sec.id}
                            type="button"
                            aria-pressed={on}
                            className={`rb-chip${on ? ' active' : ''}`}
                            onClick={() => { setBoletinSectionId(sec.id); setBoletinHtmlString(null); }}
                          >
                            {sec.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Student list + preview */}
            {!boletinPeriodId ? (
              <Alert message="Seleccione un período escolar" description="Elija el período académico para el cual desea emitir los boletines." type="info" showIcon style={{ borderRadius: 12 }} />
            ) : !boletinGradeId ? (
              <Alert message="Seleccione un grado" description="Elija el grado correspondiente." type="info" showIcon style={{ borderRadius: 12 }} />
            ) : !boletinSectionId ? (
              <Alert message="Seleccione una sección" description="Elija la sección correspondiente." type="info" showIcon style={{ borderRadius: 12 }} />
            ) : boletinStudents.length === 0 ? (
              <Alert message="No hay estudiantes inscritos" description="No se encontraron estudiantes inscritos en la sección seleccionada para este período." type="warning" showIcon style={{ borderRadius: 12 }} />
            ) : (
              <div className="rb-boletin-content">
                {/* Student list */}
                <div className="rb-student-list">
                  <div className="rb-student-list-header">
                    <span style={{ fontWeight: 700, fontSize: 13 }}>Estudiantes ({boletinStudents.length})</span>
                    <Button
                      type="primary"
                      icon={<PrinterOutlined />}
                      size="small"
                      loading={boletinHtmlLoading}
                      onClick={handleEmitSectionHtml}
                      style={{ borderRadius: 8, fontWeight: 600 }}
                    >
                      Emitir sección
                    </Button>
                  </div>
                  <div className="rb-student-list-body">
                    {boletinStudents.map((stu, idx) => {
                      const isSelected = boletinHtmlSelectedInscriptionId === stu.inscriptionId;
                      return (
                        <div
                          key={stu.inscriptionId}
                          className={`rb-student-item${isSelected ? ' selected' : ''}`}
                          onClick={() => handlePreviewStudentHtml(stu.inscriptionId)}
                        >
                          <span className="rb-student-num">{idx + 1}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="rb-student-name">{stu.lastName} {stu.firstName}</div>
                            <div className="rb-student-doc">C.I. {stu.document || '—'}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* HTML preview */}
                <div className="rb-preview-area">
                  {boletinHtmlLoading ? (
                    <div className="rb-empty-preview">
                      <Spin tip="Generando vista previa..." />
                    </div>
                  ) : boletinHtmlString ? (
                    <div>
                      <div style={{ textAlign: 'center', marginBottom: 8 }}>
                        <Button
                          type="primary"
                          icon={<PrinterOutlined />}
                          onClick={handlePrintBoletinHtml}
                          style={{ borderRadius: 10, fontWeight: 700, height: 40 }}
                        >
                          Imprimir / Guardar como PDF
                        </Button>
                      </div>
                      <iframe
                        ref={boletinHtmlIframeRef}
                        srcDoc={boletinHtmlString}
                        style={{ width: '100%', height: '65vh', border: '1px solid #e2e8f0', borderRadius: 12 }}
                        title="Boletín HTML"
                      />
                    </div>
                  ) : (
                    <div className="rb-empty-preview">
                      <div className="rb-empty-preview-inner">
                        <IconFileCode size={48} />
                        <span style={{ color: '#94a3b8', fontSize: 14 }}>
                          Seleccione un estudiante para ver la vista previa del boletín,
                          o use «Emitir sección» para generar todos los boletines de la sección.
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Notas Certificadas ── */}
        {reportType === 'certified' && (
          <div className="rb-columns">
            {/* Config column */}
            <div className="rb-config">
              <section className="rb-card">
                <h2 className="rb-card-label">1. Estudiante</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ position: 'relative' }}>
                    <Input
                      placeholder="Buscar por nombre o cédula..."
                      value={certSearchQuery}
                      onChange={(e) => certSearch(e.target.value)}
                      prefix={<IconSearch size={16} />}
                      style={{ borderRadius: 10, paddingLeft: 36 }}
                    />
                  </div>
                  <Select
                    placeholder="Resultados de búsqueda..."
                    style={{ width: '100%' }}
                    value={certPersonId}
                    onChange={(v: number) => setCertPersonId(v)}
                    options={certSearchResults}
                    showSearch
                    filterOption={false}
                    notFoundContent={certSearchQuery.length < 3 ? 'Escriba al menos 3 caracteres' : 'Sin resultados'}
                  />
                </div>
              </section>

              <section className="rb-card">
                <h2 className="rb-card-label">2. Plantilla de Excel</h2>
                <Select
                  placeholder="Seleccione una plantilla"
                  style={{ width: '100%' }}
                  value={certTemplate}
                  onChange={(v: string) => setCertTemplate(v)}
                  options={certTemplateList.map(t => ({ label: t, value: t }))}
                  notFoundContent="Suba una plantilla a /templates"
                />
              </section>

              <section className="rb-info-card">
                <h2 className="rb-info-title">Qué incluye este reporte</h2>
                <ul className="rb-info-list">
                  <li><IconCheck size={15} /><span>Seleccione un estudiante y una plantilla de Excel. El sistema rellenará los nombres de celda (named ranges) con los datos del estudiante y todas sus notas de todos los períodos cursados.</span></li>
                </ul>
              </section>
            </div>

            {/* Preview column */}
            <div className="rb-preview-col">
              <div className="rb-preview-card">
                <div className="rb-preview-head">
                  <div className="rb-preview-head-title">Vista previa del reporte</div>
                  <div className="rb-preview-head-sub">Confirme antes de exportar</div>
                </div>

                <div className="rb-preview-body">
                  <PreviewRow label="Estudiante" value={certStudentLabel || '—'} muted={!certStudentLabel} />
                  <PreviewRow label="Plantilla" value={certTemplate || '—'} muted={!certTemplate} />
                </div>

                <div className="rb-perforation">
                  <div className="rb-notch rb-notch-left" />
                  <div className="rb-notch rb-notch-right" />
                </div>
                <div className="rb-dashed-divider" />

                <div className="rb-preview-footer">
                  <button
                    className="rb-export-btn"
                    disabled={!certPersonId || !certTemplate || certLoading}
                    onClick={exportCertified}
                  >
                    {certLoading ? <Spin size="small" /> : <IconDownload size={16} />}
                    {certLoading ? 'Generando…' : 'Exportar Notas Certificadas'}
                  </button>
                  {(!certPersonId || !certTemplate) && <p className="rb-export-hint">Seleccione estudiante y plantilla para continuar</p>}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <TemplateManagerModal
        open={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        selectedTemplate={selectedTemplate}
        defaultGradeId={selectedGradeIds[0] ?? null}
        defaultSectionId={selectedSectionIds[0] ?? null}
        onSelect={(name) => { setSelectedTemplate(name || null); setUserOverrodeTemplate(true); }}
      />
    </div>
  );
};

export default PerformanceSummary;
