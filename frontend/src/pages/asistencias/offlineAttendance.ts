// Offline support for the teacher attendance PWA.
//
// While online the phone keeps a copy of the teacher's weekly timetable (the
// same blocks repeat every week) and of the rosters it opened. Offline, the
// weekday picks the blocks and the calendar date identifies the session.
// Saves that cannot reach the server wait in a local queue and are sent to
// POST /attendance/offline-sync, which skips students modified on the server
// meanwhile (reported back as conflicts).
//
// Everything is scoped by personId so two teachers sharing a phone never mix
// their data. Storage is localStorage: a week of rosters is a few hundred KB.

import axios from 'axios';
import dayjs from 'dayjs';
import api from '@/services/api';
import type { AttendanceSessionView, AttendanceStatus, RosterEntry } from './types';

export interface TemplateRosterEntry {
  inscriptionId: number;
  personId: number;
  document: string;
  fullName: string;
  sectionLabel: string | null;
}

export interface TemplateBlock extends Omit<AttendanceSessionView, 'id' | 'sessionDate' | 'status' | 'counts'> {
  roster: TemplateRosterEntry[];
}

export interface WeekTemplate {
  schoolPeriodId: number | null;
  generatedAt: string;
  days: Record<string, TemplateBlock[]>;
}

export interface PendingRecord {
  inscriptionId: number;
  status: AttendanceStatus;
  reason: string | null;
  /** Value the phone showed before the teacher marked it (server copy). */
  baseStatus: AttendanceStatus | null;
  baseReason: string | null;
  listNumber: number;
  fullName: string;
}

export interface PendingSubmission {
  key: string;
  scheduleEntryId: number;
  sessionDate: string;
  subjectName: string | null;
  sectionLabel: string;
  periodLabel: string;
  savedAt: string;
  records: PendingRecord[];
  lastError?: string;
}

export interface SyncStudent {
  listNumber: number;
  fullName: string;
  serverStatus?: AttendanceStatus | null;
}

export interface SyncReport {
  subjectName: string | null;
  sectionLabel: string;
  sessionDate: string;
  periodLabel: string;
  conflicts: SyncStudent[];
  notInRoster: SyncStudent[];
  /** Skipped because an active block (retired/kicked) rejects non-absent writes. */
  blockedStudents: SyncStudent[];
}

export interface SyncOutcome {
  synced: number;
  remaining: number;
  offline: boolean;
  failed: { item: PendingSubmission; message: string }[];
  reports: SyncReport[];
}

export const QUEUE_EVENT = 'attendance-queue-changed';
const MAX_CACHED_ROSTERS = 80;

const templateKey = (personId: number) => `att:template:${personId}`;
const rostersKey = (personId: number) => `att:rosters:${personId}`;
const queueKey = (personId: number) => `att:queue:${personId}`;

export const sessionKey = (scheduleEntryId: number, date: string) => `${scheduleEntryId}|${date}`;

/** No response at all: the server was not reachable. */
export const isNetworkError = (err: unknown): boolean => axios.isAxiosError(err) && !err.response;

const readJson = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};
const writeJson = (key: string, value: unknown) => localStorage.setItem(key, JSON.stringify(value));

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const dayNameOf = (date: string) => DAY_NAMES[dayjs(date).day()];
export const periodLabelOf = (b: { periodStart: string | null; periodEnd: string | null; periodId: string }) =>
  b.periodStart
    ? (b.periodEnd && b.periodEnd !== b.periodStart ? `${b.periodStart} – ${b.periodEnd}` : b.periodStart)
    : b.periodId.toUpperCase();

/* ---------------- Weekly template ---------------- */

export const loadTemplate = (personId: number): WeekTemplate | null => readJson(templateKey(personId), null);

export async function refreshTemplate(personId: number): Promise<void> {
  const res = await api.get<WeekTemplate>('/attendance/my-week-template', {
    params: { date: dayjs().format('YYYY-MM-DD') },
  });
  writeJson(templateKey(personId), res.data);
}

