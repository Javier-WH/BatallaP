import request from 'supertest';
import app from '@/app';
import {
  createTestUser,
  createAcademicStructure,
  createTestInscription
} from '../helpers/testData';
import { Inscription, InscriptionSubject } from '@/models/index';

describe('Inscription Endpoints', () => {
  let agent: any;

  beforeEach(async () => {
    agent = request.agent(app);
    
    await createTestUser({ username: 'admin' });
    
    await agent
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'password123' });
  });

  describe('GET /api/inscriptions', () => {
    it('should return all inscriptions', async () => {
      const structure = await createAcademicStructure();
      const { person } = await createTestUser({ username: 'student1' });
      
      await createTestInscription(
        person.id,
        structure.period.id,
        structure.grade.id,
        structure.section.id
      );

      const response = await agent
        .get('/api/inscriptions')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
    });

    it('should filter inscriptions by period', async () => {
      const structure1 = await createAcademicStructure();
      const { person: person1 } = await createTestUser({ username: 'student1' });
      const { person: person2 } = await createTestUser({ username: 'student2' });
      
      await createTestInscription(
        person1.id,
        structure1.period.id,
        structure1.grade.id,
        structure1.section.id
      );

      const response = await agent
        .get(`/api/inscriptions?schoolPeriodId=${structure1.period.id}`)
        .expect(200);

      expect(response.body.length).toBe(1);
    });
  });

  describe('GET /api/inscriptions/:id', () => {
    it('should return inscription by id', async () => {
      const structure = await createAcademicStructure();
      const { person } = await createTestUser({ username: 'student1' });
      
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
    it('should create new inscription', async () => {
      const structure = await createAcademicStructure();
      const { person } = await createTestUser({ username: 'student1' });

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

      expect(response.body).toHaveProperty('id');
      expect(response.body.personId).toBe(person.id);
      expect(response.body.escolaridad).toBe('regular');
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
      const { person } = await createTestUser({ username: 'student1' });

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
      const { person } = await createTestUser({ username: 'student1' });
      
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

      expect(response.body.escolaridad).toBe('repitiente');
    });
  });

  describe('DELETE /api/inscriptions/:id', () => {
    it('should delete inscription', async () => {
      const structure = await createAcademicStructure();
      const { person } = await createTestUser({ username: 'student1' });
      
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
      const { person } = await createTestUser({ username: 'student1' });
      
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
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.inscriptionId).toBe(inscription.id);
      expect(response.body.subjectId).toBe(structure.subject.id);
    });
  });

  describe('DELETE /api/inscriptions/:inscriptionId/subjects/:subjectId', () => {
    it('should unenroll student from subject', async () => {
      const structure = await createAcademicStructure();
      const { person } = await createTestUser({ username: 'student1' });
      
      const inscription = await createTestInscription(
        person.id,
        structure.period.id,
        structure.grade.id,
        structure.section.id
      );

      const inscriptionSubject = await InscriptionSubject.create({
        inscriptionId: inscription.id,
        subjectId: structure.subject.id
      });

      await agent
        .delete(`/api/inscriptions/${inscription.id}/subjects/${structure.subject.id}`)
        .expect(200);

      const deleted = await InscriptionSubject.findByPk(inscriptionSubject.id);
      expect(deleted).toBeNull();
    });
  });
});
