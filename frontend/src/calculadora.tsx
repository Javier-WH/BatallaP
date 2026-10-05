import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider } from 'antd';
import esES from 'antd/locale/es_ES';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import { registerSW } from 'virtual:pwa-register';
import ExchangeCalculatorPage from '@/pages/shared/ExchangeCalculatorPage';
import '@/index.css';
import '@/utils/pwaInstall';

registerSW({ immediate: true });

dayjs.locale('es');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfigProvider locale={esES}
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
