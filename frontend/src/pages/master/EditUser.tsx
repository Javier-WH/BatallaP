import React, { useState, useEffect } from 'react';
import { Form, Input, Button, DatePicker, Select, Radio, message, Card, Spin } from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import api from '@/services/api';
import dayjs from 'dayjs';

const { Option } = Select;

const EditUser: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data } = await api.get(`/users/${id}`);
        // Map data to form fields
        form.setFieldsValue({
          firstName: data.firstName,
          lastName: data.lastName,
          documentType: data.documentType,
          document: data.document,
          gender: data.gender,
          birthdate: data.birthdate ? dayjs(data.birthdate) : null,

          // User Data
          username: data.user?.username,
          // Password left blank intentionally

          // Contact
          address: data.contact?.address,
          phone1: data.contact?.phone1,
          phone2: data.contact?.phone2,
          email: data.contact?.email,
          whatsapp: data.contact?.whatsapp,

          // Role (Multi-select)
          roles: data.roles?.map((r: any) => r.name)
        });
      } catch (error) {
        console.error(error);
        message.error('Error al cargar datos del usuario');
        navigate('/master/search');
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchUser();
  }, [id, form, navigate]);


  const onFinish = async (values: any) => {
    setSubmitting(true);
    try {
      const payload = {
        ...values,
        birthdate: values.birthdate ? values.birthdate.format('YYYY-MM-DD') : null
      };

      await api.put(`/users/${id}`, payload);
      message.success('Usuario actualizado exitosamente');
      navigate('/master/search');
    } catch (error: any) {
      console.error(error);
      message.error(error.response?.data?.message || 'Error al actualizar usuario');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 50 }}><Spin size="large" /></div>;

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <Card title="Editar Usuario" extra={<Button onClick={() => navigate('/master/search')}>Volver</Button>}>
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Account Info */}
            <div style={{ gridColumn: 'span 2' }}>
              <h4 style={{ margin: 0, marginBottom: 8, color: '#666' }}>Credenciales de Acceso</h4>
            </div>
            <Form.Item
              name="username"
              label="Usuario"
              rules={[{ required: true }]}
            >
              <Input />
            </Form.Item>

            <Form.Item
              name="password"
              label="Nueva Contraseña (Dejar en blanco para no cambiar)"
            >
              <Input.Password placeholder="******" />
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
                <Option value="Cedula Escolar">Cédula Escolar</Option>
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
                <Radio value="M">M</Radio>
                <Radio value="F">F</Radio>
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

                <Form.Item
                  name="phone2"
                  label="Teléfono Secundario"
                >
                  <Input />
                </Form.Item>

                <Form.Item
                  name="email"
                  label="Email"
                  rules={[{ type: 'email' }]}
                >
                  <Input />
                </Form.Item>

                <Form.Item
                  name="whatsapp"
                  label="WhatsApp"
                >
                  <Input />
                </Form.Item>
              </div>
            </div>

            {/* Role Assignment */}
            <div style={{ gridColumn: 'span 2', marginTop: 8 }}>
              <h4 style={{ margin: 0, marginBottom: 8, color: '#666' }}>Permisos del Sistema</h4>
            </div>
            <Form.Item
              name="roles"
              label="Roles Asignados"
              rules={[{ required: true, message: 'Seleccione al menos un rol' }]}
              style={{ gridColumn: 'span 2' }}
            >
              <Select mode="multiple" placeholder="Selecciona roles">
                <Option value="Student">Estudiante</Option>
                <Option value="Tutor">Representante</Option>
                <Option value="Teacher">Profesor</Option>
                <Option value="Admin">Admin</Option>
                <Option value="Master">Master</Option>
              </Select>
            </Form.Item>
          </div>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={submitting} block size="large">
              Guardar Cambios
            </Button>
          </Form.Item>

          <Form.Item>
            <Button danger block onClick={() => navigate('/master/search')}>
              Cancelar
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default EditUser;