const findTemplateBlock = (personId: number, scheduleEntryId: number, date: string): TemplateBlock | null =>
  loadTemplate(personId)?.days[dayNameOf(date)]?.find(b => b.scheduleEntryId === scheduleEntryId) ?? null;

/* ---------------- Cached rosters (per block + date) ---------------- */

type RosterCache = Record<string, { roster: RosterEntry[]; savedAt: string }>;

export function cacheRoster(personId: number, key: string, roster: RosterEntry[]) {
  const cache = readJson<RosterCache>(rostersKey(personId), {});
  cache[key] = { roster, savedAt: new Date().toISOString() };
  const keys = Object.keys(cache);
  if (keys.length > MAX_CACHED_ROSTERS) {
    keys.sort((a, b) => cache[a].savedAt.localeCompare(cache[b].savedAt))
      .slice(0, keys.length - MAX_CACHED_ROSTERS)
      .forEach(k => delete cache[k]);
  }
  writeJson(rostersKey(personId), cache);
}

/**
 * Roster to show offline: the copy of that exact day if it was opened online,
 * else the weekly template's students with nothing marked.
 */
export function offlineRoster(personId: number, scheduleEntryId: number, date: string): RosterEntry[] | null {
  const cached = readJson<RosterCache>(rostersKey(personId), {})[sessionKey(scheduleEntryId, date)];
  if (cached) return cached.roster;
  const block = findTemplateBlock(personId, scheduleEntryId, date);
  if (!block) return null;
  return block.roster.map(s => ({
    ...s,
    status: null,
    reason: null,
    blocked: false,
    clearedBy: null,
    clearedAt: null,
    clearanceReasonCode: null,
    clearanceReasonNote: null,
    priorBlock: null,
    recordId: null,
  }));
}

/* ---------------- Pending queue ---------------- */

export const loadQueue = (personId: number): PendingSubmission[] => readJson(queueKey(personId), []);

const saveQueue = (personId: number, queue: PendingSubmission[]) => {
  writeJson(queueKey(personId), queue);
  window.dispatchEvent(new Event(QUEUE_EVENT));
};

export const findPending = (personId: number, key: string) => loadQueue(personId).find(p => p.key === key) ?? null;

/**
 * Queue a save. Saving the same block+date again merges into the pending
 * entry, keeping each student's ORIGINAL base value so the conflict check
 * still compares against what the server had before any offline edit.
 */
export function enqueue(personId: number, submission: Omit<PendingSubmission, 'key' | 'savedAt'>) {
  const key = sessionKey(submission.scheduleEntryId, submission.sessionDate);
  const queue = loadQueue(personId);
  const previous = queue.find(p => p.key === key);
  const previousBase = new Map(previous?.records.map(r => [r.inscriptionId, r]) ?? []);
  const records = submission.records.map(r => {
    const prev = previousBase.get(r.inscriptionId);
    return prev ? { ...r, baseStatus: prev.baseStatus, baseReason: prev.baseReason } : r;
  });
  const next: PendingSubmission = { ...submission, key, records, savedAt: new Date().toISOString() };
  saveQueue(personId, [...queue.filter(p => p.key !== key), next]);
}

export const removePending = (personId: number, key: string) =>
  saveQueue(personId, loadQueue(personId).filter(p => p.key !== key));

/** Overlay the teacher's unsynced marks on a roster. */
export function applyPending(roster: RosterEntry[], pending: PendingSubmission | null): RosterEntry[] {
  if (!pending) return roster;
  const marks = new Map(pending.records.map(r => [r.inscriptionId, r]));
  return roster.map(s => {
    const m = marks.get(s.inscriptionId);
    return m ? { ...s, status: m.status, reason: m.reason } : s;
  });
}

/* ---------------- Offline schedule ---------------- */

