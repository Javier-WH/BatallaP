import React, { useState, useEffect, useCallback } from 'react';
import { Table, Card, Button, Input, Select, Space, Tag, message, Row, Col, Typography, Empty } from 'antd';
import { FilterOutlined, TeamOutlined, EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '@/services/api';
import type { ColumnsType } from 'antd/es/table';

const { Search } = Input;
const { Option } = Select;
const { Text } = Typography;

type Gender = 'M' | 'F';

interface SchoolPeriod {
  id: number;
  name: string;
  isActive: boolean;
}

interface Grade {
  id: number;
  name: string;
}

interface Section {
  id: number;
  name: string;
}

interface StudentSummary {
  id: number;
  firstName: string;
  lastName: string;
  documentType: string;
  document: string;
  gender: Gender;
}

interface InscriptionRecord {
  id: number;
  student: StudentSummary;
  grade: Grade;
  section?: Section | null;
}

interface FiltersState {
  gradeId?: number;
  sectionId?: number;
  gender?: Gender;
  q: string;
}

const EnrolledStudents: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [inscriptions, setInscriptions] = useState<InscriptionRecord[]>([]);
  const [activePeriod, setActivePeriod] = useState<SchoolPeriod | null>(null);

  // Catalogs for filters
  const [grades, setGrades] = useState<Grade[]>([]);
  const [sections, setSections] = useState<Section[]>([]);

  // Filter states
  const [filters, setFilters] = useState<FiltersState>({
    gradeId: undefined,
    sectionId: undefined,
    gender: undefined,
    q: ''
  });

  // 1. Initial Load: Active Period and Catalogs
  useEffect(() => {
    const loadCatalogs = async () => {
      try {
        const [periodsRes, gradesRes, sectionsRes] = await Promise.all([
          api.get<SchoolPeriod[]>('/academic/periods'),
          api.get<Grade[]>('/academic/grades'),
          api.get<Section[]>('/academic/sections')
        ]);

        const active = periodsRes.data.find((p) => p.isActive) || null;
        setActivePeriod(active);
        setGrades(gradesRes.data);
        setSections(sectionsRes.data);
      } catch (error) {
        console.error('Error loading catalogs:', error);
        message.error('Error al cargar catálogos');
      }
    };
    loadCatalogs();
  }, []);

  // 2. Fetch Inscriptions when filters or activePeriod change
  const fetchInscriptions = useCallback(async () => {
    if (!activePeriod) return;

    setLoading(true);
    try {
      const params = {
        schoolPeriodId: activePeriod.id,
        gradeId: filters.gradeId,
        sectionId: filters.sectionId,
        gender: filters.gender,
        q: filters.q
      };

      const res = await api.get<InscriptionRecord[]>('/inscriptions', { params });
      setInscriptions(res.data);
    } catch (error) {
      console.error('Error fetching inscriptions:', error);
      message.error('Error al obtener lista de estudiantes');
    } finally {
      setLoading(false);
    }
  }, [activePeriod, filters]);

  useEffect(() => {
    fetchInscriptions();
  }, [fetchInscriptions]);

  const columns: ColumnsType<InscriptionRecord> = [
    {
      title: 'Estudiante',
      key: 'student',
      render: (_: unknown, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{`${record.student?.firstName} ${record.student?.lastName}`}</Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.student?.documentType}: {record.student?.document}
          </Text>
        </Space>
      )
    },
    {
      title: 'Género',
      dataIndex: ['student', 'gender'],
      key: 'gender',
      render: (gender: string) => (
        <Tag color={gender === 'M' ? 'blue' : 'magenta'}>
          {gender === 'M' ? 'Masculino' : 'Femenino'}
        </Tag>
      )
    },
    {
      title: 'Grado',
      dataIndex: ['grade', 'name'],
      key: 'grade',
    },
    {
      title: 'Sección',
      dataIndex: ['section', 'name'],
      key: 'section',
      render: (name: string) => name || <Text type="secondary">N/A</Text>
    },
    {
      title: 'Expediente',
      key: 'record',
      align: 'center' as const,
      render: (_: unknown, record) => (
        <Button
          type="primary"
          ghost
          icon={<EyeOutlined />}
          onClick={() => navigate(`/student/${record.student?.id}`)}
        >
          Ver Detalle
        </Button>
      )
    }
  ];

  return (
    <div style={{ padding: '0 20px' }}>
      <Card
        title={
          <Space>
            <TeamOutlined style={{ color: '#1890ff' }} />
            <span style={{ fontSize: '18px', fontWeight: 600 }}>Estudiantes Inscritos</span>
            {activePeriod && <Tag color="blue" style={{ marginLeft: 8 }}>Periodo {activePeriod.name}</Tag>}
          </Space>
        }
        style={{ borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
      >
        {!activePeriod && !loading && (
          <Empty
            description="No hay un periodo escolar activo. Por favor, active uno en Gestión Académica."
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        )}

        {activePeriod && (
          <>
            {/* Filters Area */}
            <div style={{
              marginBottom: 24,
              padding: '20px',
              background: '#f8fafc',
              borderRadius: '12px',
              border: '1px solid #e2e8f0'
            }}>
              <Row gutter={[16, 16]} align="bottom">
                <Col xs={24} md={8}>
                  <Text strong type="secondary">Búsqueda rápida</Text>
                  <Search
                    placeholder="Escriba nombre o cédula..."
                    allowClear
                    enterButton
                    loading={loading}
                    onSearch={(val) => setFilters(prev => ({ ...prev, q: val }))}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      if (!e.target.value) setFilters(prev => ({ ...prev, q: '' }));
                    }}
                    style={{ width: '100%', marginTop: 8 }}
                  />
                </Col>
                <Col xs={12} sm={8} md={5}>
                  <Text strong type="secondary">Grado</Text>
                  <Select
                    placeholder="Todos los grados"
                    style={{ width: '100%', marginTop: 8 }}
                    allowClear
                    value={filters.gradeId}
                    onChange={(val: number | undefined) => setFilters(prev => ({ ...prev, gradeId: val }))}>
                    {grades.map(g => <Option key={g.id} value={g.id}>{g.name}</Option>)}
                  </Select>
                </Col>
                <Col xs={12} sm={8} md={4}>
                  <Text strong type="secondary">Sección</Text>
                  <Select
                    placeholder="Todas"
                    style={{ width: '100%', marginTop: 8 }}
                    allowClear
                    value={filters.sectionId}
                    onChange={(val: number | undefined) => setFilters(prev => ({ ...prev, sectionId: val }))}>
                    {sections.map(s => <Option key={s.id} value={s.id}>{s.name}</Option>)}
                  </Select>
                </Col>
                <Col xs={12} sm={8} md={4}>
                  <Text strong type="secondary">Género</Text>
                  <Select
                    placeholder="Ambos"
                    style={{ width: '100%', marginTop: 8 }}
                    allowClear
                    value={filters.gender}
                    onChange={(val: Gender | undefined) => setFilters(prev => ({ ...prev, gender: val }))}>
                    <Option value="M">Masculino</Option>
                    <Option value="F">Femenino</Option>
                  </Select>
                </Col>
                <Col xs={12} md={3}>
                  <Button
                    icon={<FilterOutlined />}
                    onClick={() => setFilters({ gradeId: undefined, sectionId: undefined, gender: undefined, q: '' })}
                    block
                    style={{ marginTop: '29px' }}
                  >
                    Limpiar
                  </Button>
                </Col>
              </Row>
            </div>

            <Table
              columns={columns}
              dataSource={inscriptions}
              rowKey="id"
              loading={loading}
              pagination={{
                pageSize: 10,
                showSizeChanger: false,
                hideOnSinglePage: true,
                position: ['bottomCenter']
              }}
              locale={{ emptyText: 'No se encontraron estudiantes para los filtros seleccionados' }}
              style={{ background: '#fff' }}
            />
          </>
        )}
      </Card>
    </div>
  );
};

export default EnrolledStudents;
