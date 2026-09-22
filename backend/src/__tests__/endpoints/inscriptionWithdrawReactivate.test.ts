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

  it('T2: reactivate resets withdrawnAt to null', async () => {
    // First withdraw
    await agent
      .post(`/api/inscriptions/${inscription.id}/withdraw`)
      .expect(200);

    const withdrawn = await Inscription.findByPk(inscription.id);
    expect(withdrawn!.withdrawnAt).not.toBeNull();

    // Now reactivate
    const res = await agent
      .post(`/api/inscriptions/${inscription.id}/reactivate`)
      .send({ sectionId: structure.section.id })
      .expect(200);

    expect(res.body.message).toContain('reactivado');

    const refreshed = await Inscription.findByPk(inscription.id);
    expect(refreshed!.withdrawnAt).toBeNull();
    expect(refreshed!.sectionId).toBe(structure.section.id);

    const refreshedMat = await Matriculation.findOne({ where: { inscriptionId: inscription.id } });
    expect(refreshedMat!.status).toBe('completed');
  });

  it('T3: enrollMatriculatedStudent clears withdrawnAt when reusing an existing withdrawn inscription', async () => {
    // Mark the inscription as withdrawn directly
    await inscription.update({ withdrawnAt: new Date() });
    await matriculation.update({ status: 'withdrawn', sectionId: null });

    const withdrawn = await Inscription.findByPk(inscription.id);
    expect(withdrawn!.withdrawnAt).not.toBeNull();

    // Re-enroll the student via enrollMatriculatedStudent endpoint
    // This reuses the existing inscription and should clear withdrawnAt
    const res = await agent
      .post(`/api/matriculations/${matriculation.id}/enroll`)
      .send({
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
        sectionId: structure.section.id,
        escolaridad: 'regular'
      });

    expect(res.status).toBe(200);

    const refreshed = await Inscription.findByPk(inscription.id);
    expect(refreshed!.withdrawnAt).toBeNull();
    expect(refreshed!.sectionId).toBe(structure.section.id);

    const refreshedMat = await Matriculation.findOne({ where: { inscriptionId: inscription.id } });
    expect(refreshedMat!.status).toBe('completed');
  });

  it('T4: after reactivate, the student appears in the period closure preview', async () => {
    // Withdraw
    await agent
      .post(`/api/inscriptions/${inscription.id}/withdraw`)
      .expect(200);

    // Preview should NOT include the withdrawn student
    const previewBefore = await PeriodClosurePreview.calculatePreview(structure.period.id);
    const foundBefore = previewBefore.some(p => p.inscription.student?.id === person.id);
    expect(foundBefore).toBe(false);

    // Reactivate
    await agent
      .post(`/api/inscriptions/${inscription.id}/reactivate`)
      .send({ sectionId: structure.section.id })
      .expect(200);

    // Preview should now include the reactivated student
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
