import React, { useState, useEffect, useCallback } from 'react';
import { Table, Card, Button, Input, Select, Space, Tag, message, Row, Col, Typography } from 'antd';
import { FilterOutlined, UserOutlined } from '@ant-design/icons';
import api from '@/services/api';

const { Search } = Input;
const { Option } = Select;
const { Text } = Typography;

const EnrolledStudents: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [inscriptions, setInscriptions] = useState<any[]>([]);
  const [activePeriod, setActivePeriod] = useState<any>(null);

  // Catalogs for filters
  const [grades, setGrades] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);

  // Filter states
  const [filters, setFilters] = useState({
    gradeId: undefined,
    sectionId: undefined,
    gender: undefined,
    q: ''
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Get periods to find the active one
      const periodsRes = await api.get('/academic/periods');
      const active = periodsRes.data.find((p: any) => p.isActive);

      if (!active) {
        setActivePeriod(null);
        setInscriptions([]);
        setLoading(false);
        return;
      }

      setActivePeriod(active);

      // 2. Fetch catalogs for filters
      const [gradesRes, sectionsRes] = await Promise.all([
        api.get('/academic/grades'),
        api.get('/academic/sections')
      ]);
      setGrades(gradesRes.data);
      setSections(sectionsRes.data);

      // 3. Fetch inscriptions
      const params = {
        schoolPeriodId: active.id,
        gradeId: filters.gradeId,
        sectionId: filters.sectionId,
        gender: filters.gender,
        q: filters.q
      };

      const inscriptionsRes = await api.get('/inscriptions', { params });
      setInscriptions(inscriptionsRes.data);
    } catch (error) {
      console.error(error);
      message.error('Error al cargar datos de estudiantes');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const columns = [
    {
      title: 'Estudiante',
      key: 'student',
      render: (_: any, record: any) => (
        <Space direction="vertical" size={0}>
          <Text strong>{`${record.student?.firstName} ${record.student?.lastName}`}</Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>{record.student?.documentType}: {record.student?.document}</Text>
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
    }
  ];

  return (
    <div style={{ padding: '0 20px' }}>
      <Card
        title={
          <Space>
            <UserOutlined />
            <span>Estudiantes Inscritos</span>
            {activePeriod && <Tag color="green">Periodo: {activePeriod.name}</Tag>}
          </Space>
        }
      >
        {!activePeriod && !loading && (
          <Text type="danger">No hay un periodo escolar activo actualmente.</Text>
        )}

        {/* Filters Area */}
        <div style={{ marginBottom: 24, padding: 16, background: '#f5f5f5', borderRadius: 8 }}>
          <Row gutter={[16, 16]} align="bottom">
            <Col xs={24} sm={12} md={6}>
              <Text type="secondary">Búsqueda</Text>
              <Search
                placeholder="Nombre o Cédula"
                allowClear
                onSearch={(val) => setFilters(prev => ({ ...prev, q: val }))}
                style={{ width: '100%', marginTop: 8 }}
              />
            </Col>
            <Col xs={12} sm={8} md={5}>
              <Text type="secondary">Grado</Text>
              <Select
                placeholder="Todos"
                style={{ width: '100%', marginTop: 8 }}
                allowClear
                value={filters.gradeId}
                onChange={(val) => setFilters(prev => ({ ...prev, gradeId: val }))}
              >
                {grades.map(g => <Option key={g.id} value={g.id}>{g.name}</Option>)}
              </Select>
            </Col>
            <Col xs={12} sm={8} md={4}>
              <Text type="secondary">Sección</Text>
              <Select
                placeholder="Todas"
                style={{ width: '100%', marginTop: 8 }}
                allowClear
                value={filters.sectionId}
                onChange={(val) => setFilters(prev => ({ ...prev, sectionId: val }))}
              >
                {sections.map(s => <Option key={s.id} value={s.id}>{s.name}</Option>)}
              </Select>
            </Col>
            <Col xs={12} sm={8} md={5}>
              <Text type="secondary">Género</Text>
              <Select
                placeholder="Todos"
                style={{ width: '100%', marginTop: 8 }}
                allowClear
                value={filters.gender}
                onChange={(val) => setFilters(prev => ({ ...prev, gender: val }))}
              >
                <Option value="M">Masculino</Option>
                <Option value="F">Femenino</Option>
              </Select>
            </Col>
            <Col xs={12} sm={4} md={4}>
              <Button
                icon={<FilterOutlined />}
                onClick={() => setFilters({ gradeId: undefined, sectionId: undefined, gender: undefined, q: '' })}
                block
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
          pagination={{ pageSize: 12, hideOnSinglePage: true }}
          locale={{ emptyText: 'No se encontraron estudiantes para los filtros seleccionados' }}
        />
      </Card>
    </div>
  );
};

export default EnrolledStudents;
