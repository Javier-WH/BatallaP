import React, { useState } from 'react';
import { Form, Input, Button, DatePicker, Select, Radio, message, Card } from 'antd';
import api from '@/services/api';

const { Option } = Select;

const RegisterUser: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      // Form values match backend expectation: 
      // username, password, firstName, lastName, documentType, document, gender, birthdate, roleName
      // Map 'roleName' manually if needed, or ensure form field name matches

      const payload = {
        ...values,
        birthdate: values.birthdate.format('YYYY-MM-DD') // Ensure date format
      };

      await api.post('/auth/register', payload); // Adjust endpoint if you create a specific admin-create-user endpoint, but using public register for now or update it in backend
      message.success('Usuario inscrito exitosamente');
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
      <Card title="Inscripción de Nuevo Usuario">
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={{
            documentType: 'Venezolano',
            gender: 'M',
            roleName: 'Student'
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Account Info */}
            <Form.Item
              name="username"
              label="Nombre de Usuario (Login)"
              rules={[{ required: true, message: 'Por favor ingrese el usuario' }]}
            >
              <Input placeholder="Ej. jdoe" />
            </Form.Item>

            <Form.Item
              name="password"
              label="Contraseña"
              rules={[{ required: true, message: 'Por favor ingrese la contraseña' }]}
            >
              <Input.Password placeholder="******" />
            </Form.Item>

            {/* Personal Info */}
            <Form.Item
              name="firstName"
              label="Nombre"
              rules={[{ required: true, message: 'Por favor ingrese el nombre' }]}
            >
              <Input placeholder="Juan" />
            </Form.Item>

            <Form.Item
              name="lastName"
              label="Apellido"
              rules={[{ required: true, message: 'Por favor ingrese el apellido' }]}
            >
              <Input placeholder="Perez" />
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
              rules={[{ required: true, message: 'Ingrese el número' }]}
            >
              <Input placeholder="12345678" />
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
              rules={[{ required: true, message: 'Seleccione fecha' }]}
            >
              <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
            </Form.Item>

            {/* Role Assignment */}
            <Form.Item
              name="roleName"
              label="Asignar Rol Inicial"
              rules={[{ required: true }]}
              style={{ gridColumn: 'span 2' }}
            >
              <Select placeholder="Selecciona un rol">
                <Option value="Student">Estudiante</Option>
                <Option value="Tutor">Representante</Option>
                <Option value="Teacher">Profesor</Option>
                <Option value="Admin">Admin</Option>
                <Option value="Master">Master</Option>
              </Select>
            </Form.Item>
          </div>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              Inscribir Usuario
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default RegisterUser;
