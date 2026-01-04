import api from '@/services/api';

export interface SchoolPeriod {
  id: number;
  name: string;
  period: string;
  isActive: boolean;
}

export interface ChecklistStatus {
  total: number;
  done: number;
}

export interface ClosureStatusResponse {
  period: SchoolPeriod;
  nextPeriod?: {
    id: number;
    name: string;
    period: string;
  } | null;
  closure?: {
    id: number;
    status: 'draft' | 'validating' | 'closed' | 'failed';
    startedAt?: string;
    finishedAt?: string;
  } | null;
  checklist: ChecklistStatus;
  blockedTerms: number;
  totalTerms: number;
}

export interface OutcomeRecord {
  id: number;
  inscriptionId: number;
  finalAverage: string | null;
  failedSubjects: number;
  status: 'aprobado' | 'materias_pendientes' | 'reprobado';
  promotionGrade?: {
    id: number;
    name: string;
  } | null;
  inscription: {
    id: number;
    grade?: { id: number; name: string };
    section?: { id: number; name: string } | null;
    student?: { id: number; firstName: string; lastName: string; document?: string };
    pendingSubjects?: PendingSubjectRecord[];
  };
}

export interface PendingSubjectRecord {
  id: number;
  status: 'pendiente' | 'aprobada' | 'convalidada';
  subjectId: number;
  subject?: { id: number; name: string };
  updatedAt: string;
  inscription?: {
    id: number;
    grade?: { id: number; name: string };
    section?: { id: number; name: string } | null;
    student?: { id: number; firstName: string; lastName: string };
  };
}

export const getActivePeriod = async () => {
  const { data } = await api.get<SchoolPeriod | null>('/academic/active');
  return data;
};

export const getClosureStatus = async (periodId: number) => {
  const { data } = await api.get<ClosureStatusResponse>(`/period-closure/${periodId}/status`);
  return data;
};

export const updateChecklistStatus = async (
  periodId: number,
  payload: { gradeId: number; sectionId: number; termId: number; status: 'open' | 'in_review' | 'done' }
) => {
  const { data } = await api.post(`/period-closure/${periodId}/checklist`, payload);
  return data;
};

export const getPeriodOutcomes = async (periodId: number, status?: OutcomeRecord['status']) => {
  const params = status ? { status } : undefined;
  const { data } = await api.get<OutcomeRecord[]>(`/periods/${periodId}/outcomes`, { params });
  return data;
};

export const getPendingSubjects = async (periodId: number) => {
  const { data } = await api.get<PendingSubjectRecord[]>(`/periods/${periodId}/pending-subjects`);
  return data;
};

export const resolvePendingSubject = async (
  pendingSubjectId: number,
  status: 'aprobada' | 'convalidada'
) => {
  const { data } = await api.post(`/periods/pending-subjects/${pendingSubjectId}/resolve`, { status });
  return data;
};

export interface ClosureValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ClosureExecutionResult {
  success: boolean;
  closureId: number;
  stats: {
    totalStudents: number;
    approved: number;
    withPendingSubjects: number;
    failed: number;
    newInscriptions: number;
    pendingSubjectsCreated: number;
  };
  errors: string[];
  log: Record<string, unknown>;
}

export const validatePeriodClosure = async (periodId: number) => {
  const { data } = await api.get<ClosureValidationResult>(`/period-closure/${periodId}/validate`);
  return data;
};

export const executePeriodClosure = async (periodId: number) => {
  const { data } = await api.post<ClosureExecutionResult>(`/period-closure/${periodId}/execute`);
  return data;
};

export const getPreviewOutcomes = async (periodId: number, status?: OutcomeRecord['status']) => {
  const params = status ? { status } : undefined;
  const { data } = await api.get<OutcomeRecord[]>(`/period-closure/${periodId}/preview`, { params });
  return data;
};
