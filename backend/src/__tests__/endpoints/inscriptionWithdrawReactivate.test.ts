import request from 'supertest';
import app from '@/app';
import {
  createTestUser,
  createTestRole,
  createAcademicStructure,
  createTestInscription
} from '../helpers/testData';
import { Inscription, Matriculation, PersonRole } from '@/models/index';
import { PeriodClosurePreview } from '@/services/periodClosurePreview';

const enrollPayload = (sectionId: number | null | undefined) => ({
  firstName: 'Test',
  lastName: 'Student',
  documentType: 'Venezolano',
  document: '12345678',
  gender: 'M',
  birthdate: '2000-01-01',
  birthState: 'GUÁRICO',
  birthMunicipality: 'JOSÉ TADEO MONAGAS',
  birthParish: 'Altagracia de Orituco',
  residenceState: 'Guárico',
  residenceMunicipality: 'José Tadeo Monagas',
  residenceParish: 'Altagracia de Orituco',
  mother: {
    firstName: 'Madre',
    lastName: 'Test',
    documentType: 'Venezolano',
    document: '99999999',
    phone: '0000000000',
    email: 'no@email.com',
    residenceState: 'GUÁRICO',
    residenceMunicipality: 'JOSÉ TADEO MONAGAS',
    residenceParish: 'ALTAGRACIA DE ORITUCO',
    address: 'N/A'
  },
  representativeType: 'mother',
  ...(sectionId !== undefined ? { sectionId } : {}),
  escolaridad: 'regular'
});

