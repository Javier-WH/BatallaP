import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, Select, Space, Typography, Row, Col, Spin, message, Empty } from 'antd';
import { DownloadOutlined, FileExcelOutlined } from '@ant-design/icons';
import api from '@/services/api';

const { Title, Text } = Typography;

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
    </div>
  );
};

export default PerformanceSummary;
