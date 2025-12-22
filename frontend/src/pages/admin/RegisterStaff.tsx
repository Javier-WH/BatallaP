import React, { useState } from 'react';
import { Form, Input, Button, DatePicker, Select, Radio, message, Card, Checkbox, Space, Tag } from 'antd';
import { UserOutlined, TeamOutlined, AuditOutlined } from '@ant-design/icons';
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

const ROLE_OPTIONS = [
  { value: 'Profesor', label: 'Profesor', icon: <UserOutlined />, color: 'green' },
  { value: 'Representante', label: 'Representante', icon: <TeamOutlined />, color: 'blue' },
  { value: 'Control de Estudios', label: 'Control de Estudios', icon: <AuditOutlined />, color: 'purple' }
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
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <Card title="Inscripción de Personal">
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={{
            documentType: 'Venezolano',
            gender: 'M',
          }}
        >
          {/* Role Selection */}
          <div style={{
            marginBottom: 24,
            padding: 16,
            background: 'linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%)',
            borderRadius: 8,
            border: '1px solid #e0e0e0'
          }}>
            <h4 style={{ margin: 0, marginBottom: 12, color: '#333' }}>Tipo de Usuario</h4>
            <Space size="large" wrap>
              {ROLE_OPTIONS.map((role) => (
                <Checkbox
                  key={role.value}
                  checked={selectedRoles.includes(role.value)}
                  onChange={(e) => handleRoleChange(role.value, e.target.checked)}
                >
                  <Space>
                    {React.cloneElement(role.icon, { style: { color: selectedRoles.includes(role.value) ? role.color : '#999' } })}
                    <span style={{ fontWeight: selectedRoles.includes(role.value) ? 600 : 400 }}>{role.label}</span>
                  </Space>
                </Checkbox>
              ))}
            </Space>
            {selectedRoles.length === 0 && (
              <div style={{ marginTop: 8, color: '#ff4d4f', fontSize: 12 }}>
                ⚠️ Seleccione al menos un rol
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Account Info */}
            <div style={{ gridColumn: 'span 2' }}>
              <h4 style={{ margin: 0, marginBottom: 8, color: '#666' }}>Datos de Cuenta</h4>
            </div>
            <Form.Item
              name="username"
              label="Usuario"
              rules={[{ required: true }]}
            >
              <Input placeholder="Ej. jperez" />
            </Form.Item>

            <Form.Item
              name="password"
              label="Contraseña"
              rules={[{ required: true }]}
            >
              <Input.Password />
            </Form.Item>

            {/* Personal Info */}
            <div style={{ gridColumn: 'span 2', marginTop: 8 }}>
              <h4 style={{ margin: 0, marginBottom: 8, color: '#666' }}>Datos Personales</h4>
            </div>
            <Form.Item
              name="firstName"
              label="Nombre"
              rules={[{ required: true }]}
            >
              <Input />
            </Form.Item>

            <Form.Item
              name="lastName"
              label="Apellido"
              rules={[{ required: true }]}
            >
              <Input />
            </Form.Item>

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

            <Form.Item
              name="document"
              label="Número de Documento"
              rules={[{ required: true }]}
            >
              <Input />
            </Form.Item>

            <Form.Item
              name="gender"
              label="Género"
              rules={[{ required: true }]}
            >
              <Radio.Group>
                <Radio value="M">Masculino</Radio>
                <Radio value="F">Femenino</Radio>
              </Radio.Group>
            </Form.Item>

            <Form.Item
              name="birthdate"
              label="Fecha de Nacimiento"
              rules={[{ required: true }]}
            >
              <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
            </Form.Item>

            {/* Contact Info */}
            <div style={{ gridColumn: 'span 2', marginTop: 16 }}>
              <h4 style={{ margin: 0, marginBottom: 8, color: '#666' }}>Datos de Contacto</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Form.Item
                  name="address"
                  label="Dirección"
                  rules={[{ required: true }]}
                  style={{ gridColumn: 'span 2' }}
                >
                  <Input.TextArea rows={2} />
                </Form.Item>

                <Form.Item
                  name="phone1"
                  label="Teléfono Principal"
                  rules={[{ required: true }]}
                >
                  <Input />
                </Form.Item>

                <Form.Item name="phone2" label="Teléfono Secundario">
                  <Input />
                </Form.Item>

                <Form.Item name="email" label="Email" rules={[{ type: 'email' }]}>
                  <Input />
                </Form.Item>

                <Form.Item name="whatsapp" label="WhatsApp">
                  <Input />
                </Form.Item>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 24, padding: 12, background: '#f0f5ff', borderRadius: 8, textAlign: 'center', border: '1px solid #adc6ff' }}>
            <span style={{ color: '#1d39c4' }}>
              Se asignará el rol de: {' '}
              {selectedRoles.map(role => (
                <Tag
                  key={role}
                  color={role === 'Teacher' ? 'green' : role === 'Tutor' ? 'blue' : 'purple'}
                  style={{ marginLeft: 4 }}
                >
                  {role === 'Teacher' ? 'Profesor' : role === 'Tutor' ? 'Representante' : 'Control de Estudios'}
                </Tag>
              ))}
              {selectedRoles.length === 0 && <Tag color="error">Ninguno</Tag>}
            </span>
          </div>

          <Form.Item style={{ marginTop: 16 }}>
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
