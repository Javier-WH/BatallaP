import React, { useState } from 'react';
import { Form, Input, Button, message } from 'antd';
import { UserOutlined, LockOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { useAuth } from '@/context/AuthContext';
import { useSchool } from '@/context/SchoolContext';
import api from '@/services/api';
import { useNavigate } from 'react-router-dom';

const Login: React.FC = () => {
  const { login } = useAuth();
  const { settings } = useSchool();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', values);
      message.success('Bienvenido el sistema');
      login(data.user);
      navigate('/dashboard');
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-slate-100 via-slate-200 to-slate-300 overflow-hidden relative">
      {/* Decorative Orbs */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-brand-primary/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-brand-secondary/10 rounded-full blur-3xl animate-pulse" />

      <div className="w-full max-w-md p-4 relative z-10">
        <div className="glass-card p-10 space-y-8">
          <div className="text-center space-y-4">
            <div className="relative inline-block">
              <div
                className="absolute -inset-1 bg-gradient-to-r from-brand-primary to-brand-secondary blur opacity-25 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"
                style={{ borderRadius: settings.logoShape === 'circle' ? '50%' : '1rem' }}
              ></div>
              <img
                src={settings.logo}
                alt="Logo"
                className="relative w-24 h-24 mx-auto object-contain bg-white p-2 shadow-inner border border-slate-100"
                style={{ borderRadius: settings.logoShape === 'circle' ? '50%' : '1rem' }}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://cdn-icons-png.flaticon.com/512/2940/2940651.png'; // Fallback
                }}
              />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{settings.name}</h1>
              <p className="text-slate-500 font-medium">Panel Administrativo Institucional</p>
            </div>
          </div>

          <Form
            name="login"
            layout="vertical"
            onFinish={onFinish}
            autoComplete="off"
            requiredMark={false}
          >
            <Form.Item
              label={<span className="text-slate-600 font-semibold px-1">Usuario</span>}
              name="username"
              rules={[{ required: true, message: 'Ingresa tu usuario' }]}
            >
              <Input
                prefix={<UserOutlined className="text-slate-400 mr-2" />}
                className="h-12 border-slate-200 focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 transition-all font-medium"
                placeholder="Ej. jdoe"
              />
            </Form.Item>

            <Form.Item
              label={<span className="text-slate-600 font-semibold px-1">Contraseña</span>}
              name="password"
              rules={[{ required: true, message: 'Ingresa tu contraseña' }]}
            >
              <Input.Password
                prefix={<LockOutlined className="text-slate-400 mr-2" />}
                className="h-12 border-slate-200 focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 transition-all font-medium"
                placeholder="••••••••"
              />
            </Form.Item>

            <div className="pt-2">
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                className="w-full h-12 bg-slate-900 hover:bg-slate-800 border-none text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 group transition-all"
              >
                <span>Acceder al Sistema</span>
                <ArrowRightOutlined className="group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </Form>

          <div className="text-center pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-400 font-medium uppercase tracking-widest">
              &copy; {new Date().getFullYear()} Gestión Escolar Premium
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
