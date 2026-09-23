const NUMERIC_DOCUMENT_TYPES = new Set(['Venezolano', 'Extranjero', 'Cedula Escolar']);

/**
 * Cédulas (V/E) and cédulas escolares are stored as digits only — the letter is
 * derived from `documentType` when displayed. Passports keep their characters.
 * A value without any digit is returned trimmed instead of being wiped.
 */
export const normalizeDocumentNumber = <T extends string | null | undefined>(
  documentType: string | null | undefined,
  document: T
): T => {
  if (typeof document !== 'string') return document;
  const trimmed = document.trim();
  if (!documentType || !NUMERIC_DOCUMENT_TYPES.has(documentType)) return trimmed as T;
  const digits = trimmed.replace(/\D/g, '');
  return (digits || trimmed) as T;
};
