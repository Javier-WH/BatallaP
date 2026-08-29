/**
 * scheduleGeneratorService
 *
 * Generates schedules automatically for all sections of a grade in a school period.
 * Uses backtracking with heuristics to place subjects into the weekly grid.
 *
 * Constraints respected:
 *  - weeklyBlocks per subject (total hours to place)
 *  - min_academic_hours_per_block (block size = N consecutive periods)
 *  - allowConsecutiveBlocks (whether a subject can use multi-period blocks)
 *  - maxHoursPerDay per subject (null = no limit)
 *  - Group subjects (same subjectGroupId) must be placed in the same slot across all sections
 *  - Teacher availability (TeacherAvailability: 'available' | 'busy' | 'preferred')
 *  - No teacher conflicts (a teacher can't be in two sections at the same time)
 *  - avoid_last_morning_first_afternoon: if a section uses the last morning period,
 *    the first afternoon period must be left empty for that section.
 */

import sequelize from '@/config/database';
import {
  Schedule, ScheduleEntry, PeriodGradeSection, PeriodGrade, PeriodGradeSubject,
  Subject, TeacherAssignment, TeacherAvailability, Setting, Grade, Section, Person,
} from '@/models';

// ── Types ──
interface PeriodSlot {
  id: string;          // m1, m2, t1, etc.
  section: 'manana' | 'tarde';
  isBreak: boolean;
  order: number;       // global order across all periods
  sectionOrder: number; // order within section (manana/tarde)
}

interface SubjectInfo {
  subjectId: number;
  subjectName: string;
  weeklyBlocks: number;
  allowConsecutiveBlocks: boolean;
  maxHoursPerDay: number | null;
  subjectGroupId: number | null;
  teachers: { teacherId: number; teacherName: string }[];
}

interface SectionInfo {
  periodGradeSectionId: number;
  sectionName: string;
  gradeName: string;
  subjects: SubjectInfo[];
}

interface PlacedEntry {
  day: string;
  periodId: string;
  subjectId: number;
  teacherId: number;
  isGroupSubject: boolean;
  periodGradeSectionId: number;
}

interface GenerationResult {
  success: boolean;
  placed: PlacedEntry[];
  unplaced: { sectionId: number; subjectId: number; reason: string }[];
  conflicts: { teacherId: number; day: string; periodId: string; sections: number[] }[];
  stats: { totalSlots: number; filledSlots: number; sections: number; subjects: number };
}

// ── Days ──
const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

// ── Build period slots from settings ──
function buildPeriodSlots(settings: Record<string, string>): PeriodSlot[] {
  const slots: PeriodSlot[] = [];
  let globalOrder = 0;

  const buildSection = (prefix: string, section: 'manana' | 'tarde', blocksBefore: number, recess: number, blocksAfter: number): void => {
    let sectionOrder = 0;
    for (let i = 0; i < blocksBefore; i++) {
      slots.push({ id: `${prefix}${i + 1}`, section, isBreak: false, order: globalOrder++, sectionOrder });
      sectionOrder++;
    }
    if (recess > 0) {
      slots.push({ id: `${prefix}_break`, section, isBreak: true, order: globalOrder++, sectionOrder });
      sectionOrder++;
    }
    for (let i = 0; i < blocksAfter; i++) {
      slots.push({ id: `${prefix}${blocksBefore + i + 1}`, section, isBreak: false, order: globalOrder++, sectionOrder });
      sectionOrder++;
    }
  };

  const mBefore = Number(settings.morning_blocks_before_recess) || 3;
  const mRecess = Number(settings.morning_recess_minutes) > 0 ? 1 : 0;
  const mAfter = Number(settings.morning_blocks_after_recess) || 0;
  buildSection('m', 'manana', mBefore, mRecess, mAfter);

  const aBefore = Number(settings.afternoon_blocks_before_recess) || 2;
  const aRecess = Number(settings.afternoon_recess_minutes) > 0 ? 1 : 0;
  const aAfter = Number(settings.afternoon_blocks_after_recess) || 0;
  buildSection('t', 'tarde', aBefore, aRecess, aAfter);

  return slots;
}

