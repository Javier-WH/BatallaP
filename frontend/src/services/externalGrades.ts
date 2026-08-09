import api from './api';

export type ExternalGradeType = 'transferencia' | 'equivalencia';
export type ExternalGradeStatus = 'aprobada' | 'reprobada';

export interface ExternalPlantel {
  id: number;
  code: string;
  name: string;
  state: string;
  dependency?: string | null;
  municipality?: string | null;
  parish?: string | null;
}

export interface ExternalSubject {
  id: number;
  name: string;
}

export interface ExternalGrade {
  id: number;
  inscriptionSubjectId: number;
  finalScore: number | null;
  status: ExternalGradeStatus;
  calculatedAt: string;
  plantelId: number | null;
  gradeType: ExternalGradeType | null;
  plantel?: ExternalPlantel | null;
  inscriptionSubject?: {
    id: number;
    subject: ExternalSubject;
    inscription: {
      id: number;
      student: { id: number; firstName: string; lastName: string; document: string };
      period: { id: number; name: string; period: string; isExternal?: boolean };
      grade: { id: number; name: string };
    };
  };
}

export interface ExternalInscription {
  id: number;
  schoolPeriodId: number;
  gradeId: number;
  personId: number;
  escolaridad: string;
  period?: { id: number; name: string; period: string; isExternal?: boolean };
  grade?: { id: number; name: string };
  inscriptionSubjects?: Array<{
    id: number;
    subject: ExternalSubject;
    finalGrade?: ExternalGrade | null;
  }>;
}

export interface PersonExternalGradesResponse {
  person: { id: number; firstName: string; lastName: string; document: string };
  inscriptions: ExternalInscription[];
}

export interface ResolvePlantelInput {
  code?: string | null;
  name: string;
  state?: string | null;
  dependency?: string | null;
  municipality?: string | null;
  parish?: string | null;
}

export interface CreateInscriptionInput {
  personId: number;
  periodLabel: string;
  periodName: string;
  startYear?: number;
  endYear?: number;
  gradeId: number;
  plantelId: number;
}

export interface UpsertGradeInput {
  inscriptionId: number;
  subjectId: number;
  finalScore: number;
  status: ExternalGradeStatus;
  plantelId: number;
  issuedAt: string;
  gradeType: ExternalGradeType;
  observations?: string | null;
}

export interface BulkEntry {
  personId: number;
  periodLabel: string;
  periodName: string;
  startYear?: number;
  endYear?: number;
  gradeId: number;
  plantel: ResolvePlantelInput;
  grades: Array<{
    subjectId: number;
    finalScore: number;
    status: ExternalGradeStatus;
    issuedAt: string;
    gradeType: ExternalGradeType;
  }>;
}

export async function getExternalGradesForPerson(personId: number): Promise<PersonExternalGradesResponse> {
  const { data } = await api.get<PersonExternalGradesResponse>(`/external-grades/persons/${personId}`);
  return data;
}

export async function listExternalGrades(params?: { personId?: number; plantelId?: number }): Promise<ExternalGrade[]> {
  const { data } = await api.get<ExternalGrade[]>('/external-grades/grades', { params });
  return data;
}

export async function listExternalSubjects(): Promise<ExternalSubject[]> {
  const { data } = await api.get<ExternalSubject[]>('/external-grades/subjects');
  return data;
}

export async function resolvePlantel(input: ResolvePlantelInput): Promise<ExternalPlantel> {
  const { data } = await api.post<ExternalPlantel>('/external-grades/planteles', input);
  return data;
}

export async function createExternalInscription(input: CreateInscriptionInput): Promise<ExternalInscription> {
  const { data } = await api.post<ExternalInscription>('/external-grades/inscriptions', input);
  return data;
}

export async function upsertExternalGrade(input: UpsertGradeInput): Promise<ExternalGrade> {
  const { data } = await api.post<ExternalGrade>('/external-grades/grades', input);
  return data;
}

export async function updateExternalGrade(id: number, patch: Partial<UpsertGradeInput>): Promise<ExternalGrade> {
  const { data } = await api.put<ExternalGrade>(`/external-grades/grades/${id}`, patch);
  return data;
}

export async function deleteExternalGrade(id: number): Promise<void> {
  await api.delete(`/external-grades/grades/${id}`);
}

export async function bulkRegisterExternalGrades(entries: BulkEntry[]): Promise<{ created: number; skipped: number }> {
  const { data } = await api.post<{ created: number; skipped: number }>('/external-grades/bulk', entries);
  return data;
}
