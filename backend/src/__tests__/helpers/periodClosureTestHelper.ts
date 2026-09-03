import {
  SchoolPeriod,
  Grade,
  Section,
  Subject,
  PeriodGrade,
  PeriodGradeSection,
  PeriodGradeSubject,
  Term,
  Inscription,
  InscriptionSubject,
  SubjectFinalGrade,
  SubjectTermGrade,
  Setting,
  SchoolPeriodTransitionRule,
  Person,
  User,
  PersonRole,
  Role,
  CouncilChecklist,
  RevisionPeriod,
  PendingSubject,
} from '@/models/index';
import { PeriodClosureExecutor } from '@/services/periodClosureExecutor';

let helperCounter = 0;

function nextId(): string {
  helperCounter += 1;
  return helperCounter.toString().padStart(6, '0');
}

export interface ClosureSetup {
  currentPeriod: SchoolPeriod;
  nextPeriod: SchoolPeriod;
  grades: Grade[];
  sections: Section[];
  subjects: Subject[];
  terms: Term[];
  periodGradesCurrent: Map<number, PeriodGrade>; // gradeId -> PeriodGrade
  periodGradesNext: Map<number, PeriodGrade>;
  periodGradeSubjectsCurrent: Map<string, PeriodGradeSubject>; // `${gradeId}:${subjectId}`
  periodGradeSubjectsNext: Map<string, PeriodGradeSubject>;
  transitionRules: Map<number, SchoolPeriodTransitionRule>; // gradeFromId -> rule
  masterUser: User;
  masterPerson: Person;
}

export interface StudentWithGrades {
  person: Person;
  inscription: Inscription;
  inscriptionSubjects: Map<number, InscriptionSubject>; // subjectId -> InscriptionSubject
}

/**
 * Creates a full closure setup with:
 * - A current period (activo) and a next period (preinscripcion)
 * - N grades with `order` 1..N
 * - One section per grade in each period
 * - M subjects per grade in each period
 * - 3 blocked terms
 * - Settings: min_approval_grade=10, max_failed_subjects=3
 * - Transition rules: grade[i] -> grade[i+1], last grade has no gradeToId
 * - A master user to execute the closure
 */
