/**
 * paymentRulesService — what each payment method must provide, and how a
 * payment is fingerprinted to detect accidental duplicates.
 *
 * Methods fall in four families:
 *  - cash:      currency + date + amount.
 *  - bank:      transferencia / pago_movil / tarjeta → bank + last 4 digits of the reference.
 *  - platform:  binance / bybit / okx / zinli / zelle → payer account (user/email), no bank.
 *  - other:     free description (notes) is mandatory.
 */

export const PAYMENT_METHOD_LIST = [
  'efectivo', 'transferencia', 'pago_movil', 'zelle', 'zinli', 'binance', 'bybit', 'okx', 'tarjeta', 'otro',
] as const;
export type PaymentMethodCode = typeof PAYMENT_METHOD_LIST[number];

export const PAYMENT_CURRENCIES = ['USD', 'EUR', 'VES', 'USDT'] as const;

export interface MethodRule {
  family: 'cash' | 'bank' | 'platform' | 'other';
  defaultCurrency: string;
  requiresBank: boolean;
  requiresAccount: boolean;
  /** Reference must be exactly 4 digits (last digits of the operation). */
  referenceLast4: boolean;
  requiresNotes: boolean;
}

export const METHOD_RULES: Record<PaymentMethodCode, MethodRule> = {
  efectivo:      { family: 'cash',     defaultCurrency: 'USD',  requiresBank: false, requiresAccount: false, referenceLast4: false, requiresNotes: false },
  transferencia: { family: 'bank',     defaultCurrency: 'VES',  requiresBank: true,  requiresAccount: false, referenceLast4: true,  requiresNotes: false },
  pago_movil:    { family: 'bank',     defaultCurrency: 'VES',  requiresBank: true,  requiresAccount: false, referenceLast4: true,  requiresNotes: false },
  tarjeta:       { family: 'bank',     defaultCurrency: 'VES',  requiresBank: true,  requiresAccount: false, referenceLast4: true,  requiresNotes: false },
  zelle:         { family: 'platform', defaultCurrency: 'USD',  requiresBank: false, requiresAccount: true,  referenceLast4: false, requiresNotes: false },
  zinli:         { family: 'platform', defaultCurrency: 'USD',  requiresBank: false, requiresAccount: true,  referenceLast4: false, requiresNotes: false },
  binance:       { family: 'platform', defaultCurrency: 'USDT', requiresBank: false, requiresAccount: true,  referenceLast4: false, requiresNotes: false },
  bybit:         { family: 'platform', defaultCurrency: 'USDT', requiresBank: false, requiresAccount: true,  referenceLast4: false, requiresNotes: false },
  okx:           { family: 'platform', defaultCurrency: 'USDT', requiresBank: false, requiresAccount: true,  referenceLast4: false, requiresNotes: false },
  otro:          { family: 'other',    defaultCurrency: 'USD',  requiresBank: false, requiresAccount: false, referenceLast4: false, requiresNotes: true  },
};

export interface PaymentInput {
  method: string;
  currency: string;
  amount: number;
  bank?: string | null;
  account?: string | null;
  reference?: string | null;
  notes?: string | null;
}

export interface NormalizedPaymentFields {
  method: PaymentMethodCode;
  bank: string | null;
  account: string | null;
  reference: string | null;
  notes: string | null;
}

const clean = (v?: string | null) => {
  const s = (v ?? '').trim();
  return s ? s : null;
};

/**
 * Validates the method-specific fields and drops the ones that do not apply
 * (a cash payment carries no bank, a platform payment no bank, etc.).
 * Throws an Error with `status = 400` and a Spanish message.
 */
export function normalizePaymentFields(input: PaymentInput): NormalizedPaymentFields {
  const fail = (message: string) => Object.assign(new Error(message), { status: 400 });

  const method = (input.method || 'efectivo') as PaymentMethodCode;
  const rule = METHOD_RULES[method];
  if (!rule) throw fail('Método de pago inválido');
  if (!(PAYMENT_CURRENCIES as readonly string[]).includes(input.currency)) throw fail('Moneda inválida');
  if (!(Number(input.amount) > 0)) throw fail('El monto debe ser mayor que cero');

  const bank = rule.requiresBank ? clean(input.bank) : null;
  const account = rule.requiresAccount ? clean(input.account) : null;
  let reference = clean(input.reference);
  const notes = clean(input.notes);

  if (rule.requiresBank && !bank) throw fail('Seleccione el banco');
  if (rule.requiresAccount && !account) throw fail('Indique el usuario o cuenta que realizó el pago');
  if (rule.referenceLast4 && !(reference && /^\d{4}$/.test(reference))) {
    throw fail('La referencia debe ser los últimos 4 dígitos de la operación');
  }
  if (rule.requiresNotes && !notes) throw fail('Describa el método de pago en las notas');
  if (rule.family === 'cash') reference = null;

  return { method, bank, account, reference, notes };
}

/**
 * "A la par": when a school period accepts it (`usdAtPar`), a payment in USD
 * or USDT (cash, Zelle, Zinli, Binance…) settles a EUR debt 1:1 at face value
 * (40 USD settle 40 EUR) instead of being converted by exchange rate. Payments
 * in bolívares are always converted at the payment-date rate.
 */
export const PAR_PAYMENT_CURRENCIES = ['USD', 'USDT'];
export const PAR_DEBT_CURRENCY = 'EUR';

export function appliesAtPar(paymentCurrency: string, debtCurrency: string | null | undefined, periodUsdAtPar: boolean): boolean {
  return periodUsdAtPar && debtCurrency === PAR_DEBT_CURRENCY && PAR_PAYMENT_CURRENCIES.includes(paymentCurrency);
}

const lc = (v: string | null) => (v ?? '').trim().toLowerCase();

/**
 * Fingerprint of an operation: same bank/account + reference + amount +
 * currency + day is the same payment. Transferencia and pago móvil share a
 * family (registering one operation under both names is still a duplicate).
 * Returns null when there is no reference to fingerprint (cash, platforms
 * without an operation id) — those rely on the time-window check.
 */
export function buildDedupeKey(f: NormalizedPaymentFields, currency: string, amount: number, day: string): string | null {
  if (!f.reference) return null;
  const rule = METHOD_RULES[f.method];
  const family = rule.family === 'bank' && f.method !== 'tarjeta' ? 'bank' : f.method;
  return [family, lc(f.bank ?? f.account), lc(f.reference), currency, Number(amount).toFixed(2), day].join('|');
}
