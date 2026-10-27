import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import api from '@/services/api';
import { useSchool } from '@/context/SchoolContext';

/**
 * Shared pending room-booking request count.
 *
 * One store feeds every level of the Control de Estudios badge cascade
 * (sidebar module -> Horarios nav -> Distribución de Aulas tab -> Solicitudes
 * button), so they all show the same number. It refreshes every 30 s and on
 * every route change (same cadence as the grade-edit-requests badge), and
 * immediately when `emitRoomBookingsChanged` is called after a request is
 * submitted, approved or rejected.
 */

const EVENT = 'room-bookings-changed';
const POLL_MS = 30_000;

export const emitRoomBookingsChanged = () => window.dispatchEvent(new Event(EVENT));

let count = 0;
let inflight: Promise<void> | null = null;
const subscribers = new Set<() => void>();
const notifySubscribers = () => subscribers.forEach(fn => fn());

export async function refreshPendingRoomBookings(schoolPeriodId?: number | null) {
  if (!schoolPeriodId) {
    count = 0;
    notifySubscribers();
    return;
  }
  inflight ??= api
    .get('/room-bookings/pending/count', { params: { schoolPeriodId } })
    .then(res => { count = Number(res.data?.count) || 0; })
    .catch(() => { /* keep last known count */ })
    .finally(() => { inflight = null; notifySubscribers(); });
  await inflight;
}

export function usePendingRoomBookingCount(enabled = true): number {
  const { activePeriod } = useSchool();
  const { pathname } = useLocation();
  const [n, setN] = useState(count);

  useEffect(() => {
    if (!enabled) return;
    const sub = () => setN(count);
    subscribers.add(sub);
    const refresh = () => { void refreshPendingRoomBookings(activePeriod?.id); };
    window.addEventListener(EVENT, refresh);
    refresh();
    const interval = setInterval(refresh, POLL_MS);
    return () => {
      subscribers.delete(sub);
      window.removeEventListener(EVENT, refresh);
      clearInterval(interval);
    };
  }, [enabled, activePeriod?.id, pathname]);

  return enabled ? n : 0;
}
