import request from 'supertest';
import app from '@/app';
import { Charge, Inscription, PersonRole } from '@/models/index';
import { carryOverDebts } from '@/services/debtCarryoverService';
import {
  createAcademicStructure, createTestInscription, createTestPeriod, createTestRole, createTestUser,
} from '../helpers/testData';

describe('Debts inherited when a student moves to a new period', () => {
  let agent: any;
  let structure: any;
  let nextPeriod: any;
  let oldInscription: Inscription;
  let newInscription: Inscription;

  const addCharge = (inscriptionId: number, periodId: number, overrides: any = {}) => Charge.create({
    inscriptionId,
    schoolPeriodId: periodId,
    type: 'mensualidad',
    month: null,
    description: 'Mensualidad',
    amount: 50,
    currency: 'USD',
    active: true,
    source: 'schedule',
    ...overrides,
  } as any);

  const pay = (inscriptionId: number, periodId: number, amount: number, extra: any = {}) =>
    agent.post('/api/ledger/payments').send({ inscriptionId, schoolPeriodId: periodId, amount, currency: 'USD', ...extra });

  const chargesOf = (id: number) => Charge.findAll({ where: { inscriptionId: id }, order: [['id', 'ASC']] });

  beforeEach(async () => {
    agent = request.agent(app);
    const { person: admin } = await createTestUser({ username: 'co_admin' });
    const master = await createTestRole('Master');
    await PersonRole.create({ personId: admin.id, roleId: master.id });
    await agent.post('/api/auth/login').send({ username: 'co_admin', password: 'password123' });

    structure = await createAcademicStructure();
    nextPeriod = await createTestPeriod({
      period: '2027-2028', name: 'Año Escolar 2027-2028', startYear: 2027, endYear: 2028, status: 'activo',
    });
    const { person } = await createTestUser({ username: 'co_student' });
    oldInscription = await createTestInscription(person.id, structure.period.id, structure.grade.id, structure.section.id);
    newInscription = await createTestInscription(person.id, nextPeriod.id, structure.grade.id, structure.section.id);
  });

  it('an unpaid charge moves whole to the new inscription as a debt of its original period', async () => {
    await addCharge(oldInscription.id, structure.period.id, { month: 'Aug', amount: 60 });
    const res = await carryOverDebts(oldInscription.id, newInscription.id);
    expect(res).toEqual({ carried: 1, byCurrency: { USD: 60 } });

    const old = (await chargesOf(oldInscription.id))[0];
    expect(old.active).toBe(false);
    const inherited = (await chargesOf(newInscription.id))[0];
    expect(inherited.schoolPeriodId).toBe(structure.period.id);
    expect(inherited.month).toBe('Aug');
    expect(Number(inherited.amount)).toBe(60);
    expect(inherited.source).toBe('manual');
    expect(inherited.scheduleKey).toBeNull();
  });

  it('a partially paid charge keeps the settled part on the old inscription and inherits only the remainder', async () => {
    await addCharge(oldInscription.id, structure.period.id, { month: 'Aug', amount: 60 });
    await pay(oldInscription.id, structure.period.id, 25).expect(201);

    const res = await carryOverDebts(oldInscription.id, newInscription.id);
    expect(res.byCurrency).toEqual({ USD: 35 });
    const old = (await chargesOf(oldInscription.id))[0];
    expect(old.active).toBe(true);
    expect(Number(old.amount)).toBe(25);
    expect(Number((await chargesOf(newInscription.id))[0].amount)).toBe(35);
  });

  it('fully paid charges are not inherited', async () => {
    await addCharge(oldInscription.id, structure.period.id, { month: 'Aug', amount: 40 });
    await pay(oldInscription.id, structure.period.id, 40).expect(201);
    const res = await carryOverDebts(oldInscription.id, newInscription.id);
    expect(res.carried).toBe(0);
    expect(await chargesOf(newInscription.id)).toHaveLength(0);
  });

  it('the new ledger shows it under priorPeriods and keeps the new year\'s own debts separate', async () => {
    await addCharge(oldInscription.id, structure.period.id, { month: 'Aug', amount: 60 });
    await addCharge(newInscription.id, nextPeriod.id, { month: 'Oct', amount: 55 });
    await carryOverDebts(oldInscription.id, newInscription.id);

    const res = await agent
      .get(`/api/ledger/${nextPeriod.id}/${structure.grade.id}/${structure.section.id}`).expect(200);
    const student = res.body.students.find((s: any) => s.inscriptionId === newInscription.id);
    const prior = student.priorPeriods.find((p: any) => p.periodId === structure.period.id);
    expect(prior.months.Aug.totalCharged).toBe(60);
    expect(student.months.Oct.totalCharged).toBe(55);
  });

  it('a payment settles the inherited debt first, and a payment aimed at the new year is blocked while it is pending', async () => {
    await addCharge(oldInscription.id, structure.period.id, { month: 'Aug', amount: 60 });
    await addCharge(newInscription.id, nextPeriod.id, { month: 'Oct', amount: 55 });
    await carryOverDebts(oldInscription.id, newInscription.id);

    const blocked = await pay(newInscription.id, nextPeriod.id, 55, { scope: 'month', month: 'Oct' });
    expect(blocked.status).toBe(400);
    expect(blocked.body.code).toBe('OUT_OF_ORDER_PAYMENT');

    const auto = await pay(newInscription.id, nextPeriod.id, 60).expect(201);
    expect(auto.body.debtPeriodId).toBe(structure.period.id);
    expect(auto.body.month).toBe('Aug');
  });

  it('the old ledger no longer lists the inherited debt as owed', async () => {
    await addCharge(oldInscription.id, structure.period.id, { month: 'Aug', amount: 60 });
    await carryOverDebts(oldInscription.id, newInscription.id);
    const res = await agent
      .get(`/api/ledger/${structure.period.id}/${structure.grade.id}/${structure.section.id}`).expect(200);
    const student = res.body.students.find((s: any) => s.inscriptionId === oldInscription.id);
    expect(student.months.Aug?.totalCharged ?? 0).toBe(0);
  });

  it('keeps the papers hold on the inscription that now carries the debt', async () => {
    await oldInscription.update({ papersHold: true } as any);
    await addCharge(oldInscription.id, structure.period.id, { month: 'Aug', amount: 60 });
    await carryOverDebts(oldInscription.id, newInscription.id);
    await newInscription.reload();
    expect((newInscription as any).papersHold).toBe(true);
  });

  it('chains across closures keeping the original debt period, and does not clash with the new schedule keys', async () => {
    await addCharge(oldInscription.id, structure.period.id, { month: 'Aug', amount: 60, scheduleKey: 'mensualidad:Aug' });
    await addCharge(newInscription.id, nextPeriod.id, { month: 'Aug', amount: 70, scheduleKey: 'mensualidad:Aug' });
    await carryOverDebts(oldInscription.id, newInscription.id);

    const thirdPeriod = await createTestPeriod({
      period: '2028-2029', name: 'Año Escolar 2028-2029', startYear: 2028, endYear: 2029, status: 'preinscripcion',
    });
    const third = await createTestInscription(newInscription.personId, thirdPeriod.id, structure.grade.id, structure.section.id);
    const res = await carryOverDebts(newInscription.id, third.id);
    expect(res.byCurrency).toEqual({ USD: 130 });

    const periods = (await chargesOf(third.id)).map(c => c.schoolPeriodId).sort();
    expect(periods).toEqual([structure.period.id, nextPeriod.id].sort());
  });
});