describe('Inscription Withdraw/Reactivate — withdrawnAt lifecycle', () => {
  let agent: any;
  let structure: any;
  let person: any;
  let inscription: any;
  let matriculation: any;

  beforeEach(async () => {
    agent = request.agent(app);

    const { person: admin } = await createTestUser({ username: 'admin' });
    const masterRole = await createTestRole('Master');
    await PersonRole.create({ personId: admin.id, roleId: masterRole.id });

    await agent
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'password123' });

    structure = await createAcademicStructure();

    const { person: p } = await createTestUser({ username: 'student', firstName: 'Test', lastName: 'Student' });
    const alumnoRole = await createTestRole('Alumno');
    await PersonRole.create({ personId: p.id, roleId: alumnoRole.id });
    person = p;

    inscription = await createTestInscription(
      person.id,
      structure.period.id,
      structure.grade.id,
      structure.section.id
    );
    matriculation = await Matriculation.create({
      schoolPeriodId: structure.period.id,
      gradeId: structure.grade.id,
      sectionId: structure.section.id,
      personId: person.id,
      inscriptionId: inscription.id,
      status: 'completed',
      escolaridad: 'regular',
      hiddenFromControlEstudios: false
    });
  });

  it('T1: withdraw sets withdrawnAt to a non-null date', async () => {
    expect(inscription.withdrawnAt).toBeNull();

    const res = await agent
      .post(`/api/inscriptions/${inscription.id}/withdraw`)
      .expect(200);

    expect(res.body.message).toContain('retirado');

    const refreshed = await Inscription.findByPk(inscription.id);
    expect(refreshed!.withdrawnAt).not.toBeNull();
    expect(refreshed!.withdrawnAt).toBeInstanceOf(Date);

    const refreshedMat = await Matriculation.findOne({ where: { inscriptionId: inscription.id } });
    expect(refreshedMat!.status).toBe('withdrawn');
  });

  it('T2: reactivate resets withdrawnAt and sends the student to No Matriculados (no section)', async () => {
    await agent
      .post(`/api/inscriptions/${inscription.id}/withdraw`)
      .expect(200);

    const withdrawn = await Inscription.findByPk(inscription.id);
    expect(withdrawn!.withdrawnAt).not.toBeNull();

    // No section required: Control de Estudios decides later where to place them
    const res = await agent
      .post(`/api/inscriptions/${inscription.id}/reactivate`)
      .expect(200);

    expect(res.body.message).toContain('reactivado');

    const refreshed = await Inscription.findByPk(inscription.id);
    expect(refreshed!.withdrawnAt).toBeNull();
    expect(refreshed!.sectionId).toBeNull();

    const refreshedMat = await Matriculation.findOne({ where: { inscriptionId: inscription.id } });
    expect(refreshedMat!.status).toBe('pending');
    expect(refreshedMat!.sectionId).toBeNull();
  });

  it('T3: a withdrawn student must be reactivated before being matriculated; matriculating then reuses the inscription', async () => {
    await agent.post(`/api/inscriptions/${inscription.id}/withdraw`).expect(200);

    // Direct matriculation of a withdrawn student is rejected
    await agent
      .post(`/api/matriculations/${matriculation.id}/enroll`)
      .send(enrollPayload(structure.section.id))
      .expect(400);

    await agent.post(`/api/inscriptions/${inscription.id}/reactivate`).expect(200);

    const res = await agent
      .post(`/api/matriculations/${matriculation.id}/enroll`)
      .send(enrollPayload(structure.section.id));
    expect(res.status).toBe(200);

    const refreshed = await Inscription.findByPk(inscription.id);
    expect(refreshed!.withdrawnAt).toBeNull();
    expect(refreshed!.sectionId).toBe(structure.section.id);

    const refreshedMat = await Matriculation.findOne({ where: { inscriptionId: inscription.id } });
    expect(refreshedMat!.status).toBe('completed');
    expect(refreshedMat!.sectionId).toBe(structure.section.id);
  });

  it('T4: after reactivate + matricular, the student appears in the period closure preview', async () => {
    await agent
      .post(`/api/inscriptions/${inscription.id}/withdraw`)
      .expect(200);

    const previewBefore = await PeriodClosurePreview.calculatePreview(structure.period.id);
    const foundBefore = previewBefore.some(p => p.inscription.student?.id === person.id);
    expect(foundBefore).toBe(false);

    await agent.post(`/api/inscriptions/${inscription.id}/reactivate`).expect(200);
    await agent
      .post(`/api/matriculations/${matriculation.id}/enroll`)
      .send(enrollPayload(structure.section.id))
      .expect(200);

    const previewAfter = await PeriodClosurePreview.calculatePreview(structure.period.id);
    const foundAfter = previewAfter.some(p => p.inscription.student?.id === person.id);
    expect(foundAfter).toBe(true);
  });

  it('T5: Control de Estudios can unmatriculate a student back to No Matriculados', async () => {
    const { person: ceUser } = await createTestUser({ username: 'ce_user' });
    const ceRole = await createTestRole('Control de Estudios');
    await PersonRole.create({ personId: ceUser.id, roleId: ceRole.id });

    const ceAgent = request.agent(app);
    await ceAgent
      .post('/api/auth/login')
      .send({ username: 'ce_user', password: 'password123' });

    await ceAgent
      .post(`/api/inscriptions/${inscription.id}/unmatriculate`)
      .expect(200);

    const refreshed = await Inscription.findByPk(inscription.id);
    expect(refreshed!.sectionId).toBeNull();

    const refreshedMat = await Matriculation.findOne({ where: { inscriptionId: inscription.id } });
    expect(refreshedMat!.status).toBe('pending');
    expect(refreshedMat!.sectionId).toBeNull();
  });

  it('T6: a role without enrollment permissions cannot unmatriculate', async () => {
    const { person: alumno } = await createTestUser({ username: 'alumno_user' });
    const alumnoRole = await createTestRole('Alumno');
    await PersonRole.create({ personId: alumno.id, roleId: alumnoRole.id });

    const otherAgent = request.agent(app);
    await otherAgent
      .post('/api/auth/login')
      .send({ username: 'alumno_user', password: 'password123' });

    await otherAgent
      .post(`/api/inscriptions/${inscription.id}/unmatriculate`)
      .expect(403);
  });

  it('T7: a role without enrollment permissions is rejected from all write endpoints', async () => {
    const { person: alumno } = await createTestUser({ username: 'alumno_user2' });
    const alumnoRole = await createTestRole('Alumno');
    await PersonRole.create({ personId: alumno.id, roleId: alumnoRole.id });

    const otherAgent = request.agent(app);
    await otherAgent
      .post('/api/auth/login')
      .send({ username: 'alumno_user2', password: 'password123' });

    // Inscribir (Admin/Master only)
    await otherAgent.post('/api/inscriptions').send({}).expect(403);
    await otherAgent.post('/api/inscriptions/register').send({}).expect(403);
    await otherAgent.post('/api/inscriptions/quick-register').send({}).expect(403);
    await otherAgent.delete(`/api/inscriptions/${inscription.id}`).expect(403);

    // Matricular / gestionar (Admin/Master/Control de Estudios)
    await otherAgent.post(`/api/matriculations/${matriculation.id}/enroll`).send({}).expect(403);
    await otherAgent.put(`/api/inscriptions/${inscription.id}`).send({}).expect(403);
    await otherAgent.patch(`/api/matriculations/${matriculation.id}`).send({}).expect(403);
    await otherAgent.post(`/api/inscriptions/${inscription.id}/subjects`).send({}).expect(403);
    await otherAgent.delete(`/api/inscriptions/${inscription.id}/subjects/1`).expect(403);
    await otherAgent.post(`/api/inscriptions/${inscription.id}/withdraw`).expect(403);
  });
});

