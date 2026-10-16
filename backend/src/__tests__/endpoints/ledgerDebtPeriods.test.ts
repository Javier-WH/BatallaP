import request from 'supertest';
import app from '@/app';
import {
  Charge, ExchangeRate, ExchangeRateType, Inscription, Matriculation, Payment, PersonRole,
} from '@/models/index';
import {
  createAcademicStructure, createTestInscription, createTestPeriod, createTestRole, createTestUser,
} from '../helpers/testData';

describe('Debts belonging to a prior school period', () => {
  let agent: any;
  let structure: any;
  let prevPeriod: any;
  let inscription: Inscription;

  const addCharge = (overrides: any) => Charge.create({
    inscriptionId: inscription.id,
    schoolPeriodId: structure.period.id,
    type: 'mensualidad',
    month: null,
    description: 'Deuda',
    amount: 50,
    currency: 'USD',
    active: true,
    ...overrides,
  } as any);

  beforeEach(async () => {
    agent = request.agent(app);
    const { person: admin } = await createTestUser({ username: 'dp_admin' });
    const master = await createTestRole('Master');
    await PersonRole.create({ personId: admin.id, roleId: master.id });
    await agent.post('/api/auth/login').send({ username: 'dp_admin', password: 'password123' });

    structure = await createAcademicStructure();
    prevPeriod = await createTestPeriod({
      period: '2024-2025', name: 'Año Escolar 2024-2025',
      startYear: 2024, endYear: 2025, status: 'historico',
    });
    const { person } = await createTestUser({ username: 'dp_student' });
    inscription = await createTestInscription(person.id, structure.period.id, structure.grade.id, structure.section.id);
  });

  const getStudent = async () => {
    const res = await agent
      .get(`/api/ledger/${structure.period.id}/${structure.grade.id}/${structure.section.id}`)
      .expect(200);
    return res.body.students.find((s: any) => s.inscriptionId === inscription.id);
  };

  it('a charge for a prior period appears under priorPeriods, not in the current months', async () => {
    await addCharge({ schoolPeriodId: prevPeriod.id, month: 'Aug', amount: 40, description: 'Mensualidad' });
    const student = await getStudent();
    expect(student.months.Aug).toBeUndefined();
    const prior = student.priorPeriods.find((p: any) => p.periodId === prevPeriod.id);
    expect(prior).toBeDefined();
    expect(prior.months.Aug.totalCharged).toBe(40);
  });

  it('an automatic payment settles the oldest period debt first, not the current period', async () => {
    await addCharge({ schoolPeriodId: prevPeriod.id, month: 'Aug', amount: 40 });
    await addCharge({ month: 'Sep', amount: 55 });
    const res = await agent.post('/api/ledger/payments').send({
      inscriptionId: inscription.id, schoolPeriodId: structure.period.id,
      amount: 40, currency: 'USD',
    }).expect(201);
    expect(res.body.month).toBe('Aug');
    expect(res.body.debtPeriodId).toBe(prevPeriod.id);
  });

  it('an explicit month + debtPeriodId payment lands in the prior-period bucket', async () => {
    await addCharge({ schoolPeriodId: prevPeriod.id, month: 'Aug', amount: 40 });
    await addCharge({ month: 'Aug', amount: 55 }); // same month code, current period
    await agent.post('/api/ledger/payments').send({
      inscriptionId: inscription.id, schoolPeriodId: structure.period.id,
      month: 'Aug', debtPeriodId: prevPeriod.id, amount: 40, currency: 'USD',
    }).expect(201);
    const student = await getStudent();
    const prior = student.priorPeriods.find((p: any) => p.periodId === prevPeriod.id);
    expect(prior.months.Aug.totalPaid).toBe(40);
    expect(student.months.Aug.totalPaid ?? 0).toBe(0);
  });

  it('a bolívares payment counts by its equivalence in the debt currency', async () => {
    const type = await ExchangeRateType.create({ code: 'USD_BCV', name: 'Dólar BCV', currency: 'USD', isDefault: true, active: true } as any);
    await ExchangeRate.create({ exchangeRateTypeId: type.id, rate: 500, date: '2020-01-01' } as any);
    await addCharge({ month: 'Sep', amount: 100, currency: 'USD' });

    const res = await agent.post('/api/ledger/payments').send({
      inscriptionId: inscription.id, schoolPeriodId: structure.period.id,
      amount: 50000, currency: 'VES', amountVES: 50000,
    }).expect(201);
    // 50000 VES / 500 VES per USD = 100 USD of the debt settled
    expect(res.body.month).toBe('Sep');
    expect(res.body.equivalent).toBe(100);
    expect(res.body.equivalentCurrency).toBe('USD');

    const student = await getStudent();
    expect(student.months.Sep.totalPaid).toBe(100);
  });

  it('an inactive charge does not attract automatic payments', async () => {
    await addCharge({ month: 'Sep', amount: 55, active: false });
    await addCharge({ month: 'Oct', amount: 55 });
    const res = await agent.post('/api/ledger/payments').send({
      inscriptionId: inscription.id, schoolPeriodId: structure.period.id,
      amount: 55, currency: 'USD',
    }).expect(201);
    expect(res.body.month).toBe('Oct');
  });

  it('GET /inscriptions/:id/debt returns the debt ordered chronologically', async () => {
    await addCharge({ schoolPeriodId: prevPeriod.id, month: 'Aug', amount: 40 });
    await addCharge({ month: 'Sep', amount: 55 });
    const res = await agent.get(`/api/ledger/inscriptions/${inscription.id}/debt`).expect(200);
    expect(res.body.hasDebt).toBe(true);
    expect(res.body.buckets[0].periodId).toBe(prevPeriod.id);
    expect(res.body.buckets[0].month).toBe('Aug');
    expect(res.body.buckets[1].periodId).toBe(structure.period.id);
    expect(res.body.totals.USD.remaining).toBe(95);
  });
});

