import request from 'supertest';
import app from '@/app';
import {
  createTestUser,
  createTestPeriod,
  createAcademicStructure,
  createTestInscription
} from '../helpers/testData';
import { StudentPeriodOutcome, PendingSubject } from '@/models/index';

describe('Period Outcome Endpoints', () => {
  let agent: any;
  let periodId: number;

  beforeEach(async () => {
    agent = request.agent(app);
    
    const { user } = await createTestUser({ username: 'admin' });
    
    await agent
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'password123' });

    const period = await createTestPeriod();
    periodId = period.id;
  });

  describe('GET /api/periods/:periodId/outcomes', () => {
    it('should return empty array when no outcomes exist', async () => {
      const response = await agent
        .get(`/api/periods/${periodId}/outcomes`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(0);
    });

    it('should return outcomes for period', async () => {
      const structure = await createAcademicStructure();
      const { person } = await createTestUser({ username: 'student1' });
      
      const inscription = await createTestInscription(
        person.id,
        structure.period.id,
        structure.grade.id,
        structure.section.id
      );

      await StudentPeriodOutcome.create({
        inscriptionId: inscription.id,
        finalAverage: 15.5,
        failedSubjects: 0,
        status: 'aprobado'
      });

      const response = await agent
        .get(`/api/periods/${structure.period.id}/outcomes`)
        .expect(200);

      expect(response.body.length).toBe(1);
      expect(response.body[0].status).toBe('aprobado');
      expect(response.body[0].finalAverage).toBe('15.50');
    });

    it('should filter outcomes by status', async () => {
      const structure = await createAcademicStructure();
      const { person: person1 } = await createTestUser({ username: 'student1' });
      const { person: person2 } = await createTestUser({ username: 'student2' });
      
      const inscription1 = await createTestInscription(
        person1.id,
        structure.period.id,
        structure.grade.id,
        structure.section.id
      );

      const inscription2 = await createTestInscription(
        person2.id,
        structure.period.id,
        structure.grade.id,
        structure.section.id
      );

      await StudentPeriodOutcome.create({
        inscriptionId: inscription1.id,
        finalAverage: 15.5,
        failedSubjects: 0,
        status: 'aprobado'
      });

      await StudentPeriodOutcome.create({
        inscriptionId: inscription2.id,
        finalAverage: 8.5,
        failedSubjects: 5,
        status: 'reprobado'
      });

      const response = await agent
        .get(`/api/periods/${structure.period.id}/outcomes?status=aprobado`)
        .expect(200);

      expect(response.body.length).toBe(1);
      expect(response.body[0].status).toBe('aprobado');
    });

    it('should return 400 for invalid status', async () => {
      await agent
        .get(`/api/periods/${periodId}/outcomes?status=invalid`)
        .expect(400);
    });
  });

  describe('GET /api/periods/:periodId/pending-subjects', () => {
    it('should return empty array when no pending subjects exist', async () => {
      const response = await agent
        .get(`/api/periods/${periodId}/pending-subjects`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(0);
    });

    it('should return pending subjects for period', async () => {
      const structure = await createAcademicStructure();
      const { person } = await createTestUser({ username: 'student1' });
      
      const inscription = await createTestInscription(
        person.id,
        structure.period.id,
        structure.grade.id,
        structure.section.id
      );

      await PendingSubject.create({
        newInscriptionId: inscription.id,
        subjectId: structure.subject.id,
        originPeriodId: structure.period.id,
        status: 'pendiente'
      });

      const response = await agent
        .get(`/api/periods/${structure.period.id}/pending-subjects`)
        .expect(200);

      expect(response.body.length).toBe(1);
      expect(response.body[0].status).toBe('pendiente');
    });
  });

  describe('POST /api/periods/pending-subjects/:pendingSubjectId/resolve', () => {
    it('should resolve pending subject as aprobada', async () => {
      const structure = await createAcademicStructure();
      const { person } = await createTestUser({ username: 'student1' });
      
      const inscription = await createTestInscription(
        person.id,
        structure.period.id,
        structure.grade.id,
        structure.section.id
      );

      const pendingSubject = await PendingSubject.create({
        newInscriptionId: inscription.id,
        subjectId: structure.subject.id,
        originPeriodId: structure.period.id,
        status: 'pendiente'
      });

      const response = await agent
        .post(`/api/periods/pending-subjects/${pendingSubject.id}/resolve`)
        .send({ status: 'aprobada' })
        .expect(200);

      expect(response.body.status).toBe('aprobada');
      expect(response.body.resolvedAt).toBeDefined();
    });

    it('should return 400 for invalid status', async () => {
      await agent
        .post('/api/periods/pending-subjects/1/resolve')
        .send({ status: 'invalid' })
        .expect(400);
    });
  });
});
