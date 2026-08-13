import React, { useState, useCallback, useEffect } from 'react';
import { Modal, Spin, Button, Radio, Select, message, Space, Tabs, Input, Alert, Popover } from 'antd';
import { DownloadOutlined, FileExcelOutlined, FileTextOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { pdf } from '@react-pdf/renderer';
import BoletinPDF from './BoletinPDF';
import type { BoletinData, LetterGrade } from './BoletinPDF';
import api from '@/services/api';

const LegendRow: React.FC<{ name: string; desc: string }> = ({ name, desc }) => (
  <div style={{ display: 'flex', gap: 8, padding: '2px 0', borderBottom: '1px dashed #e2e8f0' }}>
    <code style={{ color: '#15803d', fontWeight: 700, whiteSpace: 'nowrap', minWidth: 140, fontSize: 11 }}>{name}</code>
    <span style={{ color: '#475569', fontSize: 11.5, flex: 1 }}>{desc}</span>
  </div>
);

interface Section { id: number; name: string; }
interface PeriodGradeStructure { id: number; grade: { id: number; name: string; order: number }; sections: Section[]; }
interface SchoolPeriod { id: number; name: string; period: string; status: 'preinscripcion' | 'activo' | 'historico' | 'externo'; isActive: boolean; }

interface BoletinModalProps {
  open: boolean;
  onClose: () => void;
  allPeriods: SchoolPeriod[];
  structure: PeriodGradeStructure[];
  selectedPeriodId: number | null;
  selectedGradeId: number | null;
  selectedSectionId: number | null;
}

type Scope = 'all' | 'section' | 'single';
type ModalTab = 'boletin' | 'certified';

const BoletinModal: React.FC<BoletinModalProps> = ({
  open,
  onClose,
  allPeriods,
  structure,
  selectedPeriodId: initialPeriodId,
  selectedGradeId: initialGradeId,
  selectedSectionId: initialSectionId,
}) => {
  const [activeTab, setActiveTab] = useState<ModalTab>('boletin');
  const [scope, setScope] = useState<Scope>('section');
  const [periodId, setPeriodId] = useState<number | null>(initialPeriodId);
  const [gradeId, setGradeId] = useState<number | null>(initialGradeId);
  const [sectionId, setSectionId] = useState<number | null>(initialSectionId);
  const [inscriptionId, setInscriptionId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [data, setData] = useState<BoletinData | null>(null);
  const [studentOptions, setStudentOptions] = useState<{ label: string; value: number }[]>([]);

  // For certified grades tab
  const [certifiedPersonId, setCertifiedPersonId] = useState<number | null>(null);
  const [certifiedTemplate, setCertifiedTemplate] = useState<string | null>(null);
  const [templateList, setTemplateList] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ label: string; value: number }[]>([]);
  const [letterGrades, setLetterGrades] = useState<LetterGrade[]>([]);

  const selectedGrade = structure.find((s) => s.grade.id === gradeId);
  const availableSections = selectedGrade?.sections || [];

  useEffect(() => {
    api.get('/settings').then((res) => {
      if (res.data?.letter_grades) {
        try {
          const parsed = typeof res.data.letter_grades === 'string'
            ? JSON.parse(res.data.letter_grades)
            : res.data.letter_grades;
          if (parsed.scale && Array.isArray(parsed.scale)) {
            setLetterGrades(parsed.scale);
          } else if (Array.isArray(parsed)) {
            setLetterGrades(parsed);
          }
        } catch { /* ignore */ }
      }
    }).catch(() => { /* ignore */ });
  }, []);

  useEffect(() => {
    if (scope !== 'single' || !periodId || !gradeId) {
      setStudentOptions([]);
      setInscriptionId(null);
      return;
    }
    let cancelled = false;
    api.get('/inscriptions', {
      params: { schoolPeriodId: periodId, gradeId, sectionId: sectionId || undefined },
    }).then((res) => {
      if (cancelled) return;
      const list = (res.data || []).map((ins: any) => ({
        label: `${ins.student?.lastName || ''} ${ins.student?.firstName || ''} — ${ins.section?.name || ''} (C.I. ${ins.student?.document || '—'})`,
        value: ins.id,
      }));
      setStudentOptions(list);
    }).catch(() => {
      if (!cancelled) setStudentOptions([]);
    });
    setInscriptionId(null);
    return () => { cancelled = true; };
  }, [scope, periodId, gradeId, sectionId]);

  // Fetch available templates for certified grades
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    api.get('/templates').then((res) => {
      if (cancelled) return;
      const names = (res.data || []).map((t: any) => t.name || t.filename || t).filter(Boolean);
      setTemplateList(names);
    }).catch(() => {
      if (!cancelled) setTemplateList([]);
    });
    return () => { cancelled = true; };
  }, [open]);

  const generate = useCallback(async () => {
    if (!periodId || !gradeId) {
      message.warning('Seleccione período y grado');
      return;
    }
    if (scope === 'section' && !sectionId) {
      message.warning('Seleccione una sección');
      return;
    }
    if (scope === 'single' && !inscriptionId) {
      message.warning('Seleccione un estudiante');
      return;
    }

    setLoading(true);
    setPdfUrl(null);
    try {
      const params: any = { schoolPeriodId: periodId, gradeId };
      if (scope === 'section') params.sectionId = sectionId;
      if (scope === 'single') params.inscriptionId = inscriptionId;

      const res = await api.get('/performance-summary/boletin-data', { params });
      const boletinData = { ...res.data, letterGrades } as BoletinData;

      if (!boletinData.students || boletinData.students.length === 0) {
        message.warning('No se encontraron estudiantes con los criterios seleccionados');
        setData(null);
        return;
      }

      setData(boletinData);
      const doc = <BoletinPDF data={boletinData} />;
      const blob = await pdf(doc).toBlob();
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
    } catch (error) {
      console.error('[BoletinModal] Error:', error);
      message.error('Error al generar el boletín');
    } finally {
      setLoading(false);
    }
  }, [periodId, gradeId, sectionId, inscriptionId, scope]);

  const handleDownload = useCallback(() => {
    if (pdfUrl) {
      const a = document.createElement('a');
      a.href = pdfUrl;
      a.download = `boletin-${gradeId}-${scope}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  }, [pdfUrl, gradeId, scope]);

  // Certified grades search
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (query.trim().length < 3) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await api.get('/users', { params: { q: query.trim() } });
      const results = (res.data || []).map((p: any) => ({
        label: `${p.lastName || ''} ${p.firstName || ''} (C.I. ${p.document || '—'})`,
        value: p.id,
      }));
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    }
  }, []);

  const exportCertifiedGrades = useCallback(async () => {
    if (!certifiedPersonId) {
      message.warning('Seleccione un estudiante');
      return;
    }
    if (!certifiedTemplate) {
      message.warning('Seleccione una plantilla');
      return;
    }

    setLoading(true);
    try {
      const response = await api.get('/certified-grades/export', {
        params: { personId: certifiedPersonId, template: certifiedTemplate },
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const fileName = response.headers['content-disposition']
        ?.split('filename="')[1]?.split('"')[0]
        || 'notas-certificadas.xlsx';
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      message.success('Notas certificadas exportadas correctamente');
    } catch (error: any) {
      console.error('[BoletinModal] Error exporting certified grades:', error);
      if (error.response?.data) {
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const err = JSON.parse(reader.result as string);
            message.error(err.message || 'Error al exportar');
          } catch {
            message.error('Error al exportar las notas certificadas');
          }
        };
        reader.readAsText(error.response.data);
      } else {
        message.error('Error al exportar las notas certificadas');
      }
    } finally {
      setLoading(false);
    }
  }, [certifiedPersonId, certifiedTemplate]);

  const handleClose = () => {
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
    }
    setData(null);
    setPdfUrl(null);
    setActiveTab('boletin');
    setCertifiedPersonId(null);
    setCertifiedTemplate(null);
    setSearchQuery('');
    setSearchResults([]);
    onClose();
  };

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      title="Generar Documentos de Calificaciones"
      width={900}
      footer={pdfUrl && activeTab === 'boletin' ? (
        <Space>
          <Button onClick={handleClose}>Cerrar</Button>
          <Button type="primary" icon={<DownloadOutlined />} onClick={handleDownload}>
            Descargar PDF
          </Button>
        </Space>
      ) : null}
      destroyOnClose
      styles={{ body: { minHeight: '55vh' } }}
    >
      <Tabs
        activeKey={activeTab}
        onChange={(k) => { setActiveTab(k as ModalTab); if (pdfUrl) { URL.revokeObjectURL(pdfUrl); setPdfUrl(null); } setData(null); }}
        items={[
          { key: 'boletin', label: 'Boletines (PDF)', icon: <FileTextOutlined /> },
          { key: 'certified', label: 'Notas Certificadas (Excel)', icon: <FileExcelOutlined /> },
        ]}
        style={{ marginBottom: 16 }}
      />

      {activeTab === 'boletin' && (
        <>
          {!pdfUrl ? (
            <div style={{ maxWidth: 500, margin: '0 auto' }}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontWeight: 700, marginBottom: 6 }}>Modo de generación</label>
                <Radio.Group value={scope} onChange={(e) => setScope(e.target.value)}>
                  <Radio.Button value="all">Todos</Radio.Button>
                  <Radio.Button value="section">Por Sección</Radio.Button>
                  <Radio.Button value="single">Estudiante</Radio.Button>
                </Radio.Group>
              </div>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
                <div style={{ flex: '1 1 200px' }}>
                  <label style={{ display: 'block', fontWeight: 700, marginBottom: 6, fontSize: 13 }}>Período</label>
                  <Select
                    placeholder="Período"
                    style={{ width: '100%' }}
                    value={periodId}
                    onChange={(v: number) => setPeriodId(v)}
                    options={allPeriods.map((p) => ({ label: `${p.name}${p.status === 'activo' ? ' (activo)' : ''}`, value: p.id }))}
                  />
                </div>
                <div style={{ flex: '1 1 150px' }}>
                  <label style={{ display: 'block', fontWeight: 700, marginBottom: 6, fontSize: 13 }}>Grado</label>
                  <Select
                    placeholder="Grado"
                    style={{ width: '100%' }}
                    value={gradeId}
                    onChange={(v: number) => { setGradeId(v); setSectionId(null); setInscriptionId(null); }}
                    options={structure.map((s) => ({ label: s.grade.name, value: s.grade.id }))}
                  />
                </div>
              </div>

              {scope === 'section' && (
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontWeight: 700, marginBottom: 6, fontSize: 13 }}>Sección</label>
                  <Select
                    placeholder="Sección"
                    style={{ width: '100%' }}
                    value={sectionId}
                    disabled={!gradeId}
                    onChange={(v: number) => setSectionId(v)}
                    options={availableSections.map((sec) => ({ label: sec.name, value: sec.id }))}
                  />
                </div>
              )}

              {scope === 'single' && (
                <>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontWeight: 700, marginBottom: 6, fontSize: 13 }}>Sección (opcional)</label>
                    <Select
                      placeholder="Todas las secciones"
                      style={{ width: '100%' }}
                      value={sectionId}
                      disabled={!gradeId}
                      allowClear
                      onChange={(v: number | undefined) => setSectionId(v ?? null)}
                      options={availableSections.map((sec) => ({ label: sec.name, value: sec.id }))}
                    />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontWeight: 700, marginBottom: 6, fontSize: 13 }}>Estudiante</label>
                    <Select
                      placeholder="Seleccione un estudiante"
                      style={{ width: '100%' }}
                      value={inscriptionId}
                      showSearch
                      filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                      disabled={!gradeId || studentOptions.length === 0}
                      onChange={(v: number) => setInscriptionId(v)}
                      options={studentOptions}
                      notFoundContent={gradeId ? 'Sin estudiantes' : 'Primero seleccione un grado'}
                    />
                  </div>
                </>
              )}

              <div style={{ textAlign: 'center', marginTop: 24 }}>
                {loading ? (
                  <Spin tip="Generando..." />
                ) : (
                  <Button
                    type="primary"
                    size="large"
                    icon={<DownloadOutlined />}
                    onClick={generate}
                    disabled={!periodId || !gradeId || (scope === 'section' && !sectionId) || (scope === 'single' && !inscriptionId)}
                    style={{ borderRadius: 10, fontWeight: 700, height: 44 }}
                  >
                    Generar Boletín{scope === 'all' ? 'es' : ''}
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div>
              {data && (
                <div style={{ textAlign: 'center', marginBottom: 8, fontSize: 12, color: '#666' }}>
                  {data.students.length} estudiante(s) — {data.institution.name} — {data.grade.name}
                </div>
              )}
              <iframe
                src={pdfUrl}
                style={{ width: '100%', height: '60vh', border: '1px solid #e2e8f0', borderRadius: 8 }}
                title="Boletín de Calificaciones"
              />
            </div>
          )}
        </>
      )}

      {activeTab === 'certified' && (
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <Alert
            message="Notas Certificadas"
            description="Seleccione un estudiante y una plantilla de Excel. El sistema rellenará los nombres de celda (named ranges) con los datos del estudiante y todas sus notas de todos los períodos cursados."
            type="info"
            style={{ marginBottom: 20, borderRadius: 8 }}
          />

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontWeight: 700, marginBottom: 6, fontSize: 13 }}>Buscar Estudiante</label>
            <Input.Search
              placeholder="Buscar por nombre o cédula..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              enterButton
              style={{ marginBottom: 8 }}
            />
            <Select
              placeholder="Resultados de búsqueda..."
              style={{ width: '100%' }}
              value={certifiedPersonId}
              onChange={(v: number) => setCertifiedPersonId(v)}
              options={searchResults}
              showSearch
              filterOption={false}
              notFoundContent={searchQuery.length < 3 ? 'Escriba al menos 3 caracteres' : 'Sin resultados'}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontWeight: 700, marginBottom: 6, fontSize: 13 }}>Plantilla de Excel</label>
            <Select
              placeholder="Seleccione una plantilla"
              style={{ width: '100%' }}
              value={certifiedTemplate}
              onChange={(v: string) => setCertifiedTemplate(v)}
              options={templateList.map((t) => ({ label: t, value: t }))}
              notFoundContent="Suba una plantilla a /templates"
            />
          </div>

          <div style={{ textAlign: 'center', marginTop: 28 }}>
            {loading ? (
              <Spin tip="Generando..." />
            ) : (
              <Button
                type="primary"
                size="large"
                icon={<FileExcelOutlined />}
                onClick={exportCertifiedGrades}
                disabled={!certifiedPersonId || !certifiedTemplate}
                style={{
                  borderRadius: 10,
                  fontWeight: 700,
                  height: 44,
                  background: '#059669',
                  border: 'none',
                }}
              >
                Exportar Notas Certificadas
              </Button>
            )}
          </div>

          <div style={{ marginTop: 20, textAlign: 'center' }}>
            <Popover
              trigger="click"
              placement="top"
              title="Named ranges que rellena el sistema (Notas Certificadas)"
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
                  <LegendRow name="expedition_place_date" desc="Lugar y fecha de expedición (ej. «Altagracia de Orituco, 30 de abril del 2022»)." />

                  <div style={{ fontWeight: 700, color: '#0f172a', marginTop: 10, marginBottom: 4 }}>Datos del Estudiante</div>
                  <LegendRow name="student_doc" desc="Cédula del estudiante." />
                  <LegendRow name="student_birthdate" desc="Fecha de nacimiento en formato texto (ej. «15 de marzo de 2008»)." />
                  <LegendRow name="student_lastname" desc="Apellidos del estudiante." />
                  <LegendRow name="student_firstname" desc="Nombres del estudiante." />
                  <LegendRow name="student_birth_country" desc="País de nacimiento (ej. Venezuela)." />
                  <LegendRow name="student_birth_state" desc="Estado de nacimiento del estudiante." />
                  <LegendRow name="student_birth_municipality" desc="Municipio de nacimiento del estudiante." />

                  <div style={{ fontWeight: 700, color: '#0f172a', marginTop: 10, marginBottom: 4 }}>Datos por Año Aprobado</div>
                  <LegendRow name="year_N_name" desc="Nombre del grado del año N (ej. «Primer Año»). N = 1, 2, 3... Solo años aprobados." />
                  <LegendRow name="year_N_period" desc="Período escolar del año N (ej. «2024-2025»)." />
                  <LegendRow name="yN_lapso_K" desc="Nombre del lapso K del año N (ej. «Primer Lapso»)." />

                  <div style={{ fontWeight: 700, color: '#0f172a', marginTop: 10, marginBottom: 4 }}>Notas por Materia (año N, materia M)</div>
                  <LegendRow name="yN_sM_name" desc="Nombre de la materia M del año N (ej. «Matemática»)." />
                  <LegendRow name="yN_sM_lK" desc="Calificación del lapso K en número (ej. «14.0»)." />
                  <LegendRow name="yN_sM_num" desc="Definitiva de la materia en número (ej. «15.0»)." />
                  <LegendRow name="yN_sM_letters" desc="Definitiva de la materia en letras (ej. «quince», «catorce coma cinco»)." />
                  <LegendRow name="yN_sM_month" desc="Mes de aprobación en letras (ej. «julio»)." />
                  <LegendRow name="yN_sM_year" desc="Año de aprobación (ej. «2025»)." />

                  <div style={{ marginTop: 10, fontSize: 11, color: '#666', borderTop: '1px solid #e2e8f0', paddingTop: 6 }}>
                    <b>N</b> = número de año aprobado (1, 2, 3, 4, 5...) — los años reprobados se omiten.<br />
                    <b>M</b> = número de materia dentro del año (1, 2, 3...) — en orden canónico.<br />
                    <b>K</b> = número de lapso dentro del año (1, 2, 3...).<br />
                    Los <b>named ranges</b> deben estar definidos en el .xlsx (Fórmulas › Gestor de nombres en Excel). El sistema solo rellena los que existan.
                  </div>
                </div>
              }
            >
              <Button type="link" icon={<InfoCircleOutlined />} style={{ fontSize: 12 }}>
                Ver named ranges disponibles
              </Button>
            </Popover>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default BoletinModal;