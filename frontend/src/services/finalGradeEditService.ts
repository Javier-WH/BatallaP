import api from '@/services/api';

export interface FinalGrade {
  id: number;
  inscriptionSubjectId: number;
  finalScore: number | null;
  rawScore: number | null;
  councilPoints: number | null;
  status: 'aprobada' | 'reprobada';
  calculatedAt: string;
  inscriptionSubject: {
    id: number;
    subject: {
      id: number;
      name: string;
    };
    inscription: {
      id: number;
      periodId: number;
      student: {
        id: number;
        firstName: string;
        lastName: string;
        document: string;
      };
      period: {
        id: number;
        name: string;
        period: string;
      };
      grade: {
        id: number;
        name: string;
      };
      section: {
        id: number;
        name: string;
      };
    };
  };
}

export interface UpdateFinalGradeData {
  finalScore: number;
  status: 'aprobada' | 'reprobada';
  reason: string;
  permissionId: number;
  inscriptionSubjectId?: number;
  actCode?: string;
}

const finalGradeEditService = {
  getFinalGradesByPeriod: async (schoolPeriodId: number): Promise<FinalGrade[]> => {
    const response = await api.get('/evaluation/final-grades-by-period', {
      params: { schoolPeriodId }
    });
    return response.data;
  },

  updateFinalGrade: async (id: string | number, data: UpdateFinalGradeData): Promise<{ message: string; finalGrade: FinalGrade }> => {
    console.log('[finalGradeEditService] Sending PUT request to:', `/evaluation/final-grade/${id}`, data);
    const response = await api.put(`/evaluation/final-grade/${id}`, data);
    console.log('[finalGradeEditService] Response:', response.data);
    return response.data;
  },

  checkPermission: async (schoolPeriodId: number): Promise<{ hasPermission: boolean; reason?: string }> => {
    const response = await api.get(`/grade-edit-permissions/check/${schoolPeriodId}`);
    return response.data;
  }
};

export default finalGradeEditService;
