import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, Select, Space, Typography, Row, Col, Spin, message, Empty, Tag, Popover, Divider } from 'antd';
import { DownloadOutlined, FileExcelOutlined, FolderOpenOutlined, CheckCircleOutlined, InfoCircleOutlined } from '@ant-design/icons';
import api from '@/services/api';
import TemplateManagerModal from '@/components/TemplateManagerModal';

const { Title, Text } = Typography;

// Fila de leyenda: nombre del named range (izquierda) + descripción del dato (derecha)
const LegendRow: React.FC<{ name: string; desc: string }> = ({ name, desc }) => (
  <div style={{ display: 'flex', gap: 10, padding: '3px 0', borderBottom: '1px dashed #e2e8f0' }}>
    <code style={{ color: '#15803d', fontWeight: 700, whiteSpace: 'nowrap', minWidth: 110, fontSize: 12 }}>{name}</code>
    <span style={{ color: '#475569', fontSize: 12.5, flex: 1 }}>{desc}</span>
  </div>
);

interface Grade {
  id: number;
  name: string;
  isDiversified: boolean;
  order: number;
}

interface Section {
  id: number;
  name: string;
}

interface PeriodGradeStructure {
  id: number;
  grade: Grade;
  sections: Section[];
}

const PerformanceSummary: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [structure, setStructure] = useState<PeriodGradeStructure[]>([]);
  const [activePeriod, setActivePeriod] = useState<any>(null);
  const [selectedGradeId, setSelectedGradeId] = useState<number | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<number | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const activeRes = await api.get('/academic/active');
      const period = activeRes.data;
      setActivePeriod(period);

      if (period) {
        const structureRes = await api.get(`/academic/structure/${period.id}`);
        setStructure(structureRes.data.sort((a: PeriodGradeStructure, b: PeriodGradeStructure) =>
          (a.grade.order || 0) - (b.grade.order || 0)
        ));
      }
    } catch (error) {
      console.error('Error fetching data', error);
      message.error('Error al cargar la información inicial');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExport = async () => {
    if (!activePeriod || !selectedGradeId || !selectedSectionId) {
      message.warning('Seleccione un grado y una sección');
      return;
    }

    setExporting(true);
    try {
      const response = await api.get('/performance-summary/export', {
        params: {
          schoolPeriodId: activePeriod.id,
          gradeId: selectedGradeId,
          sectionId: selectedSectionId,
          template: selectedTemplate || undefined,
        },
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const fileName = response.headers['content-disposition']
        ?.split('filename="')[1]?.split('"')[0]
        || 'resumen-rendimiento.xlsx';
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
          } catch {
            message.error('Error al exportar el resumen');
          }
        };
        reader.readAsText(error.response.data);
      } else {
        message.error('Error al exportar el resumen');
      }
    } finally {
      setExporting(false);
    }
  };

  const selectedGrade = structure.find(s => s.grade.id === selectedGradeId);
  const availableSections = selectedGrade?.sections || [];

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
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            boxShadow: '0 12px 24px rgba(5,150,105,0.25)'
          }}>
            <FileExcelOutlined style={{ fontSize: 28, color: '#fff' }} />
          </div>
          <Title level={2} style={{ margin: 0, fontWeight: 900, letterSpacing: '-0.04em' }}>
            Resumen de Rendimiento Estudiantil
          </Title>
          <Text type="secondary" style={{ fontSize: 16, fontWeight: 500 }}>
            Genere un archivo Excel con el resumen final de notas de los estudiantes
          </Text>
        </div>

        {structure.length === 0 ? (
          <Empty description="No hay estructura académica configurada para el período activo" />
        ) : (
          <Row gutter={[24, 24]} justify="center" align="middle">
            <Col xs={24} sm={10} md={7}>
              <Text style={{ fontWeight: 700, display: 'block', marginBottom: 8 }}>Grado</Text>
              <Select
                placeholder="Seleccione un grado"
                style={{ width: '100%' }}
                size="large"
                value={selectedGradeId}
                onChange={(val) => {
                  setSelectedGradeId(val);
                  setSelectedSectionId(null);
                }}
                options={structure.map(s => ({
                  label: s.grade.name,
                  value: s.grade.id,
                }))}
              />
            </Col>
            <Col xs={24} sm={10} md={7}>
              <Text style={{ fontWeight: 700, display: 'block', marginBottom: 8 }}>Sección</Text>
              <Select
                placeholder="Seleccione una sección"
                style={{ width: '100%' }}
                size="large"
                value={selectedSectionId}
                disabled={!selectedGradeId}
                onChange={(val) => setSelectedSectionId(val)}
                options={availableSections.map(s => ({
                  label: s.name,
                  value: s.id,
                }))}
              />
            </Col>
            <Col xs={24} sm={4} md={4} style={{ display: 'flex', alignItems: 'flex-end' }}>
              <Button
                type="primary"
                size="large"
                icon={<DownloadOutlined />}
                onClick={handleExport}
                loading={exporting}
                disabled={!selectedGradeId || !selectedSectionId}
                style={{
                  width: '100%',
                  height: 40,
                  borderRadius: 10,
                  fontWeight: 700,
                  background: '#059669',
                  border: 'none',
                }}
              >
                Exportar
              </Button>
            </Col>
          </Row>
        )}

        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <Button
            icon={<FolderOpenOutlined />}
            onClick={() => setTemplateModalOpen(true)}
            style={{ borderRadius: 10, fontWeight: 600 }}
          >
            Gestionar plantillas
          </Button>
          <Popover
            trigger="click"
            placement="bottom"
            title="Nombres de celda (named ranges) que rellena el sistema"
            content={
              <div style={{ maxWidth: 520, fontSize: 12.5, lineHeight: 1.5 }}>
                <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>Datos de la institución y el período</div>
                <LegendRow name="inst_period" desc="Nombre del período académico activo (ej. 2025-2026)." />
                <LegendRow name="inst_eval_type" desc="Tipo de evaluación (texto fijo: REVISION DE MATERIA PENDIENTE)." />
                <LegendRow name="inst_code" desc="Código DEA de la institución." />
                <LegendRow name="inst_name" desc="Nombre de la institución." />
                <LegendRow name="inst_address" desc="Dirección de la institución." />
                <LegendRow name="inst_phone" desc="Teléfono de la institución." />
                <LegendRow name="inst_municipality" desc="Municipio de la institución." />
                <LegendRow name="inst_state" desc="Estado de la institución." />
                <LegendRow name="inst_cdcee" desc="Código CDCEE de la institución." />
                <LegendRow name="inst_director" desc="Nombre del director(a)." />
                <LegendRow name="inst_director_doc" desc="Cédula del director(a)." />

                <Divider style={{ margin: '10px 0' }} />
                <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
                  Datos por estudiante — <span style={{ fontWeight: 400, color: '#475569' }}>reemplaza <b>n</b> por el número de estudiante (1 a 35)</span>
                </div>
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
                <LegendRow name="subj_i" desc="Abreviatura de la materia i (i = 1, 2, …). El sistema la escribe automáticamente con la abreviatura configurada en Gestión Académica. Define además la columna de la nota grade_i_n." />
                <LegendRow name="subjname_i" desc="Nombre completo de la materia i (ej: «Castellano y Literatura»). Opcional: el sistema lo escribe si el named range existe en la plantilla." />

                <Divider style={{ margin: '10px 0' }} />
                <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>Notas por estudiante y materia</div>
                <LegendRow name="grade_i_n" desc="Nota final del estudiante n en la materia de la columna i. Combina el promedio del período + puntos de consejo." />

                <Divider style={{ margin: '10px 0' }} />
                <div style={{ color: '#94a3b8', fontSize: 11.5 }}>
                  Los <b>named ranges</b> deben estar definidos en el .xlsx (Fórmulas › Gestor de nombres en Excel). El sistema solo rellena los que existan.
                </div>
              </div>
            }
          >
            <Button icon={<InfoCircleOutlined />} style={{ borderRadius: 10, fontWeight: 600 }}>Leyenda de celdas</Button>
          </Popover>
          {selectedTemplate ? (
            <Tag icon={<CheckCircleOutlined />} color="success" style={{ display: 'inline-flex', alignItems: 'center', alignSelf: 'center' }}>
              Plantilla: {selectedTemplate}
            </Tag>
          ) : (
            <Text type="secondary" style={{ alignSelf: 'center', fontSize: 13 }}>
              Usando plantilla por defecto (ResumenFinal_Template.xlsx)
            </Text>
          )}
        </div>

        <div style={{ marginTop: 32, padding: '20px 24px', background: '#f0fdf4', borderRadius: 12, border: '1px solid #bbf7d0' }}>
          <Space direction="vertical" size="small">
            <Text style={{ fontWeight: 700, color: '#166534' }}>
              Información del reporte:
            </Text>
            <Text style={{ color: '#15803d', fontSize: 13 }}>
              • Columnas: Nro, Apellidos, Nombres, Lugar de Nacimiento, EF (Educación Física), Día, Mes, Año, y materias con encabezados abreviados.
            </Text>
            <Text style={{ color: '#15803d', fontSize: 13 }}>
              • Las notas mostradas corresponden al promedio final del período (notas + puntos de consejo).
            </Text>
            <Text style={{ color: '#15803d', fontSize: 13 }}>
              • Configure las abreviaturas de las materias en Gestión Académica para encabezados más compactos.
            </Text>
          </Space>
        </div>
      </Card>

      <TemplateManagerModal
        open={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        selectedTemplate={selectedTemplate}
        onSelect={(name) => setSelectedTemplate(name || null)}
      />
    </div>
  );
};

export default PerformanceSummary;
