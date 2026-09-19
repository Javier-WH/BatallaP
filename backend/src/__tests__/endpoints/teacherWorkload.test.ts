import request from 'supertest';
import app from '@/app';
import {
  createTestUser,
  createTestRole,
  createAcademicStructure,
  createTestGrade,
  createTestSection,
  createTestSetting,
} from '../helpers/testData';
import {
  PersonRole, PeriodGrade, PeriodGradeSection, PeriodGradeSubject,
  ScheduleLink, ScheduleLinkItem, SubjectGroup, TeacherAssignment, TeacherAdminHour,
} from '@/models/index';

// GET /api/teacher-workload?schoolPeriodId=
// teachingBlocks = Σ assignments (non-MP sections) of
//   subject.weeklyBlocks ?? periodGradeSubject.weeklyBlocks
// teachingHours = teachingBlocks × min_academic_hours_per_block
// totalHours = teachingHours + adminHours
describe('Teacher workload endpoint', () => {
  let agent: any;

  const setup = async () => {
    agent = request.agent(app);
    const { person: staffPerson } = await createTestUser({ username: 'admin' });
    const staffRole = await createTestRole('Master');
    await PersonRole.create({ personId: staffPerson.id, roleId: staffRole.id });
    await agent
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'password123' });

    const { person: teacher } = await createTestUser({ username: 'prof1' });
    const teacherRole = await createTestRole('Profesor');
    await PersonRole.create({ personId: teacher.id, roleId: teacherRole.id });
    return teacher;
  };

  it('computes blocks from PeriodGradeSubject.weeklyBlocks plus admin hours', async () => {
    const teacher = await setup();
    const { period, section, periodGradeSection, periodGradeSubject } = await createAcademicStructure();
    await createTestSetting('min_academic_hours_per_block', '2');
    await periodGradeSubject.update({ weeklyBlocks: 5 });

    await TeacherAssignment.create({
      teacherId: teacher.id,
      periodGradeSubjectId: periodGradeSubject.id,
      sectionId: section.id,
    });
    await TeacherAdminHour.create({
      teacherId: teacher.id,
      schoolPeriodId: period.id,
      day: 'Lunes',
      periodId: 'm1',
    });

    const res = await agent
      .get(`/api/teacher-workload?schoolPeriodId=${period.id}`)
      .expect(200);

    const row = res.body.find((r: any) => r.teacherId === teacher.id);
    expect(row).toBeDefined();
    expect(row.teachingBlocks).toBe(5);
    expect(row.teachingHours).toBe(10);
    expect(row.adminHours).toBe(1);
    expect(row.totalHours).toBe(11);
    void periodGradeSection;
  });

  it('Subject.weeklyBlocks overrides the per-grade default', async () => {
    const teacher = await setup();
    const { period, section, periodGradeSubject, subject } = await createAcademicStructure();
    await createTestSetting('min_academic_hours_per_block', '2');
    await periodGradeSubject.update({ weeklyBlocks: 5 });
    await subject.update({ weeklyBlocks: 1 });

    await TeacherAssignment.create({
      teacherId: teacher.id,
      periodGradeSubjectId: periodGradeSubject.id,
      sectionId: section.id,
    });

    const res = await agent
      .get(`/api/teacher-workload?schoolPeriodId=${period.id}`)
      .expect(200);

    const row = res.body.find((r: any) => r.teacherId === teacher.id);
    expect(row.teachingBlocks).toBe(1);
    expect(row.teachingHours).toBe(2);
  });

  it('excludes assignments in the Materia Pendiente section', async () => {
    const teacher = await setup();
    const { period, periodGrade, periodGradeSubject } = await createAcademicStructure();
    const mpSection = await createTestSection({ isMateriaPendiente: true });
    await PeriodGradeSection.create({
      periodGradeId: periodGrade.id,
      sectionId: mpSection.id,
    });
    await periodGradeSubject.update({ weeklyBlocks: 5 });

    await TeacherAssignment.create({
      teacherId: teacher.id,
      periodGradeSubjectId: periodGradeSubject.id,
      sectionId: mpSection.id,
    });

    const res = await agent
      .get(`/api/teacher-workload?schoolPeriodId=${period.id}`)
      .expect(200);

    const row = res.body.find((r: any) => r.teacherId === teacher.id);
    expect(row).toBeDefined();
    expect(row.teachingBlocks).toBe(0);
    expect(row.totalHours).toBe(0);
  });

  it('counts a linked group subject once across sections and grades', async () => {
    const teacher = await setup();
    // Grade 1 with 2 sections + Grade 2 with 2 sections, same grouped subject,
    // all linked → the teacher delivers it once to everyone simultaneously.
    const { period, periodGrade, section, periodGradeSubject, subject } = await createAcademicStructure();
    await createTestSetting('min_academic_hours_per_block', '1');

    const sectionB = await createTestSection();
    await PeriodGradeSection.create({ periodGradeId: periodGrade.id, sectionId: sectionB.id });

    const grade2 = await createTestGrade();
    const periodGrade2 = await PeriodGrade.create({ schoolPeriodId: period.id, gradeId: grade2.id });
    const sectionC = await createTestSection();
    const sectionD = await createTestSection();
    await PeriodGradeSection.create({ periodGradeId: periodGrade2.id, sectionId: sectionC.id });
    await PeriodGradeSection.create({ periodGradeId: periodGrade2.id, sectionId: sectionD.id });
    const pgs2 = await PeriodGradeSubject.create({ periodGradeId: periodGrade2.id, subjectId: subject.id });

    const group = await SubjectGroup.create({ name: `GRUPO-TEST-${subject.id}` });
    await subject.update({ subjectGroupId: group.id, weeklyBlocks: 4 });
    const link = await ScheduleLink.create({ schoolPeriodId: period.id, name: 'Desfiles' });
    await ScheduleLinkItem.bulkCreate([
      { linkId: link.id, subjectId: subject.id, periodGradeId: periodGrade.id },
      { linkId: link.id, subjectId: subject.id, periodGradeId: periodGrade2.id },
    ]);

    for (const sec of [section.id, sectionB.id]) {
      await TeacherAssignment.create({ teacherId: teacher.id, periodGradeSubjectId: periodGradeSubject.id, sectionId: sec });
    }
    for (const sec of [sectionC.id, sectionD.id]) {
      await TeacherAssignment.create({ teacherId: teacher.id, periodGradeSubjectId: pgs2.id, sectionId: sec });
    }

    const res = await agent
      .get(`/api/teacher-workload?schoolPeriodId=${period.id}`)
      .expect(200);

    const row = res.body.find((r: any) => r.teacherId === teacher.id);
    // One simultaneous unit of 4 blocks, not 4 assignments × 4 = 16
    expect(row.teachingBlocks).toBe(4);
    expect(row.totalHours).toBe(4);
  });

  it('counts a grouped subject once across same-grade sections (no link)', async () => {
    const teacher = await setup();
    const { period, periodGrade, section, periodGradeSubject, subject } = await createAcademicStructure();
    await createTestSetting('min_academic_hours_per_block', '1');

    const sectionB = await createTestSection();
    await PeriodGradeSection.create({ periodGradeId: periodGrade.id, sectionId: sectionB.id });

    const group = await SubjectGroup.create({ name: `GRUPO-TEST-${subject.id}` });
    await subject.update({ subjectGroupId: group.id });
    await periodGradeSubject.update({ weeklyBlocks: 3 });

    for (const sec of [section.id, sectionB.id]) {
      await TeacherAssignment.create({ teacherId: teacher.id, periodGradeSubjectId: periodGradeSubject.id, sectionId: sec });
    }

    const res = await agent
      .get(`/api/teacher-workload?schoolPeriodId=${period.id}`)
      .expect(200);

    const row = res.body.find((r: any) => r.teacherId === teacher.id);
    // Both sections share the same group block → 3, not 6
    expect(row.teachingBlocks).toBe(3);
  });
});
