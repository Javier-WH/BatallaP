import React, { useEffect, useMemo, useState } from 'react';
import type { Dayjs } from 'dayjs';
import { Card, Form, Select, Input, DatePicker, Radio, Row, Col, Button, Tag, Alert, message } from 'antd';
import { UserAddOutlined } from '@ant-design/icons';
import api from '@/services/api';

const { Option } = Select;

interface EnrollStructureEntry {
  gradeId: number;
  grade?: { id: number; name: string };
  sections?: { id: number; name: string }[];
}

interface SchoolPeriod {
  id: number;
  name: string;
  isActive?: boolean;
}

const MatricularEstudiante: React.FC = () => {
  const [form] = Form.useForm();
  const [activePeriod, setActivePeriod] = useState<SchoolPeriod | null>(null);
  const [structure, setStructure] = useState<EnrollStructureEntry[]>([]);
  const [selectedGradeId, setSelectedGradeId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const periodsRes = await api.get('/academic/periods');
        const active = (periodsRes.data || []).find((p: SchoolPeriod) => p.isActive);

        if (!active) {
          message.warning('No hay periodo escolar activo');
          setLoading(false);
          return;
        }

        setActivePeriod(active);

        const structureRes = await api.get(`/academic/structure/${active.id}`);
        setStructure(structureRes.data || []);
      } catch (error) {
        console.error('Error cargando datos de matrícula:', error);
        message.error('Error cargando datos de matrícula');
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  const gradeOptions = useMemo(
    () =>
      structure.map(entry => ({
        label: entry.grade?.name ?? `Grado ${entry.gradeId}`,
        value: entry.gradeId
      })),
    [structure]
  );

  const sectionOptions = useMemo(() => {
    if (!selectedGradeId) return [];
    const match = structure.find(entry => entry.gradeId === selectedGradeId);
    return (match?.sections ?? []).map(section => ({
      label: section.name,
      value: section.id
    }));
  }, [selectedGradeId, structure]);

  const handleSubmit = async (values: {
    gradeId: number;
    sectionId?: number;
    firstName: string;
    lastName: string;
    documentType: string;
    document: string;
    gender: 'M' | 'F';
    birthdate: Dayjs;
  }) => {
    if (!activePeriod) {
      message.error('No hay periodo activo configurado');
      return;
    }

    try {
      await api.post('/inscriptions/quick-register', {
        schoolPeriodId: activePeriod.id,
        gradeId: values.gradeId,
        sectionId: values.sectionId ?? null,
        firstName: values.firstName,
        lastName: values.lastName,
        documentType: values.documentType,
        document: values.document,
        gender: values.gender,
        birthdate: values.birthdate ? values.birthdate.format('YYYY-MM-DD') : null
      });

      message.success('Estudiante matriculado correctamente');
      form.resetFields();
      setSelectedGradeId(null);
    } catch (error: unknown) {
      console.error('Error matriculando estudiante:', error);
      const err = error as { response?: { data?: { error?: string; message?: string } } };
      message.error(err.response?.data?.error || err.response?.data?.message || 'Error al matricular estudiante');
    }
  };

  if (loading) {
    return <Card loading />;
  }

  if (!activePeriod) {
    return (
      <Card>
        <Alert
          type="warning"
          message="No hay periodo escolar activo"
          description="Configure un periodo activo antes de matricular estudiantes."
          showIcon
        />
      </Card>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', paddingBottom: 32 }}>
      <Card
        title="Matricular Estudiante (Datos Básicos)"
        bordered={false}
        extra={
          <Tag color="blue" style={{ padding: '4px 12px' }}>
            Periodo activo: <strong>{activePeriod.name}</strong>
          </Tag>
        }
      >
        <Alert
          showIcon
          type="info"
          style={{ marginBottom: 20 }}
          message="Solo datos esenciales"
          description="La información restante será completada posteriormente por Control de Estudios."
        />

        <Form
          layout="vertical"
          form={form}
          initialValues={{ documentType: 'Venezolano', gender: 'M' }}
          onFinish={handleSubmit}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="gradeId"
                label="Grado"
                rules={[{ required: true, message: 'Seleccione un grado' }]}
              >
                <Select
                  placeholder="Seleccione"
                  options={gradeOptions}
                  onChange={(value: number) => {
                    setSelectedGradeId(value);
                    form.setFieldsValue({ sectionId: undefined });
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="sectionId" label="Sección (Opcional)">
                <Select
                  placeholder="Seleccione"
                  options={sectionOptions}
                  disabled={!selectedGradeId}
                  allowClear
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="firstName"
                label="Nombres"
                rules={[{ required: true, message: 'Ingrese los nombres' }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="lastName"
                label="Apellidos"
                rules={[{ required: true, message: 'Ingrese los apellidos' }]}
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="documentType"
                label="Tipo de documento"
                rules={[{ required: true }]}
              >
                <Select>
                  <Option value="Venezolano">V</Option>
                  <Option value="Extranjero">E</Option>
                  <Option value="Pasaporte">P</Option>
                  <Option value="Cedula Escolar">CE</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={16}>
              <Form.Item
                name="document"
                label="Documento"
                rules={[{ required: true, message: 'Ingrese el documento' }]}
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="gender"
                label="Género"
                rules={[{ required: true, message: 'Seleccione género' }]}
              >
                <Radio.Group style={{ width: '100%' }}>
                  <Radio.Button value="M" style={{ width: '50%', textAlign: 'center' }}>
                    Masculino
                  </Radio.Button>
                  <Radio.Button value="F" style={{ width: '50%', textAlign: 'center' }}>
                    Femenino
                  </Radio.Button>
                </Radio.Group>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="birthdate"
                label="Fecha de nacimiento"
                rules={[{ required: true, message: 'Seleccione la fecha' }]}
              >
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item>
            <Button type="primary" htmlType="submit" icon={<UserAddOutlined />} size="large" block>
              Matricular Estudiante
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default MatricularEstudiante;
