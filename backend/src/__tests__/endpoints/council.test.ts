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
  CouncilPoint,
  CouncilChecklist,
  InscriptionSubject,
  SubjectTermGrade,
  SchoolPeriod,
} from '@/models/index';

describe('Council Endpoints — saveCouncilPoint & bulkSaveCouncilPoints', () => {
  let agent: any;
  let setup: any;

  beforeEach(async () => {
    agent = request.agent(app);

    // Create a Control de Estudios user (typical role that manages council points)
    const { person } = await createTestUser({ username: 'control' });
    const controlRole = await createTestRole('Control de Estudios');
    await PersonRole.create({ personId: person.id, roleId: controlRole.id });

    await agent
      .post('/api/auth/login')
      .send({ username: 'control', password: 'password123' });

    // Build full academic structure with an active period
    const structure = await createAcademicStructure({ period: { status: 'activo' } });
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

    // Default council point limits (per-subject=2, total=2)
    await createTestSetting('council_points_limit', '2');
    await createTestSetting('council_points_per_subject_limit', '2');

    setup = {
      person,
      studentPerson,
      structure,
      term,
      inscription,
      insSub,
    };
  });

  it('1. saveCouncilPoint crea puntos y sincroniza SubjectTermGrade', async () => {
    const response = await agent
      .post('/api/council/save')
      .send({
        inscriptionSubjectId: setup.insSub.id,
        termId: setup.term.id,
        points: 1,
      })
      .expect(200);

    expect(Number(response.body.points)).toBe(1);

    // CouncilPoint persisted
    const cp = await CouncilPoint.findOne({
      where: { inscriptionSubjectId: setup.insSub.id, termId: setup.term.id },
    });
    expect(cp).not.toBeNull();
    expect(Number(cp!.points)).toBe(1);

    // SubjectTermGrade synced
    const stg = await SubjectTermGrade.findOne({
      where: { inscriptionSubjectId: setup.insSub.id, termId: setup.term.id },
    });
    expect(stg).not.toBeNull();
  });

  it('2. saveCouncilPoint actualiza puntos existentes', async () => {
    // First save: points=1
    await agent
      .post('/api/council/save')
      .send({
        inscriptionSubjectId: setup.insSub.id,
        termId: setup.term.id,
        points: 1,
      })
      .expect(200);

    // Second save: points=2
    const response = await agent
      .post('/api/council/save')
      .send({
        inscriptionSubjectId: setup.insSub.id,
        termId: setup.term.id,
        points: 2,
      })
      .expect(200);

    expect(Number(response.body.points)).toBe(2);

    // Only one CouncilPoint row, updated
    const cps = await CouncilPoint.findAll({
      where: { inscriptionSubjectId: setup.insSub.id, termId: setup.term.id },
    });
    expect(cps.length).toBe(1);
    expect(Number(cps[0].points)).toBe(2);
  });

  it('3. saveCouncilPoint rechaza lapso bloqueado', async () => {
    await setup.term.update({ isBlocked: true });

    const response = await agent
      .post('/api/council/save')
      .send({
        inscriptionSubjectId: setup.insSub.id,
        termId: setup.term.id,
        points: 1,
      })
      .expect(403);

    expect(response.body.message).toContain('cerrado');

    // No CouncilPoint should have been persisted
    const cp = await CouncilPoint.findOne({
      where: { inscriptionSubjectId: setup.insSub.id, termId: setup.term.id },
    });
    expect(cp).toBeNull();
  });

  it('4. bulkSaveCouncilPoints guarda lote correctamente', async () => {
    // Create a second subject + inscriptionSubject for the same student
    const structure2 = await createAcademicStructure({ periodId: setup.structure.period.id });
    const insSub2 = await InscriptionSubject.create({
      inscriptionId: setup.inscription.id,
      subjectId: structure2.subject.id,
      schoolPeriodId: setup.structure.period.id,
      gradeId: setup.structure.grade.id,
      sectionId: setup.structure.section.id,
    });

    const response = await agent
      .post('/api/council/bulk-save')
      .send({
        updates: [
          { inscriptionSubjectId: setup.insSub.id, termId: setup.term.id, points: 1 },
          { inscriptionSubjectId: insSub2.id, termId: setup.term.id, points: 1 },
        ],
      })
      .expect(200);

    expect(response.body.message).toBe('Puntos actualizados correctamente');

    // Both CouncilPoints persisted
    const cp1 = await CouncilPoint.findOne({
      where: { inscriptionSubjectId: setup.insSub.id, termId: setup.term.id },
    });
    const cp2 = await CouncilPoint.findOne({
      where: { inscriptionSubjectId: insSub2.id, termId: setup.term.id },
    });
    expect(cp1).not.toBeNull();
    expect(Number(cp1!.points)).toBe(1);
    expect(cp2).not.toBeNull();
    expect(Number(cp2!.points)).toBe(1);

    // SubjectTermGrade synced for both
    const stg1 = await SubjectTermGrade.findOne({
      where: { inscriptionSubjectId: setup.insSub.id, termId: setup.term.id },
    });
    const stg2 = await SubjectTermGrade.findOne({
      where: { inscriptionSubjectId: insSub2.id, termId: setup.term.id },
    });
    expect(stg1).not.toBeNull();
    expect(stg2).not.toBeNull();
  });

  it('5. bulkSaveCouncilPoints rechaza exceso de puntos por materia', async () => {
    // per-subject limit is 2 (set in beforeEach); try 3
    const response = await agent
      .post('/api/council/bulk-save')
      .send({
        updates: [
          { inscriptionSubjectId: setup.insSub.id, termId: setup.term.id, points: 3 },
        ],
      })
      .expect(400);

    expect(response.body.message).toContain('límite de puntos por materia');

    // No CouncilPoint should have been persisted
    const cp = await CouncilPoint.findOne({
      where: { inscriptionSubjectId: setup.insSub.id, termId: setup.term.id },
    });
    expect(cp).toBeNull();
  });
});
