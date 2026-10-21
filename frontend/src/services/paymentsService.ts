import axios from 'axios';
import api from './api';
import { ratesFromSnapshot, refreshRatesSnapshot } from './exchangeRatesCache';

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
  effectiveMonth: string;
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
  icon: string | null;        // Lucide icon name of the ledger badge
  iconImage: string | null;   // uploaded badge image; takes precedence over `icon`
  /** Optional size list; empty/null = the item has no sizes. */
  sizes: string[] | null;
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
  effectiveMonth: string;
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

export interface RatesAtDateResult {
  date: string;
  rates: RateAtDate[];
  /** True when the server was unreachable and the answer comes from the copy stored on the device. */
  offline?: boolean;
  /** When that stored copy was downloaded (ISO), only with `offline`. */
  cachedAt?: string;
}

export async function getRatesAtDate(date?: string): Promise<RatesAtDateResult> {
  try {
    const { data } = await api.get<RatesAtDateResult>('/payments/exchange-rates/at-date', {
      params: date ? { date } : undefined,
    });
    void refreshRatesSnapshot();
    return data;
  } catch (err) {
    // No response at all = no connection: answer from the stored history if there is one.
    if (axios.isAxiosError(err) && !err.response) {
      const cached = ratesFromSnapshot(date);
      if (cached) return { ...cached, offline: true };
    }
    throw err;
  }
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

// ── Charge generation / sync (whole period) ──

export interface ChargeSyncSummary {
  schoolPeriodId: number;
  generate: { inscriptions: number; charges: number; amountByCurrency: Record<string, number> };
  sync: { charges: number; skippedPaid: number; deltaByCurrency: Record<string, number> };
  excludedMateriaPendiente: number;
  warnings: Array<{ message: string; count: number }>;
}

export async function previewChargeSync(schoolPeriodId?: number): Promise<ChargeSyncSummary> {
  const { data } = await api.post<ChargeSyncSummary>('/payments/charges/preview', { schoolPeriodId });
  return data;
}

export async function applyChargeSync(schoolPeriodId?: number): Promise<{ created: number; reactivated: number; updated: number; skippedPaid: number }> {
  const { data } = await api.post('/payments/charges/apply', { schoolPeriodId });
  return data;
}

// ── Billing calendar ──

export async function updateBillingCalendar(
  schoolPeriodId: number,
  payload: { billingStartMonth: number; billingEndMonth: number },
): Promise<{ schoolPeriodId: number; billingStartMonth: number; billingEndMonth: number; months: string[] }> {
  const { data } = await api.put(`/payments/billing-calendar/${schoolPeriodId}`, payload);
  return data;
}

/** Turns on/off "USD or USDT settle EUR debts 1:1" for a school period. */
export async function updateParSettlement(schoolPeriodId: number, usdAtPar: boolean): Promise<{ schoolPeriodId: number; usdAtPar: boolean }> {
  const { data } = await api.put(`/payments/par-settlement/${schoolPeriodId}`, { usdAtPar });
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

/** Upload a custom badge image for an item (multipart `icon`). */
export async function uploadSellableItemIcon(id: number, file: File): Promise<SellableItem> {
  const fd = new FormData();
  fd.append('icon', file);
  const { data } = await api.put<SellableItem>(`/payments/sellable-items/${id}/icon`, fd);
  return data;
}

/** Remove the uploaded badge image (the Lucide icon stays as fallback). */
export async function clearSellableItemIcon(id: number): Promise<SellableItem> {
  const { data } = await api.delete<SellableItem>(`/payments/sellable-items/${id}/icon`);
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

/** A guardian of a ledger student — contact data plus the other students they represent. */
export interface LedgerGuardian {
  /** All relationships this person holds with the student (e.g. ['father', 'representative']). */
  relationships: ('mother' | 'father' | 'sibling' | 'grandparent' | 'uncle_aunt' | 'representative')[];
  isRepresentative: boolean;
  firstName: string;
  lastName: string;
  document: string | null;
  documentType: string | null;
  phone: string | null;
  phone2: string | null;
  whatsapp: string | null;
  email: string | null;
  /** Other students this guardian represents: name + where they study (grade/section/period). */
  alsoRepresents: { personId: number; name: string; where: string }[];
}

export interface LedgerStudent {
  inscriptionId: number;
  personId: number;
  name: string;
  document: string;
  rosterNumber: number | null;
  entryMonth: string | null;
  /** Real guardians only — placeholder profiles ("sin representante") are filtered server-side. */
  guardians: LedgerGuardian[];
  gradeName: string;
  sectionName: string;
  months: Record<string, LedgerBucket>;
  /** Month-less debts generated from the enrollment plan — displayed inside the entry month's cell. */
  enrollment: LedgerBucket;
  /** Month-less manual/extraordinary debts — displayed in the "Otros" column. */
  other: LedgerBucket;
  /** Debts that belong to school periods other than the viewed one. */
  priorPeriods: LedgerPriorPeriod[];
  discounts: LedgerDiscount[];
}

/** Charges and payments of one month (or of the non-monthly debts). totalCharged is NET of discounts. */
export interface LedgerBucket {
  charges: any[];
  payments: any[];
  /** Charged / paid per debt currency — a cell can mix them (EUR enrollment + USD uniform). */
  byCurrency?: Record<string, { charged: number; paid: number }>;
  /** Currency the bucket's debts are denominated in (payments are converted to it). */
  currency: string | null;
  grossCharged: number;
  totalDiscount: number;
  totalCharged: number;
  totalPaid: number;
  /** Same totals expressed in VES — lets mixed-currency buckets aggregate. */
  totalChargedVES: number;
  totalPaidVES: number;
}

export interface LedgerPriorPeriod {
  periodId: number;
  periodName: string;
  periodCode: string | null;
  billingMonths: string[];
  months: Record<string, LedgerBucket>;
  enrollment: LedgerBucket;
  other: LedgerBucket;
}

export interface LedgerDiscount {
  id: number;
  reasonId: number;
  reasonName: string;
  kind: 'percent' | 'fixed';
  value: number;
  appliesTo: 'mensualidad' | 'matricula' | 'todo';
  fromMonth: string | null;
  toMonth: string | null;
  note: string | null;
}

export interface LedgerResponse {
  students: LedgerStudent[];
  months: string[];
  /** Section totals per debt currency; pending never goes negative per month. */
  totals?: Record<string, { charged: number; paid: number; pending: number }>;
  monthlyFeeByMonth: Record<string, { id: number; amount: number; currency: string; currencyName: string } | null>;
  monthlyFee: {
    id: number;
    amount: number;
    currency: string;
    currencyName: string;
  } | null;
}

export interface LedgerSection {
  /** null = the "Sin sección" group (withdrawn students of the grade with outstanding debt). */
  sectionId: number | null;
  sectionName: string;
  gradeId: number;
  gradeName: string;
}

export async function getLedgerSections(schoolPeriodId: number): Promise<LedgerSection[]> {
  const { data } = await api.get<LedgerSection[]>(`/ledger/sections/${schoolPeriodId}`);
  return data;
}

export async function getLedgerBySection(schoolPeriodId: number, gradeId: number, sectionId: number | null): Promise<LedgerResponse> {
  const { data } = await api.get<LedgerResponse>(`/ledger/${schoolPeriodId}/${gradeId}/${sectionId ?? 'null'}`);
  return data;
}

/** Withdrawn student result — the latest withdrawn inscription of a person. */
export interface WithdrawnStudentResult {
  inscriptionId: number;
  personId: number;
  name: string;
  document: string;
  documentType: string;
  gradeName: string;
  periodName: string;
  withdrawnAt: string | null;
}

export async function searchWithdrawnStudents(q: string): Promise<WithdrawnStudentResult[]> {
  const { data } = await api.get<WithdrawnStudentResult[]>('/ledger/withdrawn-students', { params: { q } });
  return data;
}

/** One row of the "Resumen de movimientos" sheet. */
export interface PaymentReportRow {
  id: number;
  paymentDate: string;
  createdAt: string;
  student: string;
  document: string | null;
  gradeName: string | null;
  sectionName: string | null;
  method: string;
  amount: number;
  currency: string;
  amountVES: number | null;
  exchangeRate: number | null;
  equivalent: number | null;
  equivalentCurrency: string | null;
  atPar: boolean;
  reference: string | null;
  bank: string | null;
  account: string | null;
  notes: string | null;
  registeredById: number | null;
  registeredBy: string | null;
  allocations: { amount: number; currency: string | null; description: string | null; month: string | null }[];
}

export interface PaymentsReport {
  rows: PaymentReportRow[];
  registrants: { id: number; name: string }[];
  /** True when the row cap was hit — narrow the date range. */
  truncated: boolean;
  limit: number;
}

export async function getPaymentsReport(params: { from?: string; to?: string; schoolPeriodId?: number }): Promise<PaymentsReport> {
  const { data } = await api.get<PaymentsReport>('/ledger/payments/report', { params });
  return data;
}

export interface PaymentPayload {
  inscriptionId: number;
  schoolPeriodId: number;
  feeId?: number | null;
  sellableItemId?: number | null;
  chargeId?: number | null;
  month?: string | null;
  /** School period whose debt this payment settles (null = the payment's period). */
  debtPeriodId?: number | null;
  amount: number;
  currency: string;
  amountVES?: number | null;
  exchangeRate?: number | null;
  method?: string;
  /** Last 4 digits of the operation for bank methods; operation id (optional) for platforms. */
  reference?: string;
  bank?: string;
  /** Payer's user/email on platforms (Binance, Bybit, OKX, Zinli, Zelle). */
  account?: string;
  /** Calendar day of the payment (YYYY-MM-DD). */
  paymentDate?: string;
  notes?: string;
  /** Settles enrollment / one-time debts: the payment is not assigned to any month. */
  nonMonthly?: boolean;
  /** Debt scope: 'tuition' = only academic debts (enrollment + monthly fees); 'item' = sellable items only (direct purchase, use with chargeId). Default = every debt in order. */
  scope?: 'tuition' | 'item';
  /** Idempotency key of the form submission. */
  clientRequestId?: string;
  /** Register even though the server flagged a possible duplicate. */
  allowDuplicate?: boolean;
}

export interface DuplicatePaymentInfo {
  id: number;
  studentName: string;
  registeredBy: string | null;
  paymentDate: string;
  createdAt: string;
  amount: number;
  currency: string;
  method: string;
  reference: string | null;
}

/** The part of a payment credited to one charge, in the charge's currency. */
export interface PaymentAllocationView {
  chargeId: number;
  amount: number;
  currency: string;
  month: string | null;
  periodId: number;
  atPar: boolean;
  description: string | null;
  type: string | null;
}

export async function createPayment(payload: PaymentPayload): Promise<any> {
  const { data } = await api.post('/ledger/payments', payload);
  return data;
}

export async function updateEntryMonth(inscriptionId: number, entryMonth: string): Promise<{ entryMonth: string; generated: number; warnings: string[] }> {
  const { data } = await api.put(`/ledger/inscriptions/${inscriptionId}/entry-month`, { entryMonth });
  return data;
}

// ── Discounts / scholarships ──

export interface DiscountReason {
  id: number;
  name: string;
  description: string | null;
  active: boolean;
}

export async function listDiscountReasons(): Promise<DiscountReason[]> {
  const { data } = await api.get<DiscountReason[]>('/payments/discount-reasons');
  return data;
}

export async function createDiscountReason(payload: { name: string; description?: string }): Promise<DiscountReason> {
  const { data } = await api.post<DiscountReason>('/payments/discount-reasons', payload);
  return data;
}

export async function updateDiscountReason(id: number, payload: Partial<DiscountReason>): Promise<DiscountReason> {
  const { data } = await api.put<DiscountReason>(`/payments/discount-reasons/${id}`, payload);
  return data;
}

export interface DiscountPayload {
  reasonId: number;
  kind: 'percent' | 'fixed';
  value: number;
  appliesTo: 'mensualidad' | 'matricula' | 'todo';
  fromMonth?: string | null;
  toMonth?: string | null;
  note?: string | null;
}

export async function createInscriptionDiscount(inscriptionId: number, payload: DiscountPayload): Promise<any> {
  const { data } = await api.post(`/ledger/inscriptions/${inscriptionId}/discounts`, payload);
  return data;
}

export async function deleteInscriptionDiscount(id: number): Promise<void> {
  await api.delete(`/ledger/discounts/${id}`);
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
  /** Units bought (items only); deliveries are tracked per unit. */
  quantity?: number;
}

export async function createCharge(payload: ChargePayload): Promise<any> {
  const { data } = await api.post('/ledger/charges', payload);
  return data;
}

export async function bulkCreateCharges(charges: ChargePayload[]): Promise<{ created: number }> {
  const { data } = await api.post<{ created: number }>('/ledger/charges/bulk', { charges });
  return data;
}

// ── Item deliveries ──

export interface ChargeDelivery {
  id: number;
  chargeId: number;
  quantity: number;
  /** Size handed over (items with sizes). */
  size: string | null;
  note: string | null;
  deliveredByPersonId: number | null;
  deliveredBy?: { id: number; firstName: string; lastName: string } | null;
  createdAt: string;
}

/** Record that `quantity` units of an item charge were handed over. `stockWarning` is set when the inventory went negative (the delivery is registered anyway). */
export async function deliverItemUnits(
  chargeId: number,
  payload: { quantity?: number; size?: string; note?: string },
): Promise<ChargeDelivery & { stockWarning: string | null }> {
  const { data } = await api.post<ChargeDelivery & { stockWarning: string | null }>(`/ledger/charges/${chargeId}/deliveries`, payload);
  return data;
}

/** Undo a mistaken delivery record. */
export async function undoItemDelivery(deliveryId: number): Promise<void> {
  await api.delete(`/ledger/deliveries/${deliveryId}`);
}

/** Removes a payment entered by mistake; the reason is mandatory and audited. */
export async function deletePayment(id: number, reason: string): Promise<void> {
  await api.delete(`/ledger/payments/${id}`, { data: { reason } });
}

/** Moves a payment charged to the wrong student to the right one (same school period). */
export async function movePayment(id: number, toInscriptionId: number, reason: string): Promise<any> {
  const { data } = await api.post(`/ledger/payments/${id}/move`, { toInscriptionId, reason });
  return data;
}

export interface PaymentAuditEntry {
  id: number;
  paymentId: number;
  action: 'deleted' | 'moved';
  fromInscriptionId: number;
  toInscriptionId: number | null;
  reason: string;
  createdAt: string;
  performer: { id: number; firstName: string; lastName: string } | null;
  snapshot: Record<string, any>;
}

export async function listPaymentAudit(inscriptionId: number): Promise<PaymentAuditEntry[]> {
  const { data } = await api.get<PaymentAuditEntry[]>('/ledger/payments/audit', { params: { inscriptionId } });
  return data;
}

export async function deleteCharge(id: number): Promise<void> {
  await api.delete(`/ledger/charges/${id}`);
}

// ── Debt summary & document hold ──

export interface DebtBucketView {
  periodId: number;
  periodName: string;
  month: string | null;
  currency: string;
  charged: number;
  paid: number;
  remaining: number;
  /** Charged / paid per debt currency — a bucket can mix them. */
  byCurrency?: Record<string, { charged: number; paid: number }>;
  charges: { id: number; type: string; description: string; amount: number; currency: string }[];
  paymentCount: number;
}

export interface InscriptionDebt {
  inscriptionId: number;
  withdrawn: boolean;
  papersHold: boolean;
  hasDebt: boolean;
  totals: Record<string, { charged: number; paid: number; remaining: number }>;
  buckets: DebtBucketView[];
}

export async function getInscriptionDebt(inscriptionId: number): Promise<InscriptionDebt> {
  const { data } = await api.get<InscriptionDebt>(`/ledger/inscriptions/${inscriptionId}/debt`);
  return data;
}

export async function releasePapers(inscriptionId: number): Promise<{ papersHold: boolean }> {
  const { data } = await api.post(`/ledger/inscriptions/${inscriptionId}/release-papers`);
  return data;
}

// ── Inventory by size ──

export interface InventorySizeRow {
  /** null = units without a size. */
  size: string | null;
  /** Stock on hand; null while the item has no inventory configured. */
  stock: number | null;
  delivered: number;
  received: number;
  /** Size removed from the item's list but still used by movements/deliveries. */
  retired: boolean;
}

export interface InventoryMovement {
  id: number;
  size: string | null;
  quantity: number;
  type: 'ingreso' | 'ajuste';
  note: string | null;
  createdAt: string;
  createdBy?: { id: number; firstName: string; lastName: string } | null;
}

export interface ItemInventory {
  itemId: number;
  sizes: string[];
  configured: boolean;
  sold: number;
  delivered: number;
  pendingDelivery: number;
  rows: InventorySizeRow[];
}

export interface ItemInventoryDetail extends ItemInventory {
  movements: InventoryMovement[];
}

export async function getItemInventory(itemId: number, schoolPeriodId?: number): Promise<ItemInventoryDetail> {
  const { data } = await api.get<ItemInventoryDetail>(`/payments/sellable-items/${itemId}/inventory`, { params: { schoolPeriodId } });
  return data;
}

export async function createInventoryMovement(
  itemId: number,
  payload: { type: 'ingreso' | 'ajuste'; size?: string | null; quantity: number; note?: string },
): Promise<InventoryMovement> {
  const { data } = await api.post<InventoryMovement>(`/payments/sellable-items/${itemId}/inventory-movements`, payload);
  return data;
}
