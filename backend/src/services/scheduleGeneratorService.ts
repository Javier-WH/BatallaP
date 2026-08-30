/**
 * scheduleGeneratorService
 *
 * Generates schedules automatically for ALL sections of ALL grades in a school period.
 * Uses Google OR-Tools CP-SAT solver via a Python child process.
 *
 * The TypeScript side:
 *   1. Loads all data from the DB (sections, subjects, teachers, availability, settings)
 *   2. Builds a JSON problem description
 *   3. Calls schedule_solver.py via child_process
 *   4. Parses the solution and saves to DB
 *
 * The Python side (schedule_solver.py):
 *   1. Reads the JSON problem from stdin
 *   2. Builds a CP-SAT model with all constraints
 *   3. Solves it
 *   4. Returns the solution as JSON on stdout
 */

import { spawn } from 'child_process';
import path from 'path';
import sequelize from '@/config/database';
import {
  Schedule, ScheduleEntry, PeriodGradeSection, PeriodGrade, PeriodGradeSubject,
  Subject, TeacherAssignment, TeacherAvailability, Setting, Grade, Section, Person,
  ScheduleException,
} from '@/models';

// ── Types ──
interface PeriodSlot {
  id: string;
  section: 'manana' | 'tarde';
  isBreak: boolean;
  order: number;
  sectionOrder: number;
}

interface BlockDef {
  id: string;          // e.g. "m1_m2" (composite of period IDs)
  day: string;
  section: 'manana' | 'tarde';
  periodIds: string[];
  order: number;       // order within the day+section
  globalOrder: number; // global order across all blocks (manana before tarde, days in order)
}

interface SubjectInput {
  subjectId: number;
  weeklyBlocks: number;
  allowConsecutiveBlocks: number;
  maxHoursPerDay: number | null;
  subjectGroupId: number | null;
  teacherId: number | null;
}

interface SectionInput {
  id: number;          // PeriodGradeSection.id
  periodGradeId: number;
  subjects: SubjectInput[];
}

interface GroupSubjectInput {
  subjectGroupId: number;
  periodGradeId: number;
  subjectIds: number[];
}

interface ProblemJson {
  blockSize: number;
  avoidLastMorningFirstAfternoon: boolean;
  days: string[];
  blocks: BlockDef[];
  sections: SectionInput[];
  teacherBusy: { teacherId: number; day: string; blockId: string }[];
  teacherPreferred: { teacherId: number; day: string; blockId: string }[];
  groupSubjects: GroupSubjectInput[];
}

interface SolverResult {
  success: boolean;
  placed: {
    sectionId: number; subjectId: number; teacherId: number;
    day: string; blockId: string; periodIds: string[]; isGroupSubject: boolean;
  }[];
  unplaced: { sectionId: number; subjectId: number; reason: string }[];
  stats: { filledBlocks: number; totalBlocks: number; status: string };
}

interface GenerationResult {
  success: boolean;
  placed: { day: string; periodId: string; subjectId: number; teacherId: number; isGroupSubject: boolean; periodGradeSectionId: number }[];
  unplaced: { sectionId: number; subjectId: number; reason: string }[];
  conflicts: any[];
  stats: { totalSlots: number; filledSlots: number; sections: number; subjects: number; solverStatus: string };
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

// ── Build fixed blocks from period slots ──
// Blocks are groups of `blockSize` consecutive non-break periods within the same section (manana/tarde).
// A class can only start at the beginning of a block.
function buildBlocks(slots: PeriodSlot[], blockSize: number): BlockDef[] {
  const blocks: BlockDef[] = [];
  const days = DAYS;
  let globalOrder = 0;

  for (const day of days) {
    for (const sec of ['manana', 'tarde'] as const) {
      const sectionSlots = slots.filter(s => s.section === sec && !s.isBreak);
      let order = 0;
      for (let i = 0; i < sectionSlots.length; i += blockSize) {
        const chunk = sectionSlots.slice(i, i + blockSize);
        if (chunk.length < blockSize) break; // incomplete block, skip
        const periodIds = chunk.map(s => s.id);
        const blockId = periodIds.join('_');
        blocks.push({
          id: blockId,
          day,
          section: sec,
          periodIds,
          order,
          globalOrder,
        });
        order++;
        globalOrder++;
      }
    }
  }

  return blocks;
}

// ── Call the Python solver ──
function callSolver(problem: ProblemJson): Promise<SolverResult> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, '..', '..', 'scripts', 'schedule_solver.py');
    const py = spawn('python', [scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    py.stdout.on('data', (data) => { stdout += data.toString(); });
    py.stderr.on('data', (data) => { stderr += data.toString(); });

    py.on('close', (code) => {
      if (stderr) {
        console.log(`[scheduleSolver] stderr: ${stderr}`);
      }
      if (code !== 0) {
        reject(new Error(`Python solver exited with code ${code}. stderr: ${stderr}`));
        return;
      }
      try {
        const result = JSON.parse(stdout);
        resolve(result);
      } catch (e) {
        reject(new Error(`Failed to parse solver output: ${e}. stdout: ${stdout.slice(0, 500)}. stderr: ${stderr.slice(0, 500)}`));
      }
    });

    py.on('error', (err) => {
      reject(new Error(`Failed to spawn python: ${err.message}`));
    });

    // Send the problem as JSON on stdin
    py.stdin.write(JSON.stringify(problem));
    py.stdin.end();
  });
}

