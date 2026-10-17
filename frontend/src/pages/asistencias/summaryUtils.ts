/** "12.5%" — one decimal, "—" when there is nothing to divide by. */
export function pct(part: number, total: number): string {
  if (!total) return '—';
  const v = (part / total) * 100;
  return `${Number.isInteger(v) ? v : v.toFixed(1)}%`;
}
