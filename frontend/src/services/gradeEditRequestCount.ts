import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import api from '@/services/api';

/**
 * Shared pending grade-edit-request count (Control de Estudios badges).
 * Single store so the sidebar module badge and the "Notas" menu badge show the
 * same number; refreshes every 30 s and on every route change.
 */

const POLL_MS = 30_000;

let count = 0;
let inflight: Promise<void> | null = null;
const subscribers = new Set<() => void>();

async function refresh() {
  inflight ??= api
    .get('/evaluation/grade-edit-requests/pending/count')
    .then(res => { count = Number(res.data?.count) || 0; })
    .catch(() => { /* keep last known count */ })
    .finally(() => { inflight = null; subscribers.forEach(fn => fn()); });
  await inflight;
}

export function usePendingGradeEditCount(enabled = true): number {
  const { pathname } = useLocation();
  const [n, setN] = useState(count);

  useEffect(() => {
    if (!enabled) return;
    const sub = () => setN(count);
    subscribers.add(sub);
    void refresh();
    const interval = setInterval(() => { void refresh(); }, POLL_MS);
    return () => { subscribers.delete(sub); clearInterval(interval); };
  }, [enabled, pathname]);

  return enabled ? n : 0;
}