/** Sessions of a date built from the weekly template (negative ids = offline). */
export function offlineSessionsFor(personId: number, date: string): AttendanceSessionView[] {
  const blocks = loadTemplate(personId)?.days[dayNameOf(date)] ?? [];
  const queue = loadQueue(personId);
  const rosters = readJson<RosterCache>(rostersKey(personId), {});
  return blocks.map(block => {
    const view: Omit<TemplateBlock, 'roster'> = { ...block };
    delete (view as Partial<TemplateBlock>).roster;
    const key = sessionKey(view.scheduleEntryId, date);
    const pending = queue.find(p => p.key === key) ?? null;
    const marked = applyPending(rosters[key]?.roster ?? [], pending).filter(r => r.status !== null);
    const counts = {
      present: marked.filter(r => r.status === 'present').length,
      absent: marked.filter(r => r.status === 'absent').length,
      late: marked.filter(r => r.status === 'late').length,
      kicked: marked.filter(r => r.status === 'kicked').length,
      total: Math.max(marked.length, pending?.records.length ?? 0),
    };
    return { ...view, id: -view.scheduleEntryId, sessionDate: date, status: counts.total > 0 ? 'completed' : 'pending', counts };
  });
}

/* ---------------- Sync ---------------- */

let running: Promise<SyncOutcome> | null = null;

/** Send every queued save, oldest first. Stops at the first network failure. */
export function syncPending(personId: number): Promise<SyncOutcome> {
  if (!running) {
    running = doSync(personId).finally(() => { running = null; });
  }
  return running;
}

async function doSync(personId: number): Promise<SyncOutcome> {
  const outcome: SyncOutcome = { synced: 0, remaining: 0, offline: false, failed: [], reports: [] };
  const queue = [...loadQueue(personId)].sort((a, b) => a.savedAt.localeCompare(b.savedAt));
  for (const item of queue) {
    try {
      const res = await api.post<{
        conflicts: { inscriptionId: number; listNumber: number; fullName: string; serverStatus: AttendanceStatus | null }[];
        notInRoster: number[];
        blockedStudents: { inscriptionId: number; listNumber: number; fullName: string }[];
      }>('/attendance/offline-sync', {
        scheduleEntryId: item.scheduleEntryId,
        sessionDate: item.sessionDate,
        records: item.records.map(r => ({
          inscriptionId: r.inscriptionId,
          status: r.status,
          reason: r.reason,
          baseStatus: r.baseStatus,
          baseReason: r.baseReason,
        })),
      });
      removePending(personId, item.key);
      outcome.synced++;
      const byId = new Map(item.records.map(r => [r.inscriptionId, r]));
      const { conflicts, notInRoster, blockedStudents } = res.data;
      if (conflicts.length > 0 || notInRoster.length > 0 || blockedStudents.length > 0) {
        outcome.reports.push({
          subjectName: item.subjectName,
          sectionLabel: item.sectionLabel,
          sessionDate: item.sessionDate,
          periodLabel: item.periodLabel,
          conflicts: conflicts.map(c => ({ listNumber: c.listNumber, fullName: c.fullName, serverStatus: c.serverStatus })),
          notInRoster: notInRoster.map(id => ({
            listNumber: byId.get(id)?.listNumber ?? 0,
            fullName: byId.get(id)?.fullName ?? `Inscripción ${id}`,
          })),
          blockedStudents: blockedStudents.map(s => ({ listNumber: s.listNumber, fullName: s.fullName })),
        });
      }
    } catch (err) {
      if (isNetworkError(err)) {
        outcome.offline = true;
        break;
      }
      // Rejected by the server (expired login, invalid date…): keep it so
      // nothing is lost, and tell the teacher why.
      const message = axios.isAxiosError<{ message?: string }>(err)
        ? err.response?.data?.message || 'Error al sincronizar'
        : 'Error al sincronizar';
      saveQueue(personId, loadQueue(personId).map(p => (p.key === item.key ? { ...p, lastError: message } : p)));
      outcome.failed.push({ item, message });
    }
  }
  outcome.remaining = loadQueue(personId).length;
  return outcome;
}
