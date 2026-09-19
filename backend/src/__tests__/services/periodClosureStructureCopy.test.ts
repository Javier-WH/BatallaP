import '../setup';
import sequelize from '@/config/database';
import {
  Inscription,
  PeriodGrade,
  PeriodGradeSection,
  PeriodGradeSubject,
  Section,
  TeacherAssignment,
  Person,
} from '@/models/index';
import { clonePeriodStructure } from '@/services/schoolPeriodService';
import {
  createFullClosureSetup,
  createStudentWithGrades,
  markCouncilsDone,
  executeClosure,
  validateClosure,
  ClosureSetup,
} from '../helpers/periodClosureTestHelper';

describe('Period Closure — Structure copy to next period', () => {
  let setup: ClosureSetup;

  // E1: Next period has NO structure — the executor must clone it and still
  // inscribe the student in the promoted grade/section.
  it('E1: clones structure into an empty next period and inscribes the student', async () => {
    setup = await createFullClosureSetup({ gradeCount: 2, subjectsPerGrade: 3, nextPeriodStructure: 'none' });
    await markCouncilsDone(setup);

    // The helper assigns one distinct section per grade. Link the student's
    // section to the target grade (grade[1]) in the current period so the
    // promoted student can keep it.
    await PeriodGradeSection.create({
      periodGradeId: setup.periodGradesCurrent.get(setup.grades[1].id)!.id,
      sectionId: setup.sections[0].id,
    });

    const student = await createStudentWithGrades(setup, 0, { 0: 15, 1: 15, 2: 15 });

    const result = await executeClosure(setup);
    expect(result.success).toBe(true);
    expect(result.stats.skipped).toBe(0);
    expect(result.stats.newInscriptions).toBe(1);

    // Structure was cloned into the next period
    const nextPeriodGrades = await PeriodGrade.findAll({
      where: { schoolPeriodId: setup.nextPeriod.id },
    });
    expect(nextPeriodGrades.map(pg => pg.gradeId).sort()).toEqual(
      setup.grades.map(g => g.id).sort()
    );

    // The student was promoted: grade[0] -> grade[1], same section
    const newInscription = await Inscription.findOne({
      where: {
        personId: student.person.id,
        schoolPeriodId: setup.nextPeriod.id,
      },
    });
    expect(newInscription).not.toBeNull();
    expect(newInscription!.gradeId).toBe(setup.grades[1].id);
    expect(newInscription!.sectionId).toBe(setup.sections[0].id);
    expect(newInscription!.escolaridad).toBe('regular');
  });

  // E2: Next period partially configured — merge fills gaps without
  // duplicating the grade that already exists.
  it('E2: merges into a partially configured next period without duplicates', async () => {
    setup = await createFullClosureSetup({ gradeCount: 2, subjectsPerGrade: 2, nextPeriodStructure: 'none' });
    await markCouncilsDone(setup);

    // Pre-configure ONLY grade[0] in the next period (simulates manual config)
    const existingPg = await PeriodGrade.create({
      schoolPeriodId: setup.nextPeriod.id,
      gradeId: setup.grades[0].id,
    });
    await PeriodGradeSection.create({
      periodGradeId: existingPg.id,
      sectionId: setup.sections[0].id,
    });
    await PeriodGradeSubject.create({
      periodGradeId: existingPg.id,
      subjectId: setup.subjects[0].id,
      order: 1,
      weeklyBlocks: 5,
    });

    const student = await createStudentWithGrades(setup, 0, { 0: 15, 1: 15 });

    const result = await executeClosure(setup);
    expect(result.success).toBe(true);
    expect(result.stats.skipped).toBe(0);
    expect(result.stats.newInscriptions).toBe(1);

    // grade[0] exists exactly once in the next period (not duplicated)
    const grade0Rows = await PeriodGrade.count({
      where: { schoolPeriodId: setup.nextPeriod.id, gradeId: setup.grades[0].id },
    });
    expect(grade0Rows).toBe(1);

    // grade[1] was added by the merge
    const grade1Pg = await PeriodGrade.findOne({
      where: { schoolPeriodId: setup.nextPeriod.id, gradeId: setup.grades[1].id },
    });
    expect(grade1Pg).not.toBeNull();

    // The manually configured weeklyBlocks on the existing row were preserved
    const existingPgs = await PeriodGradeSubject.findOne({
      where: { periodGradeId: existingPg.id, subjectId: setup.subjects[0].id },
    });
    expect(existingPgs!.weeklyBlocks).toBe(5);

    // Student promoted into grade[1]
    const newInscription = await Inscription.findOne({
      where: { personId: student.person.id, schoolPeriodId: setup.nextPeriod.id },
    });
    expect(newInscription!.gradeId).toBe(setup.grades[1].id);
  });

  // E3: field fidelity — subject flags and colors are copied.
  it('E3: copies includeInAverage, notRepairable, weeklyBlocks and colors', async () => {
    setup = await createFullClosureSetup({ gradeCount: 1, subjectsPerGrade: 2, nextPeriodStructure: 'none' });

    // Customize the source rows
    const pgCurrent = setup.periodGradesCurrent.get(setup.grades[0].id)!;
    await pgCurrent.update({ color: '#112233' });
    const pgsSection = await PeriodGradeSection.findOne({
      where: { periodGradeId: pgCurrent.id, sectionId: setup.sections[0].id },
    });
    await pgsSection!.update({ color: '#445566' });
    const pgsCurrent = setup.periodGradeSubjectsCurrent.get(`${setup.grades[0].id}:${setup.subjects[0].id}`)!;
    await pgsCurrent.update({
      includeInAverage: false,
      notRepairable: true,
      weeklyBlocks: 4,
      order: 7,
    });

    const t = await sequelize.transaction();
    await clonePeriodStructure(setup.currentPeriod.id, setup.nextPeriod.id, t);
    await t.commit();

    const pgNext = await PeriodGrade.findOne({
      where: { schoolPeriodId: setup.nextPeriod.id, gradeId: setup.grades[0].id },
    });
    expect(pgNext).not.toBeNull();
    expect(pgNext!.color).toBe('#112233');

    const sectionNext = await PeriodGradeSection.findOne({
      where: { periodGradeId: pgNext!.id, sectionId: setup.sections[0].id },
    });
    expect(sectionNext!.color).toBe('#445566');

    const pgsNext = await PeriodGradeSubject.findOne({
      where: { periodGradeId: pgNext!.id, subjectId: setup.subjects[0].id },
    });
    expect(pgsNext).not.toBeNull();
    expect(pgsNext!.includeInAverage).toBe(false);
    expect(pgsNext!.notRepairable).toBe(true);
    expect(pgsNext!.weeklyBlocks).toBe(4);
    expect(pgsNext!.order).toBe(7);
  });

  // E4: teacher assignments are copied to the new periodGradeSubject/section.
  it('E4: copies teacher assignments to the new period structure', async () => {
    setup = await createFullClosureSetup({ gradeCount: 1, subjectsPerGrade: 1, nextPeriodStructure: 'none' });

    const teacher = await Person.create({
      firstName: 'Docente',
      lastName: 'Prueba',
      document: 'T-0001',
      documentType: 'Venezolano',
      birthdate: new Date('1985-05-15'),
      gender: 'F',
    });

    const pgsCurrent = setup.periodGradeSubjectsCurrent.get(`${setup.grades[0].id}:${setup.subjects[0].id}`)!;
    await TeacherAssignment.create({
      teacherId: teacher.id,
      periodGradeSubjectId: pgsCurrent.id,
      sectionId: setup.sections[0].id,
    });

    const t = await sequelize.transaction();
    await clonePeriodStructure(setup.currentPeriod.id, setup.nextPeriod.id, t);
    await t.commit();

    const pgNext = await PeriodGrade.findOne({
      where: { schoolPeriodId: setup.nextPeriod.id, gradeId: setup.grades[0].id },
    });
    const pgsNext = await PeriodGradeSubject.findOne({
      where: { periodGradeId: pgNext!.id, subjectId: setup.subjects[0].id },
    });

    const newAssignment = await TeacherAssignment.findOne({
      where: {
        periodGradeSubjectId: pgsNext!.id,
        sectionId: setup.sections[0].id,
      },
    });
    expect(newAssignment).not.toBeNull();
    expect(newAssignment!.teacherId).toBe(teacher.id);
  });

  // E5: validation warns (does not block) when the next period lacks structure.
  it('E5: validateClosure warns that structure will be auto-copied', async () => {
    setup = await createFullClosureSetup({ gradeCount: 2, subjectsPerGrade: 1, nextPeriodStructure: 'none' });
    await markCouncilsDone(setup);

    const result = await validateClosure(setup);
    expect(result.valid).toBe(true);
    expect(result.warnings.some(w => w.includes('se copiará automáticamente'))).toBe(true);
  });

  // Sanity: 'none' structure also skips cloning the Materia Pendiente section
  // row per grade — the MP inscription flow still creates it on demand.
  it('E6: MP inscriptions still work when next period structure was cloned', async () => {
    setup = await createFullClosureSetup({ gradeCount: 2, subjectsPerGrade: 4, nextPeriodStructure: 'none' });
    await markCouncilsDone(setup);

    // Student fails 1 of 4 subjects → materias_pendientes (max_failed_subjects=3)
    const student = await createStudentWithGrades(setup, 0, { 0: 15, 1: 15, 2: 15, 3: 5 });

    const result = await executeClosure(setup);
    expect(result.success).toBe(true);
    expect(result.stats.withPendingSubjects).toBe(1);
    expect(result.stats.pendingSubjectsCreated).toBe(1);

    // Two inscriptions: regular in grade[1] + MP in grade[0] with MP section
    const newInscriptions = await Inscription.findAll({
      where: { personId: student.person.id, schoolPeriodId: setup.nextPeriod.id },
    });
    expect(newInscriptions.length).toBe(2);

    const regularIns = newInscriptions.find(i => i.escolaridad === 'regular');
    const mpIns = newInscriptions.find(i => i.escolaridad === 'materia_pendiente');
    expect(regularIns?.gradeId).toBe(setup.grades[1].id);
    expect(mpIns?.gradeId).toBe(setup.grades[0].id);

    const mpSection = await Section.findOne({ where: { isMateriaPendiente: true } });
    expect(mpIns?.sectionId).toBe(mpSection?.id);
  });
});
