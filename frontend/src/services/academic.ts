import api from '@/services/api';

export const createPeriod = async (data: { period: string; name: string }) => {
  const { data: response } = await api.post('/academic/periods', data);
  return response;
};

/**
 * Guarantee that the school year following the active one exists and is flagged
 * as 'preinscripcion'. Uses the same backend function that the system uses when
 * activating a period. Requires an active period to exist.
 */
export const ensurePreinscriptionPeriod = async () => {
  const { data } = await api.post('/academic/periods/ensure-preinscription');
  return data;
};
