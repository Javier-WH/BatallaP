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
  schoolPeriodId: number;
  targetExchangeRateTypeId: number;
  conversionMode: 'exchange_rate' | 'same_amount';
  active: boolean;
  targetExchangeRateType?: ExchangeRateType;
  schoolPeriod?: { id: number; period: string; name?: string };
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

export interface RateAtDate {
  typeId: number;
  code: string;
  name: string;
  currency: string;
  rate: number | null;
  date: string | null;
}

export async function getRatesAtDate(date?: string): Promise<{ date: string; rates: RateAtDate[] }> {
  const { data } = await api.get<{ date: string; rates: RateAtDate[] }>('/payments/exchange-rates/at-date', {
    params: date ? { date } : undefined,
  });
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

export async function fetchBcvRates(): Promise<{ success: boolean; message: string; rates: { usd?: number; eur?: number; date: string } }> {
  const { data } = await api.post('/payments/exchange-rates/fetch-bcv');
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

export async function listEnrollmentPlans(params?: { active?: boolean; schoolPeriodId?: number }): Promise<EnrollmentPlan[]> {
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

// ── Ledger ──

export interface LedgerStudent {
  inscriptionId: number;
  personId: number;
  name: string;
  document: string;
  gradeName: string;
  sectionName: string;
  months: Record<string, {
    charges: any[];
    payments: any[];
    totalCharged: number;
    totalPaid: number;
  }>;
  nonMonthly: {
    charges: any[];
    payments: any[];
  };
}

export interface LedgerResponse {
  students: LedgerStudent[];
  monthlyFee: {
    id: number;
    amount: number;
    currency: string;
    currencyName: string;
  } | null;
}

export interface LedgerSection {
  sectionId: number;
  sectionName: string;
  gradeId: number;
  gradeName: string;
}

export async function getLedgerSections(schoolPeriodId: number): Promise<LedgerSection[]> {
  const { data } = await api.get<LedgerSection[]>(`/ledger/sections/${schoolPeriodId}`);
  return data;
}

export async function getLedgerBySection(schoolPeriodId: number, gradeId: number, sectionId: number): Promise<LedgerResponse> {
  const { data } = await api.get<LedgerResponse>(`/ledger/${schoolPeriodId}/${gradeId}/${sectionId}`);
  return data;
}

export interface PaymentPayload {
  inscriptionId: number;
  schoolPeriodId: number;
  feeId?: number | null;
  sellableItemId?: number | null;
  chargeId?: number | null;
  month?: string | null;
  amount: number;
  currency: string;
  amountVES?: number | null;
  exchangeRate?: number | null;
  method?: string;
  reference?: string;
  bank?: string;
  paymentDate?: string;
  notes?: string;
}

export async function createPayment(payload: PaymentPayload): Promise<any> {
  const { data } = await api.post('/ledger/payments', payload);
  return data;
}

export interface ChargePayload {
  inscriptionId: number;
  schoolPeriodId: number;
  feeId?: number | null;
  sellableItemId?: number | null;
  type: string;
  month?: string | null;
  description: string;
  amount: number;
  currency: string;
  amountVES?: number | null;
  dueDate?: string;
}

export async function createCharge(payload: ChargePayload): Promise<any> {
  const { data } = await api.post('/ledger/charges', payload);
  return data;
}

export async function bulkCreateCharges(charges: ChargePayload[]): Promise<{ created: number }> {
  const { data } = await api.post<{ created: number }>('/ledger/charges/bulk', { charges });
  return data;
}

export async function deletePayment(id: number): Promise<void> {
  await api.delete(`/ledger/payments/${id}`);
}

export async function deleteCharge(id: number): Promise<void> {
  await api.delete(`/ledger/charges/${id}`);
}
