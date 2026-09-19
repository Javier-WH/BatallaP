import request from 'supertest';
import app from '@/app';
import { createTestUser, createAcademicStructure } from '../helpers/testData';
import { Subject } from '@/models/index';

// weeklyBlocks precedence: Subject.weeklyBlocks (per-subject override,
// null = unset) wins over PeriodGradeSubject.weeklyBlocks (per-grade default).
describe('Schedule section options — weeklyBlocks precedence', () => {
  let agent: any;

  beforeEach(async () => {
    agent = request.agent(app);
    await createTestUser({ username: 'admin' });
    await agent
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'password123' });
  });

  it('uses PeriodGradeSubject.weeklyBlocks when the subject has no override', async () => {
    const { periodGradeSection, periodGradeSubject } = await createAcademicStructure();
    await periodGradeSubject.update({ weeklyBlocks: 5 });

    const res = await agent
      .get(`/api/schedules/section/${periodGradeSection.id}/options`)
      .expect(200);

    const opt = res.body.find((o: any) => o.periodGradeSubjectId === periodGradeSubject.id);
    expect(opt.weeklyBlocks).toBe(5);
  });

  it('Subject.weeklyBlocks overrides PeriodGradeSubject.weeklyBlocks', async () => {
    const { periodGradeSection, periodGradeSubject, subject } = await createAcademicStructure();
    await periodGradeSubject.update({ weeklyBlocks: 5 });
    await subject.update({ weeklyBlocks: 1 });

    const res = await agent
      .get(`/api/schedules/section/${periodGradeSection.id}/options`)
      .expect(200);

    const opt = res.body.find((o: any) => o.periodGradeSubjectId === periodGradeSubject.id);
    expect(opt.weeklyBlocks).toBe(1);
  });

  it('PUT /api/academic/subjects/:id persists and clears weeklyBlocks', async () => {
    const { subject } = await createAcademicStructure();

    await agent
      .put(`/api/academic/subjects/${subject.id}`)
      .send({ name: subject.name, weeklyBlocks: 3 })
      .expect(200);
    expect((await Subject.findByPk(subject.id))!.weeklyBlocks).toBe(3);

    await agent
      .put(`/api/academic/subjects/${subject.id}`)
      .send({ name: subject.name, weeklyBlocks: null })
      .expect(200);
    expect((await Subject.findByPk(subject.id))!.weeklyBlocks).toBeNull();
  });
});