export async function createFullClosureSetup(options: {
  gradeCount?: number;
  subjectsPerGrade?: number;
  gradeNames?: string[];
  subjectNames?: string[];
} = {}): Promise<ClosureSetup> {
  const gradeCount = options.gradeCount ?? 2;
  const subjectsPerGrade = options.subjectsPerGrade ?? 3;
  const suffix = nextId();

  // Master user
  const masterUser = await User.create({
    username: `master_${suffix}`,
    password: 'password123',
  });
  const masterPerson = await Person.create({
    userId: masterUser.id,
    firstName: 'Master',
    lastName: 'Test',
    document: `M${suffix}`,
    documentType: 'Venezolano',
    birthdate: new Date('1990-01-01'),
    gender: 'M',
  });
  const [masterRole] = await Role.findOrCreate({ where: { name: 'Master' as const } });
  await PersonRole.create({ personId: masterPerson.id, roleId: masterRole.id });

  // Periods
  const currentPeriod = await SchoolPeriod.create({
    period: `2025-2026-${suffix}`,
    name: `Año Escolar 2025-2026 #${suffix}`,
    startYear: 2025,
    endYear: 2026,
    status: 'activo',
  });

  const nextPeriod = await SchoolPeriod.create({
    period: `2026-2027-${suffix}`,
    name: `Año Escolar 2026-2027 #${suffix}`,
    startYear: 2026,
    endYear: 2027,
    status: 'preinscripcion',
  });

  // Grades
  const grades: Grade[] = [];
  const gradeNames = options.gradeNames ?? ['1ER AÑO', '2DO AÑO', '3ER AÑO', '4TO AÑO', '5TO AÑO'];
  for (let i = 0; i < gradeCount; i++) {
    const g = await Grade.create({
      name: `${gradeNames[i] ?? `GRADO ${i + 1}`} ${suffix}`,
      isDiversified: false,
      order: i + 1,
    });
    grades.push(g);
  }

  // Sections (one per grade, shared across periods)
  const sections: Section[] = [];
  for (let i = 0; i < gradeCount; i++) {
    const s = await Section.create({ name: `A-${suffix}-${i}` });
    sections.push(s);
  }

  // Subjects (shared across grades for simplicity)
  const subjects: Subject[] = [];
  const subjectNames = options.subjectNames ?? ['MATEMÁTICA', 'CIENCIAS', 'HISTORIA', 'LENGUA', 'GEOGRAFÍA'];
  for (let i = 0; i < subjectsPerGrade; i++) {
    const s = await Subject.create({ name: `${subjectNames[i] ?? `MATERIA ${i + 1}`} ${suffix}` });
    subjects.push(s);
  }

  // Terms (3, all blocked)
  const terms: Term[] = [];
  for (let i = 0; i < 3; i++) {
    const t = await Term.create({
      schoolPeriodId: currentPeriod.id,
      name: `Lapso ${i + 1}`,
      order: i + 1,
      isBlocked: true,
      isActive: false,
    });
    terms.push(t);
  }

  // PeriodGrades + PeriodGradeSections + PeriodGradeSubjects for current and next period
  const periodGradesCurrent = new Map<number, PeriodGrade>();
  const periodGradesNext = new Map<number, PeriodGrade>();
  const periodGradeSubjectsCurrent = new Map<string, PeriodGradeSubject>();
  const periodGradeSubjectsNext = new Map<string, PeriodGradeSubject>();

  for (let gi = 0; gi < gradeCount; gi++) {
    const grade = grades[gi];
    const section = sections[gi];

    // Current period
    const pgCurrent = await PeriodGrade.create({
      schoolPeriodId: currentPeriod.id,
      gradeId: grade.id,
    });
    periodGradesCurrent.set(grade.id, pgCurrent);

    await PeriodGradeSection.create({
      periodGradeId: pgCurrent.id,
      sectionId: section.id,
    });

    for (let si = 0; si < subjectsPerGrade; si++) {
      const pgs = await PeriodGradeSubject.create({
        periodGradeId: pgCurrent.id,
        subjectId: subjects[si].id,
        active: true,
        includeInAverage: true,
        weeklyBlocks: 2,
      });
      periodGradeSubjectsCurrent.set(`${grade.id}:${subjects[si].id}`, pgs);
    }

    // Next period
    const pgNext = await PeriodGrade.create({
      schoolPeriodId: nextPeriod.id,
      gradeId: grade.id,
    });
    periodGradesNext.set(grade.id, pgNext);

    await PeriodGradeSection.create({
      periodGradeId: pgNext.id,
      sectionId: section.id,
    });

    for (let si = 0; si < subjectsPerGrade; si++) {
      const pgs = await PeriodGradeSubject.create({
        periodGradeId: pgNext.id,
        subjectId: subjects[si].id,
        active: true,
        includeInAverage: true,
        weeklyBlocks: 2,
      });
      periodGradeSubjectsNext.set(`${grade.id}:${subjects[si].id}`, pgs);
    }
  }

  // Transition rules: grade[i] -> grade[i+1], last grade has no gradeToId
  const transitionRules = new Map<number, SchoolPeriodTransitionRule>();
  for (let i = 0; i < gradeCount; i++) {
    const rule = await SchoolPeriodTransitionRule.create({
      gradeFromId: grades[i].id,
      gradeToId: i < gradeCount - 1 ? grades[i + 1].id : null,
      minAverage: 10,
      maxPendingSubjects: 3,
      autoGraduate: i === gradeCount - 1, // auto-graduate on last grade
    });
    transitionRules.set(grades[i].id, rule);
  }

  // Settings
  await Setting.create({ key: 'min_approval_grade', value: '10' });
  await Setting.create({ key: 'max_failed_subjects', value: '3' });

  return {
    currentPeriod,
    nextPeriod,
    grades,
    sections,
    subjects,
    terms,
    periodGradesCurrent,
    periodGradesNext,
    periodGradeSubjectsCurrent,
    periodGradeSubjectsNext,
    transitionRules,
    masterUser,
    masterPerson,
  };
}

/**
 * Creates a student with an inscription in the current period and
 * InscriptionSubject + SubjectFinalGrade for each subject with the given scores.
 *
 * @param setup The closure setup
 * @param gradeIndex Index of the grade (0-based)
 * @param scores Map of subjectIndex -> finalScore (e.g. {0: 15, 1: 8, 2: 12})
 * @param options.escolaridad Escolaridad status (default 'regular')
 * @param options.originPeriodId For materia_pendiente inscriptions
 */