describe('Regla de negocio: matriculado ⇒ tiene sección; Retirar/Reactivar solo Administración', () => {
  let adminAgent: any;
  let ceAgent: any;
  let structure: any;
  let student: any;
  let pendingMatriculation: any;

  const loginAs = async (username: string, roleName: Parameters<typeof createTestRole>[0]) => {
    const { person } = await createTestUser({ username });
    const role = await createTestRole(roleName);
    await PersonRole.create({ personId: person.id, roleId: role.id });
    const a = request.agent(app);
    await a.post('/api/auth/login').send({ username, password: 'password123' });
    return a;
  };

  beforeEach(async () => {
    adminAgent = await loginAs('admin_rule', 'Administrador');
    ceAgent = await loginAs('ce_rule', 'Control de Estudios');
    structure = await createAcademicStructure();

    const { person } = await createTestUser({ username: 'student_rule', firstName: 'Test', lastName: 'Student' });
    student = person;
    // Inscrito (por Administración) pero aún no matriculado
    pendingMatriculation = await Matriculation.create({
      schoolPeriodId: structure.period.id,
      gradeId: structure.grade.id,
      sectionId: null,
      personId: student.id,
      status: 'pending',
      escolaridad: 'regular',
      hiddenFromControlEstudios: false
    });
  });

  it('R1: matricular sin sección → 400 y el estudiante sigue en No Matriculados', async () => {
    const res = await ceAgent
      .post(`/api/matriculations/${pendingMatriculation.id}/enroll`)
      .send(enrollPayload(undefined))
      .expect(400);
    expect(res.body.error).toMatch(/sección/i);

    const refreshed = await Matriculation.findByPk(pendingMatriculation.id);
    expect(refreshed!.status).toBe('pending');
    expect(await Inscription.count({ where: { personId: student.id } })).toBe(0);
  });

  it('R2: matricular con una sección que no pertenece al grado → 400', async () => {
    const other = await createAcademicStructure({ periodId: structure.period.id });
    await ceAgent
      .post(`/api/matriculations/${pendingMatriculation.id}/enroll`)
      .send(enrollPayload(other.section.id))
      .expect(400);
  });

  it('R3: Control de Estudios matricula con sección válida → matriculado con sección', async () => {
    await ceAgent
      .post(`/api/matriculations/${pendingMatriculation.id}/enroll`)
      .send(enrollPayload(structure.section.id))
      .expect(201);

    const refreshed = await Matriculation.findByPk(pendingMatriculation.id);
    expect(refreshed!.status).toBe('completed');
    expect(refreshed!.sectionId).toBe(structure.section.id);
    const insc = await Inscription.findByPk(refreshed!.inscriptionId!);
    expect(insc!.sectionId).toBe(structure.section.id);
  });

  it('R4: no se puede quitar la sección a un matriculado por PATCH (solo con Sacar de Matrícula)', async () => {
    await ceAgent
      .post(`/api/matriculations/${pendingMatriculation.id}/enroll`)
      .send(enrollPayload(structure.section.id))
      .expect(201);
    const mat = await Matriculation.findByPk(pendingMatriculation.id);

    await ceAgent.patch(`/api/inscriptions/${mat!.inscriptionId}`).send({ sectionId: null }).expect(400);
    await ceAgent.patch(`/api/matriculations/${mat!.id}`).send({ sectionId: null }).expect(400);

    const after = await Matriculation.findByPk(pendingMatriculation.id);
    expect(after!.status).toBe('completed');
    expect(after!.sectionId).toBe(structure.section.id);
  });

  it('R5: Administración puede retirar a un estudiante que nunca fue matriculado, y reactivarlo a No Matriculados', async () => {
    await adminAgent.post(`/api/matriculations/${pendingMatriculation.id}/withdraw`).expect(200);
    let refreshed = await Matriculation.findByPk(pendingMatriculation.id);
    expect(refreshed!.status).toBe('withdrawn');
    expect(refreshed!.sectionId).toBeNull();

    // Retirado: no se le puede asignar sección hasta reactivarlo
    await ceAgent.patch(`/api/matriculations/${pendingMatriculation.id}`).send({ sectionId: structure.section.id }).expect(400);

    await adminAgent.post(`/api/matriculations/${pendingMatriculation.id}/reactivate`).expect(200);
    refreshed = await Matriculation.findByPk(pendingMatriculation.id);
    expect(refreshed!.status).toBe('pending');
    expect(refreshed!.sectionId).toBeNull();
  });

  it('R6: Control de Estudios no puede retirar ni reactivar', async () => {
    await ceAgent.post(`/api/matriculations/${pendingMatriculation.id}/withdraw`).expect(403);
    await pendingMatriculation.update({ status: 'withdrawn' });
    await ceAgent.post(`/api/matriculations/${pendingMatriculation.id}/reactivate`).expect(403);
  });
});
