import request from 'supertest';
import ExcelJS from 'exceljs';
import app from '@/app';
import {
  createTestUser,
  createTestRole,
  createAcademicStructure,
  createTestInscription,
  createTestTerm,
  createTestSection,
} from '../helpers/testData';
import {
  PersonRole,
  EvaluationPlan,
  EvaluationCriteria,
  EvaluationIndicator,
  Qualification,
  QualificationEditRequest,
  InscriptionSubject,
  SubjectTermGrade,
  TeacherAssignment,
  Inscription,
  CouncilChecklist,
} from '@/models/index';

// Regression: deleting an evaluation must remove its qualifications, criteria
// and the persisted per-term snapshots — otherwise historical views, Excel
// summaries and certified grades keep showing grades of deleted evaluations.
describe('Evaluation Endpoints — deleteEvaluationItem cleanup', () => {
  let agent: any;
  let setup: any;

  beforeEach(async () => {
    agent = request.agent(app);

    const { person } = await createTestUser({ username: 'teacher' });
    const teacherRole = await createTestRole('Profesor');
    await PersonRole.create({ personId: person.id, roleId: teacherRole.id });
    await agent
      .post('/api/auth/login')
      .send({ username: 'teacher', password: 'password123' });

    const structure = await createAcademicStructure();
    const term = await createTestTerm(structure.period.id, { name: 'Primer Lapso', order: 1 });

    const { person: studentPerson } = await createTestUser({
      username: 'student1',
      firstName: 'Estudiante',
      lastName: 'Prueba',
    });
    const alumnoRole = await createTestRole('Alumno');
    await PersonRole.create({ personId: studentPerson.id, roleId: alumnoRole.id });

    const inscription = await createTestInscription(
      studentPerson.id,
      structure.period.id,
      structure.grade.id,
      structure.section.id,
    );
    const insSub = await InscriptionSubject.create({
      inscriptionId: inscription.id,
      subjectId: structure.subject.id,
      schoolPeriodId: structure.period.id,
      gradeId: structure.grade.id,
      sectionId: structure.section.id,
    });

    setup = { structure, term, inscription, insSub };
  });

  const createPlan = (termId: number, percentage: number, description = 'Examen') =>
    EvaluationPlan.create({
      periodGradeSubjectId: setup.structure.periodGradeSubject.id,
      sectionId: setup.structure.section.id,
      termId,
      description,
      percentage,
      date: new Date('2025-09-15'),
    });

  const saveScore = (evaluationPlanId: number, score: number) =>
    agent
      .post('/api/evaluation/qualifications')
      .send({ evaluationPlanId, inscriptionSubjectId: setup.insSub.id, score })
      .expect(200);

  it('elimina calificaciones, criteria y snapshots de lapso al borrar la evaluación', async () => {
    const plan = await createPlan(setup.term.id, 100);
    const criterion = await EvaluationCriteria.create({ evaluationPlanId: plan.id, name: 'C1', points: 20 });
    await EvaluationIndicator.create({ evaluationCriteriaId: criterion.id, name: 'I1', points: 20 });
    await saveScore(plan.id, 15);

    // Snapshot exists before deletion
    expect(
      await SubjectTermGrade.count({ where: { inscriptionSubjectId: setup.insSub.id } }),
    ).toBeGreaterThan(0);

    await agent.delete(`/api/evaluation/plan/${plan.id}`).expect(200);

    expect(await EvaluationPlan.findByPk(plan.id)).toBeNull();
    expect(await Qualification.count({ where: { evaluationPlanId: plan.id } })).toBe(0);
    expect(await EvaluationCriteria.count({ where: { evaluationPlanId: plan.id } })).toBe(0);
    expect(await EvaluationIndicator.count({ where: { evaluationCriteriaId: criterion.id } })).toBe(0);
    // Ghost term grades removed: subject left with no contributions
    expect(await SubjectTermGrade.count({ where: { inscriptionSubjectId: setup.insSub.id } })).toBe(0);
  });

  it('limpia solicitudes de edición huérfanas al borrar la evaluación', async () => {
    const plan = await createPlan(setup.term.id, 100);
    await saveScore(plan.id, 10);
    const qual = await Qualification.findOne({
      where: { evaluationPlanId: plan.id, inscriptionSubjectId: setup.insSub.id },
    });
    const { user: teacherUser } = await createTestUser({ username: 'teacher2' });
    const editRequest = await QualificationEditRequest.create({
      qualificationId: qual!.id,
      requestedBy: teacherUser.id,
      justification: 'Necesito corregir',
    });

    await agent.delete(`/api/evaluation/plan/${plan.id}`).expect(200);

    expect(await QualificationEditRequest.findByPk(editRequest.id)).toBeNull();
  });

  it('recalcula el snapshot del lapso cuando quedan otras evaluaciones', async () => {
    const planA = await createPlan(setup.term.id, 50, 'Examen A');
    const planB = await createPlan(setup.term.id, 50, 'Examen B');
    await saveScore(planA.id, 10); // 10 * 0.5 = 5
    await saveScore(planB.id, 20); // 20 * 0.5 = 10 → term = 15

    let tg = await SubjectTermGrade.findOne({
      where: { inscriptionSubjectId: setup.insSub.id, termId: setup.term.id },
    });
    expect(Number(tg!.score)).toBe(15);

    await agent.delete(`/api/evaluation/plan/${planB.id}`).expect(200);

    tg = await SubjectTermGrade.findOne({
      where: { inscriptionSubjectId: setup.insSub.id, termId: setup.term.id },
    });
    // Only planA contributes now: 10 * 0.5 = 5
    expect(Number(tg!.score)).toBe(5);
    expect(await Qualification.count({ where: { evaluationPlanId: planA.id } })).toBe(1);
  });

  it('permite borrar una evaluación sin calificaciones', async () => {
    const plan = await createPlan(setup.term.id, 100);
    await agent.delete(`/api/evaluation/plan/${plan.id}`).expect(200);
    expect(await EvaluationPlan.findByPk(plan.id)).toBeNull();
  });

  it('recalcula snapshots al cambiar el porcentaje de una evaluación', async () => {
    const planA = await createPlan(setup.term.id, 50, 'Examen A');
    const planB = await createPlan(setup.term.id, 50, 'Examen B');
    await saveScore(planA.id, 10);
    await saveScore(planB.id, 20);

    // Lower planB weight: 10*0.5 + 20*0.3 = 11
    await agent
      .put(`/api/evaluation/plan/${planB.id}`)
      .send({ percentage: 30 })
      .expect(200);

    const tg = await SubjectTermGrade.findOne({
      where: { inscriptionSubjectId: setup.insSub.id, termId: setup.term.id },
    });
    expect(Number(tg!.score)).toBe(11);
  });
});

