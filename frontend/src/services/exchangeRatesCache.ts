import dayjs from 'dayjs';
import api from './api';
import type { ExchangeRate, RateAtDate } from './paymentsService';

// Offline copy of the exchange-rate history. It is tiny (a date and a number per rate and
// type), so the whole recent history is kept on the phone: the calculator can then answer
// "rate on or before date X" without the server, exactly like /exchange-rates/at-date does.

const STORAGE_KEY = 'exchange-rates-snapshot';
const REFRESH_AFTER_MS = 30 * 60 * 1000;
const HISTORY_DAYS = 1095;

type RateRow = [typeId: number, date: string, rate: number];

interface Snapshot {
  savedAt: string;
  types: { id: number; code: string; name: string; currency: string }[];
  rates: RateRow[];
}

const read = (): Snapshot | null => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  } catch {
    return null;
  }
};

let refreshing = false;

/** Downloads the history and stores it. Throttled unless `force`; failures keep the previous copy. */
export async function refreshRatesSnapshot(force = false): Promise<void> {
  const current = read();
  if (!force && current && Date.now() - new Date(current.savedAt).getTime() < REFRESH_AFTER_MS) return;
  if (refreshing) return;
  refreshing = true;
  try {
    const from = dayjs().subtract(HISTORY_DAYS, 'day').format('YYYY-MM-DD');
    const { data } = await api.get<ExchangeRate[]>('/payments/exchange-rates', { params: { from } });
    const types = new Map<number, Snapshot['types'][number]>();
    const rates: RateRow[] = [];
    for (const row of data) {
      if (!row.type?.active) continue;
      types.set(row.type.id, { id: row.type.id, code: row.type.code, name: row.type.name, currency: row.type.currency });
      rates.push([row.exchangeRateTypeId, row.date, Number(row.rate)]);
    }
    const snapshot: Snapshot = {
      savedAt: new Date().toISOString(),
      types: [...types.values()].sort((a, b) => a.id - b.id),
      rates,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Offline or session expired: keep whatever copy we already have.
  } finally {
    refreshing = false;
  }
}

/** Same answer as the server for `date` (default today), from the stored copy; null if none. */
export function ratesFromSnapshot(date?: string): { date: string; rates: RateAtDate[]; cachedAt: string } | null {
  const snapshot = read();
  if (!snapshot) return null;
  const target = date ?? dayjs().format('YYYY-MM-DD');
  const rates: RateAtDate[] = snapshot.types.map((type) => {
    let best: RateRow | null = null;
    for (const row of snapshot.rates) {
      if (row[0] === type.id && row[1] <= target && (!best || row[1] > best[1])) best = row;
    }
    return {
      typeId: type.id,
      code: type.code,
      name: type.name,
      currency: type.currency,
      rate: best ? best[2] : null,
      date: best ? best[1] : null,
    };
  });
  return { date: target, rates, cachedAt: snapshot.savedAt };
}
