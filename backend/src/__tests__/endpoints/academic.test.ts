import request from 'supertest';
import app from '@/app';
import {
  createTestUser,
  createTestPeriod,
  createTestGrade,
  createTestSection,
  createTestSubject,
  createAcademicStructure
} from '../helpers/testData';
import { PeriodGrade, PeriodGradeSection, PeriodGradeSubject } from '@/models/index';

describe('Academic Endpoints', () => {
  let agent: any;

  beforeEach(async () => {
    agent = request.agent(app);

    await createTestUser({ username: 'admin' });

    await agent
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'password123' });
  });

  describe('GET /api/academic/periods', () => {
    it('should return all school periods', async () => {
      await createTestPeriod({ period: '2024-2025', startYear: 2024, endYear: 2025 });
      await createTestPeriod({ period: '2025-2026', startYear: 2025, endYear: 2026 });

      const response = await agent
        .get('/api/academic/periods')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('GET /api/academic/active', () => {
    it('should return active period', async () => {
      await createTestPeriod({ isActive: true });

      const response = await agent
        .get('/api/academic/active')
        .expect(200);

      // getActivePeriod returns the period object directly (or null)
      expect(response.body).not.toBeNull();
      expect(response.body.isActive).toBe(true);
    });

    it('should return null when no active period', async () => {
      await createTestPeriod({ isActive: false });

      const response = await agent
        .get('/api/academic/active')
        .expect(200);

      expect(response.body).toBeNull();
    });
  });

  describe('POST /api/academic/periods', () => {
    it('should create new school period', async () => {
      const response = await agent
        .post('/api/academic/periods')
        .send({
          period: '2026-2027',
          name: 'Año Escolar 2026-2027'
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.period).toBe('2026-2027');
    });

    it('should return 400 for missing required fields', async () => {
      await agent
        .post('/api/academic/periods')
        .send({
          period: '2026-2027'
        })
        .expect(400);
    });
  });

  describe('GET /api/academic/grades', () => {
    it('should return all grades', async () => {
      await createTestGrade({ name: 'Primer año' });
      await createTestGrade({ name: 'Segundo año' });

      const response = await agent
        .get('/api/academic/grades')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('GET /api/academic/sections', () => {
    it('should return all sections', async () => {
      await createTestSection({ name: 'Sección A' });
      await createTestSection({ name: 'Sección B' });

      const response = await agent
        .get('/api/academic/sections')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('GET /api/academic/subjects', () => {
    it('should return all subjects', async () => {
      await createTestSubject({ name: 'Matemática' });
      await createTestSubject({ name: 'Castellano' });

      const response = await agent
        .get('/api/academic/subjects')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('GET /api/academic/structure/:periodId', () => {
    it('should return period structure (array of PeriodGrades)', async () => {
      const structure = await createAcademicStructure();

      const response = await agent
        .get(`/api/academic/structure/${structure.period.id}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(1);
      // Each item is a PeriodGrade with nested grade, sections, subjects
      expect(response.body[0]).toHaveProperty('grade');
      expect(response.body[0]).toHaveProperty('sections');
      expect(response.body[0]).toHaveProperty('subjects');
    });
  });

  describe('POST /api/academic/structure/period-grade', () => {
    it('should assign grade to period', async () => {
      const period = await createTestPeriod();
      const grade = await createTestGrade();

      const response = await agent
        .post('/api/academic/structure/period-grade')
        .send({ schoolPeriodId: period.id, gradeId: grade.id })
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body.schoolPeriodId).toBe(period.id);
      expect(response.body.gradeId).toBe(grade.id);
    });
  });

  describe('POST /api/academic/structure/section', () => {
    it('should assign section to period-grade', async () => {
      const structure = await createAcademicStructure();
      const newSection = await createTestSection({ name: 'Sección B' });

      const response = await agent
        .post('/api/academic/structure/section')
        .send({ periodGradeId: structure.periodGrade.id, sectionId: newSection.id })
        .expect(200);

      expect(response.body).toHaveProperty('periodGradeId');
      expect(response.body.periodGradeId).toBe(structure.periodGrade.id);
      expect(response.body.sectionId).toBe(newSection.id);
    });
  });

  describe('POST /api/academic/structure/subject', () => {
    it('should assign subject to period-grade', async () => {
      const structure = await createAcademicStructure();
      const newSubject = await createTestSubject({ name: 'Física' });

      const response = await agent
        .post('/api/academic/structure/subject')
        .send({ periodGradeId: structure.periodGrade.id, subjectId: newSubject.id })
        .expect(200);

      expect(response.body).toHaveProperty('periodGradeId');
      expect(response.body.periodGradeId).toBe(structure.periodGrade.id);
      expect(response.body.subjectId).toBe(newSubject.id);
    });
  });
});
