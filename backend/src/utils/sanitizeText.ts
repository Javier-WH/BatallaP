// Zero-width / invisible formatting characters that sneak in when pasting from
// ChatGPT, Word or web pages (ZWSP, ZWNJ, ZWJ, word joiner, BOM, soft hyphen).
const INVISIBLE_CHARS = /[\u00AD\u200B-\u200D\u2060\uFEFF]/g;

/** Strips invisible characters and trims. Non-string values pass through untouched. */
export const sanitizeText = <T>(value: T): T =>
  (typeof value === 'string' ? value.replace(INVISIBLE_CHARS, '').trim() : value) as T;
