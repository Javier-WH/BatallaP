import request from 'supertest';
import app from '@/app';
import {
  createTestUser,
  createTestRole,
  createAcademicStructure,
  createTestInscription,
  createTestTerm,
  createTestSetting,
} from '../helpers/testData';
import {
  PersonRole,
  EvaluationPlan,
  Qualification,
  QualificationEditRequest,
  GradeChangeLog,
  InscriptionSubject,
  TeacherAssignment,
} from '@/models/index';

/* ------------------------------------------------------------------ */
/* Shared setup helpers                                                */
/* ------------------------------------------------------------------ */

async function buildBaseSetup() {
  const agent = request.agent(app);

  // Teacher user and login
  const { user, person } = await createTestUser({ username: 'teacher' });
  const teacherRole = await createTestRole('Profesor');
  await PersonRole.create({ personId: person.id, roleId: teacherRole.id });
  await agent.post('/api/auth/login').send({ username: 'teacher', password: 'password123' });

  // Academic structure + term
  const structure = await createAcademicStructure();
  const term = await createTestTerm(structure.period.id, { name: 'Primer Lapso', order: 1 });

  // Student with inscription + subject
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
    description: 'Examen parcial',
    percentage: 25,
    date: new Date('2025-09-15'),
  });

  return { agent, user, person, structure, term, studentPerson, inscription, insSub, evalPlan };
}

async function createControlEstudiosAgent() {
  const agent = request.agent(app);
  const { user, person } = await createTestUser({ username: 'control' });
  const role = await createTestRole('Control de Estudios');
  await PersonRole.create({ personId: person.id, roleId: role.id });
  await agent.post('/api/auth/login').send({ username: user.username, password: 'password123' });
  return { agent, user };
}

async function createQualification(evalPlanId: number, insSubId: number, overrides: Partial<any> = {}) {
  return await Qualification.create({
    evaluationPlanId: evalPlanId,
    inscriptionSubjectId: insSubId,
    score: 15,
    scoreSetAt: new Date(),
    ...overrides,
  });
}

/* ------------------------------------------------------------------ */
/* POST /api/evaluation/grade-edit-request                             */
/* ------------------------------------------------------------------ */

describe('Grade Edit Requests — POST /grade-edit-request', () => {
  let setup: any;

  beforeEach(async () => {
    setup = await buildBaseSetup();
  });

  it('1. sin sesión activa responde 401', async () => {
    const q = await createQualification(setup.evalPlan.id, setup.insSub.id);
    const unauthAgent = request.agent(app);

    await unauthAgent
      .post('/api/evaluation/grade-edit-request')
      .send({ qualificationId: q.id, justification: 'prueba' })
      .expect(401);
  });

  it('2. rechaza sin justificación (400)', async () => {
    const q = await createQualification(setup.evalPlan.id, setup.insSub.id);

    const response = await setup.agent
      .post('/api/evaluation/grade-edit-request')
      .send({ qualificationId: q.id, justification: '   ' })
      .expect(400);

    expect(response.body.message).toContain('justificación');
  });

  it('3. rechaza qualificationId inexistente (404)', async () => {
    await setup.agent
      .post('/api/evaluation/grade-edit-request')
      .send({ qualificationId: 99999, justification: 'prueba' })
      .expect(404);
  });

  it('4. rechaza solicitud duplicada pendiente (409)', async () => {
    const q = await createQualification(setup.evalPlan.id, setup.insSub.id);

    await setup.agent
      .post('/api/evaluation/grade-edit-request')
      .send({ qualificationId: q.id, justification: 'primera', requestedScore: 18 })
      .expect(201);

    const response = await setup.agent
      .post('/api/evaluation/grade-edit-request')
      .send({ qualificationId: q.id, justification: 'segunda', requestedScore: 19 })
      .expect(409);

    expect(response.body.message).toContain('pendiente');
  });

  it('5. crea la solicitud con currentScore y requestedScore (201)', async () => {
    const q = await createQualification(setup.evalPlan.id, setup.insSub.id);

    const response = await setup.agent
      .post('/api/evaluation/grade-edit-request')
      .send({
        qualificationId: q.id,
        justification: 'El alumno justificó su inasistencia',
        currentScore: 15,
        requestedScore: 18,
      })
      .expect(201);

    expect(response.body.status).toBe('pending');
    expect(Number(response.body.currentScore)).toBe(15);
    expect(Number(response.body.requestedScore)).toBe(18);
    expect(response.body.qualificationId).toBe(q.id);

    const persisted = await QualificationEditRequest.findByPk(response.body.id);
    expect(persisted).not.toBeNull();
    expect(persisted!.justification).toBe('El alumno justificó su inasistencia');
  });
});

