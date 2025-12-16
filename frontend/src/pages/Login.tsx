import React from 'react';
import { Form, Input, Button, Card, Typography, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useAuth } from '@/context/AuthContext';
import api from '@/services/api';
import { useNavigate } from 'react-router-dom';

const { Title } = Typography;

const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = React.useState(false);

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', values);
      message.success('Bienvenido el sistema');
      login(data.user);
      navigate('/dashboard'); // Redirect to dashboard
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f0f2f5' }}>
      <Card style={{ width: 400, boxShadow: '0 4px 8px rgba(0,0,0,0.1)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={2}>Sistema Escolar</Title>
          <p>Ingresa tus credenciales</p>
        </div>
        <Form
          name="normal_login"
          className="login-form"
          initialValues={{ remember: true }}
          onFinish={onFinish}
          size="large"
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: 'Por favor ingresa tu usuario!' }]}
          >
            <Input prefix={<UserOutlined className="site-form-item-icon" />} placeholder="Usuario" />
          </Form.Item>
          <Form.Item
            name="password"
            rules={[{ required: true, message: 'Por favor ingresa tu contraseña!' }]}
          >
            <Input
              prefix={<LockOutlined className="site-form-item-icon" />}
              type="password"
              placeholder="Contraseña"
            />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" className="login-form-button" block loading={loading}>
              Iniciar Sesión
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default Login;
