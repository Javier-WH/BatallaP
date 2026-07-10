import React, { useState, useCallback, useEffect } from 'react';
import { Modal, Spin, Button, Radio, Select, message, Space } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { pdf } from '@react-pdf/renderer';
import BoletinPDF from './BoletinPDF';
import type { BoletinData } from './BoletinPDF';
import api from '@/services/api';

interface Section { id: number; name: string; }
interface PeriodGradeStructure { id: number; grade: { id: number; name: string; order: number }; sections: Section[]; }
interface SchoolPeriod { id: number; name: string; period: string; isActive: boolean; }

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

const BoletinModal: React.FC<BoletinModalProps> = ({
  open,
  onClose,
  allPeriods,
  structure,
  selectedPeriodId: initialPeriodId,
  selectedGradeId: initialGradeId,
  selectedSectionId: initialSectionId,
}) => {
  const [scope, setScope] = useState<Scope>('section');
  const [periodId, setPeriodId] = useState<number | null>(initialPeriodId);
  const [gradeId, setGradeId] = useState<number | null>(initialGradeId);
  const [sectionId, setSectionId] = useState<number | null>(initialSectionId);
  const [inscriptionId, setInscriptionId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [data, setData] = useState<BoletinData | null>(null);
  const [studentOptions, setStudentOptions] = useState<{ label: string; value: number }[]>([]);

  const selectedGrade = structure.find((s) => s.grade.id === gradeId);
  const availableSections = selectedGrade?.sections || [];

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
      const boletinData = res.data as BoletinData;

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

  const handleClose = () => {
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
    }
    setData(null);
    setPdfUrl(null);
    onClose();
  };

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      title="Generar Boletines de Calificaciones"
      width={900}
      footer={pdfUrl ? (
        <Space>
          <Button onClick={handleClose}>Cerrar</Button>
          <Button type="primary" icon={<DownloadOutlined />} onClick={handleDownload}>
            Descargar PDF
          </Button>
        </Space>
      ) : null}
      destroyOnClose
      styles={{ body: { minHeight: '60vh' } }}
    >
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
                options={allPeriods.map((p) => ({ label: `${p.name}${p.isActive ? ' (activo)' : ''}`, value: p.id }))}
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
                  placeholder="Seleccione un estudiante (puede buscar por nombre o cédula)"
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
              <Spin tip="Generando boletín..." />
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
              {data.students.length} estudiante(s) · {data.institution.name} · {data.grade.name}
            </div>
          )}
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '55vh' }}>
              <Spin size="large" tip="Generando..." />
            </div>
          ) : (
            <iframe
              src={pdfUrl}
              style={{ width: '100%', height: '60vh', border: '1px solid #e2e8f0', borderRadius: 8 }}
              title="Boletín de Calificaciones"
            />
          )}
        </div>
      )}
    </Modal>
  );
};

export default BoletinModal;