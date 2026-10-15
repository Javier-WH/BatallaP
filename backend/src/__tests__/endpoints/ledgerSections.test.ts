import request from 'supertest';
import app from '@/app';
import { Role, PersonRole } from '@/models/index';
import {
  createTestUser,
  createAcademicStructure,
  createTestSection,
  createTestGrade,
  createTestPeriod,
  createTestInscription,
} from '../helpers/testData';

// The ledger section dropdown must not offer the auxiliary "MATERIA PENDIENTE"
// section — it is not a real grade section.
describe('GET /api/ledger/sections/:schoolPeriodId', () => {
  let agent: any;

  beforeEach(async () => {
    agent = request.agent(app);
    const { person: adminPerson } = await createTestUser({ username: 'admin' });
    const [adminRole] = await Role.findOrCreate({ where: { name: 'Administrador' as any }, defaults: { name: 'Administrador' as any } });
    await PersonRole.create({ personId: adminPerson.id, roleId: adminRole.id });
    await agent
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'password123' });
  });

  it('excludes Materia Pendiente sections but keeps regular ones', async () => {
    const { period, grade, section } = await createAcademicStructure();
    const { person: student1 } = await createTestUser({ username: 'student1' });
    await createTestInscription(student1.id, period.id, grade.id, section.id);

    const mpSection = await createTestSection({ name: 'MATERIA PENDIENTE', isMateriaPendiente: true });
    const { person: student2 } = await createTestUser({ username: 'student2' });
    await createTestInscription(student2.id, period.id, grade.id, mpSection.id);

    const res = await agent.get(`/api/ledger/sections/${period.id}`).expect(200);

    const ids = res.body.map((s: any) => s.sectionId);
    expect(ids).toContain(section.id);
    expect(ids).not.toContain(mpSection.id);
  });

  it('orders sections by grade.order, then grade name, then section name', async () => {
    const period = await createTestPeriod();
    // Deliberately inverted: "Z" grade has lower order than "A" grade.
    // (createTestGrade doesn't pass `order` through — set it with update().)
    const gradeHigh = await createTestGrade({ name: 'Zeta año' });
    const gradeLow = await createTestGrade({ name: 'Alfa año' });
    await gradeHigh.update({ order: 1 });
    await gradeLow.update({ order: 2 });
    const sectionB = await createTestSection({ name: 'B' });
    const sectionA = await createTestSection({ name: 'A' });

    const enroll = async (username: string, gradeId: number, sectionId: number) => {
      const { person } = await createTestUser({ username });
      await createTestInscription(person.id, period.id, gradeId, sectionId);
    };
    // Alfa-B inserted first on purpose; canonical order must not depend on insert order.
    await enroll('s1', gradeLow.id, sectionB.id);
    await enroll('s2', gradeHigh.id, sectionA.id);
    await enroll('s3', gradeLow.id, sectionA.id);

    const res = await agent.get(`/api/ledger/sections/${period.id}`).expect(200);
    const pairs = res.body.map((s: any) => `${s.gradeName}/${s.sectionName}`);

    expect(pairs).toEqual([
      `${gradeHigh.name}/A`,
      `${gradeLow.name}/A`,
      `${gradeLow.name}/B`,
    ]);
  });
});

// The ledger student list must carry the official roster number and be
// ordered by it (canonical roster order), NULLs last.
describe('GET /api/ledger/:schoolPeriodId/:gradeId/:sectionId', () => {
  let agent: any;

  beforeEach(async () => {
    agent = request.agent(app);
    const { person: adminPerson } = await createTestUser({ username: 'admin' });
    const [adminRole] = await Role.findOrCreate({ where: { name: 'Administrador' as any }, defaults: { name: 'Administrador' as any } });
    await PersonRole.create({ personId: adminPerson.id, roleId: adminRole.id });
    await agent
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'password123' });
  });

  it('returns rosterNumber and orders students by it (NULLs last)', async () => {
    const { period, grade, section } = await createAcademicStructure();

    const { person: p1 } = await createTestUser({ username: 'st1', firstName: 'Ana', lastName: 'Zamora' });
    const { person: p2 } = await createTestUser({ username: 'st2', firstName: 'Luis', lastName: 'Alba' });
    const { person: p3 } = await createTestUser({ username: 'st3', firstName: 'Eva', lastName: 'Mora' });

    await createTestInscription(p1.id, period.id, grade.id, section.id, { rosterNumber: 2 });
    await createTestInscription(p2.id, period.id, grade.id, section.id, { rosterNumber: 1 });
    await createTestInscription(p3.id, period.id, grade.id, section.id); // no roster number

    const res = await agent
      .get(`/api/ledger/${period.id}/${grade.id}/${section.id}`)
      .expect(200);

    const numbers = res.body.students.map((s: any) => s.rosterNumber);
    const names = res.body.students.map((s: any) => s.name);

    expect(numbers).toEqual([1, 2, null]);
    // Person hooks uppercase names.
    expect(names).toEqual(['ALBA, LUIS', 'ZAMORA, ANA', 'MORA, EVA']);
  });
});
