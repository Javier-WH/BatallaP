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

// Same-day duplication regression: a lone mode-0 subject (weekly 2) can either
// double up on one day (day has 2 blocks, no thin-day penalty) or spread to 2
// days (each day has 1 block -> thin-day penalty 150 each). Old weight (3)
// preferred doubling; the new weight (800) must prefer spreading.
function sameDayProblem() {
  const blocks = makeBlocks();
  const subjects = [
    { subjectId: 39, teacherId: 61, weeklyBlocks: 2, allowConsecutiveBlocks: 0, difficulty: 'light' },
  ];
  return {
    blockSize: 2,
    days: DAYS,
    blocks,
    sections: [{ id: 1, periodGradeId: 4, subjects }],
    teacherBusy: [],
    teacherPreferred: [],
    syncGroupSubjects: false,
    groupSubjects: [],
    crossGradeLinks: [],
    minConsolidatedBlocksPerDay: 2,
    thinDayWeight: 150,
    sameDaySubjectWeight: 800,
  };
}

// Difficulty gradient regression: one day only, all three teachers free in
// tarde only — heavy + medium + light must fill the 3-block afternoon.
// Gradient must put heavy first and pull light to the last block.
function difficultyGradientProblem() {
  const blocks = makeBlocks().filter(b => b.day === 'Lunes');
  const busy: Array<Record<string, unknown>> = [];
  for (const b of blocks) {
    if (b.section === 'manana') {
      busy.push({ teacherId: 49, day: 'Lunes', blockId: b.id });
      busy.push({ teacherId: 70, day: 'Lunes', blockId: b.id });
      busy.push({ teacherId: 71, day: 'Lunes', blockId: b.id });
    }
  }
  const subjects = [
    { subjectId: 3, teacherId: 49, weeklyBlocks: 1, allowConsecutiveBlocks: 0, difficulty: 'heavy' },
    { subjectId: 39, teacherId: 70, weeklyBlocks: 1, allowConsecutiveBlocks: 0, difficulty: 'light' },
    { subjectId: 4, teacherId: 71, weeklyBlocks: 1, allowConsecutiveBlocks: 0, difficulty: 'medium' },
  ];
  return {
    blockSize: 2,
    days: ['Lunes'],
    blocks,
    sections: [{ id: 1, periodGradeId: 4, subjects }],
    teacherBusy: busy,
    teacherPreferred: [],
    syncGroupSubjects: false,
    groupSubjects: [],
    crossGradeLinks: [],
    heavyPositionWeight: 20,
    lightPositionBonus: 10,
  };
}

// Short-visit regression: subject X can go either lone in the morning (day
// becomes 2 runs, one of them a single block) or merged into the afternoon run
// at a high heavy-position cost. With only the 200 run penalty the lone visit
// won; the 300 short-visit penalty must tip it toward merging.
function shortVisitProblem() {
  const blocks = makeBlocks().filter(b => b.day === 'Lunes');
  const busy: Array<Record<string, unknown>> = [];
  for (const b of blocks) {
    // Y's teacher: only t1_t2 free. X's teacher: only m1_m2 and t3_t4 free.
    if (!(b.id === 't1_t2')) busy.push({ teacherId: 80, day: 'Lunes', blockId: b.id as string });
    if (!(b.id === 'm1_m2' || b.id === 't3_t4')) busy.push({ teacherId: 81, day: 'Lunes', blockId: b.id as string });
  }
  const subjects = [
    { subjectId: 50, teacherId: 80, weeklyBlocks: 1, allowConsecutiveBlocks: 0, difficulty: 'medium' },
    { subjectId: 51, teacherId: 81, weeklyBlocks: 1, allowConsecutiveBlocks: 0, difficulty: 'heavy' },
  ];
  return {
    blockSize: 2,
    days: ['Lunes'],
    blocks,
    sections: [{ id: 1, periodGradeId: 4, subjects }],
    teacherBusy: busy,
    teacherPreferred: [],
    syncGroupSubjects: false,
    groupSubjects: [],
    crossGradeLinks: [],
    minConsolidatedBlocksPerDay: 2,
    heavyPositionWeight: 250,
    shortVisitWeight: 300,
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

maybeDescribe('schedule_solver same-day duplication', () => {
  it('never places a non-consecutive subject twice non-adjacent in one day', () => {
    const result = runSolver(sameDayProblem());
    expect(result.unplaced).toEqual([]);
    const ps = result.placed.filter(p => p.subjectId === 39);
    expect(ps).toHaveLength(2);
    if (ps[0].day === ps[1].day) {
      // Same day is only acceptable as one contiguous run ("one session"):
      // the two blocks must be adjacent in the same turn (m1_m2+m3_m4 ok,
      // m1_m2+t1_t2 or m1_m2+m5_m6 not ok).
      const first = (id: string) => parseInt(id.slice(1).split('_')[0], 10);
      expect(ps[0].blockId[0]).toBe(ps[1].blockId[0]);
      expect(Math.abs(first(ps[0].blockId) - first(ps[1].blockId))).toBe(2);
    }
  }, 180000);
});

maybeDescribe('schedule_solver difficulty gradient', () => {
  it('places heavy early in the turn and pulls light to the last block', () => {
    const result = runSolver(difficultyGradientProblem());
    expect(result.unplaced).toEqual([]);
    const heavy = result.placed.find(p => p.subjectId === 3);
    const light = result.placed.find(p => p.subjectId === 39);
    const medium = result.placed.find(p => p.subjectId === 4);
    expect(heavy?.blockId).toBe('t1_t2');
    expect(medium?.blockId).toBe('t3_t4');
    expect(light?.blockId).toBe('t5_t6');
  }, 180000);
});

maybeDescribe('schedule_solver short visit', () => {
  it('merges a block into an existing run instead of leaving a lone visit', () => {
    const result = runSolver(shortVisitProblem());
    expect(result.unplaced).toEqual([]);
    const x = result.placed.find(p => p.subjectId === 51);
    // X merges into the afternoon run (t3_t4 next to Y's t1_t2) rather than
    // sitting alone in the morning
    expect(x?.blockId).toBe('t3_t4');
  }, 180000);
});