// Withdrawal visibility rules:
//  - A student withdrawn mid-term (before the council/section closure for
//    that term) disappears from grade views — incomplete grades can't transfer.
//  - A student withdrawn AFTER the term officially finished stays listed for
//    that term only, so teachers and staff can review their recorded grades.
describe('Evaluation Endpoints — withdrawn students visibility', () => {
  let agent: any;
  let setup: any;

  beforeEach(async () => {
    agent = request.agent(app);

    const { person } = await createTestUser({ username: 'teacher' });
    const teacherRole = await createTestRole('Profesor');
    await PersonRole.create({ personId: person.id, roleId: teacherRole.id });
    await agent
      .post('/api/auth/login')
      .send({ username: 'teacher', password: 'password123' });

    const structure = await createAcademicStructure();
    const term = await createTestTerm(structure.period.id, { name: 'Primer Lapso', order: 1 });
    const assignment = await TeacherAssignment.create({
      teacherId: person.id,
      periodGradeSubjectId: structure.periodGradeSubject.id,
      sectionId: structure.section.id,
    });

    const { person: studentPerson } = await createTestUser({
      username: 'student1',
      firstName: 'Estudiante',
      lastName: 'Prueba',
    });
    const alumnoRole = await createTestRole('Alumno');
    await PersonRole.create({ personId: studentPerson.id, roleId: alumnoRole.id });

    const inscription = await createTestInscription(
      studentPerson.id,
      structure.period.id,
      structure.grade.id,
      structure.section.id,
    );
    const insSub = await InscriptionSubject.create({
      inscriptionId: inscription.id,
      subjectId: structure.subject.id,
      schoolPeriodId: structure.period.id,
      gradeId: structure.grade.id,
      sectionId: structure.section.id,
    });

    const evalPlan = await EvaluationPlan.create({
      periodGradeSubjectId: structure.periodGradeSubject.id,
      sectionId: structure.section.id,
      termId: term.id,
      description: 'Examen 1',
      percentage: 100,
      date: new Date('2025-09-15'),
    });

    setup = { structure, term, assignment, inscription, insSub, evalPlan };
  });

  const markCouncilDone = (termId: number, completedAt: Date) =>
    CouncilChecklist.create({
      schoolPeriodId: setup.structure.period.id,
      gradeId: setup.structure.grade.id,
      sectionId: setup.structure.section.id,
      termId,
      status: 'done',
      completedAt,
    });

  const getStudents = (termId: number) =>
    agent
      .get(`/api/evaluation/students/${setup.assignment.id}`)
      .query({ termId })
      .expect(200);

  it('un retirado a mitad de lapso (sin consejo) NO aparece', async () => {
    await agent
      .post('/api/evaluation/qualifications')
      .send({ evaluationPlanId: setup.evalPlan.id, inscriptionSubjectId: setup.insSub.id, score: 15 })
      .expect(200);

    await setup.inscription.update({ sectionId: null, withdrawnAt: new Date(), rosterNumber: null } as any);

    const res = await getStudents(setup.term.id);
    expect((res.body as any[]).some((i: any) => i.id === setup.inscription.id)).toBe(false);
  });

  it('un retirado DESPUÉS del consejo completado aparece con sus notas', async () => {
    await agent
      .post('/api/evaluation/qualifications')
      .send({ evaluationPlanId: setup.evalPlan.id, inscriptionSubjectId: setup.insSub.id, score: 15 })
      .expect(200);

    // Council finished first, student withdrew afterwards.
    await markCouncilDone(setup.term.id, new Date('2025-11-15'));
    await setup.inscription.update({
      sectionId: null,
      withdrawnAt: new Date('2025-11-20'),
      rosterNumber: null,
    } as any);

    const res = await getStudents(setup.term.id);

    const row = (res.body as any[]).find((i: any) => i.id === setup.inscription.id);
    expect(row).toBeDefined();
    expect(row.withdrawnAt).not.toBeNull();
    const quals = row.inscriptionSubjects?.[0]?.qualifications ?? [];
    expect(quals.length).toBeGreaterThan(0);
    expect(Number(quals[0].score)).toBe(15);
  });

  it('un retirado ANTES de que se completara el consejo NO aparece', async () => {
    // Student withdrew mid-term; the council only completed afterwards.
    await setup.inscription.update({
      sectionId: null,
      withdrawnAt: new Date('2025-10-10'),
      rosterNumber: null,
    } as any);
    await markCouncilDone(setup.term.id, new Date('2025-11-15'));

    const res = await getStudents(setup.term.id);
    expect((res.body as any[]).some((i: any) => i.id === setup.inscription.id)).toBe(false);
  });

  it('un retirado post-consejo NO aparece en lapsos posteriores', async () => {
    const term2 = await createTestTerm(setup.structure.period.id, { name: 'Segundo Lapso', order: 2 });

    // Term 1 council done → student withdrew after it. Term 2 council never ran.
    await markCouncilDone(setup.term.id, new Date('2025-11-15'));
    await setup.inscription.update({
      sectionId: null,
      withdrawnAt: new Date('2025-11-20'),
      rosterNumber: null,
    } as any);

    const resTerm1 = await getStudents(setup.term.id);
    expect((resTerm1.body as any[]).some((i: any) => i.id === setup.inscription.id)).toBe(true);

    const resTerm2 = await getStudents(term2.id);
    expect((resTerm2.body as any[]).some((i: any) => i.id === setup.inscription.id)).toBe(false);
  });

  it('la planilla Excel del lapso completado incluye al retirado; la de otro lapso no', async () => {
    const term2 = await createTestTerm(setup.structure.period.id, { name: 'Segundo Lapso', order: 2 });

    // Second, still-enrolled student so the term-2 sheet has a roster.
    const { person: activePerson } = await createTestUser({ username: 'student2' });
    const activeInscription = await createTestInscription(
      activePerson.id,
      setup.structure.period.id,
      setup.structure.grade.id,
      setup.structure.section.id,
    );
    await InscriptionSubject.create({
      inscriptionId: activeInscription.id,
      subjectId: setup.structure.subject.id,
      schoolPeriodId: setup.structure.period.id,
      gradeId: setup.structure.grade.id,
      sectionId: setup.structure.section.id,
    });

    await agent
      .post('/api/evaluation/qualifications')
      .send({ evaluationPlanId: setup.evalPlan.id, inscriptionSubjectId: setup.insSub.id, score: 15 })
      .expect(200);

    // Term 1 council done → student withdrew afterwards.
    await markCouncilDone(setup.term.id, new Date('2025-11-15'));
    await setup.inscription.update({
      sectionId: null,
      withdrawnAt: new Date('2025-11-20'),
      rosterNumber: null,
    } as any);

    const exportSheet = async (termId: number) => {
      const res = await agent
        .get(`/api/evaluation/export-grades/${setup.assignment.id}`)
        .query({ term: termId })
        .buffer(true)
        .parse((r: any, cb: any) => {
          const chunks: Buffer[] = [];
          r.on('data', (c: Buffer) => chunks.push(c));
          r.on('end', () => cb(null, Buffer.concat(chunks)));
        })
        .expect(200);
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(res.body);
      const texts: string[] = [];
      wb.eachSheet(sheet =>
        sheet.eachRow(row =>
          row.eachCell(cell => texts.push(String(cell.value ?? ''))),
        ),
      );
      return texts.join(' | ');
    };

    const term1Content = await exportSheet(setup.term.id);
    expect(term1Content.toUpperCase()).toContain('PRUEBA'); // withdrawn student's lastName

    const term2Content = await exportSheet(term2.id);
    expect(term2Content.toUpperCase()).not.toContain('PRUEBA');
  });

  it('un retirado de OTRA sección no aparece en esta asignación', async () => {
    // Second section in the same grade: withdrawn student whose insSub points
    // to a different section must not leak into this assignment's roster.
    const otherSection = await createTestSection();
    const { person: otherPerson } = await createTestUser({ username: 'student2' });
    const otherInscription = await createTestInscription(
      otherPerson.id,
      setup.structure.period.id,
      setup.structure.grade.id,
      otherSection.id,
    );
    const otherInsSub = await InscriptionSubject.create({
      inscriptionId: otherInscription.id,
      subjectId: setup.structure.subject.id,
      schoolPeriodId: setup.structure.period.id,
      gradeId: setup.structure.grade.id,
      sectionId: otherSection.id,
    });
    // Grade recorded directly: the save endpoint validates that the
    // inscription subject belongs to the plan's section.
    await Qualification.create({
      evaluationPlanId: setup.evalPlan.id,
      inscriptionSubjectId: otherInsSub.id,
      score: 12,
      isAbsent: false,
    });
    // Even with the council done and a post-council withdrawal, the student
    // never studied THIS subject in THIS section.
    await markCouncilDone(setup.term.id, new Date('2025-11-15'));
    await otherInscription.update({ sectionId: null, withdrawnAt: new Date('2025-11-20'), rosterNumber: null } as any);

    const res = await agent
      .get(`/api/evaluation/students/${setup.assignment.id}`)
      .query({ termId: setup.term.id })
      .expect(200);

    expect((res.body as any[]).some((i: any) => i.id === otherInscription.id)).toBe(false);
  });
});
