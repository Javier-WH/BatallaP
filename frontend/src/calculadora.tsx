import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider } from 'antd';
import { registerSW } from 'virtual:pwa-register';
import ExchangeCalculatorPage from '@/pages/shared/ExchangeCalculatorPage';
import '@/index.css';

registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#1e40af',
          borderRadius: 12,
          fontFamily: 'Inter, system-ui, sans-serif',
        },
      }}
    >
      <ExchangeCalculatorPage />
    </ConfigProvider>
  </StrictMode>
);