export async function createStudentWithGrades(
  setup: ClosureSetup,
  gradeIndex: number,
  scores: Record<number, number>,
  options: {
    escolaridad?: string;
    originPeriodId?: number;
  } = {}
): Promise<StudentWithGrades> {
  const suffix = nextId();
  const grade = setup.grades[gradeIndex];
  const section = setup.sections[gradeIndex];

  // Create student person
  const person = await Person.create({
    firstName: `Estudiante`,
    lastName: `Test ${suffix}`,
    document: `E${suffix}`,
    documentType: 'Venezolano',
    birthdate: new Date('2010-01-01'),
    gender: 'M',
  });

  // Create inscription
  const inscription = await Inscription.create({
    personId: person.id,
    schoolPeriodId: setup.currentPeriod.id,
    gradeId: grade.id,
    sectionId: section.id,
    escolaridad: (options.escolaridad as any) || 'regular',
    isRepeater: options.escolaridad === 'repitiente',
  });

  // Create InscriptionSubject + SubjectFinalGrade for each subject
  const inscriptionSubjects = new Map<number, InscriptionSubject>();

  for (let si = 0; si < setup.subjects.length; si++) {
    const subject = setup.subjects[si];
    const insSub = await InscriptionSubject.create({
      inscriptionId: inscription.id,
      subjectId: subject.id,
      schoolPeriodId: setup.currentPeriod.id,
      gradeId: grade.id,
      sectionId: section.id,
    });
    inscriptionSubjects.set(subject.id, insSub);

    // Create SubjectTermGrade for each term (score 0, will be overwritten by sync)
    for (const term of setup.terms) {
      await SubjectTermGrade.create({
        inscriptionSubjectId: insSub.id,
        termId: term.id,
        score: scores[si] ?? 0,
        calculatedAt: new Date(),
      });
    }

    // Pre-create SubjectFinalGrade — the calculator will use it (isClosedPeriod=true)
    const finalScore = scores[si] ?? 0;
    const status = finalScore >= 10 ? 'aprobada' : 'reprobada';
    await SubjectFinalGrade.create({
      inscriptionSubjectId: insSub.id,
      finalScore,
      rawScore: finalScore,
      councilPoints: 0,
      status,
      calculatedAt: new Date(),
      gradeType: 'regular',
      schoolPeriodId: setup.currentPeriod.id,
      subjectId: subject.id,
      gradeId: grade.id,
    });
  }

  return { person, inscription, inscriptionSubjects };
}

/**
 * Creates a pending subject for a student, linked to an inscription.
 * This simulates a student who already has pending subjects from a previous period.
 */
export async function createPendingSubjectForStudent(
  setup: ClosureSetup,
  student: StudentWithGrades,
  subjectIndex: number,
  originPeriodId?: number,
): Promise<PendingSubject> {
  const subject = setup.subjects[subjectIndex];
  return await PendingSubject.create({
    newInscriptionId: student.inscription.id,
    subjectId: subject.id,
    originPeriodId: originPeriodId ?? setup.currentPeriod.id,
    status: 'pendiente',
  });
}

/**
 * Marks all council checklists as done for the current period.
 */
export async function markCouncilsDone(setup: ClosureSetup): Promise<void> {
  for (let gi = 0; gi < setup.grades.length; gi++) {
    for (const term of setup.terms) {
      await CouncilChecklist.create({
        schoolPeriodId: setup.currentPeriod.id,
        gradeId: setup.grades[gi].id,
        sectionId: setup.sections[gi].id,
        termId: term.id,
        status: 'done',
        completedAt: new Date(),
      });
    }
  }
}

/**
 * Creates a revision period in 'completed' status.
 */
export async function createCompletedRevisionPeriod(setup: ClosureSetup): Promise<RevisionPeriod> {
  return await RevisionPeriod.create({
    schoolPeriodId: setup.currentPeriod.id,
    status: 'completed',
    maxOpportunities: 3,
    passingGrade: 10,
    currentOpportunity: 1,
    completedAt: new Date(),
  });
}

/**
 * Executes the closure and returns the result.
 */
export async function executeClosure(
  setup: ClosureSetup,
): Promise<{
  success: boolean;
  closureId: number;
  stats: any;
  errors: string[];
  log: any;
}> {
  return await PeriodClosureExecutor.executeClosure(
    setup.currentPeriod.id,
    setup.masterUser.id,
  );
}

/**
 * Validates the closure (without executing).
 */
export async function validateClosure(
  setup: ClosureSetup,
): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
  return await PeriodClosureExecutor.validateClosure(setup.currentPeriod.id);
}
