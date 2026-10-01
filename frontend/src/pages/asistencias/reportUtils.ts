import type { Dayjs } from 'dayjs';

export const DAY_FULL_BY_SHORT: Record<string, string> = {
  Lun: 'Lunes', Mar: 'Martes', 'Mié': 'Miércoles', Jue: 'Jueves', Vie: 'Viernes',
};

/** Monday of the week containing d (weeks run Monday–Friday). */
export const mondayOf = (d: Dayjs): Dayjs => {
  const dow = d.day();
  return d.subtract(dow === 0 ? 6 : dow - 1, 'day').startOf('day');
};

export const timeRange = (start: string | null, end: string | null): string | undefined =>
  start ? (end && end !== start ? `${start}–${end}` : start) : undefined;
