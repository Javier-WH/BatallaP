import { execFileSync, execSync } from 'child_process';
import path from 'path';

const SOLVER = path.join(__dirname, '../../../scripts/schedule_solver.py');

function solverAvailable(): boolean {
  try {
    execSync('python -c "import ortools"', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

interface SolverResult {
  success: boolean;
  placed: Array<{ sectionId: number; subjectId: number; teacherId: number; day: string; blockId: string }>;
  unplaced: Array<{ sectionId: number; subjectId: number; reason: string }>;
}

function runSolver(problem: unknown): SolverResult {
  const out = execFileSync('python', [SOLVER], {
    input: JSON.stringify(problem),
    maxBuffer: 64 * 1024 * 1024,
  });
  return JSON.parse(out.toString());
}

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

function makeBlocks() {
  const blocks: Array<Record<string, unknown>> = [];
  for (const day of DAYS) {
    let go = 0;
    for (let i = 1; i <= 4; i++) {
      blocks.push({
        id: `m${2 * i - 1}_m${2 * i}`, day, section: 'manana',
        order: i - 1, globalOrder: go++, periodIds: [`m${2 * i - 1}`, `m${2 * i}`],
      });
    }
    [[1, 2], [3, 4], [5, 6]].forEach(([a, b], i) => {
      blocks.push({
        id: `t${a}_t${b}`, day, section: 'tarde',
        order: i, globalOrder: go++, periodIds: [`t${a}`, `t${b}`],
      });
    });
  }
  return blocks;
}

// Real-scenario regression: group subjects 33/35 linked across grades 4to/5to,
// forced to last_afternoon, weeklyBlocks=2, mandatory consecutive. Teachers:
// 51 busy all Jueves + mornings L/M/X/V; 57 busy mornings L/X/V.
function forcedLinkProblem() {
  const blocks = makeBlocks();
  const busy: Array<Record<string, unknown>> = [];
  for (const b of blocks) {
    const day = b.day as string;
    if (day === 'Jueves' || (b.section === 'manana' && day !== 'Martes')) {
      busy.push({ teacherId: 51, day, blockId: b.id });
    }
    if (b.section === 'manana' && ['Lunes', 'Miércoles', 'Viernes'].includes(day)) {
      busy.push({ teacherId: 57, day, blockId: b.id });
    }
  }
  const subjects = [
    { subjectId: 33, teacherId: 51, weeklyBlocks: 2, subjectGroupId: 1, allowConsecutiveBlocks: 2, difficulty: 'medium' },
    { subjectId: 35, teacherId: 57, weeklyBlocks: 2, subjectGroupId: 1, allowConsecutiveBlocks: 2, difficulty: 'medium' },
  ];
  return {
    blockSize: 2,
    days: DAYS,
    blocks,
    sections: [
      { id: 1, periodGradeId: 10, subjects },
      { id: 2, periodGradeId: 10, subjects },
      { id: 3, periodGradeId: 11, subjects },
      { id: 4, periodGradeId: 11, subjects },
    ],
    teacherBusy: busy,
    teacherPreferred: [],
    syncGroupSubjects: true,
    groupSubjects: [
      { periodGradeId: 10, subjectGroupId: 1, subjectIds: [33, 35] },
      { periodGradeId: 11, subjectGroupId: 1, subjectIds: [33, 35] },
    ],
    crossGradeLinks: [
      {
        id: 2,
        items: [
          { subjectId: 33, periodGradeId: 10 },
          { subjectId: 33, periodGradeId: 11 },
          { subjectId: 35, periodGradeId: 10 },
          { subjectId: 35, periodGradeId: 11 },
        ],
      },
    ],
    forcedSlotSubjects: [{ subjectId: 35, position: 'last_afternoon' }],
    forcedSlotDefaultWeight: 5000,
  };
}

const hasSolver = solverAvailable();
const maybeDescribe = hasSolver ? describe : describe.skip;

maybeDescribe('schedule_solver forced slot + consecutive link', () => {
  it('places a mandatory-consecutive forced link as a run ending the afternoon', () => {
    const result = runSolver(forcedLinkProblem());
    expect(result.unplaced).toEqual([]);

    const byPair = new Map<string, Array<{ day: string; blockId: string }>>();
    for (const p of result.placed) {
      const key = `${p.sectionId}:${p.subjectId}`;
      if (!byPair.has(key)) byPair.set(key, []);
      byPair.get(key)!.push({ day: p.day, blockId: p.blockId });
    }
    for (const sid of [1, 2, 3, 4]) {
      for (const subj of [33, 35]) {
        const ps = byPair.get(`${sid}:${subj}`) ?? [];
        expect(ps).toHaveLength(2);
        // The two blocks form one same-day run ending at the last afternoon block
        expect(new Set(ps.map(p => p.day)).size).toBe(1);
        expect(new Set(ps.map(p => p.blockId))).toEqual(new Set(['t3_t4', 't5_t6']));
      }
    }
  }, 180000);
});
