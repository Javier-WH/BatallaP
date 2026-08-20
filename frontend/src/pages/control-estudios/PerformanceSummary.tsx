import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, Select, Space, Typography, Row, Col, Spin, message, Empty, Tag, Popover, Divider, Radio, Tabs, Input, Alert } from 'antd';
import { DownloadOutlined, FileExcelOutlined, FileTextOutlined, FolderOpenOutlined, CheckCircleOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { pdf } from '@react-pdf/renderer';
import api from '@/services/api';
import TemplateManagerModal from '@/components/TemplateManagerModal';
import BoletinPDF from '@/components/pdf/BoletinPDF';
import type { BoletinData, LetterGrade } from '@/components/pdf/BoletinPDF';

const { Title, Text } = Typography;

const LegendRow: React.FC<{ name: string; desc: string }> = ({ name, desc }) => (
  <div style={{ display: 'flex', gap: 10, padding: '3px 0', borderBottom: '1px dashed #e2e8f0' }}>
    <code style={{ color: '#15803d', fontWeight: 700, whiteSpace: 'nowrap', minWidth: 110, fontSize: 12 }}>{name}</code>
    <span style={{ color: '#475569', fontSize: 12.5, flex: 1 }}>{desc}</span>
  </div>
);

interface Grade { id: number; name: string; isDiversified: boolean; order: number; }
interface Section { id: number; name: string; }
interface PeriodGradeStructure { id: number; grade: Grade; sections: Section[]; }
interface SchoolPeriod { id: number; period: string; name: string; status: 'preinscripcion' | 'activo' | 'historico' | 'externo'; isActive: boolean; }

const PerformanceSummary: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [structure, setStructure] = useState<PeriodGradeStructure[]>([]);
  const [allPeriods, setAllPeriods] = useState<SchoolPeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | null>(null);
  const [selectedGradeId, setSelectedGradeId] = useState<number | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<number | null>(null);
  const [studentGroup, setStudentGroup] = useState<'regulares' | 'revision'>('regulares');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [userOverrodeTemplate, setUserOverrodeTemplate] = useState(false);

  // boletin tab state
  const [boletinPeriodId, setBoletinPeriodId] = useState<number | null>(null);
  const [boletinGradeId, setBoletinGradeId] = useState<number | null>(null);
  const [boletinSectionId, setBoletinSectionId] = useState<number | null>(null);
  const [boletinStudents, setBoletinStudents] = useState<{ inscriptionId: number; firstName: string; lastName: string; document: string }[]>([]);
  const [boletinSelectedInscriptionId, setBoletinSelectedInscriptionId] = useState<number | null>(null);
  const [boletinLoading, setBoletinLoading] = useState(false);
  const [boletinBatchLoading, setBoletinBatchLoading] = useState(false);
  const [boletinPdfUrl, setBoletinPdfUrl] = useState<string | null>(null);
  const [boletinData, setBoletinData] = useState<BoletinData | null>(null);
  const [letterGrades, setLetterGrades] = useState<LetterGrade[]>([]);

  // certified tab state
  const [certPersonId, setCertPersonId] = useState<number | null>(null);
  const [certTemplate, setCertTemplate] = useState<string | null>(null);
  const [certTemplateList, setCertTemplateList] = useState<string[]>([]);
  const [certSearchQuery, setCertSearchQuery] = useState('');
  const [certSearchResults, setCertSearchResults] = useState<{ label: string; value: number }[]>([]);
  const [certLoading, setCertLoading] = useState(false);

  const boletinSelectedGrade = structure.find(s => s.grade.id === boletinGradeId);
  const boletinAvailableSections = boletinSelectedGrade?.sections || [];

  const cleanupBoletinPdf = useCallback(() => {
    setBoletinPdfUrl(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setBoletinData(null);
  }, []);

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

  useEffect(() => {
    if (!selectedGradeId) { setSelectedTemplate(null); return; }
    const params = selectedSectionId ? `?sectionId=${selectedSectionId}` : '';
    api.get(`/templates/assignment/${selectedGradeId}${params}`)
      .then((res) => { setSelectedTemplate(res.data?.templateName || null); })
      .catch(() => setSelectedTemplate(null));
  }, [selectedGradeId, selectedSectionId]);

  useEffect(() => {
    setUserOverrodeTemplate(false);
    setSelectedGradeId(null);
    setSelectedSectionId(null);
  }, [selectedPeriodId]);

  useEffect(() => { setUserOverrodeTemplate(false); }, [selectedGradeId, selectedSectionId]);

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
    }).catch(() => { /* ignore */ });
  }, []);

  // Load students for boletin tab when section is selected
  useEffect(() => {
    if (!boletinPeriodId || !boletinGradeId || !boletinSectionId) {
      setBoletinStudents([]);
      setBoletinSelectedInscriptionId(null);
      cleanupBoletinPdf();
      return;
    }
    let cancelled = false;
    cleanupBoletinPdf();
    setBoletinSelectedInscriptionId(null);
    api.get('/inscriptions', {
      params: { schoolPeriodId: boletinPeriodId, gradeId: boletinGradeId, sectionId: boletinSectionId },
    }).then((res) => {
      if (cancelled) return;
      const list = (res.data || []).map((ins: any) => ({
        inscriptionId: ins.id,
        firstName: ins.student?.firstName || '',
        lastName: ins.student?.lastName || '',
        document: ins.student?.document || '',
      })).sort((a: any, b: any) => {
        const docA = (a.document || '').replace(/\D/g, '');
        const docB = (b.document || '').replace(/\D/g, '');
        const numA = docA ? parseInt(docA, 10) : Infinity;
        const numB = docB ? parseInt(docB, 10) : Infinity;
        return numA - numB;
      });
      setBoletinStudents(list);
    }).catch(() => { if (!cancelled) setBoletinStudents([]); });
    return () => { cancelled = true; };
  }, [boletinPeriodId, boletinGradeId, boletinSectionId, cleanupBoletinPdf]);

  // Cleanup PDF URL on unmount
  useEffect(() => {
    return () => {
      setBoletinPdfUrl(prev => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, []);

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
    if (!selectedPeriodId || !selectedGradeId || !selectedSectionId) {
      message.warning('Seleccione periodo, grado y sección');
      return;
    }
    if (!selectedTemplate) {
      setTemplateModalOpen(true);
      return;
    }
    setExporting(true);
    try {
      const response = await api.get('/performance-summary/export', {
        params: {
          schoolPeriodId: selectedPeriodId,
          gradeId: selectedGradeId,
          sectionId: selectedSectionId,
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
      message.success('Resumen exportado correctamente');
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

  const selectedGrade = structure.find(s => s.grade.id === selectedGradeId);
  const availableSections = selectedGrade?.sections || [];

  // --- boletin handlers ---
  const generateBoletinPdf = useCallback(async (params: { schoolPeriodId: number; gradeId: number; sectionId?: number; inscriptionId?: number }) => {
    const res = await api.get('/performance-summary/boletin-data', { params });
    const data = { ...res.data, letterGrades } as BoletinData;
    if (!data.students || data.students.length === 0) {
      return null;
    }
    const doc = <BoletinPDF data={data} />;
    const blob = await pdf(doc).toBlob();
    return { url: URL.createObjectURL(blob), data };
  }, [letterGrades]);

  const handlePreviewStudent = useCallback(async (inscriptionId: number) => {
    if (!boletinPeriodId || !boletinGradeId) return;
    setBoletinSelectedInscriptionId(inscriptionId);
    setBoletinLoading(true);
    cleanupBoletinPdf();
    try {
      const result = await generateBoletinPdf({
        schoolPeriodId: boletinPeriodId,
        gradeId: boletinGradeId,
        sectionId: boletinSectionId || undefined,
        inscriptionId,
      });
      if (result) {
        setBoletinPdfUrl(result.url);
        setBoletinData(result.data);
      } else {
        message.warning('No se encontraron notas para este estudiante en el período seleccionado');
      }
    } catch (error: any) {
      console.error('[Boletin] Error al previsualizar:', error);
      const errMsg = error?.response?.data?.message || 'Error al generar la vista previa del boletín. Verifique que el estudiante tenga notas registradas.';
      message.error(errMsg);
    } finally { setBoletinLoading(false); }
  }, [boletinPeriodId, boletinGradeId, boletinSectionId, generateBoletinPdf, cleanupBoletinPdf]);

  const handleEmitSection = useCallback(async () => {
    if (!boletinPeriodId || !boletinGradeId || !boletinSectionId) {
      message.warning('Seleccione período, grado y sección');
      return;
    }
    if (boletinStudents.length === 0) {
      message.warning('No hay estudiantes inscritos en la sección seleccionada');
      return;
    }
    setBoletinBatchLoading(true);
    cleanupBoletinPdf();
    setBoletinSelectedInscriptionId(null);
    try {
      const result = await generateBoletinPdf({
        schoolPeriodId: boletinPeriodId,
        gradeId: boletinGradeId,
        sectionId: boletinSectionId,
      });
      if (result) {
        setBoletinPdfUrl(result.url);
        setBoletinData(result.data);
        message.success(`Se generaron ${result.data.students.length} boletín(es) correctamente`);
      } else {
        message.warning('No se encontraron estudiantes con notas en la sección seleccionada');
      }
    } catch (error: any) {
      console.error('[Boletin] Error al emitir sección:', error);
      const errMsg = error?.response?.data?.message || 'Error al generar los boletines de la sección. Intente nuevamente.';
      message.error(errMsg);
    } finally { setBoletinBatchLoading(false); }
  }, [boletinPeriodId, boletinGradeId, boletinSectionId, boletinStudents.length, generateBoletinPdf, cleanupBoletinPdf]);

  const handleDownloadBoletin = useCallback(() => {
    if (boletinPdfUrl) {
      const a = document.createElement('a');
      a.href = boletinPdfUrl;
      const studentLabel = boletinSelectedInscriptionId
        ? `estudiante-${boletinSelectedInscriptionId}`
        : `seccion-${boletinSectionId}`;
      a.download = `boletin-${studentLabel}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  }, [boletinPdfUrl, boletinSelectedInscriptionId, boletinSectionId]);

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

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <Card className="animate-card" style={{ borderRadius: 20 }}>
        <Tabs
          defaultActiveKey="summary"
          size="large"
          style={{ minHeight: '55vh' }}
          items={[
            {
              key: 'summary',
              label: (
                <span>
                  <FileExcelOutlined style={{ marginRight: 6 }} />
                  Resumen de Rendimiento Estudiantil
                </span>
              ),
              children: (
                <>
                  <div style={{ marginBottom: 24, textAlign: 'center' }}>
                    <Text type="secondary" style={{ fontSize: 16, fontWeight: 500 }}>
                      Genere un archivo Excel con el resumen final de notas de los estudiantes
                    </Text>
                  </div>

                  {structure.length === 0 ? (
                    <Empty description="No hay estructura académica configurada para el período activo" />
                  ) : (
                    <>
                      <Row gutter={[24, 24]} justify="center" align="middle">
                        <Col xs={24} sm={10} md={7}>
                          <Text style={{ fontWeight: 700, display: 'block', marginBottom: 8 }}>Periodo Académico</Text>
                          <Select placeholder="Seleccione un periodo" style={{ width: '100%' }} size="large"
                            value={selectedPeriodId}
                            onChange={(val) => setSelectedPeriodId(val)}
                            options={allPeriods.map(p => ({ label: `${p.name}${p.status === 'activo' ? ' (activo)' : ''}`, value: p.id }))} />
                        </Col>
                        <Col xs={24} sm={10} md={7}>
                          <Text style={{ fontWeight: 700, display: 'block', marginBottom: 8 }}>Grado</Text>
                          <Select placeholder="Seleccione un grado" style={{ width: '100%' }} size="large"
                            value={selectedGradeId}
                            onChange={(val) => { setSelectedGradeId(val); setSelectedSectionId(null); }}
                            options={structure.map(s => ({ label: s.grade.name, value: s.grade.id }))} />
                        </Col>
                        <Col xs={24} sm={10} md={7}>
                          <Text style={{ fontWeight: 700, display: 'block', marginBottom: 8 }}>Sección</Text>
                          <Select placeholder="Seleccione una sección" style={{ width: '100%' }} size="large"
                            value={selectedSectionId} disabled={!selectedGradeId}
                            onChange={(val) => setSelectedSectionId(val)}
                            options={availableSections.map(s => ({ label: s.name, value: s.id }))} />
                        </Col>
                      </Row>
                      <Row gutter={[24, 24]} justify="center" align="middle" style={{ marginTop: 16 }}>
                        <Col xs={24} style={{ textAlign: 'center' }}>
                          <Text style={{ fontWeight: 700, display: 'block', marginBottom: 8 }}>Grupo de estudiantes</Text>
                          <Radio.Group value={studentGroup} onChange={(e) => setStudentGroup(e.target.value)} size="large" buttonStyle="solid">
                            <Radio.Button value="regulares" style={{ borderRadius: '8px 0 0 8px', fontWeight: 600, padding: '4px 24px' }}>Final (Aprobados)</Radio.Button>
                            <Radio.Button value="revision" style={{ borderRadius: '0 8px 8px 0', fontWeight: 600, padding: '4px 24px' }}>Revisión (Reprobados)</Radio.Button>
                          </Radio.Group>
                        </Col>
                      </Row>
                      <Row gutter={[24, 24]} justify="center" align="middle" style={{ marginTop: 16 }}>
                        <Col xs={24} sm={8} md={4} style={{ display: 'flex', alignItems: 'flex-end' }}>
                          <Button type="primary" size="large" icon={<DownloadOutlined />}
                            onClick={handleExport} loading={exporting} disabled={!selectedGradeId || !selectedSectionId || !selectedTemplate}
                            style={{ width: '100%', height: 40, borderRadius: 10, fontWeight: 700, background: '#059669', border: 'none' }}>
                            Exportar
                          </Button>
                        </Col>
                      </Row>
                    </>
                  )}

                  <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    <Button icon={<FolderOpenOutlined />} onClick={() => setTemplateModalOpen(true)} style={{ borderRadius: 10, fontWeight: 600 }}>
                      Gestionar plantillas
                    </Button>
                    <Popover trigger="click" placement="bottom" title="Nombres de celda (named ranges) que rellena el sistema"
                      content={
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
                          <Divider style={{ margin: '10px 0' }} />
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
                          <Divider style={{ margin: '10px 0' }} />
                          <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>Encabezados de materias</div>
                          <LegendRow name="subj_i" desc="Abreviatura de la materia i. El sistema la escribe automáticamente." />
                          <LegendRow name="subjname_i" desc="Nombre completo de la materia i." />
                          <Divider style={{ margin: '10px 0' }} />
                          <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>Notas por estudiante y materia</div>
                          <LegendRow name="grade_i_n" desc="Nota final del estudiante n en la materia de la columna i." />
                          <Divider style={{ margin: '10px 0' }} />
                          <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>Totales por hoja</div>
                          <LegendRow name="std_total" desc="Total de estudiantes en la hoja." />
                          <LegendRow name="std_page_count" desc="Número de estudiantes en la página actual." />
                          <Divider style={{ margin: '10px 0' }} />
                          <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>Datos del docente por materia</div>
                          <LegendRow name="teacher_name_i" desc="Nombre del docente de la materia i." />
                          <LegendRow name="teacher_doc_i" desc="Cédula del docente de la materia i." />
                          <Divider style={{ margin: '10px 0' }} />
                          <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>Conteos por materia (fila 67-71)</div>
                          <LegendRow name="subj_count_i" desc="Total inscritos en la materia i." />
                          <LegendRow name="subj_failed_i" desc="Reprobados en la materia i." />
                          <LegendRow name="subj_passed_i" desc="Aprobados en la materia i." />
                          <LegendRow name="subj_zero_i" desc="Inasistentes (exactamente 0) en la materia i." />
                          <LegendRow name="subj_unenrolled_i" desc="No inscritos en la materia i." />
                          <Divider style={{ margin: '10px 0' }} />
                          <div style={{ color: '#94a3b8', fontSize: 11.5 }}>Los <b>named ranges</b> deben estar definidos en el .xlsx. El sistema solo rellena los que existan.</div>
                        </div>
                      }>
                      <Button icon={<InfoCircleOutlined />} style={{ borderRadius: 10, fontWeight: 600 }}>Leyenda de celdas</Button>
                    </Popover>
                    {selectedTemplate ? (
                      <Tag icon={<CheckCircleOutlined />} color="success" style={{ display: 'inline-flex', alignItems: 'center', alignSelf: 'center' }}>
                        Plantilla: {selectedTemplate}{!userOverrodeTemplate ? ' (asignada al período)' : ''}
                      </Tag>
                    ) : (
                      <Text type="secondary" style={{ alignSelf: 'center', fontSize: 13 }}>Sin plantilla asignada.</Text>
                    )}
                  </div>

                  {structure.length > 0 && (
                    <div style={{ marginTop: 32, padding: '20px 24px', background: '#f0fdf4', borderRadius: 12, border: '1px solid #bbf7d0' }}>
                      <Space direction="vertical" size="small">
                        <Text style={{ fontWeight: 700, color: '#166534' }}>Información del reporte:</Text>
                        <Text style={{ color: '#15803d', fontSize: 13 }}>• Columnas: Nro, Apellidos, Nombres, Lugar de Nacimiento, EF (Educación Física), Día, Mes, Año, y materias con encabezados abreviados.</Text>
                        <Text style={{ color: '#15803d', fontSize: 13 }}>• Las notas mostradas corresponden al promedio final del período (notas + puntos de consejo).</Text>
                        <Text style={{ color: '#15803d', fontSize: 13 }}>• Configure las abreviaturas de las materias en Gestión Académica para encabezados más compactos.</Text>
                      </Space>
                    </div>
                  )}
                </>
              ),
            },
            {
              key: 'boletin',
              label: (
                <span>
                  <FileTextOutlined style={{ marginRight: 6 }} />
                  Boletines (PDF)
                </span>
              ),
              children: (
                <>
                  {/* Selectores */}
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontWeight: 700, marginBottom: 6, fontSize: 13 }}>Período</label>
                    <Select placeholder="Período" style={{ width: '100%', maxWidth: 400 }} value={boletinPeriodId}
                      onChange={(v: number) => { setBoletinPeriodId(v); setBoletinGradeId(null); setBoletinSectionId(null); }}
                      options={allPeriods.map(p => ({ label: `${p.name}${p.status === 'activo' ? ' (activo)' : ''}`, value: p.id }))} />
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontWeight: 700, marginBottom: 6, fontSize: 13 }}>Grado</label>
                    {structure.length === 0 ? (
                      <Text type="secondary" style={{ fontSize: 13 }}>
                        {boletinPeriodId ? 'No hay grados configurados para este período' : 'Primero seleccione un período'}
                      </Text>
                    ) : (
                      <Space wrap>
                        {structure.map(s => (
                          <Button
                            key={s.grade.id}
                            type={boletinGradeId === s.grade.id ? 'primary' : 'default'}
                            onClick={() => { setBoletinGradeId(s.grade.id); setBoletinSectionId(null); }}
                            style={{ borderRadius: 8, fontWeight: 600 }}
                          >
                            {s.grade.name}
                          </Button>
                        ))}
                      </Space>
                    )}
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontWeight: 700, marginBottom: 6, fontSize: 13 }}>Sección</label>
                    {!boletinGradeId ? (
                      <Text type="secondary" style={{ fontSize: 13 }}>Seleccione un grado primero</Text>
                    ) : boletinAvailableSections.length === 0 ? (
                      <Text type="secondary" style={{ fontSize: 13 }}>No hay secciones configuradas para este grado</Text>
                    ) : (
                      <Space wrap>
                        {boletinAvailableSections.map(sec => (
                          <Button
                            key={sec.id}
                            type={boletinSectionId === sec.id ? 'primary' : 'default'}
                            onClick={() => setBoletinSectionId(sec.id)}
                            style={{ borderRadius: 8, fontWeight: 600 }}
                          >
                            {sec.name}
                          </Button>
                        ))}
                      </Space>
                    )}
                  </div>

                  {!boletinPeriodId ? (
                    <Alert
                      message="Seleccione un período escolar"
                      description="Elija el período académico para el cual desea emitir los boletines."
                      type="info"
                      showIcon
                      style={{ borderRadius: 8 }}
                    />
                  ) : !boletinGradeId ? (
                    <Alert
                      message="Seleccione un grado"
                      description="Elija el grado correspondiente haciendo clic en uno de los botones de arriba."
                      type="info"
                      showIcon
                      style={{ borderRadius: 8 }}
                    />
                  ) : !boletinSectionId ? (
                    <Alert
                      message="Seleccione una sección"
                      description="Elija la sección correspondiente haciendo clic en uno de los botones de arriba."
                      type="info"
                      showIcon
                      style={{ borderRadius: 8 }}
                    />
                  ) : boletinStudents.length === 0 ? (
                    <Alert
                      message="No hay estudiantes inscritos"
                      description="No se encontraron estudiantes inscritos en la sección seleccionada para este período. Verifique que los estudiantes hayan sido matriculados e inscritos correctamente."
                      type="warning"
                      showIcon
                      style={{ borderRadius: 8 }}
                    />
                  ) : (
                    <Row gutter={[16, 16]}>
                      {/* Lista de estudiantes */}
                      <Col xs={24} md={8} lg={7}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <Text strong>Estudiantes ({boletinStudents.length})</Text>
                          <Button
                            type="primary"
                            icon={<DownloadOutlined />}
                            size="small"
                            loading={boletinBatchLoading}
                            onClick={handleEmitSection}
                            style={{ borderRadius: 8, fontWeight: 600 }}
                          >
                            Emitir sección
                          </Button>
                        </div>
                        <div style={{ maxHeight: '65vh', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                          {boletinStudents.map((stu, idx) => {
                            const isSelected = boletinSelectedInscriptionId === stu.inscriptionId;
                            return (
                              <div
                                key={stu.inscriptionId}
                                onClick={() => handlePreviewStudent(stu.inscriptionId)}
                                style={{
                                  padding: '10px 14px',
                                  cursor: 'pointer',
                                  borderBottom: '1px solid #f1f5f9',
                                  background: isSelected ? '#e0f2fe' : 'transparent',
                                  transition: 'background 0.15s',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 10,
                                }}
                                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = '#f8fafc'; }}
                                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                              >
                                <span style={{
                                  flexShrink: 0,
                                  width: 24,
                                  height: 24,
                                  borderRadius: 6,
                                  background: isSelected ? '#0284c7' : '#e2e8f0',
                                  color: isSelected ? '#fff' : '#64748b',
                                  fontSize: 11,
                                  fontWeight: 700,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}>
                                  {idx + 1}
                                </span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontWeight: 600, fontSize: 13 }}>
                                    {stu.lastName} {stu.firstName}
                                  </div>
                                  <div style={{ fontSize: 11, color: '#64748b' }}>
                                    C.I. {stu.document || '—'}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </Col>

                      {/* Vista previa PDF */}
                      <Col xs={24} md={16} lg={17}>
                        {boletinLoading ? (
                          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
                            <Spin tip="Generando vista previa..." />
                          </div>
                        ) : boletinPdfUrl ? (
                          <div>
                            {boletinData && (
                              <div style={{ textAlign: 'center', marginBottom: 8, fontSize: 12, color: '#666' }}>
                                {boletinData.students.length} estudiante(s) — {boletinData.institution.name} — {boletinData.grade.name}
                              </div>
                            )}
                            <iframe
                              src={boletinPdfUrl}
                              style={{ width: '100%', height: '65vh', border: '1px solid #e2e8f0', borderRadius: 8 }}
                              title="Boletín de Calificaciones"
                            />
                            <div style={{ textAlign: 'center', marginTop: 12 }}>
                              <Button
                                type="primary"
                                icon={<DownloadOutlined />}
                                onClick={handleDownloadBoletin}
                                style={{ borderRadius: 10, fontWeight: 700, height: 40 }}
                              >
                                Descargar PDF
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: '#94a3b8' }}>
                            <div style={{ textAlign: 'center' }}>
                              <FileTextOutlined style={{ fontSize: 48, marginBottom: 12, display: 'block' }} />
                              <Text type="secondary">
                                Seleccione un estudiante para ver la vista previa del boletín,
                                o use «Emitir sección» para generar todos los boletines de la sección.
                              </Text>
                            </div>
                          </div>
                        )}
                      </Col>
                    </Row>
                  )}
                </>
              ),
            },
            {
              key: 'certified',
              label: (
                <span>
                  <FileExcelOutlined style={{ marginRight: 6 }} />
                  Notas Certificadas (Excel)
                </span>
              ),
              children: (
                <div style={{ maxWidth: 600, margin: '0 auto' }}>
                  <Alert message="Notas Certificadas"
                    description="Seleccione un estudiante y una plantilla de Excel. El sistema rellenará los nombres de celda (named ranges) con los datos del estudiante y todas sus notas de todos los períodos cursados."
                    type="info" style={{ marginBottom: 20, borderRadius: 8 }} />

                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontWeight: 700, marginBottom: 6, fontSize: 13 }}>Buscar Estudiante</label>
                    <Input.Search placeholder="Buscar por nombre o cédula..." value={certSearchQuery}
                      onChange={(e) => certSearch(e.target.value)} enterButton style={{ marginBottom: 8 }} />
                    <Select placeholder="Resultados de búsqueda..." style={{ width: '100%' }} value={certPersonId}
                      onChange={(v: number) => setCertPersonId(v)} options={certSearchResults}
                      showSearch filterOption={false}
                      notFoundContent={certSearchQuery.length < 3 ? 'Escriba al menos 3 caracteres' : 'Sin resultados'} />
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontWeight: 700, marginBottom: 6, fontSize: 13 }}>Plantilla de Excel</label>
                    <Select placeholder="Seleccione una plantilla" style={{ width: '100%' }} value={certTemplate}
                      onChange={(v: string) => setCertTemplate(v)}
                      options={certTemplateList.map(t => ({ label: t, value: t }))}
                      notFoundContent="Suba una plantilla a /templates" />
                  </div>

                  <div style={{ textAlign: 'center', marginTop: 28 }}>
                    {certLoading ? (
                      <Spin tip="Generando..." />
                    ) : (
                      <Button type="primary" size="large" icon={<FileExcelOutlined />}
                        onClick={exportCertified} disabled={!certPersonId || !certTemplate}
                        style={{ borderRadius: 10, fontWeight: 700, height: 44, background: '#059669', border: 'none' }}>
                        Exportar Notas Certificadas
                      </Button>
                    )}
                  </div>

                  <div style={{ marginTop: 20, textAlign: 'center' }}>
                    <Popover trigger="click" placement="top" title="Named ranges que rellena el sistema (Notas Certificadas)"
                      content={
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
                      }>
                      <Button type="link" icon={<InfoCircleOutlined />} style={{ fontSize: 12 }}>Ver named ranges disponibles</Button>
                    </Popover>
                  </div>
                </div>
              ),
            },
          ]}
        />
      </Card>

      <TemplateManagerModal open={templateModalOpen} onClose={() => setTemplateModalOpen(false)}
        selectedTemplate={selectedTemplate} defaultGradeId={selectedGradeId} defaultSectionId={selectedSectionId}
        onSelect={(name) => { setSelectedTemplate(name || null); setUserOverrodeTemplate(true); }} />
    </div>
  );
};

export default PerformanceSummary;