/* ------------------------------------------------------------------ */
/* GET pending + count                                                 */
/* ------------------------------------------------------------------ */

describe('Grade Edit Requests — GET pending + count', () => {
  let setup: any;

  beforeEach(async () => {
    setup = await buildBaseSetup();
  });

  it('1. count refleja solo las solicitudes pendientes', async () => {
    const before = await setup.agent.get('/api/evaluation/grade-edit-requests/pending/count');
    expect(before.body.count).toBe(0);

    const q = await createQualification(setup.evalPlan.id, setup.insSub.id);
    await setup.agent
      .post('/api/evaluation/grade-edit-request')
      .send({ qualificationId: q.id, justification: 'prueba', requestedScore: 18 })
      .expect(201);

    const after = await setup.agent.get('/api/evaluation/grade-edit-requests/pending/count');
    expect(after.body.count).toBe(1);
  });

  it('2. el listado incluye estudiante, materia, plan y solicitante', async () => {
    const q = await createQualification(setup.evalPlan.id, setup.insSub.id);
    await setup.agent
      .post('/api/evaluation/grade-edit-request')
      .send({ qualificationId: q.id, justification: 'prueba', requestedScore: 18 })
      .expect(201);

    const response = await setup.agent.get('/api/evaluation/grade-edit-requests/pending').expect(200);
    expect(response.body.length).toBe(1);

    const req = response.body[0];
    expect(req.status).toBe('pending');
    expect(req.qualification.id).toBe(q.id);
    expect(req.qualification.evaluationPlan.description).toBe('Examen parcial');
    expect(req.qualification.inscriptionSubject.subject.name).toBeTruthy();
    expect(req.qualification.inscriptionSubject.inscription.student.firstName.toLowerCase()).toBe('estudiante');
    expect(req.requester.username).toBe('teacher');
  });

  it('3. las solicitudes revisadas no aparecen en pendientes', async () => {
    const q = await createQualification(setup.evalPlan.id, setup.insSub.id);
    const created = await setup.agent
      .post('/api/evaluation/grade-edit-request')
      .send({ qualificationId: q.id, justification: 'prueba', requestedScore: 18 });
    const requestId = created.body.id;

    const { agent: controlAgent } = await createControlEstudiosAgent();
    await controlAgent
      .put(`/api/evaluation/grade-edit-request/${requestId}/review`)
      .send({ action: 'reject' })
      .expect(200);

    const pending = await setup.agent.get('/api/evaluation/grade-edit-requests/pending');
    expect(pending.body.length).toBe(0);

    const count = await setup.agent.get('/api/evaluation/grade-edit-requests/pending/count');
    expect(count.body.count).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/* PUT /api/evaluation/grade-edit-request/:id/review                   */
/* ------------------------------------------------------------------ */

describe('Grade Edit Requests — PUT review', () => {
  let setup: any;
  let controlAgent: any;

  beforeEach(async () => {
    setup = await buildBaseSetup();
    controlAgent = (await createControlEstudiosAgent()).agent;
  });

  async function createPendingRequest(qualOverrides: Partial<any> = {}, reqOverrides: Partial<any> = {}) {
    const q = await createQualification(setup.evalPlan.id, setup.insSub.id, qualOverrides);
    const res = await setup.agent
      .post('/api/evaluation/grade-edit-request')
      .send({
        qualificationId: q.id,
        justification: 'La nota debe corregirse',
        currentScore: 15,
        requestedScore: 18,
        ...reqOverrides,
      })
      .expect(201);
    return { q, request: res.body };
  }

  it('1. rechaza a un usuario sin rol autorizado (403)', async () => {
    const { request } = await createPendingRequest();

    await setup.agent
      .put(`/api/evaluation/grade-edit-request/${request.id}/review`)
      .send({ action: 'approve' })
      .expect(403);
  });

  it('2. rechaza una acción inválida (400)', async () => {
    const { request } = await createPendingRequest();

    await controlAgent
      .put(`/api/evaluation/grade-edit-request/${request.id}/review`)
      .send({ action: 'postpone' })
      .expect(400);
  });

  it('3. rechaza revisar una solicitud ya revisada (400)', async () => {
    const { request } = await createPendingRequest();

    await controlAgent
      .put(`/api/evaluation/grade-edit-request/${request.id}/review`)
      .send({ action: 'approve' })
      .expect(200);

    await controlAgent
      .put(`/api/evaluation/grade-edit-request/${request.id}/review`)
      .send({ action: 'reject' })
      .expect(400);
  });

  it('4. al aprobar aplica la nota solicitada sin resetear el timer y audita', async () => {
    const { q, request } = await createPendingRequest();

    const before = await Qualification.findByPk(q.id);
    const originalTimer = new Date(before!.scoreSetAt as Date).getTime();

    // Delay so a timer reset would be detectable
    await new Promise((r) => setTimeout(r, 50));

    await controlAgent
      .put(`/api/evaluation/grade-edit-request/${request.id}/review`)
      .send({ action: 'approve', reviewNote: 'Verificado con el profesor' })
      .expect(200);

    const after = await Qualification.findByPk(q.id);
    expect(Number(after!.score)).toBe(18);
    expect(after!.isAbsent).toBe(false);
    // Timer must NOT be reset by the approval
    expect(new Date(after!.scoreSetAt as Date).getTime()).toBe(originalTimer);

    const audits = await GradeChangeLog.findAll({
      where: { entityType: 'qualification', entityId: q.id },
    });
    expect(audits.length).toBeGreaterThanOrEqual(1);
    const lastAudit = audits[audits.length - 1];
    expect(lastAudit.reason).toBe('Cambio solicitado por el profesor: La nota debe corregirse');
    expect(lastAudit.metadata).toBeTruthy();
    expect(lastAudit.metadata?.editRequestId).toBe(request.id);
    expect(lastAudit.metadata?.reviewNote).toBe('Verificado con el profesor');
  });

  it('5. al aprobar un NP con el mismo valor numérico aplica y audita previousStatus NP', async () => {
    const { q, request } = await createPendingRequest(
      { score: 20, isAbsent: true },
      { currentScore: null, requestedScore: 20 },
    );

    await controlAgent
      .put(`/api/evaluation/grade-edit-request/${request.id}/review`)
      .send({ action: 'approve' })
      .expect(200);

    const after = await Qualification.findByPk(q.id);
    expect(after!.isAbsent).toBe(false);
    expect(Number(after!.score)).toBe(20);

    const audits = await GradeChangeLog.findAll({
      where: { entityType: 'qualification', entityId: q.id },
    });
    expect(audits.length).toBeGreaterThanOrEqual(1);
    const lastAudit = audits[audits.length - 1];
    expect(lastAudit.previousStatus).toBe('NP');
    expect(lastAudit.previousScore).toBeNull();
    expect(Number(lastAudit.newScore)).toBe(20);
  });

  it('6. al rechazar no cambia la nota ni audita, y persiste reviewNote', async () => {
    const { q, request } = await createPendingRequest();

    await controlAgent
      .put(`/api/evaluation/grade-edit-request/${request.id}/review`)
      .send({ action: 'reject', reviewNote: 'Sin evidencia suficiente' })
      .expect(200);

    const after = await Qualification.findByPk(q.id);
    expect(Number(after!.score)).toBe(15);

    const audits = await GradeChangeLog.findAll({
      where: { entityType: 'qualification', entityId: q.id },
    });
    expect(audits.length).toBe(0);

    const reviewed = await QualificationEditRequest.findByPk(request.id);
    expect(reviewed!.status).toBe('rejected');
    expect(reviewed!.reviewNote).toBe('Sin evidencia suficiente');
    expect(reviewed!.reviewedBy).not.toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* POST /api/evaluation/reset-timer                                    */
/* ------------------------------------------------------------------ */

describe('POST /api/evaluation/reset-timer', () => {
  let setup: any;
  let controlAgent: any;

  beforeEach(async () => {
    setup = await buildBaseSetup();
    controlAgent = (await createControlEstudiosAgent()).agent;
  });

  it('1. rechaza a un usuario sin rol autorizado (403)', async () => {
    const q = await createQualification(setup.evalPlan.id, setup.insSub.id);

    await setup.agent.post('/api/evaluation/reset-timer').send({ qualificationIds: [q.id] }).expect(403);
  });

  it('2. rechaza sin qualificationIds (400)', async () => {
    await controlAgent.post('/api/evaluation/reset-timer').send({}).expect(400);
    await controlAgent.post('/api/evaluation/reset-timer').send({ qualificationIds: [] }).expect(400);
  });

  it("3. por defecto resetea ambos timers", async () => {
    const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const q = await createQualification(setup.evalPlan.id, setup.insSub.id, {
      scoreSetAt: oldDate,
      remedialScoreSetAt: oldDate,
    });

    await controlAgent
      .post('/api/evaluation/reset-timer')
      .send({ qualificationIds: [q.id] })
      .expect(200);

    const after = await Qualification.findByPk(q.id);
    expect(new Date(after!.scoreSetAt as Date).getTime()).toBeGreaterThan(Date.now() - 60_000);
    expect(new Date(after!.remedialScoreSetAt as Date).getTime()).toBeGreaterThan(Date.now() - 60_000);
  });

  it("4. field='score' resetea solo el timer regular", async () => {
    const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const q = await createQualification(setup.evalPlan.id, setup.insSub.id, {
      scoreSetAt: oldDate,
      remedialScoreSetAt: oldDate,
    });

    await controlAgent
      .post('/api/evaluation/reset-timer')
      .send({ qualificationIds: [q.id], field: 'score' })
      .expect(200);

    const after = await Qualification.findByPk(q.id);
    expect(new Date(after!.scoreSetAt as Date).getTime()).toBeGreaterThan(Date.now() - 60_000);
    expect(new Date(after!.remedialScoreSetAt as Date).getTime()).toBe(oldDate.getTime());
  });

  it("5. field='remedial' resetea solo el timer remedial", async () => {
    const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const q = await createQualification(setup.evalPlan.id, setup.insSub.id, {
      scoreSetAt: oldDate,
      remedialScoreSetAt: oldDate,
    });

    await controlAgent
      .post('/api/evaluation/reset-timer')
      .send({ qualificationIds: [q.id], field: 'remedial' })
      .expect(200);

    const after = await Qualification.findByPk(q.id);
    expect(new Date(after!.scoreSetAt as Date).getTime()).toBe(oldDate.getTime());
    expect(new Date(after!.remedialScoreSetAt as Date).getTime()).toBeGreaterThan(Date.now() - 60_000);
  });
});

/* ------------------------------------------------------------------ */
/* GET /api/evaluation/students/:assignmentId — timer lock flags       */
/* ------------------------------------------------------------------ */

describe('GET /api/evaluation/students/:assignmentId — timer lock flags', () => {
  let setup: any;
  let assignment: any;

  beforeEach(async () => {
    setup = await buildBaseSetup();
    assignment = await TeacherAssignment.create({
      teacherId: setup.person.id,
      periodGradeSubjectId: setup.structure.periodGradeSubject.id,
      sectionId: setup.structure.section.id,
    });
  });

  async function fetchStudents() {
    const response = await setup.agent
      .get(`/api/evaluation/students/${assignment.id}`)
      .query({ termId: setup.term.id })
      .expect(200);
    return response.body;
  }

  it('1. marca isLockedByTimer cuando el timer venció', async () => {
    await createQualification(setup.evalPlan.id, setup.insSub.id, {
      termId: setup.term.id,
      scoreSetAt: new Date(Date.now() - 48 * 60 * 60 * 1000), // 48h ago, grace default 24h
    });

    const students = await fetchStudents();
    const quals = students[0].inscriptionSubjects[0].qualifications;
    expect(quals.length).toBe(1);
    expect(quals[0].isLockedByTimer).toBe(true);
    expect(quals[0].isRemedialLockedByTimer).toBe(false);
  });

  it('2. no bloquea cuando el timer está dentro de la ventana de gracia', async () => {
    await createQualification(setup.evalPlan.id, setup.insSub.id, {
      termId: setup.term.id,
      scoreSetAt: new Date(Date.now() - 60 * 60 * 1000), // 1h ago
    });

    const students = await fetchStudents();
    const quals = students[0].inscriptionSubjects[0].qualifications;
    expect(quals[0].isLockedByTimer).toBe(false);
  });

  it('3. no bloquea cuando no hay timer', async () => {
    await createQualification(setup.evalPlan.id, setup.insSub.id, { termId: setup.term.id, scoreSetAt: null });

    const students = await fetchStudents();
    const quals = students[0].inscriptionSubjects[0].qualifications;
    expect(quals[0].isLockedByTimer).toBe(false);
  });

  it('4. respeta el setting grade_edit_grace_hours', async () => {
    await createTestSetting('grade_edit_grace_hours', '1');
    await createQualification(setup.evalPlan.id, setup.insSub.id, {
      termId: setup.term.id,
      scoreSetAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2h ago > 1h grace
    });

    const students = await fetchStudents();
    const quals = students[0].inscriptionSubjects[0].qualifications;
    expect(quals[0].isLockedByTimer).toBe(true);
  });

  it('5. el timer remedial es independiente del regular', async () => {
    await createQualification(setup.evalPlan.id, setup.insSub.id, {
      termId: setup.term.id,
      score: 5,
      scoreSetAt: new Date(Date.now() - 60 * 60 * 1000), // recent
      remedialScoreSetAt: new Date(Date.now() - 48 * 60 * 60 * 1000), // expired
    });

    const students = await fetchStudents();
    const quals = students[0].inscriptionSubjects[0].qualifications;
    expect(quals[0].isLockedByTimer).toBe(false);
    expect(quals[0].isRemedialLockedByTimer).toBe(true);
  });
});
