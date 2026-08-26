import request from 'supertest';
import app from '@/app';
import {
  createTestUser,
  createTestPeriod,
  createTestGrade,
  createTestSection,
  createAcademicStructure,
  createTestInscription,
  createTestSetting,
  createTestTerm
} from '../helpers/testData';
import { Term, CouncilChecklist, PeriodGrade, PersonRole } from '@/models/index';
import { createTestRole } from '../helpers/testData';

describe('Period Closure Endpoints', () => {
  let agent: any;
  let userId: number;
  let periodId: number;

  beforeEach(async () => {
    agent = request.agent(app);

    const { user, person } = await createTestUser({ username: 'admin' });
    userId = user.id;
    const masterRole = await createTestRole('Master');
    await PersonRole.create({ personId: person.id, roleId: masterRole.id });

    await agent
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'password123' });

    const period = await createTestPeriod();
    periodId = period.id;
  });

  describe('GET /api/period-closure/:periodId/status', () => {
    it('should return period closure status', async () => {
      const response = await agent
        .get(`/api/period-closure/${periodId}/status`)
        .expect(200);

      expect(response.body).toHaveProperty('period');
      expect(response.body).toHaveProperty('checklist');
      expect(response.body).toHaveProperty('blockedTerms');
      expect(response.body).toHaveProperty('totalTerms');
      expect(response.body.period.id).toBe(periodId);
    });

    it('should return 400 for invalid periodId', async () => {
      await agent
        .get('/api/period-closure/invalid/status')
        .expect(400);
    });

    it('should include nextPeriod when available', async () => {
      await createTestPeriod({
        period: '2026-2027',
        name: 'Año Escolar 2026-2027',
        startYear: 2026,
        endYear: 2027,
        isActive: false
      });

      const response = await agent
        .get(`/api/period-closure/${periodId}/status`)
        .expect(200);

      expect(response.body.nextPeriod).toBeDefined();
      expect(response.body.nextPeriod.period).toBe('2026-2027');
    });
  });

  describe('GET /api/period-closure/:periodId/validate', () => {
    it('should validate closure requirements', async () => {
      const response = await agent
        .get(`/api/period-closure/${periodId}/validate`)
        .expect(200);

      expect(response.body).toHaveProperty('valid');
      expect(response.body).toHaveProperty('errors');
      expect(response.body).toHaveProperty('warnings');
    });

    it('should return errors when next period does not exist', async () => {
      const response = await agent
        .get(`/api/period-closure/${periodId}/validate`)
        .expect(200);

      expect(response.body.valid).toBe(false);
      expect(response.body.errors).toContain(
        'Debe existir un periodo siguiente creado antes de cerrar el periodo actual'
      );
    });

    it('should return errors when terms are not blocked', async () => {
      await createTestPeriod({
        period: '2026-2027',
        startYear: 2026,
        endYear: 2027,
        isActive: false
      });

      // Create a structure with sections so areAllSectionsClosed returns false
      // (totalSections > 0 but no TermSectionClosure records).
      const structure = await createAcademicStructure({ periodId });
      await createTestTerm(periodId, { isBlocked: false, name: 'Primer Lapso' });

      const response = await agent
        .get(`/api/period-closure/${periodId}/validate`)
        .expect(200);

      expect(response.body.valid).toBe(false);
      // Validation now checks per-term: either blocked OR all sections closed
      expect(response.body.errors.some((e: string) =>
        e.includes('no tiene todas sus secciones cerradas')
      )).toBe(true);
    });
  });

  describe('GET /api/period-closure/:periodId/preview', () => {
    it('should return preview of student outcomes', async () => {
      const structure = await createAcademicStructure({ periodId: periodId });
      const { person } = await createTestUser({ username: 'student1', document: '11111111' });
      
      await createTestInscription(
        person.id,
        structure.period.id,
        structure.grade.id,
        structure.section.id
      );

      await createTestSetting('min_approval_grade', '10');

      const response = await agent
        .get(`/api/period-closure/${structure.period.id}/preview`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('POST /api/period-closure/:periodId/execute', () => {
    it('should fail validation when requirements not met', async () => {
      const response = await agent
        .post(`/api/period-closure/${periodId}/execute`)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors.length).toBeGreaterThan(0);
    });

    it('should successfully close period when all requirements met', async () => {
      const nextPeriod = await createTestPeriod({
        period: '2026-2027',
        name: 'Año Escolar 2026-2027',
        startYear: 2026,
        endYear: 2027,
        status: 'preinscripcion'
      });

      const term1 = await createTestTerm(periodId, { 
        name: 'Primer Lapso',
        order: 1,
        isBlocked: true 
      });
      const term2 = await createTestTerm(periodId, { 
        name: 'Segundo Lapso',
        order: 2,
        isBlocked: true 
      });
      const term3 = await createTestTerm(periodId, { 
        name: 'Tercer Lapso',
        order: 3,
        isBlocked: true 
      });

      await createTestSetting('min_approval_grade', '10');

      const structure = await createAcademicStructure({ periodId: periodId });
      const { person } = await createTestUser({ username: 'student1', document: '11111111' });
      
      await createTestInscription(
        person.id,
        periodId,
        structure.grade.id,
        structure.section.id
      );

      await PeriodGrade.create({
        schoolPeriodId: nextPeriod.id,
        gradeId: structure.grade.id
      });

      const response = await agent
        .post(`/api/period-closure/${periodId}/execute`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('stats');
      expect(response.body.stats.totalStudents).toBeGreaterThan(0);
    });
  });
});