describe('Withdrawal debt handling and document hold', () => {
  let agent: any;
  let structure: any;
  let inscription: Inscription;
  let matriculation: Matriculation;

  const scheduledCharge = (overrides: any) => Charge.create({
    inscriptionId: inscription.id,
    schoolPeriodId: structure.period.id,
    type: 'mensualidad',
    month: null,
    description: 'Deuda',
    amount: 50,
    currency: 'USD',
    active: true,
    source: 'schedule',
    scheduleKey: `k:${Math.random()}`,
    ...overrides,
  } as any);

  beforeEach(async () => {
    agent = request.agent(app);
    const { person: admin } = await createTestUser({ username: 'wd_admin' });
    const master = await createTestRole('Master');
    await PersonRole.create({ personId: admin.id, roleId: master.id });
    await agent.post('/api/auth/login').send({ username: 'wd_admin', password: 'password123' });

    structure = await createAcademicStructure();
    const { person } = await createTestUser({ username: 'wd_student' });
    inscription = await createTestInscription(person.id, structure.period.id, structure.grade.id, structure.section.id);
    matriculation = await Matriculation.create({
      schoolPeriodId: structure.period.id,
      gradeId: structure.grade.id,
      personId: person.id,
      inscriptionId: inscription.id,
      status: 'completed',
      escolaridad: 'regular',
      hiddenFromControlEstudios: false,
    } as any);
  });

  it('keep_until keeps debts through that month and holds the documents', async () => {
    await scheduledCharge({ month: 'Oct' });
    await scheduledCharge({ month: 'Nov' });
    await scheduledCharge({ month: 'Dec' });
    await scheduledCharge({ month: null, type: 'matricula', description: 'Matrícula' });
    await scheduledCharge({ month: null, type: 'otro', source: 'manual', scheduleKey: null, description: 'Uniforme' });

    const res = await agent
      .post(`/api/matriculations/${matriculation.id}/withdraw`)
      .send({ debtAction: 'keep_until', debtUntilMonth: 'Nov' })
      .expect(200);
    expect(res.body.papersHold).toBe(true);

    const charges = await Charge.findAll({ where: { inscriptionId: inscription.id } });
    expect(charges.find(c => c.month === 'Oct')!.active).toBe(true);
    expect(charges.find(c => c.month === 'Nov')!.active).toBe(true);
    expect(charges.find(c => c.month === 'Dec')!.active).toBe(false);
    expect(charges.find(c => c.type === 'matricula')!.active).toBe(true);
    expect(charges.find(c => c.type === 'otro')!.active).toBe(true);

    await inscription.reload();
    expect(inscription.papersHold).toBe(true);
  });

  it('default withdrawal keeps the legacy behavior and holds papers only if debt remains', async () => {
    await scheduledCharge({ month: 'Oct' });
    const res = await agent.post(`/api/inscriptions/${inscription.id}/withdraw`).expect(200);
    // No debt left → documents are not held.
    expect(res.body.papersHold).toBe(false);
    await inscription.reload();
    expect(inscription.papersHold).toBe(false);
  });

  it('keep_all leaves every debt active and the hold lifts when the debt is settled', async () => {
    const charge = await scheduledCharge({ month: 'Oct', amount: 40 });
    await agent
      .post(`/api/matriculations/${matriculation.id}/withdraw`)
      .send({ debtAction: 'keep_all' })
      .expect(200);
    await inscription.reload();
    expect(inscription.papersHold).toBe(true);
    expect((await Charge.findByPk(charge.id))!.active).toBe(true);

    await agent.post('/api/ledger/payments').send({
      inscriptionId: inscription.id, schoolPeriodId: structure.period.id,
      amount: 40, currency: 'USD',
    }).expect(201);
    await inscription.reload();
    expect(inscription.papersHold).toBe(false);
  });

  it('an administrator can release the documents manually while debt remains', async () => {
    await scheduledCharge({ month: 'Oct', amount: 40 });
    await agent
      .post(`/api/matriculations/${matriculation.id}/withdraw`)
      .send({ debtAction: 'keep_all' })
      .expect(200);
    await inscription.reload();
    expect(inscription.papersHold).toBe(true);

    await agent.post(`/api/ledger/inscriptions/${inscription.id}/release-papers`).expect(200);
    await inscription.reload();
    expect(inscription.papersHold).toBe(false);
  });
});
