import api from './api';

export interface EnrollmentReportSummary {
  id: number;
  uuid: string;
  matriculationId: number;
  personId: number;
  snapshotData: SnapshotData;
  createdAt: string;
}

export interface GuardianSnapshot {
  firstName: string;
  lastName: string;
  documentType: string;
  document: string;
  phone: string;
  email: string;
  residenceState: string;
  residenceMunicipality: string;
  residenceParish: string;
  address: string;
  occupation?: string;
  birthdate?: string | null;
}

export interface SnapshotData {
  institution: {
    name: string;
    deaCode: string;
    logo: string;
  };
  period: { id: number; name: string };
  grade: { id: number; name: string };
  escolaridad: string;
  student: {
    firstName: string;
    lastName: string;
    documentType: string;
    document: string;
    gender: string;
    birthdate: string | null;
    pathology?: string;
    livingWith?: string;
    birthState?: string;
    birthMunicipality?: string;
    birthParish?: string;
    residenceState?: string;
    residenceMunicipality?: string;
    residenceParish?: string;
    phone1?: string;
    phone2?: string;
    email?: string;
    address?: string;
    whatsapp?: string;
  };
  mother?: GuardianSnapshot | null;
  father?: GuardianSnapshot | null;
  representative?: {
    relationship: string;
    data: GuardianSnapshot;
  } | null;
  previousSchools: Array<{
    plantelName: string;
    plantelCode?: string | null;
    state?: string | null;
  }>;
  enrollmentAnswers: Array<{
    prompt: string;
    answer: string | string[];
  }>;
  documents: {
    receivedCertificadoAprendizaje: boolean;
    receivedCartaBuenaConducta: boolean;
    receivedNotasCertificadas: boolean;
    receivedPartidaNacimiento: boolean;
    receivedCopiaCedulaEstudiante: boolean;
    receivedInformesMedicos: boolean;
    receivedFotoCarnetEstudiante: boolean;
  } | null;
}

export const generateReport = async (matriculationId: number): Promise<EnrollmentReportSummary> => {
  const { data } = await api.post<EnrollmentReportSummary>(`/enrollment-reports/generate/${matriculationId}`);
  return data;
};

export const getPersonReports = async (personId: number): Promise<EnrollmentReportSummary[]> => {
  const { data } = await api.get<EnrollmentReportSummary[]>(`/enrollment-reports/person/${personId}`);
  return data;
};

export const getReportByUuid = async (uuid: string): Promise<EnrollmentReportSummary> => {
  const { data } = await api.get<EnrollmentReportSummary>(`/enrollment-reports/${uuid}`);
  return data;
};