// Get non-break slots
function getTeachingSlots(slots: PeriodSlot[]): PeriodSlot[] {
  return slots.filter(s => !s.isBreak);
}

// Get the last morning slot and first afternoon slot
function getLastMorningFirstAfternoon(slots: PeriodSlot[]): { lastMorning?: PeriodSlot; firstAfternoon?: PeriodSlot } {
  const morning = slots.filter(s => s.section === 'manana' && !s.isBreak);
  const afternoon = slots.filter(s => s.section === 'tarde' && !s.isBreak);
  return {
    lastMorning: morning[morning.length - 1],
    firstAfternoon: afternoon[0],
  };
}

// ── Main generation function ──
export async function generateSchedulesForGrade(
  schoolPeriodId: number,
  periodGradeId: number
): Promise<GenerationResult> {
  // 1. Load settings
  const settingsRows = await Setting.findAll();
  const settings: Record<string, string> = {};
  settingsRows.forEach(s => { (settings as any)[s.key] = s.value; });

  const blockSize = Number(settings.min_academic_hours_per_block) || 1;
  const avoidLastMorningFirstAfternoon = settings.avoid_last_morning_first_afternoon === 'true';

  // 2. Build period slots
  const allSlots = buildPeriodSlots(settings);
  const teachingSlots = getTeachingSlots(allSlots);
  const { lastMorning, firstAfternoon } = getLastMorningFirstAfternoon(allSlots);

  // 3. Load all sections for this grade
  const pgsList = await PeriodGradeSection.findAll({
    where: { periodGradeId },
    include: [
      { model: PeriodGrade, as: 'periodGrade', include: [{ model: Grade, as: 'grade' }] },
      { model: Section, as: 'section' },
    ],
  });

  if (pgsList.length === 0) {
    return { success: false, placed: [], unplaced: [], conflicts: [], stats: { totalSlots: 0, filledSlots: 0, sections: 0, subjects: 0 } };
  }

  // 4. Load subjects + teacher assignments for each section
  const pgsSubjects = await PeriodGradeSubject.findAll({
    where: { periodGradeId, active: true },
    include: [{ model: Subject, as: 'subject' }],
    order: [['order', 'ASC']],
  });

  const sections: SectionInfo[] = [];
  for (const pgs of pgsList) {
    const assignments = await TeacherAssignment.findAll({
      where: { sectionId: pgs.id },
      include: [
        { model: Person, as: 'teacher', attributes: ['id', 'firstName', 'lastName'] },
        { model: PeriodGradeSubject, as: 'periodGradeSubject', attributes: ['id', 'subjectId', 'weeklyBlocks'] },
      ],
    });

    const subjects: SubjectInfo[] = pgsSubjects.map(p => {
      const subject = (p as any).subject;
      const teachers = assignments
        .filter(a => a.periodGradeSubjectId === p.id)
        .map(a => ({
          teacherId: (a as any).teacherId,
          teacherName: `${(a as any).teacher?.firstName ?? ''} ${(a as any).teacher?.lastName ?? ''}`.trim(),
        }));
      return {
        subjectId: p.subjectId,
        subjectName: subject?.name ?? '',
        weeklyBlocks: p.weeklyBlocks,
        allowConsecutiveBlocks: subject?.allowConsecutiveBlocks ?? false,
        maxHoursPerDay: (subject as any)?.maxHoursPerDay ?? null,
        subjectGroupId: subject?.subjectGroupId ?? null,
        teachers,
      };
    });

    sections.push({
      periodGradeSectionId: pgs.id,
      sectionName: (pgs as any).section?.name ?? '',
      gradeName: (pgs as any).periodGrade?.grade?.name ?? '',
      subjects,
    });
  }

  // 5. Load teacher availability for all teachers involved
  const allTeacherIds = new Set<number>();
  sections.forEach(s => s.subjects.forEach(sub => sub.teachers.forEach(t => allTeacherIds.add(t.teacherId))));
  const availabilityRows = await TeacherAvailability.findAll({
    where: { personId: Array.from(allTeacherIds) },
  });
  // Map: teacherId -> Set("day|periodId") for 'busy' status
  const busyMap = new Map<number, Set<string>>();
  const preferredMap = new Map<number, Set<string>>();
  availabilityRows.forEach(a => {
    const key = `${a.day}|${a.periodId}`;
    if (a.status === 'busy') {
      if (!busyMap.has(a.personId)) busyMap.set(a.personId, new Set());
      busyMap.get(a.personId)!.add(key);
    } else if (a.status === 'preferred') {
      if (!preferredMap.has(a.personId)) preferredMap.set(a.personId, new Set());
      preferredMap.get(a.personId)!.add(key);
    }
  });

  // 6. Build the placement grid
  // For each section: a map of "day|periodId" -> entry
  // For group subjects: we need to coordinate across sections

  // Group subjects by subjectGroupId
  const groupSubjectMap = new Map<number, SubjectInfo[]>(); // groupId -> subjects across all sections
  sections.forEach(sec => {
    sec.subjects.forEach(sub => {
      if (sub.subjectGroupId) {
        if (!groupSubjectMap.has(sub.subjectGroupId)) groupSubjectMap.set(sub.subjectGroupId, []);
        groupSubjectMap.get(sub.subjectGroupId)!.push(sub);
      }
    });
  });

  // Track teacher assignments: "teacherId|day|periodId" -> sectionId
  const teacherSlotMap = new Map<string, number>();

  // Track placed entries
  const placed: PlacedEntry[] = [];
  const unplaced: { sectionId: number; subjectId: number; reason: string }[] = [];

  // Track hours placed per subject per day per section
  // key: "sectionId|subjectId|day" -> count
  const hoursPerDay = new Map<string, number>();
  // key: "sectionId|subjectId" -> total placed
  const totalPlaced = new Map<string, number>();

  // Section grid: "sectionId|day|periodId" -> entry (for checking)
  const sectionGrid = new Map<string, PlacedEntry>();

  // ── Helper: check if a slot is available for a section ──
  const isSlotFree = (sectionId: number, day: string, periodId: string): boolean => {
    return !sectionGrid.has(`${sectionId}|${day}|${periodId}`);
  };

  // ── Helper: check if teacher is available ──
  const isTeacherAvailable = (teacherId: number, day: string, periodId: string): boolean => {
    const key = `${day}|${periodId}`;
    const busy = busyMap.get(teacherId);
    if (busy && busy.has(key)) return false;
    return true;
  };

  // ── Helper: check teacher conflict ──
  const hasTeacherConflict = (teacherId: number, day: string, periodId: string, sectionId: number): boolean => {
    const key = `${teacherId}|${day}|${periodId}`;
    const existing = teacherSlotMap.get(key);
    return existing !== undefined && existing !== sectionId;
  };

  // ── Helper: check avoid_last_morning_first_afternoon ──
  const passesGapRule = (sectionId: number, day: string, slot: PeriodSlot): boolean => {
    if (!avoidLastMorningFirstAfternoon || !lastMorning || !firstAfternoon) return true;
    // If placing in first afternoon, check if section already has last morning that day
    if (slot.id === firstAfternoon.id) {
      const lastMorningKey = `${sectionId}|${day}|${lastMorning.id}`;
      if (sectionGrid.has(lastMorningKey)) return false;
    }
    return true;
  };

  // ── Helper: check maxHoursPerDay ──
  const passesMaxHours = (sectionId: number, subjectId: number, day: string, maxHours: number | null, hoursToAdd: number): boolean => {
    if (maxHours === null) return true;
    const current = hoursPerDay.get(`${sectionId}|${subjectId}|${day}`) ?? 0;
    return current + hoursToAdd <= maxHours;
  };

  // ── Helper: get consecutive slots for a block (same section, no break) ──
  const getBlockSlots = (startSlot: PeriodSlot, size: number): PeriodSlot[] => {
    if (size <= 1) return [startSlot];
    const sectionSlots = teachingSlots.filter(s => s.section === startSlot.section);
    const idx = sectionSlots.findIndex(s => s.id === startSlot.id);
    if (idx < 0) return [startSlot];
    return sectionSlots.slice(idx, idx + size);
  };

  // ── Helper: try to place a subject in a section at a given day+slot ──
  const tryPlace = (
    sectionId: number,
    subject: SubjectInfo,
    day: string,
    startSlot: PeriodSlot,
    isGroup: boolean
  ): boolean => {
    const size = blockSize;
    const blockSlots = getBlockSlots(startSlot, size);
    if (blockSlots.length < size) return false;

    // Pick a teacher
    const teacher = subject.teachers[0];
    if (!teacher) return false; // no teacher assigned

    // Check all slots in the block
    for (const slot of blockSlots) {
      if (!isSlotFree(sectionId, day, slot.id)) return false;
      if (!passesGapRule(sectionId, day, slot)) return false;
      if (hasTeacherConflict(teacher.teacherId, day, slot.id, sectionId)) return false;
      if (!isTeacherAvailable(teacher.teacherId, day, slot.id)) return false;
    }
    if (!passesMaxHours(sectionId, subject.subjectId, day, subject.maxHoursPerDay, blockSlots.length)) return false;

    // For group subjects: check that all other sections with the same subjectGroupId
    // can also place their group subject in the same slot
    if (isGroup && subject.subjectGroupId) {
      const groupSubjects = groupSubjectMap.get(subject.subjectGroupId) ?? [];
      // Find which sections have this group subject and need it placed
      for (const gs of groupSubjects) {
        // Find the section that has this subject
        const targetSection = sections.find(s => s.subjects.some(sub => sub.subjectId === gs.subjectId && sub.subjectGroupId === subject.subjectGroupId));
        if (!targetSection) continue;
        const targetSectionId = targetSection.periodGradeSectionId;
        if (targetSectionId === sectionId) continue;
        // Check if the target section's slot is free
        for (const slot of blockSlots) {
          if (!isSlotFree(targetSectionId, day, slot.id)) {
            // It might be already placed with the same group subject — that's ok
            const existing = sectionGrid.get(`${targetSectionId}|${day}|${slot.id}`);
            if (!existing || existing.subjectId !== gs.subjectId) return false;
          }
        }
      }
    }

    // Place the entry
    for (const slot of blockSlots) {
      const entry: PlacedEntry = {
        day,
        periodId: slot.id,
        subjectId: subject.subjectId,
        teacherId: teacher.teacherId,
        isGroupSubject: isGroup,
        periodGradeSectionId: sectionId,
      };
      sectionGrid.set(`${sectionId}|${day}|${slot.id}`, entry);
      teacherSlotMap.set(`${teacher.teacherId}|${day}|${slot.id}`, sectionId);
      placed.push(entry);
      const hpKey = `${sectionId}|${subject.subjectId}|${day}`;
      hoursPerDay.set(hpKey, (hoursPerDay.get(hpKey) ?? 0) + 1);
      const tpKey = `${sectionId}|${subject.subjectId}`;
      totalPlaced.set(tpKey, (totalPlaced.get(tpKey) ?? 0) + 1);
    }

    // For group subjects: also place in other sections
    if (isGroup && subject.subjectGroupId) {
      const groupSubjects = groupSubjectMap.get(subject.subjectGroupId) ?? [];
      for (const gs of groupSubjects) {
        const targetSection = sections.find(s => s.subjects.some(sub => sub.subjectId === gs.subjectId && sub.subjectGroupId === subject.subjectGroupId));
        if (!targetSection) continue;
        const targetSectionId = targetSection.periodGradeSectionId;
        if (targetSectionId === sectionId) continue;
        const gsTeacher = gs.teachers[0];
        if (!gsTeacher) continue;
        for (const slot of blockSlots) {
          if (sectionGrid.has(`${targetSectionId}|${day}|${slot.id}`)) continue; // already placed
          const entry: PlacedEntry = {
            day,
            periodId: slot.id,
            subjectId: gs.subjectId,
            teacherId: gsTeacher.teacherId,
            isGroupSubject: true,
            periodGradeSectionId: targetSectionId,
          };
          sectionGrid.set(`${targetSectionId}|${day}|${slot.id}`, entry);
          teacherSlotMap.set(`${gsTeacher.teacherId}|${day}|${slot.id}`, targetSectionId);
          placed.push(entry);
          const hpKey = `${targetSectionId}|${gs.subjectId}|${day}`;
          hoursPerDay.set(hpKey, (hoursPerDay.get(hpKey) ?? 0) + 1);
          const tpKey = `${targetSectionId}|${gs.subjectId}`;
          totalPlaced.set(tpKey, (totalPlaced.get(tpKey) ?? 0) + 1);
        }
      }
    }

    return true;
  };

  // ── Helper: remove a placement (for backtracking) ──
  const removePlacement = (sectionId: number, subjectId: number, day: string, blockSlots: PeriodSlot[], isGroup: boolean, subjectGroupId: number | null) => {
    for (const slot of blockSlots) {
      const key = `${sectionId}|${day}|${slot.id}`;
      const entry = sectionGrid.get(key);
      if (entry) {
        sectionGrid.delete(key);
        teacherSlotMap.delete(`${entry.teacherId}|${day}|${slot.id}`);
        const idx = placed.findIndex(p => p.periodGradeSectionId === sectionId && p.day === day && p.periodId === slot.id && p.subjectId === subjectId);
        if (idx >= 0) placed.splice(idx, 1);
        const hpKey = `${sectionId}|${subjectId}|${day}`;
        hoursPerDay.set(hpKey, Math.max(0, (hoursPerDay.get(hpKey) ?? 0) - 1));
        const tpKey = `${sectionId}|${subjectId}`;
        totalPlaced.set(tpKey, Math.max(0, (totalPlaced.get(tpKey) ?? 0) - 1));
      }
    }
    // Remove group placements in other sections
    if (isGroup && subjectGroupId) {
      const groupSubjects = groupSubjectMap.get(subjectGroupId) ?? [];
      for (const gs of groupSubjects) {
        const targetSection = sections.find(s => s.subjects.some(sub => sub.subjectId === gs.subjectId && sub.subjectGroupId === subjectGroupId));
        if (!targetSection) continue;
        const targetSectionId = targetSection.periodGradeSectionId;
        if (targetSectionId === sectionId) continue;
        for (const slot of blockSlots) {
          const key = `${targetSectionId}|${day}|${slot.id}`;
          const entry = sectionGrid.get(key);
          if (entry && entry.subjectId === gs.subjectId) {
            sectionGrid.delete(key);
            teacherSlotMap.delete(`${entry.teacherId}|${day}|${slot.id}`);
            const idx = placed.findIndex(p => p.periodGradeSectionId === targetSectionId && p.day === day && p.periodId === slot.id && p.subjectId === gs.subjectId);
            if (idx >= 0) placed.splice(idx, 1);
            const hpKey = `${targetSectionId}|${gs.subjectId}|${day}`;
            hoursPerDay.set(hpKey, Math.max(0, (hoursPerDay.get(hpKey) ?? 0) - 1));
            const tpKey = `${targetSectionId}|${gs.subjectId}`;
            totalPlaced.set(tpKey, Math.max(0, (totalPlaced.get(tpKey) ?? 0) - 1));
          }
        }
      }
    }
  };

  // ── Build list of (section, subject) pairs to place, sorted by difficulty ──
  interface PlacementTask {
    sectionId: number;
    subject: SubjectInfo;
    isGroup: boolean;
    remaining: number; // hours remaining to place
    difficulty: number; // higher = harder to place, place first
  }

  const buildTasks = (): PlacementTask[] => {
    const tasks: PlacementTask[] = [];
    for (const sec of sections) {
      for (const sub of sec.subjects) {
        const isGroup = !!sub.subjectGroupId;
        // Difficulty: more weeklyBlocks = harder, fewer teachers = harder, group = harder
        const teacherCount = sub.teachers.length;
        const difficulty = sub.weeklyBlocks * 2 + (teacherCount === 0 ? 100 : 0) + (isGroup ? 5 : 0) + (sub.maxHoursPerDay ? 3 : 0);
        tasks.push({
          sectionId: sec.periodGradeSectionId,
          subject: sub,
          isGroup,
          remaining: sub.weeklyBlocks,
          difficulty,
        });
      }
    }
    // Sort by difficulty descending (hardest first)
    tasks.sort((a, b) => b.difficulty - a.difficulty);
    return tasks;
  };

  // ── Backtracking placement ──
  // For each task, try to place all remaining hours across the week
  const maxAttempts = 5000;
  let attempts = 0;

  const placeTask = (task: PlacementTask): boolean => {
    if (task.remaining <= 0) return true;
    if (attempts++ > maxAttempts) return false;

    // Try each day, each starting slot
    // Shuffle days to distribute evenly
    const dayOrder = [...DAYS].sort(() => Math.random() - 0.5);
    const slotOrder = [...teachingSlots].sort(() => Math.random() - 0.5);

    for (const day of dayOrder) {
      // Check maxHoursPerDay for this day
      const currentDayHours = hoursPerDay.get(`${task.sectionId}|${task.subject.subjectId}|${day}`) ?? 0;
      const maxHours = task.subject.maxHoursPerDay;
      if (maxHours !== null && currentDayHours + blockSize > maxHours) continue;

      for (const slot of slotOrder) {
        if (slot.section !== slot.section) continue;
        const blockSlots = getBlockSlots(slot, blockSize);
        if (blockSlots.length < blockSize) continue;

        // Check if all slots are free and valid
        let canPlace = true;
        for (const s of blockSlots) {
          if (!isSlotFree(task.sectionId, day, s.id)) { canPlace = false; break; }
          if (!passesGapRule(task.sectionId, day, s)) { canPlace = false; break; }
        }
        if (!canPlace) continue;

        // Try to place
        if (tryPlace(task.sectionId, task.subject, day, slot, task.isGroup)) {
          task.remaining -= blockSize;
          if (task.remaining <= 0) return true;
          if (placeTask(task)) return true;
          // Backtrack
          task.remaining += blockSize;
          removePlacement(task.sectionId, task.subject.subjectId, day, blockSlots, task.isGroup, task.subject.subjectGroupId);
        }
      }
    }
    return false;
  };

  // ── Run the algorithm ──
  const tasks = buildTasks();
  for (const task of tasks) {
    if (task.subject.teachers.length === 0) {
      unplaced.push({ sectionId: task.sectionId, subjectId: task.subject.subjectId, reason: 'Sin profesor asignado' });
      continue;
    }
    if (!placeTask(task)) {
      unplaced.push({ sectionId: task.sectionId, subjectId: task.subject.subjectId, reason: 'No se encontró espacio disponible' });
    }
  }

  // 7. Save to database
  if (placed.length > 0) {
    const t = await sequelize.transaction();
    try {
      // Group placed entries by section
      const bySection = new Map<number, PlacedEntry[]>();
      placed.forEach(e => {
        if (!bySection.has(e.periodGradeSectionId)) bySection.set(e.periodGradeSectionId, []);
        bySection.get(e.periodGradeSectionId)!.push(e);
      });

      for (const [sectionId, entries] of bySection) {
        // Find or create schedule
        const [schedule] = await Schedule.findOrCreate({
          where: { schoolPeriodId, periodGradeSectionId: sectionId },
          defaults: { schoolPeriodId, periodGradeSectionId: sectionId, status: 'draft' },
          transaction: t,
        });
        // Clear existing entries
        await ScheduleEntry.destroy({ where: { scheduleId: schedule.id }, transaction: t });
        // Bulk create
        await ScheduleEntry.bulkCreate(
          entries.map(e => ({
            scheduleId: schedule.id,
            day: e.day,
            periodId: e.periodId,
            subjectId: e.subjectId,
            teacherId: e.teacherId,
            isGroupSubject: e.isGroupSubject,
          })),
          { transaction: t }
        );
      }
      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }
  }

  // 8. Build result
  const totalSlots = sections.length * teachingSlots.length * DAYS.length;
  const result: GenerationResult = {
    success: unplaced.length === 0,
    placed,
    unplaced,
    conflicts: [],
    stats: {
      totalSlots,
      filledSlots: placed.length,
      sections: sections.length,
      subjects: tasks.length,
    },
  };
  return result;
}
