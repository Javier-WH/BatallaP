// Shared option lists and helpers for the composite "prefix + number" inputs used when
// registering people (document type + number, phone operator code + number).

export interface DocumentTypeOption {
  /** Value stored in `documentType`. */
  value: string;
  /** Short code shown in the selector. */
  code: string;
  label: string;
}

export const DOCUMENT_TYPE_OPTIONS: DocumentTypeOption[] = [
  { value: 'Venezolano', code: 'V', label: 'Venezolano' },
  { value: 'Extranjero', code: 'E', label: 'Extranjero' },
  { value: 'Pasaporte', code: 'P', label: 'Pasaporte' },
  { value: 'Cedula Escolar', code: 'CE', label: 'Cédula Escolar' },
];

/** Guardians cannot have a school ID (Cédula Escolar). */
export const GUARDIAN_DOCUMENT_TYPE_OPTIONS = DOCUMENT_TYPE_OPTIONS.filter((option) => option.value !== 'Cedula Escolar');

export const PHONE_PREFIXES = ['0414', '0416', '0412', '0424', '0422'];
export const PHONE_NUMBER_LENGTH = 7;

/**
 * Splits a stored phone ("0414-9443784", "04149443784", or just "9443784") into its operator
 * code and local number.
 */
export function splitPhone(value?: string | null): { prefix: string; number: string } {
  const text = (value ?? '').trim();
  const dashed = text.match(/^(\d{4})-(\d{0,7})$/);
  if (dashed) return { prefix: dashed[1], number: dashed[2] };
  const digits = text.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('0')) {
    return { prefix: digits.slice(0, 4), number: digits.slice(4) };
  }
  return { prefix: '', number: digits.slice(0, PHONE_NUMBER_LENGTH) };
}

/**
 * Free-form phone: auto-inserts the hyphen while typing/pasting (04121234567 → 0412-1234567).
 * Used where any area code is allowed (e.g. 0212, 0238), so no operator selector is offered.
 */
export function formatPhoneInput(value: string | undefined): string {
  const digits = (value ?? '').replace(/\D/g, '').slice(0, 11);
  return digits.length > 4 ? `${digits.slice(0, 4)}-${digits.slice(4)}` : digits;
}

/** Inverse of `splitPhone`: the stored format is `04XX-XXXXXXX`. */
export function joinPhone(prefix: string, number: string): string {
  if (!prefix && !number) return '';
  if (!prefix) return number;
  return `${prefix}-${number}`;
}

export interface PersonIdentityLike {
  firstName?: string | null;
  lastName?: string | null;
  document?: string | null;
}

const normalizeText = (value: string) =>
  value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** A guardian bucket holds a real person when any identity field is filled. */
export function guardianHasPersonData(g?: PersonIdentityLike | null): boolean {
  return !!g && [g.firstName, g.lastName, g.document]
    .some(v => typeof v === 'string' && v.trim() !== '');
}

/** Two guardian buckets describe the same person when the cédulas match, or
 *  (without usable documents) the full names match. */
export function sameGuardianPerson(
  a?: PersonIdentityLike | null,
  b?: PersonIdentityLike | null
): boolean {
  const da = String(a?.document ?? '').replace(/\D/g, '');
  const db = String(b?.document ?? '').replace(/\D/g, '');
  if (da.length >= 5 && db.length >= 5) return da === db;
  const na = normalizeText(`${a?.firstName ?? ''} ${a?.lastName ?? ''}`);
  const nb = normalizeText(`${b?.firstName ?? ''} ${b?.lastName ?? ''}`);
  return na !== '' && na === nb;
}
