import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Button, Form, Input, message } from 'antd';
import { CheckSquareOutlined, LockOutlined, UserOutlined } from '@ant-design/icons';
import api from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { useSchool } from '@/context/SchoolContext';
import { usePwaInstall } from '@/hooks/usePwaInstall';
import InstallAppButton from '@/components/InstallAppButton';
import TeacherAttendanceTab from './TeacherAttendanceTab';

/**
 * Standalone, installable "Tomar Asistencia" app (asistencias.html): only the teacher
 * attendance view, with its own inline login. The install button sits in a slim header that
 * disappears once the app is installed, so the installed app gets the whole screen.
 */
const AttendanceApp: React.FC = () => {
  const { user, login, logout } = useAuth();
  const { refreshSettings } = useSchool();
  const { installed } = usePwaInstall();
  const [submitting, setSubmitting] = useState(false);

  // An installed app must not pull-to-refresh / rubber-band the page while the roster is dragged.
  useEffect(() => {
    document.documentElement.style.overscrollBehaviorY = 'none';
    document.body.style.overscrollBehaviorY = 'none';
  }, []);

  const handleLogin = async (values: { username: string; password: string }) => {
    setSubmitting(true);
    try {
      const { data } = await api.post('/auth/login', values);
      login(data.user);
      refreshSettings();
    } catch (err) {
      message.error((axios.isAxiosError(err) && err.response?.data?.message) || 'Usuario o contraseña incorrectos');
    } finally {
      setSubmitting(false);
    }
  };

  const card = (content: React.ReactNode) => (
    <div className="min-h-dvh flex items-start sm:items-center justify-center p-4" style={{ backgroundColor: 'var(--color-page-bg, #f8fafc)' }}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-slate-100 p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center">
            <CheckSquareOutlined className="text-xl text-blue-600" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-black text-slate-800 leading-tight m-0">Tomar Asistencia</h1>
            <p className="text-xs text-slate-400 m-0">Para profesores</p>
          </div>
          <InstallAppButton />
        </div>
        {content}
      </div>
    </div>
  );

  if (!user) {
    return card(
      <Form layout="vertical" onFinish={handleLogin} requiredMark={false}>
        <Form.Item name="username" rules={[{ required: true, message: 'Ingresa tu usuario' }]}>
          <Input prefix={<UserOutlined />} placeholder="Usuario" size="large" autoComplete="username" />
        </Form.Item>
        <Form.Item name="password" rules={[{ required: true, message: 'Ingresa tu contraseña' }]}>
          <Input.Password prefix={<LockOutlined />} placeholder="Contraseña" size="large" autoComplete="current-password" />
        </Form.Item>
        <Button type="primary" htmlType="submit" size="large" block loading={submitting}>Entrar</Button>
      </Form>,
    );
  }

  if (!user.roles.includes('Profesor')) {
    return card(
      <>
        <p className="text-sm text-slate-500">Esta aplicación es solo para profesores. Tu cuenta no tiene el rol de Profesor.</p>
        <Button block onClick={logout}>Cerrar sesión</Button>
      </>,
    );
  }

  return (
    <div className="h-dvh flex flex-col" style={{ backgroundColor: 'var(--color-page-bg, #f8fafc)' }}>
      {!installed && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 bg-white border-b border-slate-100">
          <span className="text-sm font-bold text-slate-700">Tomar Asistencia</span>
          <InstallAppButton />
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <TeacherAttendanceTab fill />
      </div>
    </div>
  );
};

export default AttendanceApp;
