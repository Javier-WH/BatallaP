import api from './api';

export type EnrollmentQuestionType = 'text' | 'select' | 'checkbox';

export interface EnrollmentQuestionResponse {
  id: number;
  prompt: string;
  description: string | null;
  type: EnrollmentQuestionType;
  options: string[] | null;
  required: boolean;
  isActive: boolean;
  order: number;
  answer?: string | string[] | null;
}

export interface QuestionPayload {
  prompt: string;
  description?: string | null;
  type: EnrollmentQuestionType;
  options?: string[] | null;
  required?: boolean;
}

export const getEnrollmentQuestions = async (includeInactive = true) => {
  const { data } = await api.get<EnrollmentQuestionResponse[]>(`/enrollment-questions`, {
    params: { includeInactive }
  });
  return data;
};

export const getEnrollmentQuestionsForPerson = async (personId: number) => {
  const { data } = await api.get<EnrollmentQuestionResponse[]>('/enrollment-questions', {
    params: { includeInactive: false, personId }
  });
  return data;
};

export const createEnrollmentQuestion = async (payload: QuestionPayload) => {
  const { data } = await api.post<EnrollmentQuestionResponse>('/enrollment-questions', payload);
  return data;
};

export const updateEnrollmentQuestion = async (id: number, payload: Partial<QuestionPayload>) => {
  const { data } = await api.put<EnrollmentQuestionResponse>(`/enrollment-questions/${id}`, payload);
  return data;
};

export const reorderEnrollmentQuestions = async (order: number[]) => {
  await api.patch('/enrollment-questions/reorder', { order });
};

export const setEnrollmentQuestionStatus = async (id: number, isActive: boolean) => {
  const { data } = await api.patch<EnrollmentQuestionResponse>(`/enrollment-questions/${id}/status`, {
    isActive
  });
  return data;
};
