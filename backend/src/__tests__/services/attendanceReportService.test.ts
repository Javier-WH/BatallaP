import {
  summarizeDay,
  dayCells,
  isJustifiedAbsence,
  type DayRecord,
  type ReportDayColumn,
} from '@/services/attendanceReportService';
import { periodSortKey, type AttendanceStatus } from '@/services/attendanceService';

const rec = (
  id: number, periodId: string, status: AttendanceStatus, reason: string | null = null, baseKey = 's1'
): DayRecord => ({ id, periodId, status, reason, sortKey: periodSortKey(periodId), baseKey });

const col = (key: string, periodIds: string[]): ReportDayColumn => ({
  key, label: key, title: key, periodIds, start: null, end: null,
});

describe('attendanceReportService', () => {
  describe('isJustifiedAbsence', () => {
    it('treats Justificado / Enfermo reasons and excused status as justified', () => {
      expect(isJustifiedAbsence('absent', 'Justificado')).toBe(true);
      expect(isJustifiedAbsence('absent', 'Enfermo')).toBe(true);
      expect(isJustifiedAbsence('excused', null)).toBe(true);
    });
    it('treats other reasons as unjustified', () => {
      expect(isJustifiedAbsence('absent', 'Comportamiento')).toBe(false);
      expect(isJustifiedAbsence('absent', 'Otro: salió')).toBe(false);
      expect(isJustifiedAbsence('absent', null)).toBe(false);
    });
  });

  describe('summarizeDay (weekly cell)', () => {
    it('returns null without records', () => {
      expect(summarizeDay([], 'M')).toBeNull();
      expect(summarizeDay(undefined, 'M')).toBeNull();
    });
    it('returns the last status of the day', () => {
      expect(summarizeDay([rec(1, 'm1', 'present'), rec(2, 'm3', 'present')], 'M')?.code).toBe('present');
      expect(summarizeDay([rec(1, 'm1', 'absent', 'Enfermo'), rec(2, 'm3', 'absent', 'Enfermo')], 'M')?.code).toBe('absent');
    });
    it('marks Jubilado / Jubilada for unjustified absence after attending', () => {
      const day = [rec(1, 'm1', 'present'), rec(2, 'm3', 'absent', 'Otro: x')];
      expect(summarizeDay(day, 'M')).toMatchObject({ code: 'jubilado', label: 'Jubilado' });
      expect(summarizeDay(day, 'F')).toMatchObject({ code: 'jubilado', label: 'Jubilada' });
    });
    it('late counts as attending for the jubilado rule', () => {
      expect(summarizeDay([rec(1, 'm1', 'late'), rec(2, 'm3', 'absent')], 'M')?.code).toBe('jubilado');
    });
    it('does not mark jubilado when the later absence is justified', () => {
      expect(summarizeDay([rec(1, 'm1', 'present'), rec(2, 'm3', 'absent', 'Justificado')], 'M')?.code).toBe('absent');
    });
    it('does not mark jubilado across shifts (morning presence + afternoon absence)', () => {
      expect(summarizeDay([rec(1, 'm1', 'present'), rec(2, 't1', 'absent')], 'M')?.code).toBe('absent');
    });
    it('marks jubilado within the afternoon shift', () => {
      expect(summarizeDay([rec(1, 't1', 'present'), rec(2, 't3', 'absent')], 'M')?.code).toBe('jubilado');
    });
    it('Expulsado wins over later records', () => {
      expect(summarizeDay([rec(1, 'm1', 'present'), rec(2, 'm3', 'kicked', 'Comportamiento'), rec(3, 'm5', 'absent')], 'M')?.code)
        .toBe('kicked');
    });
  });

  describe('dayCells (daily cells by class block)', () => {
    const columns = [col('s1|m1', ['m1', 'm2']), col('g7|m3', ['m3', 'm4']), col('s2|m5', ['m5'])];

    it('maps each record to its block and flags only unjustified absences after attending', () => {
      const cells = dayCells(columns, [
        rec(1, 'm1', 'present', null, 's1'),
        rec(2, 'm3', 'absent', 'Otro: x', 'g7'),
        rec(3, 'm5', 'absent', 'Enfermo', 's2'),
      ], 'F');
      expect(cells['s1|m1']?.code).toBe('present');
      expect(cells['g7|m3']).toMatchObject({ code: 'jubilado', label: 'Jubilada' });
      expect(cells['s2|m5']?.code).toBe('absent');
    });

    it('leaves blocks without records empty and does not flag absence without prior attendance', () => {
      const cells = dayCells(columns, [rec(1, 'm3', 'absent', null, 'g7')], 'M');
      expect(cells['s1|m1']).toBeNull();
      expect(cells['g7|m3']?.code).toBe('absent');
      expect(cells['s2|m5']).toBeNull();
    });

    it('does not flag jubilado when the attendance was in a different shift', () => {
      const shifted = [col('s1|m1', ['m1']), col('s2|t1', ['t1']), col('s3|t3', ['t3'])];
      const cells = dayCells(shifted, [
        rec(1, 'm1', 'present', null, 's1'),
        rec(2, 't1', 'absent', null, 's2'),
      ], 'F');
      expect(cells['s1|m1']?.code).toBe('present');
      expect(cells['s2|t1']?.code).toBe('absent');
      expect(cells['s3|t3']).toBeNull();
    });

    it('flags jubilado for an unjustified absence later in the same shift', () => {
      const shifted = [col('s2|t1', ['t1']), col('s3|t3', ['t3'])];
      const cells = dayCells(shifted, [
        rec(1, 't1', 'present', null, 's2'),
        rec(2, 't3', 'absent', null, 's3'),
      ], 'M');
      expect(cells['s2|t1']?.code).toBe('present');
      expect(cells['s3|t3']?.code).toBe('jubilado');
    });
  });
});