// ── Main generation function ──
export async function generateSchedulesForPeriod(
  schoolPeriodId: number
): Promise<GenerationResult> {
  // 1. Load settings
  const settingsRows = await Setting.findAll();
  const settings: Record<string, string> = {};
  settingsRows.forEach(s => { (settings as any)[s.key] = s.value; });

  const blockSize = Number(settings.min_academic_hours_per_block) || 1;
  const avoidLastMorningFirstAfternoon = settings.avoid_last_morning_first_afternoon === 'true';

  // 2. Build period slots and blocks
  const allSlots = buildPeriodSlots(settings);
  const blocks = buildBlocks(allSlots, blockSize);

  // 3. Load ALL period grades
  const periodGrades = await PeriodGrade.findAll({
    where: { schoolPeriodId },
    include: [{ model: Grade, as: 'grade' }],
  });

  if (periodGrades.length === 0) {
    return { success: false, placed: [], unplaced: [], conflicts: [], stats: { totalSlots: 0, filledSlots: 0, sections: 0, subjects: 0, solverStatus: 'NO_GRADES' } };
  }

  const periodGradeIds = periodGrades.map(pg => pg.id);

  // 4. Load ALL sections, excluding MATERIA PENDIENTE
  const mpSection = await Section.findOne({ where: { name: 'MATERIA PENDIENTE' } });
  const allPgs = await PeriodGradeSection.findAll({
    where: { periodGradeId: periodGradeIds },
    include: [
      { model: PeriodGrade, as: 'periodGrade', include: [{ model: Grade, as: 'grade' }] },
      { model: Section, as: 'section' },
    ],
  });
  const allPgsFiltered = mpSection
    ? allPgs.filter(pgs => (pgs as any).sectionId !== mpSection.id)
    : allPgs;

  // 5. Load ALL subjects for ALL grades
  const allPgsSubjects = await PeriodGradeSubject.findAll({
    where: { periodGradeId: periodGradeIds, active: true },
    include: [{ model: Subject, as: 'subject' }],
    order: [['order', 'ASC']],
  });

  // 6. Load ALL teacher assignments
  // TeacherAssignment.sectionId references Section.id (NOT PeriodGradeSection.id)
  const allSectionIds = allPgsFiltered.map(pgs => (pgs as any).sectionId);
  const allAssignments = await TeacherAssignment.findAll({
    where: { sectionId: allSectionIds },
    include: [
      { model: Person, as: 'teacher', attributes: ['id', 'firstName', 'lastName'] },
      { model: PeriodGradeSubject, as: 'periodGradeSubject', attributes: ['id', 'subjectId', 'weeklyBlocks'] },
    ],
  });

  // 7. Build section inputs for the solver
  // Load schedule exceptions (per-subject overrides)
  const allSubjectIds = new Set<number>();
  allPgsSubjects.forEach(p => allSubjectIds.add(p.subjectId));
  const exceptions = await ScheduleException.findAll({
    where: { subjectId: Array.from(allSubjectIds) },
  });
  const exceptionMap = new Map<number, ScheduleException>();
  exceptions.forEach(e => exceptionMap.set(e.subjectId, e));

  const sectionInputs: SectionInput[] = [];
  const sectionPgMap = new Map<number, number>(); // sectionId (PGS.id) -> periodGradeId

  for (const pgs of allPgsFiltered) {
    const gradeSubjects = allPgsSubjects.filter(p => p.periodGradeId === pgs.periodGradeId);
    const sectionAssignments = allAssignments.filter(a => a.sectionId === (pgs as any).sectionId);

    const subjects: SubjectInput[] = gradeSubjects.map(p => {
      const subject = (p as any).subject;
      const assignment = sectionAssignments.find(a => a.periodGradeSubjectId === p.id);
      const exc = exceptionMap.get(p.subjectId);
      return {
        subjectId: p.subjectId,
        weeklyBlocks: exc?.weeklyBlocks != null ? exc.weeklyBlocks : p.weeklyBlocks,
        allowConsecutiveBlocks: exc?.allowConsecutiveBlocks != null ? exc.allowConsecutiveBlocks : ((subject as any)?.allowConsecutiveBlocks ?? 0),
        maxHoursPerDay: exc?.maxHoursPerDay != null ? exc.maxHoursPerDay : ((subject as any)?.maxHoursPerDay ?? null),
        subjectGroupId: subject?.subjectGroupId ?? null,
        teacherId: assignment ? (assignment as any).teacherId : null,
      };
    });

    sectionInputs.push({
      id: pgs.id,
      periodGradeId: pgs.periodGradeId,
      subjects,
    });
    sectionPgMap.set(pgs.id, pgs.periodGradeId);
  }

  // 8. Load teacher availability (busy slots)
  const allTeacherIds = new Set<number>();
  allAssignments.forEach(a => allTeacherIds.add((a as any).teacherId));
  const availabilityRows = await TeacherAvailability.findAll({
    where: { personId: Array.from(allTeacherIds) },
  });

  // Map teacher busy slots to block IDs
  // TeacherAvailability uses periodId (single period), we need to find which block contains that period
  const periodToBlock = new Map<string, BlockDef>(); // periodId -> block (for a given day)
  // Actually blocks are per-day, so we need (day, periodId) -> blockId
  const dayPeriodToBlock = new Map<string, string>();
  for (const b of blocks) {
    for (const pid of b.periodIds) {
      dayPeriodToBlock.set(`${b.day}|${pid}`, b.id);
    }
  }

  const teacherBusy: { teacherId: number; day: string; blockId: string }[] = [];
  const teacherPreferred: { teacherId: number; day: string; blockId: string }[] = [];
  availabilityRows.forEach(a => {
    const blockId = dayPeriodToBlock.get(`${a.day}|${a.periodId}`);
    if (!blockId) return;
    if (a.status === 'busy') {
      teacherBusy.push({ teacherId: a.personId, day: a.day, blockId });
    } else if (a.status === 'preferred') {
      teacherPreferred.push({ teacherId: a.personId, day: a.day, blockId });
    }
  });

  // 9. Build group subjects list
  // Group subjects by subjectGroupId within each periodGradeId
  const groupMap = new Map<string, { subjectGroupId: number; periodGradeId: number; subjectIds: number[] }>();
  for (const pgs of allPgsFiltered) {
    const gradeSubjects = allPgsSubjects.filter(p => p.periodGradeId === pgs.periodGradeId);
    for (const p of gradeSubjects) {
      const subject = (p as any).subject;
      const sgId = subject?.subjectGroupId;
      if (sgId) {
        const key = `${pgs.periodGradeId}|${sgId}`;
        if (!groupMap.has(key)) {
          groupMap.set(key, { subjectGroupId: sgId, periodGradeId: pgs.periodGradeId, subjectIds: [] });
        }
        const entry = groupMap.get(key)!;
        if (!entry.subjectIds.includes(p.subjectId)) {
          entry.subjectIds.push(p.subjectId);
        }
      }
    }
  }
  const groupSubjects = Array.from(groupMap.values());

  // 10. Build the problem JSON
  const problem: ProblemJson = {
    blockSize,
    avoidLastMorningFirstAfternoon,
    days: DAYS,
    blocks,
    sections: sectionInputs,
    teacherBusy,
    teacherPreferred,
    groupSubjects,
  };

  // Debug: log problem summary
  console.log(`[scheduleGenerator] Problem: ${sectionInputs.length} sections, ${blocks.length} blocks, ${groupSubjects.length} group subjects, ${teacherBusy.length} busy slots, ${teacherPreferred.length} preferred slots`);
  console.log(`[scheduleGenerator] blockSize=${blockSize}, avoidLastMorningFirstAfternoon=${avoidLastMorningFirstAfternoon}`);
  // Log busy slots per teacher for the group subject teachers
  const groupTeacherIds = new Set<number>();
  for (const sec of sectionInputs) {
    for (const sub of sec.subjects) {
      if (sub.subjectGroupId !== null && sub.teacherId !== null) {
        groupTeacherIds.add(sub.teacherId);
      }
    }
  }
  for (const tid of groupTeacherIds) {
    const busyCount = teacherBusy.filter(b => b.teacherId === tid).length;
    const prefCount = teacherPreferred.filter(p => p.teacherId === tid).length;
    const teacher = allAssignments.find(a => (a as any).teacherId === tid);
    const tName = teacher ? `${(teacher as any).teacher?.firstName} ${(teacher as any).teacher?.lastName}` : `ID ${tid}`;
    console.log(`[scheduleGenerator] Group teacher ${tName} (id=${tid}): ${busyCount} busy slots, ${prefCount} preferred slots`);
    // Log which days are busy
    const busyByDay: Record<string, number> = {};
    teacherBusy.filter(b => b.teacherId === tid).forEach(b => {
      busyByDay[b.day] = (busyByDay[b.day] || 0) + 1;
    });
    console.log(`[scheduleGenerator]   busy by day:`, JSON.stringify(busyByDay));
  }

  // 11. Call the solver
  let solverResult: SolverResult;
  try {
    solverResult = await callSolver(problem);
  } catch (e: any) {
    console.error('[scheduleGenerator] Solver error:', e.message);
    return {
      success: false,
      placed: [],
      unplaced: [],
      conflicts: [],
      stats: { totalSlots: 0, filledSlots: 0, sections: sectionInputs.length, subjects: 0, solverStatus: `SOLVER_ERROR: ${e.message}` },
    };
  }

  // 12. Convert solver result to DB entries
  // Each placed block has periodIds — we need to create one ScheduleEntry per period
  const placedEntries: { day: string; periodId: string; subjectId: number; teacherId: number; isGroupSubject: boolean; periodGradeSectionId: number }[] = [];
  for (const p of solverResult.placed) {
    for (const pid of p.periodIds) {
      placedEntries.push({
        day: p.day,
        periodId: pid,
        subjectId: p.subjectId,
        teacherId: p.teacherId,
        isGroupSubject: p.isGroupSubject,
        periodGradeSectionId: p.sectionId,
      });
    }
  }

  // 13. Save to database
  if (placedEntries.length > 0) {
    const t = await sequelize.transaction();
    try {
      const bySection = new Map<number, typeof placedEntries>();
      placedEntries.forEach(e => {
        if (!bySection.has(e.periodGradeSectionId)) bySection.set(e.periodGradeSectionId, []);
        bySection.get(e.periodGradeSectionId)!.push(e);
      });

      for (const [sectionId, entries] of bySection) {
        const [schedule] = await Schedule.findOrCreate({
          where: { schoolPeriodId, periodGradeSectionId: sectionId },
          defaults: { schoolPeriodId, periodGradeSectionId: sectionId, status: 'draft' },
          transaction: t,
        });
        await ScheduleEntry.destroy({ where: { scheduleId: schedule.id }, transaction: t });
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

  // 14. Return result
  const totalSlots = sectionInputs.length * blocks.length;
  return {
    success: solverResult.success,
    placed: placedEntries,
    unplaced: solverResult.unplaced,
    conflicts: [],
    stats: {
      totalSlots,
      filledSlots: placedEntries.length,
      sections: sectionInputs.length,
      subjects: sectionInputs.reduce((acc, s) => acc + s.subjects.length, 0),
      solverStatus: solverResult.stats.status,
    },
  };
}
