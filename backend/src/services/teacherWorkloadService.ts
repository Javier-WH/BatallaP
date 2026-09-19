/**
 * teacherWorkloadService
 *
 * Derived per-teacher weekly workload for a school period:
 *   teachingBlocks = Σ over teaching units in non-Materia-Pendiente sections of
 *                    (subject.weeklyBlocks ?? periodGradeSubject.weeklyBlocks)
 *   teachingHours  = teachingBlocks × min_academic_hours_per_block (academic hours)
 *   adminHours     = painted TeacherAdminHour cells for the period
 *   totalHours     = teachingHours + adminHours
 *
 * A "teaching unit" mirrors how the solver actually places blocks:
 *   - linked (subjectId, periodGradeId) pairs (ScheduleLink) occupy the same
 *     block across every grade/section → one unit per link per teacher;
 *   - group subjects (subjectGroupId) share one block across all sections of
 *     the same grade → one unit per (periodGradeId, subjectId);
 *   - any other assignment is one unit per (periodGradeSubjectId, sectionId).
 * e.g. a subject taught to 2 sections × 2 grades in the same block counts
 * weeklyBlocks once, not 4×.
 *
 * Availability cell counts are computed by the frontend (they change live
 * while painting) — this service only resolves the hours.
 */

import { Transaction } from 'sequelize';
import sequelize from '@/config/database';
import {
  Person, Role, Section, PeriodGrade, PeriodGradeSection, PeriodGradeSubject,
  Subject, TeacherAssignment, TeacherAdminHour, Setting,
  ScheduleLink, ScheduleLinkItem,
} from '@/models';

export interface TeacherWorkloadEntry {
  teacherId: number;
  firstName: string;
  lastName: string;
  teachingBlocks: number;
  teachingHours: number;
  adminHours: number;
  totalHours: number;
}

export async function getTeacherWorkload(
  schoolPeriodId: number,
  opts: { transaction?: Transaction } = {}
): Promise<TeacherWorkloadEntry[]> {
  const transaction = opts.transaction;

  // Academic hours per weekly block
  const blockSizeSetting = await Setting.findOne({
    where: { key: 'min_academic_hours_per_block' },
    transaction,
  });
  const blockSize = Number(blockSizeSetting?.value) || 1;

  // Non-MP sections belonging to the period: valid (periodGradeId, sectionId) pairs
  const periodGrades = await PeriodGrade.findAll({
    where: { schoolPeriodId },
    attributes: ['id'],
    transaction,
  });
  const periodGradeIds = periodGrades.map(pg => pg.id);

  // Teachers with the Profesor role — include everyone so teachers without
  // assignments still show up with a zero workload.
  const teachers = await Person.findAll({
    include: [{ model: Role, as: 'roles', where: { name: 'Profesor' }, required: true, attributes: [] }],
    attributes: ['id', 'firstName', 'lastName'],
    transaction,
  });

  const workload = new Map<number, TeacherWorkloadEntry>();
  teachers.forEach(t => workload.set(t.id, {
    teacherId: t.id,
    firstName: t.firstName,
    lastName: t.lastName,
    teachingBlocks: 0,
    teachingHours: 0,
    adminHours: 0,
    totalHours: 0,
  }));

  if (periodGradeIds.length === 0) {
    return Array.from(workload.values());
  }

  const mpSection = await Section.findOne({ where: { isMateriaPendiente: true }, transaction });
  const pgsRows = await PeriodGradeSection.findAll({
    where: { periodGradeId: periodGradeIds },
    attributes: ['periodGradeId', 'sectionId'],
    transaction,
  });
  const validPairs = new Set(
    pgsRows
      .filter(r => r.sectionId !== mpSection?.id)
      .map(r => `${r.periodGradeId}:${r.sectionId}`)
  );

  // Schedule links of the period: (subjectId, periodGradeId) -> linkId
  const linkRows = await ScheduleLink.findAll({
    where: { schoolPeriodId },
    include: [{ model: ScheduleLinkItem, as: 'items', attributes: ['subjectId', 'periodGradeId'] }],
    transaction,
  });
  const pairToLink = new Map<string, number>();
  for (const link of linkRows) {
    for (const it of (link as any).items || []) {
      pairToLink.set(`${it.subjectId}:${it.periodGradeId}`, link.id);
    }
  }

  // Assignments: pgs.periodGradeId + sectionId must be a real section of the period
  const assignments = await TeacherAssignment.findAll({
    include: [
      {
        model: PeriodGradeSubject,
        as: 'periodGradeSubject',
        attributes: ['id', 'periodGradeId', 'subjectId', 'weeklyBlocks'],
        include: [{ model: Subject, as: 'subject', attributes: ['id', 'weeklyBlocks', 'subjectGroupId'] }],
      },
    ],
    transaction,
  });

  // teacherId -> unitKey -> weeklyBlocks (max across members of the unit)
  const units = new Map<number, Map<string, number>>();
  for (const a of assignments) {
    const pgs = (a as any).periodGradeSubject;
    if (!pgs) continue;
    if (!validPairs.has(`${pgs.periodGradeId}:${a.sectionId}`)) continue;
    if (!workload.has(a.teacherId)) continue;

    const weeklyBlocks = pgs.subject?.weeklyBlocks ?? pgs.weeklyBlocks;
    const linkId = pairToLink.get(`${pgs.subjectId}:${pgs.periodGradeId}`);
    const unitKey = linkId != null
      ? `link:${linkId}`
      : pgs.subject?.subjectGroupId != null
        ? `group:${pgs.periodGradeId}:${pgs.subjectId}`
        : `single:${pgs.id}:${a.sectionId}`;

    let teacherUnits = units.get(a.teacherId);
    if (!teacherUnits) units.set(a.teacherId, teacherUnits = new Map());
    teacherUnits.set(unitKey, Math.max(teacherUnits.get(unitKey) ?? 0, weeklyBlocks));
  }

  for (const [teacherId, teacherUnits] of units) {
    const entry = workload.get(teacherId)!;
    for (const wb of teacherUnits.values()) entry.teachingBlocks += wb;
  }

  // Painted administrative hours for the period
  const adminRows = await TeacherAdminHour.findAll({
    where: { schoolPeriodId },
    attributes: ['teacherId', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
    group: ['teacherId'],
    raw: true,
    transaction,
  });
  for (const row of adminRows as any[]) {
    const entry = workload.get(Number(row.teacherId));
    if (entry) entry.adminHours = Number(row.count);
  }

  for (const entry of workload.values()) {
    entry.teachingHours = entry.teachingBlocks * blockSize;
    entry.totalHours = entry.teachingHours + entry.adminHours;
  }

  return Array.from(workload.values())
    .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`, 'es'));
}
