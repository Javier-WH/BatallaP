import React, { useState, useEffect } from 'react';
import { Card, Button, Form, Tag, message, Select, Row, Col, Input, DatePicker, Radio, Tabs } from 'antd';
import { UserAddOutlined } from '@ant-design/icons';
import api from '@/services/api';

const { Option } = Select;
const { TabPane } = Tabs;

const EnrollStudent: React.FC = () => {
  // Common State
  const [periods, setPeriods] = useState<any[]>([]);
  const [enrollStructure, setEnrollStructure] = useState<any[]>([]);

  // Existing Student State
  const [studentOptions, setStudentOptions] = useState<any[]>([]);
  const [searchingStudents, setSearchingStudents] = useState(false);

  // Forms
  const [newStudentForm] = Form.useForm();
  const [existingStudentForm] = Form.useForm();

  // Load Periods
  useEffect(() => {
    const fetchPeriods = async () => {
      try {
        const res = await api.get('/academic/periods');
        setPeriods(res.data);
      } catch (error) {
        message.error('Error cargando periodos');
      }
    };
    fetchPeriods();
  }, []);

  // --- Handlers ---

  const handlePeriodChange = async (val: number, formInstance: any) => {
    try {
      const res = await api.get(`/academic/structure/${val}`);
      setEnrollStructure(res.data);
      formInstance.setFieldsValue({ gradeId: undefined, sectionId: undefined });
    } catch (error) {
      message.error('Error cargando estructura del periodo');
    }
  };

  const handleSearchStudents = async (value: string) => {
    if (!value) {
      setStudentOptions([]);
      return;
    }
    setSearchingStudents(true);
    try {
      const res = await api.get(`/users/search?q=${value}`);
      const students = res.data.filter((p: any) =>
        p.roles?.some((r: any) => ['student', 'estudiante', 'alumno'].includes(r.name.toLowerCase()))
      );
      setStudentOptions(students.map((p: any) => ({
        label: `${p.firstName} ${p.lastName} (${p.document})`,
        value: p.id
      })));
    } catch (error) {
      // quiet fail
    } finally {
      setSearchingStudents(false);
    }
  };

  // Submit: New Student (uses /inscriptions/register - no User created)
  const handleNewStudentSubmit = async (values: any) => {
    try {
      const payload = {
        ...values,
        birthdate: values.birthdate ? values.birthdate.format('YYYY-MM-DD') : null
      };

      await api.post('/inscriptions/register', payload);

      message.success('Estudiante registrado e inscrito exitosamente');
      newStudentForm.resetFields();
      setEnrollStructure([]);
    } catch (error: any) {
      console.error(error);
      message.error(error.response?.data?.error || error.response?.data?.message || 'Error al procesar la solicitud');
    }
  };

  // Submit: Existing Student
  const handleExistingStudentSubmit = async (values: any) => {
    try {
      await api.post('/inscriptions', values);
      message.success('Estudiante inscrito correctamente');
      existingStudentForm.resetFields();
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Error en inscripción');
    }
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', paddingBottom: 40 }}>
      <Card title="Inscripción de Estudiantes" bordered={false}>
        <Tabs defaultActiveKey="new">

          {/* TAB 1: NEW STUDENT */}
          <TabPane tab="Nuevo Ingreso (Registrar e Inscribir)" key="new">
            <Form
              form={newStudentForm}
              layout="vertical"
              onFinish={handleNewStudentSubmit}
              initialValues={{ documentType: 'Venezolano', gender: 'M' }}
            >
              <div style={{ background: '#f0f7ff', padding: 16, borderRadius: 8, marginBottom: 24, border: '1px solid #91caff' }}>
                <h4 style={{ marginTop: 0, color: '#1890ff' }}>1. Datos Académicos (Inscripción)</h4>
                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item
                      name="schoolPeriodId"
                      label="Periodo Escolar"
                      rules={[{ required: true }]}
                    >
                      <Select placeholder="Seleccione" onChange={(v) => handlePeriodChange(v, newStudentForm)}>
                        {periods.map(p => (
                          <Option key={p.id} value={p.id}>{p.name} {p.isActive && <Tag color="green">ACTIVO</Tag>}</Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      name="gradeId"
                      label="Grado"
                      dependencies={['schoolPeriodId']}
                      rules={[{ required: true }]}
                    >
                      <Select placeholder="Grado" disabled={!enrollStructure.length} onChange={() => newStudentForm.setFieldsValue({ sectionId: undefined })}>
                        {enrollStructure.map(s => <Option key={s.gradeId} value={s.gradeId}>{s.grade?.name}</Option>)}
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      name="sectionId"
                      label="Sección"
                      dependencies={['gradeId']}
                    >
                      <Select placeholder="Sección" disabled={!enrollStructure.length} allowClear>
                        {(() => {
                          const gid = newStudentForm.getFieldValue('gradeId');
                          const item = enrollStructure.find(s => s.gradeId === gid);
                          return item?.sections?.map((sec: any) => <Option key={sec.id} value={sec.id}>{sec.name}</Option>) || [];
                        })()}
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>
              </div>

              <div style={{ marginBottom: 24 }}>
                <h4 style={{ color: '#666', borderBottom: '1px solid #eee', paddingBottom: 8 }}>2. Datos del Estudiante</h4>

                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="firstName" label="Nombres" rules={[{ required: true }]}>
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="lastName" label="Apellidos" rules={[{ required: true }]}>
                      <Input />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item name="documentType" label="Tipo Doc" rules={[{ required: true }]}>
                      <Select>
                        <Option value="Venezolano">V</Option>
                        <Option value="Extranjero">E</Option>
                        <Option value="Pasaporte">P</Option>
                        <Option value="Cedula Escolar">CE</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={16}>
                    <Form.Item name="document" label="Documento" rules={[{ required: true }]}>
                      <Input />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="gender" label="Género" rules={[{ required: true }]}>
                      <Radio.Group>
                        <Radio value="M">Masculino</Radio>
                        <Radio value="F">Femenino</Radio>
                      </Radio.Group>
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="birthdate" label="Fecha Nacimiento" rules={[{ required: true }]}>
                      <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
                    </Form.Item>
                  </Col>
                </Row>
              </div>

              <div>
                <h4 style={{ color: '#666', borderBottom: '1px solid #eee', paddingBottom: 8 }}>3. Datos de Contacto</h4>
                <Row gutter={16}>
                  <Col span={24}>
                    <Form.Item name="address" label="Dirección" rules={[{ required: true }]}>
                      <Input.TextArea rows={2} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="phone1" label="Teléfono Principal">
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="email" label="Email" rules={[{ type: 'email' }]}>
                      <Input />
                    </Form.Item>
                  </Col>
                </Row>
              </div>

              <Form.Item style={{ marginTop: 24 }}>
                <Button type="primary" htmlType="submit" block size="large" icon={<UserAddOutlined />}>
                  Registrar e Inscribir Estudiante
                </Button>
                <div style={{ marginTop: 8, color: '#888', fontSize: 12, textAlign: 'center' }}>
                  * Los estudiantes no requieren usuario y contraseña
                </div>
              </Form.Item>
            </Form>
          </TabPane>

          {/* TAB 2: EXISTING STUDENT */}
          <TabPane tab="Estudiante Regular (Ya Registrado)" key="existing">
            <Form
              form={existingStudentForm}
              layout="vertical"
              onFinish={handleExistingStudentSubmit}
              style={{ maxWidth: 600, margin: '20px auto' }}
            >
              <Form.Item
                name="schoolPeriodId"
                label="Periodo Escolar"
                rules={[{ required: true }]}
              >
                <Select placeholder="Seleccione el Año Escolar" onChange={(v) => handlePeriodChange(v, existingStudentForm)}>
                  {periods.map(p => (
                    <Option key={p.id} value={p.id}>{p.name} {p.isActive && <Tag color="green">ACTIVO</Tag>}</Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                name="personId"
                label="Estudiante"
                rules={[{ required: true, message: 'Busque un estudiante' }]}
              >
                <Select
                  showSearch
                  placeholder="Buscar por nombre o cédula"
                  filterOption={false}
                  onSearch={handleSearchStudents}
                  loading={searchingStudents}
                  options={studentOptions}
                  notFoundContent={searchingStudents ? <div style={{ padding: 8 }}>Buscando...</div> : null}
                />
              </Form.Item>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="gradeId"
                    label="Grado"
                    dependencies={['schoolPeriodId']}
                    rules={[{ required: true }]}
                  >
                    <Select placeholder="Grado" disabled={!enrollStructure.length} onChange={() => existingStudentForm.setFieldsValue({ sectionId: undefined })}>
                      {enrollStructure.map(s => <Option key={s.gradeId} value={s.gradeId}>{s.grade?.name}</Option>)}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="sectionId"
                    label="Sección"
                    dependencies={['gradeId']}
                  >
                    <Select placeholder="Sección" disabled={!enrollStructure.length} allowClear>
                      {(() => {
                        const gid = existingStudentForm.getFieldValue('gradeId');
                        const item = enrollStructure.find(s => s.gradeId === gid);
                        return item?.sections?.map((sec: any) => <Option key={sec.id} value={sec.id}>{sec.name}</Option>) || [];
                      })()}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item>
                <Button type="primary" htmlType="submit" block icon={<UserAddOutlined />}>
                  Inscribir Estudiante
                </Button>
              </Form.Item>
            </Form>
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
};

export default EnrollStudent;
