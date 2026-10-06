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
  /** Human label of the section(s) covered, e.g. "Primer año A/B". */
  sectionLabel: string;
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
  sectionLabel?: string | null;
  status: AttendanceStatus | null;
  reason: string | null;
  blocked: boolean;
  clearedBy: number | null;
  clearedAt: string | null;
  clearanceReasonCode: string | null;
  clearanceReasonNote: string | null;
  /**
   * Active block: 'retired' = left school early in the previous shift with
   * records (jubilado), 'kicked' = expelled earlier this same shift.
   * sessionDate/shift locate the trigger's shift.
   */
  priorBlock: {
    kind: 'retired' | 'kicked';
    subjectName: string | null;
    periodId: string;
    status: 'absent' | 'kicked';
    sessionDate: string;
    shift: 'm' | 't';
  } | null;
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

/* ---- Staff reports (Por Sección / Por Estudiante) ---- */

export type ReportCellCode = AttendanceStatus | 'jubilado';

export interface ReportCell {
  code: ReportCellCode;
  label: string;
  reason: string | null;
}

export interface ReportStudent {
  inscriptionId: number;
  personId: number;
  document: string;
  lastName: string;
  firstName: string;
  gender: 'M' | 'F' | null;
  gradeName: string;
  sectionName: string;
}

export interface ReportDayColumn {
  key: string;
  label: string;
  title: string;
  periodIds: string[];
  start: string | null;
  end: string | null;
}

export interface SectionWeekReport {
  gradeName: string;
  sectionName: string;
  dateFrom: string;
  dateTo: string;
  days: { date: string; dayShort: string }[];
  students: (ReportStudent & { cells: Record<string, ReportCell | null> })[];
}

export interface SectionDayReport {
  gradeName: string;
  sectionName: string;
  date: string;
  dayShort: string;
  columns: ReportDayColumn[];
  students: (ReportStudent & { cells: Record<string, ReportCell | null> })[];
}

export interface StudentWeeksReport {
  student: ReportStudent;
  dateFrom: string;
  dateTo: string;
  weeks: {
    weekStart: string;
    weekEnd: string;
    days: { date: string; dayShort: string; inRange: boolean; cell: ReportCell | null }[];
  }[];
}

export interface StudentSummary {
  records: StudentSummaryRecord[];
  totals: { present: number; absent: number; late: number; excused: number; kicked: number } | null;
}
