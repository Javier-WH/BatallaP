import React, { createContext, useContext, useEffect, useState } from 'react';
import api from '@/services/api';

interface SchoolSettings {
  name: string;
  logo: string;
  logoShape: 'circle' | 'square';
  themePrimaryColor: string;
  themeSecondaryColor: string; // This is now "Color Inactivo"
  themeBrandSecondary: string; // This is the NEW "Color Secundario"
  themeTextColor: string;
  themeSidebarColor: string;
  themePageBg: string;
  themePanelHeader: string;
  themeContentBg: string;
  themeAccentColor: string;
  themeHeaderText: string;
  themeInputBg: string;
  themeMutedTextColor: string;
}

interface SchoolContextType {
  settings: SchoolSettings;
  activePeriod: any;
  loading: boolean;
  refreshSettings: () => Promise<void>;
}

const defaultSettings: SchoolSettings = {
  name: 'U.E. Colegio "Batalla de Carabobo"',
  logo: '/logo-placeholder.png',
  logoShape: 'square',
  themePrimaryColor: '#1e40af',
  themeSecondaryColor: '#e2e8f0', // Inactive (slate-200ish)
  themeBrandSecondary: '#0ea5e9', // New Brand Secondary
  themeTextColor: '#0f172a',
  themeSidebarColor: '#0f172a',
  themePageBg: '#f8fafc',
  themePanelHeader: '#0f172a',
  themeContentBg: '#ffffff',
  themeAccentColor: '#1e40af',
  themeHeaderText: '#ffffff',
  themeInputBg: '#ffffff',
  themeMutedTextColor: '#94a3b8',
};

/** Applies all theme CSS vars to root */
function applyThemeToDOM(s: SchoolSettings) {
  const root = document.documentElement.style;
  root.setProperty('--color-brand-primary', s.themePrimaryColor);
  root.setProperty('--color-brand-secondary', s.themeBrandSecondary); // New one
  root.setProperty('--color-inactive', s.themeSecondaryColor); // Renamed in logic
  root.setProperty('--color-text-main', s.themeTextColor);
  root.setProperty('--color-luxury-sidebar', s.themeSidebarColor);
  root.setProperty('--color-page-bg', s.themePageBg);
  root.setProperty('--color-panel-header', s.themePanelHeader);
  root.setProperty('--color-content-bg', s.themeContentBg);
  root.setProperty('--color-accent', s.themeAccentColor);
  root.setProperty('--color-header-text', s.themeHeaderText);
  root.setProperty('--color-input-bg', s.themeInputBg);
  root.setProperty('--color-text-muted', s.themeMutedTextColor);
  root.setProperty('--ant-primary-color', s.themePrimaryColor);
}

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

      const d = settingsRes.data;
      const schoolName = d.institution_name;
      const schoolLogo = `http://localhost:3000/api/upload/logo?t=${Date.now()}`;
      const schoolLogoShape = d.institution_logo_shape || 'square';

      const resolved: SchoolSettings = {
        name: schoolName || defaultSettings.name,
        logo: schoolLogo,
        logoShape: schoolLogoShape as 'circle' | 'square',
        themePrimaryColor: d.theme_primary_color || defaultSettings.themePrimaryColor,
        themeSecondaryColor: d.theme_secondary_color || defaultSettings.themeSecondaryColor,
        themeBrandSecondary: d.theme_brand_secondary || defaultSettings.themeBrandSecondary,
        themeTextColor: d.theme_text_color || defaultSettings.themeTextColor,
        themeSidebarColor: d.theme_sidebar_color || defaultSettings.themeSidebarColor,
        themePageBg: d.theme_page_bg || defaultSettings.themePageBg,
        themePanelHeader: d.theme_panel_header || defaultSettings.themePanelHeader,
        themeContentBg: d.theme_content_bg || defaultSettings.themeContentBg,
        themeAccentColor: d.theme_accent_color || defaultSettings.themeAccentColor,
        themeHeaderText: d.theme_header_text_color || defaultSettings.themeHeaderText,
        themeInputBg: d.theme_input_bg || defaultSettings.themeInputBg,
        themeMutedTextColor: d.theme_muted_text_color || defaultSettings.themeMutedTextColor,
      };

      applyThemeToDOM(resolved);
      setSettings(resolved);
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
