import React, { useEffect, useState } from 'react';
import { Button, Form, Input, Spin } from 'antd';
import { CalculatorOutlined, LockOutlined, UserOutlined } from '@ant-design/icons';
import api from '@/services/api';
import { getRatesAtDate } from '@/services/paymentsService';
import ExchangeRateCalculator from '@/components/ExchangeRateCalculator';

type PageStatus = 'checking' | 'login' | 'ready';

/**
 * Standalone exchange-rate calculator page.
 *
 * Publicly reachable (/calculadora and the installable calculadora.html PWA
 * entry), but the rates endpoint requires a session: without one the page
 * renders a compact inline login instead of redirecting to the main app.
 */
const ExchangeCalculatorPage: React.FC = () => {
  const [status, setStatus] = useState<PageStatus>('checking');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getRatesAtDate()
      .then(() => setStatus('ready'))
      .catch((err: any) => setStatus(err?.response?.status === 401 ? 'login' : 'ready'));
  }, []);

  const handleLogin = async (values: { username: string; password: string }) => {
    setSubmitting(true);
    setLoginError(null);
    try {
      await api.post('/auth/login', values);
      setStatus('ready');
    } catch (err: any) {
      setLoginError(err?.response?.data?.message || 'Usuario o contraseña incorrectos');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-start sm:items-center justify-center p-4"
      style={{ backgroundColor: 'var(--color-page-bg, #f8fafc)' }}
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-slate-100 p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center">
            <CalculatorOutlined className="text-xl text-blue-600" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-800 leading-tight m-0">Calculadora de Tasas</h1>
            <p className="text-xs text-slate-400 m-0">Conversión Bs ⇄ USD / EUR · Tasas BCV</p>
          </div>
        </div>

        {status === 'checking' && (
          <div className="flex justify-center py-12"><Spin /></div>
        )}

        {status === 'login' && (
          <>
            <p className="text-sm text-slate-500 mb-4">
              Inicia sesión con tu cuenta del sistema para usar la calculadora.
            </p>
            <Form layout="vertical" onFinish={handleLogin} requiredMark={false}>
              <Form.Item name="username" rules={[{ required: true, message: 'Ingresa tu usuario' }]}>
                <Input prefix={<UserOutlined />} placeholder="Usuario" size="large" autoComplete="username" />
              </Form.Item>
              <Form.Item name="password" rules={[{ required: true, message: 'Ingresa tu contraseña' }]}>
                <Input.Password prefix={<LockOutlined />} placeholder="Contraseña" size="large" autoComplete="current-password" />
              </Form.Item>
              {loginError && <p className="text-red-500 text-sm mb-3">{loginError}</p>}
              <Button type="primary" htmlType="submit" size="large" block loading={submitting}>
                Entrar
              </Button>
            </Form>
          </>
        )}

        {status === 'ready' && <ExchangeRateCalculator />}
      </div>
    </div>
  );
};

export default ExchangeCalculatorPage;
