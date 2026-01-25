import api from './api';

export type GuardianDocumentType = 'Venezolano' | 'Extranjero' | 'Pasaporte';

export interface GuardianProfileResponse {
  id: number;
  firstName: string;
  lastName: string;
  documentType: GuardianDocumentType;
  document: string;
  phone: string;
  email: string;
  residenceState: string;
  residenceMunicipality: string;
  residenceParish: string;
  address: string;
  birthdate?: string; // ISO string from backend
}

export const searchGuardian = async (
  documentType: GuardianDocumentType,
  document: string
): Promise<GuardianProfileResponse | null> => {
  try {
    const { data } = await api.get<GuardianProfileResponse>('/guardians/search', {
      params: {
        documentType,
        document
      }
    });
    return data;
  } catch (error: unknown) {
    const err = error as { response?: { status?: number } };
    if (err?.response?.status === 404) {
      return null;
    }
    throw error;
  }
};
