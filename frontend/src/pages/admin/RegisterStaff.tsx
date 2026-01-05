import React, { useState } from 'react';
import {
  Form,
  Input,
  Button,
  DatePicker,
  Select,
  Radio,
  message,
  Card,
  Checkbox,
  Space,
  Tag,
  Row,
  Col
} from 'antd';
import { UserOutlined, AuditOutlined } from '@ant-design/icons';
import api from '@/services/api';
import type { AxiosError } from 'axios';
import type { Dayjs } from 'dayjs';

interface StaffFormValues {
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

const ROLE_OPTIONS = [
  {
    value: 'Profesor',
    label: 'Profesor',
    icon: <UserOutlined />,
    color: 'green',
    description: 'Gestiona calificaciones, evaluaciones y planificación académica.'
  },
  {
    value: 'Control de Estudios',
    label: 'Control de Estudios',
    icon: <AuditOutlined />,
    color: 'purple',
    description: 'Administra inscripciones, documentos y procesos académicos.'
  }
];

const RegisterStaff: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [form] = Form.useForm();

  const onFinish = async (values: StaffFormValues) => {
    if (selectedRoles.length === 0) {
      message.warning('Debe seleccionar al menos un rol');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...values,
        birthdate: values.birthdate.format('YYYY-MM-DD'),
        roles: selectedRoles // Send array of roles
      };

      await api.post('/auth/register', payload);

      const rolesText = selectedRoles.join(' y ');
      message.success(`${rolesText} inscrito exitosamente`);
      form.resetFields();
      setSelectedRoles([]); // Reset to empty
    } catch (error: unknown) {
      console.error(error);
      const axiosError = error as AxiosError<{ message?: string }>;
      message.error(axiosError.response?.data?.message || 'Error al inscribir usuario');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = (role: string, checked: boolean) => {
    if (checked) {
      setSelectedRoles([...selectedRoles, role]);
    } else {
      setSelectedRoles(selectedRoles.filter(r => r !== role));
    }
  };

  const getRoleLabel = () => {
    if (selectedRoles.length === 0) return 'Sin rol seleccionado';
    return selectedRoles.join(' y ');
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', paddingBottom: 40 }}>
      <Card title="Inscripción de Personal">
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={{
            documentType: 'Venezolano',
            gender: 'M'
          }}
        >
          <div style={SECTION_STYLE}>
            <h3 style={SECTION_TITLE_STYLE}>Roles y Accesos</h3>
            <p style={{ color: '#595959', marginBottom: 24 }}>
              Seleccione los roles que tendrá el nuevo usuario. Puede asignar múltiples funciones si el personal
              necesita operar en distintos módulos.
            </p>
            <Row gutter={[16, 16]}>
              {ROLE_OPTIONS.map((role) => {
                const isSelected = selectedRoles.includes(role.value);
                return (
                  <Col span={12} key={role.value}>
                    <div
                      style={{
                        border: `1px solid ${isSelected ? '#1890ff' : '#f0f0f0'}`,
                        borderRadius: 8,
                        padding: 16,
                        height: '100%',
                        background: isSelected ? 'rgba(24, 144, 255, 0.04)' : '#fafafa'
                      }}
                    >
                      <Checkbox
                        checked={isSelected}
                        onChange={(e) => handleRoleChange(role.value, e.target.checked)}
                      >
                        <Space align="start">
                          {React.cloneElement(role.icon, {
                            style: { color: isSelected ? role.color : '#bfbfbf', fontSize: 20 }
                          })}
                          <div>
                            <div style={{ fontWeight: 600 }}>{role.label}</div>
                            <div style={{ color: '#8c8c8c', fontSize: 12 }}>{role.description}</div>
                          </div>
                        </Space>
                      </Checkbox>
                    </div>
                  </Col>
                );
              })}
            </Row>
            {selectedRoles.length === 0 && (
              <div style={{ marginTop: 12, color: '#ff4d4f', fontSize: 12 }}>
                ⚠️ Seleccione al menos un rol para continuar.
              </div>
            )}
          </div>

          <div style={SECTION_STYLE}>
            <h3 style={SECTION_TITLE_STYLE}>Datos del Personal</h3>

            <div style={{ marginBottom: 24 }}>
              <h4 style={SUBTITLE_STYLE}>Credenciales de Acceso</h4>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="username" label="Usuario" rules={[{ required: true }]}>
                    <Input placeholder="Ej. jperez" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="password" label="Contraseña" rules={[{ required: true }]}>
                    <Input.Password />
                  </Form.Item>
                </Col>
              </Row>
            </div>

            <div style={{ marginBottom: 24 }}>
              <h4 style={SUBTITLE_STYLE}>Identidad</h4>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="firstName" label="Nombre" rules={[{ required: true }]}>
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="lastName" label="Apellido" rules={[{ required: true }]}>
                    <Input />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="documentType" label="Tipo de Documento" rules={[{ required: true }]}>
                    <Select>
                      <Option value="Venezolano">Venezolano</Option>
                      <Option value="Extranjero">Extranjero</Option>
                      <Option value="Pasaporte">Pasaporte</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="document" label="Número de Documento" rules={[{ required: true }]}>
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="gender" label="Género" rules={[{ required: true }]}>
                    <Radio.Group style={{ width: '100%' }}>
                      <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
                        <Radio value="M">Masculino</Radio>
                        <Radio value="F">Femenino</Radio>
                      </Space>
                    </Radio.Group>
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="birthdate" label="Fecha de Nacimiento" rules={[{ required: true }]}>
                    <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="address" label="Dirección" rules={[{ required: true }]}>
                    <Input.TextArea rows={2} />
                  </Form.Item>
                </Col>
              </Row>
            </div>

            <div>
              <h4 style={SUBTITLE_STYLE}>Datos de Contacto</h4>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="phone1" label="Teléfono Principal" rules={[{ required: true }]}>
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="phone2" label="Teléfono Secundario">
                    <Input />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="email" label="Email" rules={[{ type: 'email' }]}>
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="whatsapp" label="WhatsApp">
                    <Input />
                  </Form.Item>
                </Col>
              </Row>
            </div>
          </div>

          <div
            style={{
              marginBottom: 24,
              padding: 16,
              borderRadius: 8,
              border: '1px dashed #91d5ff',
              background: '#e6f7ff'
            }}
          >
            <div style={{ color: '#0050b3', fontWeight: 500, marginBottom: 8 }}>Resumen de roles</div>
            <div>
              {selectedRoles.length > 0 ? (
                selectedRoles.map((role) => (
                  <Tag
                    key={role}
                    color={role === 'Profesor' ? 'green' : 'purple'}
                    style={{ marginBottom: 8 }}
                  >
                    {role}
                  </Tag>
                ))
              ) : (
                <Tag color="error">Ninguno</Tag>
              )}
            </div>
          </div>

          <Form.Item style={{ marginTop: 8 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              disabled={selectedRoles.length === 0}
            >
              Registrar {getRoleLabel()}
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default RegisterStaff;
