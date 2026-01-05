import React, { useState } from 'react';
import { Card, Form, Input, Button, DatePicker, Select, Radio, Row, Col, message } from 'antd';
import { UserAddOutlined } from '@ant-design/icons';
import type { Dayjs } from 'dayjs';
import type { AxiosError } from 'axios';
import api from '@/services/api';

interface RepresentativeFormValues {
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  documentType: string;
  document: string;
  gender: string;
  birthdate: Dayjs;
  address: string;
  phone1: string;
  phone2?: string;
  email?: string;
  whatsapp?: string;
}

const { Option } = Select;

const SECTION_STYLE: React.CSSProperties = {
  marginBottom: 24,
  padding: 24,
  background: '#fff',
  border: '1px solid #d9d9d9',
  borderRadius: 8
};

const SECTION_TITLE_STYLE: React.CSSProperties = {
  borderLeft: '4px solid #faad14',
  paddingLeft: 12,
  marginBottom: 24,
  fontSize: 18
};

const SUBTITLE_STYLE: React.CSSProperties = {
  color: '#1890ff',
  marginBottom: 16,
  borderBottom: '1px solid #f0f0f0',
  paddingBottom: 8,
  fontSize: 16
};

const RegisterRepresentative: React.FC = () => {
  const [form] = Form.useForm<RepresentativeFormValues>();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values: RepresentativeFormValues) => {
    setLoading(true);
    try {
      const payload = {
        ...values,
        birthdate: values.birthdate.format('YYYY-MM-DD'),
        roles: ['Representante']
      };
      await api.post('/auth/register', payload);
      message.success('Representante registrado exitosamente');
      form.resetFields();
    } catch (error: unknown) {
      console.error(error);
      const axiosError = error as AxiosError<{ message?: string }>;
      message.error(axiosError.response?.data?.message || 'Error al registrar al representante');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', paddingBottom: 40 }}>
      <Card title="Registro de Representantes">
        <Form
          layout="vertical"
          form={form}
          onFinish={handleSubmit}
          initialValues={{
            documentType: 'Venezolano',
            gender: 'F'
          }}
        >
          <div style={SECTION_STYLE}>
            <h3 style={SECTION_TITLE_STYLE}>Datos del Representante</h3>

            <div style={{ marginBottom: 24 }}>
              <h4 style={SUBTITLE_STYLE}>Credenciales de Acceso</h4>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="username"
                    label="Usuario"
                    rules={[{ required: true, message: 'Ingrese un nombre de usuario' }]}
                  >
                    <Input placeholder="Ej: mrodriguez" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="password"
                    label="Contraseña"
                    rules={[{ required: true, message: 'Ingrese una contraseña' }]}
                  >
                    <Input.Password />
                  </Form.Item>
                </Col>
              </Row>
            </div>

            <div style={{ marginBottom: 24 }}>
              <h4 style={SUBTITLE_STYLE}>Identidad</h4>
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
                    label="Tipo de Documento"
                    rules={[{ required: true }]}
                  >
                    <Select>
                      <Option value="Venezolano">Venezolano</Option>
                      <Option value="Extranjero">Extranjero</Option>
                      <Option value="Pasaporte">Pasaporte</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name="document"
                    label="Número de Documento"
                    rules={[{ required: true, message: 'Ingrese la cédula o pasaporte' }]}
                  >
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name="gender"
                    label="Género"
                    rules={[{ required: true }]}
                  >
                    <Radio.Group style={{ width: '100%' }}>
                      <Row>
                        <Col span={12}>
                          <Radio value="F">Femenino</Radio>
                        </Col>
                        <Col span={12}>
                          <Radio value="M">Masculino</Radio>
                        </Col>
                      </Row>
                    </Radio.Group>
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="birthdate"
                    label="Fecha de Nacimiento"
                    rules={[{ required: true, message: 'Seleccione la fecha de nacimiento' }]}
                  >
                    <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="address"
                    label="Dirección de Habitación"
                    rules={[{ required: true, message: 'Ingrese la dirección de habitación' }]}
                  >
                    <Input.TextArea rows={2} />
                  </Form.Item>
                </Col>
              </Row>
            </div>

            <div>
              <h4 style={SUBTITLE_STYLE}>Datos de Contacto</h4>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="phone1"
                    label="Teléfono Principal"
                    rules={[{ required: true, message: 'Ingrese un número de contacto' }]}
                  >
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="phone2"
                    label="Teléfono Secundario"
                  >
                    <Input />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="email" label="Email" rules={[{ type: 'email', message: 'Ingrese un correo válido' }]}>
                    <Input placeholder="Opcional" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="whatsapp" label="WhatsApp">
                    <Input placeholder="Opcional" />
                  </Form.Item>
                </Col>
              </Row>
            </div>
          </div>

          <Form.Item style={{ marginTop: 8 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              icon={<UserAddOutlined />}
              block
            >
              Registrar Representante
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default RegisterRepresentative;
