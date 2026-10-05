import { StrictMode } from 'react';
import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider } from 'antd';
import esES from 'antd/locale/es_ES';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import { registerSW } from 'virtual:pwa-register';
import { SchoolProvider, useSchool } from '@/context/SchoolContext';
import { AuthProvider } from '@/context/AuthContext';
import AttendanceApp from '@/pages/asistencias/AttendanceApp';
import '@/index.css';
import '@/utils/pwaInstall';

registerSW({ immediate: true });

dayjs.locale('es');

const Themed = ({ children }: { children: ReactNode }) => {
  const { settings } = useSchool();
  return (
    <ConfigProvider
      locale={esES}
      theme={{
        token: {
          colorPrimary: settings.themePrimaryColor || '#1e40af',
          borderRadius: 12,
          fontFamily: 'Inter, system-ui, sans-serif',
        },
      }}
    >
      {children}
    </ConfigProvider>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SchoolProvider>
      <Themed>
        <AuthProvider>
          <AttendanceApp />
        </AuthProvider>
      </Themed>
    </SchoolProvider>
  </StrictMode>,
);
