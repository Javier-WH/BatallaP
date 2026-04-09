import api from './api';

export type PreviewRow = {
  rowNumber: number;
  errors: string[];
  payload?: Record<string, unknown>;
};

export type PreviewResponse = {
  rows: PreviewRow[];
  total: number;
  valid: number;
  invalid: number;
};

export type ProcessResponse = {
  total: number;
  processed: number;
  results: Array<{
    rowNumber: number;
    success: boolean;
    message: string;
  }>;
};

export type RetrySingleResponse = {
  success: boolean;
  message: string;
  nameConflict?: boolean;
  existingPerson?: {
    id: number;
    firstName: string;
    lastName: string;
    document: string;
  };
  personId?: number;
  matriculationId?: number;
};

export const downloadTemplate = async () => {
  const response = await api.get<ArrayBuffer>('/inscriptions/bulk/template', {
    responseType: 'arraybuffer'
  });
  return response.data;
};

export const previewBulk = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post<PreviewResponse>('/inscriptions/bulk/preview', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return data;
};

export const processBulk = async (rows: PreviewRow[]) => {
  const validRows = rows.filter((row) => row.payload && row.errors.length === 0);
  const { data } = await api.post<ProcessResponse>('/inscriptions/bulk/process', {
    rows: validRows
  });
  return data;
};

export const retrySingleRow = async (
  payload: Record<string, unknown>,
  updateExistingName = false
): Promise<RetrySingleResponse> => {
  const { data } = await api.post<RetrySingleResponse>('/inscriptions/bulk/retry-single', {
    payload,
    updateExistingName
  });
  return data;
};
