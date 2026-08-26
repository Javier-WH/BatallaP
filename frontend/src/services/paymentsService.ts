import api from './api';

// ── Types ──

export interface ExchangeRateType {
  id: number;
  code: string;
  name: string;
  currency: string;
  isDefault: boolean;
  active: boolean;
}

export interface ExchangeRate {
  id: number;
  exchangeRateTypeId: number;
  rate: number;
  date: string;
  type?: ExchangeRateType;
}

export interface Fee {
  id: number;
  schoolPeriodId: number;
  key: 'mensualidad' | 'matricula' | 'gastos_administrativos';
  name: string;
  amount: number;
  exchangeRateTypeId: number;
  active: boolean;
  exchangeRateType?: ExchangeRateType;
  schoolPeriod?: { id: number; period: string; name: string };
}

export interface SellableItem {
  id: number;
  name: string;
  description: string | null;
  amount: number;
  exchangeRateTypeId: number;
  category: string | null;
  active: boolean;
  exchangeRateType?: ExchangeRateType;
}

export interface EnrollmentPlanItem {
  id: number;
  enrollmentPlanId: number;
  itemType: 'fee' | 'sellable_item';
  feeId: number | null;
  sellableItemId: number | null;
  quantity: number;
  fee?: Fee;
  sellableItem?: SellableItem;
}

export interface EnrollmentPlan {
  id: number;
  name: string;
  description: string | null;
  targetExchangeRateTypeId: number;
  conversionMode: 'exchange_rate' | 'same_amount';
  active: boolean;
  targetExchangeRateType?: ExchangeRateType;
  items?: EnrollmentPlanItem[];
}

export interface PlanCalculation {
  planId: number;
  planName: string;
  date: string;
  conversionMode: 'exchange_rate' | 'same_amount';
  breakdown: Array<{
    itemType: string;
    name: string;
    amount: number;
    currency: string;
    currencyName: string;
    exchangeRateTypeId: number;
    rate: number | null;
    quantity: number;
    totalVES: number | null;
    totalOriginal: number;
  }>;
  totalVES: number | null;
  totalOriginalSum: number;
  targetExchangeRateTypeId: number;
  targetCurrency: string;
  targetCurrencyName: string;
  targetRate: number | null;
  total: number | null;
  missingRates?: number[];
}

// ── Exchange Rate Types ──

export async function listExchangeRateTypes(): Promise<ExchangeRateType[]> {
  const { data } = await api.get<ExchangeRateType[]>('/payments/exchange-rate-types');
  return data;
}

export async function createExchangeRateType(payload: Partial<ExchangeRateType>): Promise<ExchangeRateType> {
  const { data } = await api.post<ExchangeRateType>('/payments/exchange-rate-types', payload);
  return data;
}

export async function updateExchangeRateType(id: number, payload: Partial<ExchangeRateType>): Promise<ExchangeRateType> {
  const { data } = await api.put<ExchangeRateType>(`/payments/exchange-rate-types/${id}`, payload);
  return data;
}

export async function deleteExchangeRateType(id: number): Promise<void> {
  await api.delete(`/payments/exchange-rate-types/${id}`);
}

// ── Exchange Rates ──

export async function listExchangeRates(params?: { typeId?: number; from?: string; to?: string; latest?: boolean }): Promise<ExchangeRate[]> {
  const { data } = await api.get<ExchangeRate[]>('/payments/exchange-rates', { params });
  return data;
}

export async function upsertExchangeRate(payload: { exchangeRateTypeId: number; rate: number; date: string }): Promise<ExchangeRate> {
  const { data } = await api.post<ExchangeRate>('/payments/exchange-rates', payload);
  return data;
}

export async function bulkImportExchangeRates(rates: Array<{ exchangeRateTypeId: number; rate: number; date: string }>): Promise<{ message: string; inserted: number; updated: number }> {
  const { data } = await api.post('/payments/exchange-rates/bulk', { rates });
  return data;
}

// ── Fees ──

export async function listFees(params?: { schoolPeriodId?: number }): Promise<Fee[]> {
  const { data } = await api.get<Fee[]>('/payments/fees', { params });
  return data;
}

export async function upsertFee(payload: Partial<Fee>): Promise<Fee> {
  const { data } = await api.post<Fee>('/payments/fees', payload);
  return data;
}

export async function updateFee(id: number, payload: Partial<Fee>): Promise<Fee> {
  const { data } = await api.put<Fee>(`/payments/fees/${id}`, payload);
  return data;
}

// ── Sellable Items ──

export async function listSellableItems(params?: { active?: boolean; category?: string }): Promise<SellableItem[]> {
  const { data } = await api.get<SellableItem[]>('/payments/sellable-items', { params });
  return data;
}

export async function createSellableItem(payload: Partial<SellableItem>): Promise<SellableItem> {
  const { data } = await api.post<SellableItem>('/payments/sellable-items', payload);
  return data;
}

export async function updateSellableItem(id: number, payload: Partial<SellableItem>): Promise<SellableItem> {
  const { data } = await api.put<SellableItem>(`/payments/sellable-items/${id}`, payload);
  return data;
}

export async function deleteSellableItem(id: number): Promise<void> {
  await api.delete(`/payments/sellable-items/${id}`);
}

// ── Enrollment Plans ──

export async function listEnrollmentPlans(params?: { active?: boolean }): Promise<EnrollmentPlan[]> {
  const { data } = await api.get<EnrollmentPlan[]>('/payments/enrollment-plans', { params });
  return data;
}

export async function getEnrollmentPlan(id: number): Promise<EnrollmentPlan> {
  const { data } = await api.get<EnrollmentPlan>(`/payments/enrollment-plans/${id}`);
  return data;
}

export async function createEnrollmentPlan(payload: Partial<EnrollmentPlan> & { items?: any[] }): Promise<EnrollmentPlan> {
  const { data } = await api.post<EnrollmentPlan>('/payments/enrollment-plans', payload);
  return data;
}

export async function updateEnrollmentPlan(id: number, payload: Partial<EnrollmentPlan> & { items?: any[] }): Promise<EnrollmentPlan> {
  const { data } = await api.put<EnrollmentPlan>(`/payments/enrollment-plans/${id}`, payload);
  return data;
}

export async function deleteEnrollmentPlan(id: number): Promise<void> {
  await api.delete(`/payments/enrollment-plans/${id}`);
}

export async function calculateEnrollmentPlan(id: number, date?: string): Promise<PlanCalculation> {
  const { data } = await api.get<PlanCalculation>(`/payments/enrollment-plans/${id}/calculate`, {
    params: date ? { date } : undefined,
  });
  return data;
}
