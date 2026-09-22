import request from 'supertest';
import app from '@/app';
import { createTestUser, createAcademicStructure, createTestSubject } from '../helpers/testData';
import { ScheduleDayTurnException, PeriodGradeSubject } from '@/models/index';

// Forced day+turn exceptions: lock a grade's subject into one specific
// day and turn during schedule generation.
describe('Schedule day+turn exceptions endpoints', () => {
  let agent: any;

  beforeEach(async () => {
    agent = request.agent(app);
    await createTestUser({ username: 'admin' });
    await agent
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'password123' });
  });

  it('creates, lists (scoped by period) and deletes a forced day+turn exception', async () => {
    const { period, periodGrade, subject } = await createAcademicStructure();

    const createRes = await agent
      .post('/api/schedule-exceptions/day-turn')
      .send({ periodGradeId: periodGrade.id, subjectId: subject.id, day: 'Viernes', turn: 'manana', mode: 'hard' })
      .expect(201);
    expect(createRes.body.day).toBe('Viernes');
    expect(createRes.body.turn).toBe('manana');
    expect(createRes.body.mode).toBe('hard');

    const listRes = await agent
      .get('/api/schedule-exceptions/day-turn')
      .query({ schoolPeriodId: period.id })
      .expect(200);
    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0].subject.id).toBe(subject.id);
    expect(listRes.body[0].periodGrade.id).toBe(periodGrade.id);

    // Scoped list excludes exceptions from other periods
    const otherRes = await agent
      .get('/api/schedule-exceptions/day-turn')
      .query({ schoolPeriodId: period.id + 999 })
      .expect(200);
    expect(otherRes.body).toHaveLength(0);

    await agent
      .delete(`/api/schedule-exceptions/day-turn/${createRes.body.id}`)
      .expect(200);
    expect(await ScheduleDayTurnException.count()).toBe(0);
  });

  it('upserts when the same (grade, subject) is forced twice', async () => {
    const { periodGrade, subject } = await createAcademicStructure();

    await agent
      .post('/api/schedule-exceptions/day-turn')
      .send({ periodGradeId: periodGrade.id, subjectId: subject.id, day: 'Lunes', turn: 'tarde', mode: 'soft' })
      .expect(201);

    const res = await agent
      .post('/api/schedule-exceptions/day-turn')
      .send({ periodGradeId: periodGrade.id, subjectId: subject.id, day: 'Viernes', turn: 'manana', mode: 'hard' })
      .expect(200);

    expect(res.body.day).toBe('Viernes');
    expect(res.body.turn).toBe('manana');
    expect(await ScheduleDayTurnException.count()).toBe(1);
  });

  it('rejects invalid payloads', async () => {
    const { periodGrade, subject } = await createAcademicStructure();

    await agent
      .post('/api/schedule-exceptions/day-turn')
      .send({ periodGradeId: periodGrade.id, subjectId: subject.id, turn: 'manana' })
      .expect(400); // missing day

    await agent
      .post('/api/schedule-exceptions/day-turn')
      .send({ periodGradeId: periodGrade.id, subjectId: subject.id, day: 'Sábado', turn: 'manana' })
      .expect(400); // invalid day

    await agent
      .post('/api/schedule-exceptions/day-turn')
      .send({ periodGradeId: periodGrade.id, subjectId: subject.id, day: 'Lunes', turn: 'noche' })
      .expect(400); // invalid turn
  });

  it('rejects a subject that does not belong to the grade', async () => {
    const { periodGrade } = await createAcademicStructure();
    const otherSubject = await createTestSubject({ name: 'Materia ajena' });
    // Make sure it is NOT linked to the grade
    expect(await PeriodGradeSubject.findOne({ where: { periodGradeId: periodGrade.id, subjectId: otherSubject.id } })).toBeNull();

    await agent
      .post('/api/schedule-exceptions/day-turn')
      .send({ periodGradeId: periodGrade.id, subjectId: otherSubject.id, day: 'Lunes', turn: 'manana' })
      .expect(400);
  });
});
