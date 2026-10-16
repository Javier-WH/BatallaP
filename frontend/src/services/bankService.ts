import api from './api';

export interface Bank {
  id: number;
  code: string;
  name: string;
  shortName: string;
  rif: string | null;
  icon: string | null;
  active: boolean;
}

export async function listBanks(params?: { active?: boolean }): Promise<Bank[]> {
  const { data } = await api.get<Bank[]>('/banks', {
    params: params?.active ? { active: '1' } : undefined,
  });
  return data;
}

const toFormData = (bank: Partial<Bank>, icon?: File | null) => {
  const fd = new FormData();
  if (bank.code !== undefined) fd.append('code', bank.code);
  if (bank.name !== undefined) fd.append('name', bank.name);
  if (bank.shortName !== undefined) fd.append('shortName', bank.shortName);
  if (bank.rif !== undefined) fd.append('rif', bank.rif ?? '');
  if (bank.active !== undefined) fd.append('active', String(bank.active));
  if (icon) fd.append('icon', icon);
  return fd;
};

export async function createBank(bank: Partial<Bank>, icon?: File | null): Promise<Bank> {
  const { data } = await api.post<Bank>('/banks', toFormData(bank, icon), {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function updateBank(id: number, bank: Partial<Bank>, icon?: File | null): Promise<Bank> {
  const { data} = await api.put<Bank>(`/banks/${id}`, toFormData(bank, icon), {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}
