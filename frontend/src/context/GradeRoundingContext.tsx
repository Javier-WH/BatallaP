import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import api from '@/services/api';

interface GradeRoundingContextType {
  enableRounding: boolean;
  loading: boolean;
  refreshSetting: () => Promise<void>;
}

const GradeRoundingContext = createContext<GradeRoundingContextType | undefined>(undefined);

export const useGradeRounding = () => {
  const context = useContext(GradeRoundingContext);
  if (context === undefined) {
    throw new Error('useGradeRounding must be used within a GradeRoundingProvider');
  }
  return context;
};

interface GradeRoundingProviderProps {
  children: ReactNode;
}

export const GradeRoundingProvider: React.FC<GradeRoundingProviderProps> = ({ children }) => {
  const [enableRounding, setEnableRounding] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchSetting = async () => {
    setLoading(true);
    try {
      const res = await api.get('/settings/enable_grade_rounding');
      setEnableRounding(res.data.value === 'true');
    } catch (error) {
      console.error('Error fetching grade rounding setting:', error);
      // Default to false on error
      setEnableRounding(false);
    } finally {
      setLoading(false);
    }
  };

  const refreshSetting = async () => {
    await fetchSetting();
  };

  useEffect(() => {
    fetchSetting();
  }, []);

  return (
    <GradeRoundingContext.Provider value={{ enableRounding, loading, refreshSetting }}>
      {children}
    </GradeRoundingContext.Provider>
  );
};
