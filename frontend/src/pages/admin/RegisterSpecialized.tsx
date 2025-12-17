import React, { useState } from 'react';
import { Form, Input, Button, DatePicker, Select, Radio, message, Card } from 'antd';
import api from '@/services/api';

const { Option } = Select;

interface RegisterSpecializedProps {
  roleTarget: 'Teacher' | 'Tutor';
  title: string;
}

const RegisterSpecialized: React.FC<RegisterSpecializedProps> = ({ roleTarget, title }) => {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      const payload = {
        ...values,
        birthdate: values.birthdate.format('YYYY-MM-DD'),
        roleName: roleTarget // Force fixed role
      };

      await api.post('/auth/register', payload);
      message.success(`${title} inscrito exitosamente`);
      form.resetFields();
    } catch (error: any) {
      console.error(error);
      message.error(error.response?.data?.message || 'Error al inscribir usuario');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <Card title={`Inscripción de ${title}`}>
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={{
            documentType: 'Venezolano',
            gender: 'M',
          }}
        >
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

          <div style={{ marginTop: 24, padding: 10, background: '#f9f9f9', borderRadius: 4, textAlign: 'center' }}>
            <span style={{ color: '#888' }}>
              Se asignará automáticamente el rol de <strong>{roleTarget === 'Teacher' ? 'Profesor' : 'Representante'}</strong>.
            </span>
          </div>

          <Form.Item style={{ marginTop: 16 }}>
            <Button type="primary" htmlType="submit" loading={loading} block>
              Registrar {title}
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default RegisterSpecialized;
