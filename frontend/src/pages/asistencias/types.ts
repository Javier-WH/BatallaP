// Shared types for the attendance module (mirrors backend service interfaces)

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused' | 'kicked';

export const STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: 'Presente',
  absent: 'Ausente',
  late: 'Tarde',
  excused: 'Justificado',
  kicked: 'Expulsado',
};

export const STATUS_COLORS: Record<AttendanceStatus, string> = {
  present: 'green',
  absent: 'red',
  late: 'orange',
  excused: 'blue',
  kicked: 'volcano',
};

export interface AttendanceSessionView {
  id: number;
  scheduleEntryId: number;
  sessionDate: string;
  status: string;
  day: string;
  periodId: string;
  periodStart: string | null;
  periodEnd: string | null;
  subjectId: number | null;
  subjectName: string | null;
  gradeName: string;
  sectionName: string;
  counts: { present: number; absent: number; late: number; kicked: number; total: number };
}

export interface SessionListItem extends AttendanceSessionView {
  teacherName: string | null;
  counts: { present: number; absent: number; late: number; kicked: number; blocked: number; total: number };
}

export interface RosterEntry {
  inscriptionId: number;
  personId: number;
  document: string;
  fullName: string;
  status: AttendanceStatus | null;
  reason: string | null;
  blocked: boolean;
  clearedBy: number | null;
  clearedAt: string | null;
  clearanceReasonCode: string | null;
  clearanceReasonNote: string | null;
  priorBlock: { subjectName: string | null; periodId: string; status: 'absent' | 'kicked' } | null;
  recordId: number | null;
}

export interface ClearanceReason {
  id: number;
  code: string;
  label: string;
  requiresNote: boolean;
  active: boolean;
}

export interface StudentSummaryRecord {
  id: number;
  sessionDate: string;
  periodId: string | null;
  subjectName: string | null;
  teacherName: string | null;
  status: AttendanceStatus;
  reason: string | null;
  blocked: boolean;
  clearedAt: string | null;
  clearanceReasonCode: string | null;
  clearanceReasonNote: string | null;
  markedAt: string;
}

export interface StudentSummary {
  records: StudentSummaryRecord[];
  totals: { present: number; absent: number; late: number; excused: number; kicked: number } | null;
}
