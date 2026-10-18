import request from 'supertest';
import app from '@/app';
import { Role, PersonRole, Charge, Inscription } from '@/models/index';
import {
  createTestUser,
  createAcademicStructure,
  createTestGrade,
  createTestPeriod,
  createTestInscription,
} from '../helpers/testData';

/**
 * "Sin sección" groups of the ledger: withdrawn students (latest inscription
 * withdrawn) grouped by grade. A group only appears when at least one of its
 * members still owes money, and the ledger can be opened for it.
 */
describe('Withdrawn students in the payment ledger', () => {
  let agent: any;
  let structure: any;

  const withdraw = async (inscription: Inscription) => {
    await inscription.update({ withdrawnAt: new Date(), sectionId: null as any });
    return inscription;
  };

  const addDebt = (inscriptionId: number, periodId: number, overrides: any = {}) =>
    Charge.create({
      inscriptionId,
      schoolPeriodId: periodId,
      type: 'mensualidad',
      month: null,
      description: 'Deuda pendiente',
      amount: 50,
      currency: 'USD',
      active: true,
      ...overrides,
    } as any);

  beforeEach(async () => {
    agent = request.agent(app);
    const { person: adminPerson } = await createTestUser({ username: 'admin' });
    const [adminRole] = await Role.findOrCreate({ where: { name: 'Administrador' as any }, defaults: { name: 'Administrador' as any } });
    await PersonRole.create({ personId: adminPerson.id, roleId: adminRole.id });
    await agent.post('/api/auth/login').send({ username: 'admin', password: 'password123' });
    structure = await createAcademicStructure();
  });

  it('hides the "Sin sección" group when no withdrawn student owes money', async () => {
    const { person } = await createTestUser({ username: 'wd1' });
    const ins = await createTestInscription(person.id, structure.period.id, structure.grade.id, structure.section.id);
    await withdraw(ins);

    const res = await agent.get(`/api/ledger/sections/${structure.period.id}`).expect(200);
    expect(res.body.every((s: any) => s.sectionId !== null)).toBe(true);
  });

  it('shows a "Sin sección" group for the grade of a withdrawn debtor', async () => {
    const { person } = await createTestUser({ username: 'wd2' });
    const ins = await createTestInscription(person.id, structure.period.id, structure.grade.id, structure.section.id);
    await withdraw(ins);
    await addDebt(ins.id, structure.period.id);

    const res = await agent.get(`/api/ledger/sections/${structure.period.id}`).expect(200);
    const group = res.body.find((s: any) => s.sectionId === null);
    expect(group).toBeDefined();
    expect(group.sectionName).toBe('Sin sección');
    expect(group.gradeId).toBe(structure.grade.id);
    expect(group.gradeName).toBe(structure.grade.name);
  });

  it('shows the group only for grades that actually have withdrawn debtors', async () => {
    const otherGrade = await createTestGrade({ name: 'Otro grado' });
    const { person: p1 } = await createTestUser({ username: 'wd3' });
    const ins1 = await createTestInscription(p1.id, structure.period.id, structure.grade.id, structure.section.id);
    await withdraw(ins1);
    await addDebt(ins1.id, structure.period.id);
    // Debt-free withdrawn in another grade — must not create a group.
    const { person: p2 } = await createTestUser({ username: 'wd4' });
    const ins2 = await createTestInscription(p2.id, structure.period.id, otherGrade.id, structure.section.id);
    await withdraw(ins2);

    const res = await agent.get(`/api/ledger/sections/${structure.period.id}`).expect(200);
    const nullGroups = res.body.filter((s: any) => s.sectionId === null);
    expect(nullGroups).toHaveLength(1);
    expect(nullGroups[0].gradeId).toBe(structure.grade.id);
  });

  it('GET /:periodId/:gradeId/null returns the withdrawn students with their debts', async () => {
    const { person } = await createTestUser({ username: 'wd5', firstName: 'Nirmaris', lastName: 'Díaz' });
    const ins = await createTestInscription(person.id, structure.period.id, structure.grade.id, structure.section.id);
    await withdraw(ins);
    await addDebt(ins.id, structure.period.id, { amount: 75 });

    const res = await agent.get(`/api/ledger/${structure.period.id}/${structure.grade.id}/null`).expect(200);
    const student = res.body.students.find((s: any) => s.inscriptionId === ins.id);
    expect(student).toBeDefined();
    expect(student.name).toBe('DÍAZ, NIRMARIS');
    expect(student.sectionName ?? 'Sin sección').toBeTruthy();
    // The unpaid debt lands in a month-less bucket (enrollment or "Otros").
    const owed = (student.enrollment?.totalCharged ?? 0) + (student.other?.totalCharged ?? 0);
    expect(owed).toBe(75);
  });

  it('GET /withdrawn-students searches by name and document', async () => {
    const { person } = await createTestUser({ username: 'wd6', firstName: 'Carla', lastName: 'Retirada' });
    const ins = await createTestInscription(person.id, structure.period.id, structure.grade.id, structure.section.id);
    await withdraw(ins);

    const res = await agent.get('/api/ledger/withdrawn-students').query({ q: 'retirada' }).expect(200);
    const hit = res.body.find((r: any) => r.inscriptionId === ins.id);
    expect(hit).toBeDefined();
    expect(hit.gradeName).toBe(structure.grade.name);

    const miss = await agent.get('/api/ledger/withdrawn-students').query({ q: 'inexistente-zzz' }).expect(200);
    expect(miss.body).toHaveLength(0);
  });

  it('does not return a re-enrolled student in the withdrawn search', async () => {
    const { person } = await createTestUser({ username: 'wd7', firstName: 'Vuelve', lastName: 'Alumno' });
    const prevPeriod = await createTestPeriod();
    const oldIns = await createTestInscription(person.id, prevPeriod.id, structure.grade.id, structure.section.id);
    await withdraw(oldIns);
    // Re-enrolled: latest inscription is active → not a withdrawn student.
    await createTestInscription(person.id, structure.period.id, structure.grade.id, structure.section.id);

    const res = await agent.get('/api/ledger/withdrawn-students').query({ q: 'vuelve' }).expect(200);
    expect(res.body).toHaveLength(0);
  });

  it('a charge created for a withdrawn inscription makes the group appear', async () => {
    const { person } = await createTestUser({ username: 'wd8' });
    const ins = await createTestInscription(person.id, structure.period.id, structure.grade.id, structure.section.id);
    await withdraw(ins);

    await agent.post('/api/ledger/charges').send({
      inscriptionId: ins.id,
      schoolPeriodId: structure.period.id,
      type: 'otro',
      description: 'Deuda histórica',
      amount: 100,
      currency: 'USD',
    }).expect(201);

    const res = await agent.get(`/api/ledger/sections/${structure.period.id}`).expect(200);
    expect(res.body.some((s: any) => s.sectionId === null && s.gradeId === structure.grade.id)).toBe(true);
  });
});
