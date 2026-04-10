import api from '@/services/api';

export interface StudentPeriodOutcome {
  id: number;
  inscriptionId: number;
  finalAverage: number | null;
  failedSubjects: number;
  status: 'aprobado' | 'materias_pendientes' | 'reprobado';
  promotionGradeId: number | null;
  graduatedAt: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  inscription?: {
    id: number;
    schoolPeriodId: number;
    student?: {
      id: number;
      firstName: string;
      lastName: string;
    };
    grade?: {
      id: number;
      name: string;
    };
    section?: {
      id: number;
      name: string;
    };
  };
  promotionGrade?: {
    id: number;
    name: string;
  };
}

const periodOutcomeService = {
  getOutcomesForPeriod: async (periodId: number): Promise<StudentPeriodOutcome[]> => {
    const response = await api.get(`/academic/periods/${periodId}/outcomes`);
    return response.data;
  }
};

export default periodOutcomeService;
