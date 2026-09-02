import request from 'supertest';
import app from '@/app';
import {
  createTestUser,
  createTestRole,
  createAcademicStructure,
  createTestInscription,
  createTestTerm,
} from '../helpers/testData';
import {
  PersonRole,
  EvaluationPlan,
  Qualification,
  QualificationAudit,
  InscriptionSubject,
  SubjectTermGrade,
} from '@/models/index';

describe('Evaluation Endpoints — saveQualification', () => {
  let agent: any;
  let setup: any;

  beforeEach(async () => {
    agent = request.agent(app);

    // Create a teacher user and log in
    const { user, person } = await createTestUser({ username: 'teacher' });
    const teacherRole = await createTestRole('Profesor');
    await PersonRole.create({ personId: person.id, roleId: teacherRole.id });

    await agent
      .post('/api/auth/login')
      .send({ username: 'teacher', password: 'password123' });

    // Build full academic structure
    const structure = await createAcademicStructure();
    const term = await createTestTerm(structure.period.id, { name: 'Primer Lapso', order: 1 });

    // Create a student person with Alumno role
    const { person: studentPerson } = await createTestUser({
      username: 'student1',
      firstName: 'Estudiante',
      lastName: 'Prueba',
    });
    const alumnoRole = await createTestRole('Alumno');
    await PersonRole.create({ personId: studentPerson.id, roleId: alumnoRole.id });

    // Create inscription + inscriptionSubject
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

    // Create an evaluation plan
    const evalPlan = await EvaluationPlan.create({
      periodGradeSubjectId: structure.periodGradeSubject.id,
      sectionId: structure.section.id,
      termId: term.id,
      description: 'Examen parcial',
      percentage: 25,
      date: new Date('2025-09-15'),
    });

    setup = {
      user,
      person,
      studentPerson,
      structure,
      term,
      inscription,
      insSub,
      evalPlan,
    };
  });

  it('1. crea una nota nueva y sincroniza SubjectTermGrade', async () => {
    const response = await agent
      .post('/api/evaluation/qualifications')
      .send({
        evaluationPlanId: setup.evalPlan.id,
        inscriptionSubjectId: setup.insSub.id,
        score: 15,
      })
      .expect(200);

    expect(Number(response.body.score)).toBe(15);

    // Qualification persisted
    const q = await Qualification.findOne({
      where: { evaluationPlanId: setup.evalPlan.id, inscriptionSubjectId: setup.insSub.id },
    });
    expect(q).not.toBeNull();
    expect(Number(q!.score)).toBe(15);

    // SubjectTermGrade synced
    const stg = await SubjectTermGrade.findOne({
      where: { inscriptionSubjectId: setup.insSub.id, termId: setup.term.id },
    });
    expect(stg).not.toBeNull();
  });

  it('2. actualiza una nota existente y registra auditoría', async () => {
    // First save: score=15
    await agent
      .post('/api/evaluation/qualifications')
      .send({
        evaluationPlanId: setup.evalPlan.id,
        inscriptionSubjectId: setup.insSub.id,
        score: 15,
      })
      .expect(200);

    // Second save: score=18 (should update + audit)
    const response = await agent
      .post('/api/evaluation/qualifications')
      .send({
        evaluationPlanId: setup.evalPlan.id,
        inscriptionSubjectId: setup.insSub.id,
        score: 18,
        comment: 'Corrección de nota',
      })
      .expect(200);

    expect(Number(response.body.score)).toBe(18);

    // Qualification updated
    const q = await Qualification.findOne({
      where: { evaluationPlanId: setup.evalPlan.id, inscriptionSubjectId: setup.insSub.id },
    });
    expect(Number(q!.score)).toBe(18);

    // Audit record created with previousScore=15, newScore=18
    const audits = await QualificationAudit.findAll({
      where: { qualificationId: q!.id },
    });
    expect(audits.length).toBeGreaterThanOrEqual(1);
    const lastAudit = audits[audits.length - 1];
    expect(Number(lastAudit.previousScore)).toBe(15);
    expect(Number(lastAudit.newScore)).toBe(18);
    expect(lastAudit.get('comment')).toBe('Corrección de nota');
  });

  it('3. rechaza guardar cuando el lapso está bloqueado', async () => {
    // Block the term
    await setup.term.update({ isBlocked: true });

    const response = await agent
      .post('/api/evaluation/qualifications')
      .send({
        evaluationPlanId: setup.evalPlan.id,
        inscriptionSubjectId: setup.insSub.id,
        score: 10,
      })
      .expect(403);

    expect(response.body.message).toContain('Lapso bloqueado');

    // No qualification should have been persisted
    const q = await Qualification.findOne({
      where: { evaluationPlanId: setup.evalPlan.id, inscriptionSubjectId: setup.insSub.id },
    });
    expect(q).toBeNull();
  });

  it('4. guarda nota con isAbsent=true', async () => {
    const response = await agent
      .post('/api/evaluation/qualifications')
      .send({
        evaluationPlanId: setup.evalPlan.id,
        inscriptionSubjectId: setup.insSub.id,
        score: 0,
        isAbsent: true,
      })
      .expect(200);

    expect(response.body.isAbsent).toBe(true);

    const q = await Qualification.findOne({
      where: { evaluationPlanId: setup.evalPlan.id, inscriptionSubjectId: setup.insSub.id },
    });
    expect(q).not.toBeNull();
    expect(q!.isAbsent).toBe(true);
  });

  it('5. sin sesión activa no registra auditoría al guardar', async () => {
    // Use a fresh agent without login.
    // The system has no global auth middleware yet (see AGENTS.md), so the
    // endpoint still processes the request, but without a session user the
    // audit record is skipped. We verify that no audit is created.
    const unauthAgent = request.agent(app);

    const response = await unauthAgent
      .post('/api/evaluation/qualifications')
      .send({
        evaluationPlanId: setup.evalPlan.id,
        inscriptionSubjectId: setup.insSub.id,
        score: 12,
      });

    // The endpoint processes the request (200) because there is no global
    // auth middleware. The key assertion is that no audit row is created.
    expect(response.status).toBe(200);

    const q = await Qualification.findOne({
      where: { evaluationPlanId: setup.evalPlan.id, inscriptionSubjectId: setup.insSub.id },
    });
    expect(q).not.toBeNull();

    const audits = await QualificationAudit.findAll({
      where: { qualificationId: q!.id },
    });
    expect(audits.length).toBe(0);
  });
});
