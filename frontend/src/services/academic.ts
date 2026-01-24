import api from '@/services/api';

export const createPeriod = async (data: { period: string; name: string }) => {
  const { data: response } = await api.post('/academic/periods', data);
  return response;
};
