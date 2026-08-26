import request from 'supertest';
import app from '@/app';
import {
  createTestUser,
  createTestRole,
  createAcademicStructure,
  createTestInscription
} from '../helpers/testData';
import { Inscription, InscriptionSubject, PersonRole, Matriculation } from '@/models/index';

describe('Inscription Endpoints', () => {
  let agent: any;

  beforeEach(async () => {
    agent = request.agent(app);

    const { person } = await createTestUser({ username: 'admin' });
    const masterRole = await createTestRole('Master');
    await PersonRole.create({ personId: person.id, roleId: masterRole.id });

    await agent
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'password123' });
  });

  // Helper: create a student person with Alumno role
  async function createStudentPerson(username: string) {
    const { person } = await createTestUser({ username });
    const role = await createTestRole('Alumno');
    await PersonRole.create({ personId: person.id, roleId: role.id });
    return person;
  }

  // Helper: create an inscription WITH a matriculation so it shows up in listings
  async function createInscriptionWithMatriculation(
    personId: number,
    periodId: number,
    gradeId: number,
    sectionId: number
  ) {
    const inscription = await createTestInscription(personId, periodId, gradeId, sectionId);
    await Matriculation.create({
      schoolPeriodId: periodId,
      gradeId,
      sectionId,
      personId,
      status: 'pending',
      escolaridad: 'regular',
      hiddenFromControlEstudios: false,
    });
    return inscription;
  }

  describe('GET /api/inscriptions', () => {
    it('should return all inscriptions', async () => {
      const structure = await createAcademicStructure();
      const person = await createStudentPerson('student1');

      await createInscriptionWithMatriculation(
        person.id,
        structure.period.id,
        structure.grade.id,
        structure.section.id
      );

      const response = await agent
        .get('/api/inscriptions')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(1);
    });

    it('should filter inscriptions by period', async () => {
      const structure1 = await createAcademicStructure();
      const person1 = await createStudentPerson('student1');
      const person2 = await createStudentPerson('student2');

      await createInscriptionWithMatriculation(
        person1.id,
        structure1.period.id,
        structure1.grade.id,
        structure1.section.id
      );

      const response = await agent
        .get(`/api/inscriptions?schoolPeriodId=${structure1.period.id}`)
        .expect(200);

      expect(response.body.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GET /api/inscriptions/:id', () => {
    it('should return inscription by id', async () => {
      const structure = await createAcademicStructure();
      const person = await createStudentPerson('student1');

      const inscription = await createTestInscription(
        person.id,
        structure.period.id,
        structure.grade.id,
        structure.section.id
      );

      const response = await agent
        .get(`/api/inscriptions/${inscription.id}`)
        .expect(200);

      expect(response.body.id).toBe(inscription.id);
      expect(response.body).toHaveProperty('student');
      expect(response.body).toHaveProperty('grade');
    });

    it('should return 404 for non-existent inscription', async () => {
      await agent
        .get('/api/inscriptions/99999')
        .expect(404);
    });
  });

  describe('POST /api/inscriptions', () => {
    it('should create new inscription (matriculation)', async () => {
      const structure = await createAcademicStructure();
      const person = await createStudentPerson('student1');

      const response = await agent
        .post('/api/inscriptions')
        .send({
          personId: person.id,
          schoolPeriodId: structure.period.id,
          gradeId: structure.grade.id,
          sectionId: structure.section.id,
          escolaridad: 'regular'
        })
        .expect(201);

      // createInscription returns { message, matriculation, reportUuid }
      expect(response.body).toHaveProperty('matriculation');
      expect(response.body.matriculation.personId).toBe(person.id);
      expect(response.body.matriculation.escolaridad).toBe('regular');
    });

    it('should return 400 for missing required fields', async () => {
      await agent
        .post('/api/inscriptions')
        .send({
          personId: 1
        })
        .expect(400);
    });

    it('should prevent duplicate inscription for same period', async () => {
      const structure = await createAcademicStructure();
      const person = await createStudentPerson('student1');

      await createTestInscription(
        person.id,
        structure.period.id,
        structure.grade.id,
        structure.section.id
      );

      await agent
        .post('/api/inscriptions')
        .send({
          personId: person.id,
          schoolPeriodId: structure.period.id,
          gradeId: structure.grade.id,
          sectionId: structure.section.id,
          escolaridad: 'regular'
        })
        .expect(400);
    });
  });

  describe('PUT /api/inscriptions/:id', () => {
    it('should update inscription', async () => {
      const structure = await createAcademicStructure();
      const person = await createStudentPerson('student1');

      const inscription = await createTestInscription(
        person.id,
        structure.period.id,
        structure.grade.id,
        structure.section.id
      );

      const response = await agent
        .put(`/api/inscriptions/${inscription.id}`)
        .send({
          escolaridad: 'repitiente'
        })
        .expect(200);

      // updateInscription returns { message, inscription }
      expect(response.body.message).toMatch(/actualizado/i);
      expect(response.body.inscription.id).toBe(inscription.id);
    });
  });

  describe('DELETE /api/inscriptions/:id', () => {
    it('should delete inscription', async () => {
      const structure = await createAcademicStructure();
      const person = await createStudentPerson('student1');

      const inscription = await createTestInscription(
        person.id,
        structure.period.id,
        structure.grade.id,
        structure.section.id
      );

      await agent
        .delete(`/api/inscriptions/${inscription.id}`)
        .expect(200);

      const deleted = await Inscription.findByPk(inscription.id);
      expect(deleted).toBeNull();
    });
  });

  describe('POST /api/inscriptions/:id/subjects', () => {
    it('should enroll student in subject', async () => {
      const structure = await createAcademicStructure();
      const person = await createStudentPerson('student1');

      const inscription = await createTestInscription(
        person.id,
        structure.period.id,
        structure.grade.id,
        structure.section.id
      );

      const response = await agent
        .post(`/api/inscriptions/${inscription.id}/subjects`)
        .send({
          subjectId: structure.subject.id
        })
        .expect(200);

      // addSubjectToInscription returns { message: '...' }
      expect(response.body.message).toMatch(/agregad/i);

      // Verify the InscriptionSubject was created
      const is = await InscriptionSubject.findOne({
        where: { inscriptionId: inscription.id, subjectId: structure.subject.id }
      });
      expect(is).not.toBeNull();
      expect(is!.inscriptionId).toBe(inscription.id);
      expect(is!.subjectId).toBe(structure.subject.id);
    });
  });

  describe('DELETE /api/inscriptions/:inscriptionId/subjects/:subjectId', () => {
    it('should unenroll student from subject', async () => {
      const structure = await createAcademicStructure();
      const person = await createStudentPerson('student1');

      const inscription = await createTestInscription(
        person.id,
        structure.period.id,
        structure.grade.id,
        structure.section.id
      );

      await InscriptionSubject.create({
        inscriptionId: inscription.id,
        subjectId: structure.subject.id
      });

      await agent
        .delete(`/api/inscriptions/${inscription.id}/subjects/${structure.subject.id}`)
        .expect(200);

      const deleted = await InscriptionSubject.findOne({
        where: { inscriptionId: inscription.id, subjectId: structure.subject.id }
      });
      expect(deleted).toBeNull();
    });
  });
});
