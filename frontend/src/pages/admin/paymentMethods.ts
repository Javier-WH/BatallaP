/**
 * Payment methods and what each one asks for. Mirrors the rules enforced by the
 * backend (`paymentRulesService.ts`) — the server is the source of truth.
 */
export interface PaymentMethodDef {
  value: string;
  label: string;
  /** Currency preselected when the method is chosen. */
  defaultCurrency: string;
  /** Bank selector (banks of the catalog). */
  bank: boolean;
  /** Payer's user/email on the platform. */
  account: boolean;
  /** Reference = exactly the last 4 digits of the operation (required). */
  referenceLast4: boolean;
  /** Free description is mandatory. */
  notesRequired: boolean;
  /** Label of the account field. */
  accountLabel?: string;
  /** Optional operation id on platforms. */
  referenceOptional?: boolean;
}

export const PAYMENT_METHODS: PaymentMethodDef[] = [
  { value: 'efectivo', label: 'Efectivo', defaultCurrency: 'USD', bank: false, account: false, referenceLast4: false, notesRequired: false },
  { value: 'transferencia', label: 'Transferencia', defaultCurrency: 'VES', bank: true, account: false, referenceLast4: true, notesRequired: false },
  { value: 'pago_movil', label: 'Pago Móvil', defaultCurrency: 'VES', bank: true, account: false, referenceLast4: true, notesRequired: false },
  { value: 'zelle', label: 'Zelle', defaultCurrency: 'USD', bank: false, account: true, accountLabel: 'Correo o nombre de la cuenta Zelle', referenceLast4: false, referenceOptional: true, notesRequired: false },
  { value: 'zinli', label: 'Zinli', defaultCurrency: 'USD', bank: false, account: true, accountLabel: 'Usuario o correo de Zinli', referenceLast4: false, referenceOptional: true, notesRequired: false },
  { value: 'binance', label: 'Binance', defaultCurrency: 'USDT', bank: false, account: true, accountLabel: 'Usuario / Pay ID de Binance', referenceLast4: false, referenceOptional: true, notesRequired: false },
  { value: 'bybit', label: 'Bybit', defaultCurrency: 'USDT', bank: false, account: true, accountLabel: 'Usuario / UID de Bybit', referenceLast4: false, referenceOptional: true, notesRequired: false },
  { value: 'okx', label: 'OKX', defaultCurrency: 'USDT', bank: false, account: true, accountLabel: 'Usuario / UID de OKX', referenceLast4: false, referenceOptional: true, notesRequired: false },
  { value: 'tarjeta', label: 'Tarjeta (punto de venta)', defaultCurrency: 'VES', bank: true, account: false, referenceLast4: true, notesRequired: false },
  { value: 'otro', label: 'Otro', defaultCurrency: 'USD', bank: false, account: false, referenceLast4: false, notesRequired: true },
];

export const methodDef = (value: string): PaymentMethodDef =>
  PAYMENT_METHODS.find(m => m.value === value) ?? PAYMENT_METHODS[0];

export const PAYMENT_CURRENCIES: { value: string; label: string }[] = [
  { value: 'VES', label: 'VES (Bolívares)' },
  { value: 'USD', label: 'USD (Dólares)' },
  { value: 'EUR', label: 'EUR (Euros)' },
  { value: 'USDT', label: 'USDT (Tether)' },
];

/** "1,234.50 USD · 20.00 EUR" or "0" when there is nothing. */
export function formatTotals(byCurrency: Record<string, number>): string {
  const parts = Object.entries(byCurrency)
    .filter(([, v]) => Math.abs(v) >= 0.005)
    .map(([cur, v]) => `${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`);
  return parts.length ? parts.join(' · ') : '0';
}
