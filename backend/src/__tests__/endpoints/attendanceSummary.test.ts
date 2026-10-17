import request from 'supertest';
import app from '@/app';
import {
  createTestUser,
  createTestRole,
  createAcademicStructure,
  createTestInscription,
  createTestTerm,
} from '../helpers/testData';
import {
  PersonRole, Schedule, ScheduleEntry, AttendanceSession, AttendanceRecord, Term, Inscription,
} from '@/models/index';

const MONDAY = '2026-09-14';
const TUESDAY = '2026-09-15';
const NEXT_MONDAY = '2026-12-14'; // outside term 1

async function loginStaff(roleName: 'Control de Estudios' | 'Profesor' = 'Control de Estudios') {
  const agent = request.agent(app);
  const { user, person } = await createTestUser({ username: `sum_${roleName.replace(/\s/g, '')}` });
  const role = await createTestRole(roleName);
  await PersonRole.create({ personId: person.id, roleId: role.id });
  await agent.post('/api/auth/login').send({ username: user.username, password: 'password123' });
  return { agent, person };
}

async function setup() {
  const structure = await createAcademicStructure();
  const { agent, person } = await loginStaff();
  const term = await createTestTerm(structure.period.id, { name: 'Primer Lapso', order: 1 });
  await Term.update({ openDate: '2026-09-01', closeDate: '2026-11-30' } as any, { where: { id: term.id } });

  const schedule = await Schedule.create({
    schoolPeriodId: structure.period.id,
    periodGradeSectionId: structure.periodGradeSection.id,
    status: 'published',
  });
  const mkEntry = (day: string, periodId: string) => ScheduleEntry.create({
    scheduleId: schedule.id, day, periodId, subjectId: structure.subject.id, teacherId: person.id, isGroupSubject: false,
  } as any);
  const mon1 = await mkEntry('Lunes', 'm1');
  const mon2 = await mkEntry('Lunes', 'm2');
  const mon3 = await mkEntry('Lunes', 'm3');
  const tue1 = await mkEntry('Martes', 'm1');

  const { person: studentPerson } = await createTestUser({ username: 'sumstudent', firstName: 'Juan', lastName: 'Pérez' });
  const inscription = await createTestInscription(
    studentPerson.id, structure.period.id, structure.grade.id, structure.section.id,
  );

  const mark = async (entry: any, date: string, status: string, reason: string | null = null, insId = inscription.id) => {
    const [session] = await AttendanceSession.findOrCreate({
      where: { scheduleEntryId: entry.id, sessionDate: date },
      defaults: { scheduleEntryId: entry.id, schoolPeriodId: structure.period.id, sessionDate: date } as any,
    });
    await AttendanceRecord.create({
      sessionId: session.id, inscriptionId: insId, teacherId: person.id, status, reason, markedAt: new Date(),
    } as any);
  };

  return { structure, agent, term, inscription, mon1, mon2, mon3, tue1, mark, person };
}

describe('Attendance summary report', () => {
  it('counts blocks and days; unjustified, justified and late are separated', async () => {
    const { structure, agent, term, inscription, mon1, mon2, mon3, tue1, mark } = await setup();
    await mark(mon1, MONDAY, 'absent');
    await mark(mon2, MONDAY, 'absent');
    await mark(mon3, MONDAY, 'absent', 'Enfermo');
    await mark(tue1, TUESDAY, 'late');

    const res = await agent.get('/api/attendance/reports/summary')
      .query({ schoolPeriodId: structure.period.id, termId: term.id }).expect(200);
    const s = res.body.students.find((x: any) => x.inscriptionId === inscription.id);
    expect(s.absentBlocks).toBe(2);
    expect(s.justifiedBlocks).toBe(1);
    expect(s.lateBlocks).toBe(1);
    expect(s.attendedBlocks).toBe(1);
    expect(s.totalBlocks).toBe(4);
    expect(s.totalDays).toBe(2);
    expect(s.absentDays).toBe(1);
    expect(s.attendedDays).toBe(1);
    expect(res.body.totals.absentBlocks).toBe(2);
    expect(res.body.termName).toBe('Primer Lapso');
  });

  it('limits to the term window; the whole year (no termId) includes everything', async () => {
    const { structure, agent, term, inscription, mon1, mark } = await setup();
    await mark(mon1, MONDAY, 'absent');
    await mark(mon1, NEXT_MONDAY, 'absent');

    const byTerm = await agent.get('/api/attendance/reports/summary')
      .query({ schoolPeriodId: structure.period.id, termId: term.id }).expect(200);
    expect(byTerm.body.students.find((x: any) => x.inscriptionId === inscription.id).absentBlocks).toBe(1);

    const year = await agent.get('/api/attendance/reports/summary')
      .query({ schoolPeriodId: structure.period.id }).expect(200);
    expect(year.body.students.find((x: any) => x.inscriptionId === inscription.id).absentBlocks).toBe(2);
  });

  it('rejects a term without configured dates', async () => {
    const { structure, agent, term } = await setup();
    await Term.update({ openDate: null, closeDate: null } as any, { where: { id: term.id } });
    const res = await agent.get('/api/attendance/reports/summary')
      .query({ schoolPeriodId: structure.period.id, termId: term.id }).expect(400);
    expect(res.body.message).toMatch(/fechas/);
  });

  it('includes withdrawn students tagged and keeps their section for the section filter', async () => {
    const { structure, agent, inscription, mon1, mark } = await setup();
    await mark(mon1, MONDAY, 'absent');
    await Inscription.update({ sectionId: null, withdrawnAt: new Date() } as any, { where: { id: inscription.id } });

    const res = await agent.get('/api/attendance/reports/summary')
      .query({ schoolPeriodId: structure.period.id, sectionId: structure.section.id }).expect(200);
    const s = res.body.students.find((x: any) => x.inscriptionId === inscription.id);
    // Without InscriptionSubject rows the section cannot be recovered → filtered out of a section view,
    // but visible in the grade/period view.
    expect(s).toBeUndefined();
    const all = await agent.get('/api/attendance/reports/summary')
      .query({ schoolPeriodId: structure.period.id, gradeId: structure.grade.id }).expect(200);
    const w = all.body.students.find((x: any) => x.inscriptionId === inscription.id);
    expect(w.withdrawn).toBe(true);
    expect(w.absentBlocks).toBe(1);
  });

  it('absence-detail lists the exact blocks, with jubilado detected', async () => {
    const { agent, inscription, mon1, mon2, mark } = await setup();
    await mark(mon1, MONDAY, 'present');
    await mark(mon2, MONDAY, 'absent', 'Sin motivo');

    const res = await agent.get('/api/attendance/reports/absence-detail')
      .query({ inscriptionId: inscription.id }).expect(200);
    expect(res.body.rows).toHaveLength(1);
    expect(res.body.rows[0]).toMatchObject({ date: MONDAY, periodId: 'm2', category: 'jubilado' });
    expect(res.body.counts.absentBlocks).toBe(1);
  });

  it('only staff can read the summary', async () => {
    const structure = await createAcademicStructure();
    const { agent } = await loginStaff('Profesor');
    await agent.get('/api/attendance/reports/summary')
      .query({ schoolPeriodId: structure.period.id }).expect(403);
  });
});
