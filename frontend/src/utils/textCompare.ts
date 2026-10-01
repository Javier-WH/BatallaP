/**
 * textCompare — comparadores de texto con colación española.
 *
 * Ordenar con `<`/`>` o con el comparador por defecto de AG Grid compara por
 * punto de código Unicode, donde 'á' (U+00E1) cae después de 'z'. Esto manda
 * nombres como "Ángel" al final de la lista. Usar siempre `compareText` para
 * texto visible al usuario; `numeric: true` hace que "2" < "10".
 */

const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true });

/** Comparador para valores de celda (AG Grid `comparator` o `Array.sort`). */
export function compareText(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return collator.compare(String(a), String(b));
}

/** Comparador para strings opcionales (normaliza null/undefined a ''). */
export function compareStringsEs(a: string | undefined | null, b: string | undefined | null): number {
  return collator.compare((a || '').trim(), (b || '').trim());
}
