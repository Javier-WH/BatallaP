import React, { useState } from 'react';
import { Form, Input, Button, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-200 via-slate-100 to-white overflow-hidden relative">
      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
        <div className="absolute -top-[20%] -left-[10%] w-[70vh] h-[70vh] rounded-full bg-brand-primary/5 blur-3xl animate-pulse" />
        <div className="absolute top-[40%] -right-[10%] w-[60vh] h-[60vh] rounded-full bg-blue-400/5 blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="w-full max-w-md px-6 relative z-10">
        <div className="bg-white rounded-[2.5rem] shadow-2xl p-8 pt-20 relative animate-in fade-in slide-in-from-bottom-8 duration-700">

          {/* Floating Logo - Half inside/outside */}
          <div className="absolute -top-16 left-1/2 -translate-x-1/2">
            <div
              className="bg-white p-2 shadow-2xl flex items-center justify-center relative z-20"
              style={{
                borderRadius: settings.logoShape === 'circle' ? '50%' : '1.5rem',
                width: '128px',
                height: '128px'
              }}
            >
              <div
                className="absolute inset-0 bg-gradient-to-b from-brand-primary/10 to-transparent z-0"
                style={{ borderRadius: settings.logoShape === 'circle' ? '50%' : '1.5rem' }}
              />
              <img
                src={settings.logo}
                alt="Logo"
                className="w-full h-full object-contain relative z-10 p-2"
                style={{ borderRadius: settings.logoShape === 'circle' ? '50%' : '1rem' }}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://cdn-icons-png.flaticon.com/512/2940/2940651.png';
                }}
              />
            </div>
          </div>

          <div className="text-center mb-8 space-y-1">
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">{settings.name}</h2>
            <p className="text-slate-400 font-medium text-sm">Bienvenido de nuevo</p>
          </div>

          <Form
            name="login"
            onFinish={onFinish}
            autoComplete="off"
            size="large"
            className="space-y-4"
          >
            <Form.Item
              name="username"
              rules={[{ required: true, message: 'Ingresa tu usuario' }]}
              className="mb-4"
            >
              <Input
                prefix={<UserOutlined className="text-slate-400 mr-3 text-lg" />}
                placeholder="Usuario"
                className="bg-slate-100 border-none rounded-2xl h-14 px-4 font-medium text-slate-700 hover:bg-slate-200/80 focus:bg-white focus:ring-2 focus:ring-brand-primary/20 transition-all placeholder:text-slate-400"
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: 'Ingresa tu contraseña' }]}
              className="mb-2"
            >
              <Input.Password
                prefix={<LockOutlined className="text-slate-400 mr-3 text-lg" />}
                placeholder="Contraseña"
                className="bg-slate-100 border-none rounded-2xl h-14 px-4 font-medium text-slate-700 hover:bg-slate-200/80 focus:bg-white focus:ring-2 focus:ring-brand-primary/20 transition-all placeholder:text-slate-400"
              />
            </Form.Item>

            <div className="flex items-center justify-between text-xs font-bold text-slate-500 px-2 mb-6">
              <label className="flex items-center gap-2 cursor-pointer hover:text-brand-primary transition-colors">
                <input type="checkbox" className="rounded text-brand-primary focus:ring-brand-primary" />
                Recordarme
              </label>
              <a href="#" className="hover:text-brand-primary transition-colors">¿Olvidaste tu clave?</a>
            </div>

            <Form.Item className="mb-0">
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                className="w-full h-14 bg-brand-primary hover:bg-brand-secondary border-none text-white font-black rounded-2xl shadow-lg shadow-brand-primary/30 text-base tracking-wide hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                INICIAR SESIÓN
              </Button>
            </Form.Item>
          </Form>

          <div className="text-center mt-8">
            <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">
              Gestión Escolar Premium &copy; {new Date().getFullYear()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
