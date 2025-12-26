import React, { createContext, useContext, useEffect, useState } from 'react';
import api from '@/services/api';

interface SchoolSettings {
  name: string;
  logo: string;
  logoShape: 'circle' | 'square';
}

interface SchoolContextType {
  settings: SchoolSettings;
  activePeriod: any;
  loading: boolean;
  refreshSettings: () => Promise<void>;
}

const defaultSettings: SchoolSettings = {
  name: 'U.E. Colegio "Batalla de Carabobo"',
  logo: '/logo-placeholder.png', // Default placeholder
  logoShape: 'square'
};

const SchoolContext = createContext<SchoolContextType | undefined>(undefined);

export const SchoolProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<SchoolSettings>(defaultSettings);
  const [activePeriod, setActivePeriod] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [settingsRes, periodRes] = await Promise.all([
        api.get('/settings'),
        api.get('/academic/active')
      ]);

      const schoolName = settingsRes.data.institution_name;
      const schoolLogo = `http://localhost:3000/api/upload/logo?t=${Date.now()}`;
      const schoolLogoShape = settingsRes.data.institution_logo_shape || 'square';

      setSettings({
        name: schoolName || defaultSettings.name,
        logo: schoolLogo, // Always use the upload shortcut, it will fallback to img onError
        logoShape: schoolLogoShape as 'circle' | 'square'
      });
      setActivePeriod(periodRes.data);
    } catch (error) {
      console.error('Error fetching school data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <SchoolContext.Provider value={{ settings, activePeriod, loading, refreshSettings: fetchData }}>
      {children}
    </SchoolContext.Provider>
  );
};

export const useSchool = () => {
  const context = useContext(SchoolContext);
  if (!context) throw new Error('useSchool must be used within a SchoolProvider');
  return context;
};
