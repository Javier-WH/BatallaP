import request from 'supertest';
import app from '@/app';
import { Role, PersonRole, Fee, ExchangeRateType } from '@/models/index';
import { createTestUser, createAcademicStructure } from '../helpers/testData';

const loginAdmin = async () => {
  const { person } = await createTestUser({ username: 'fee_admin' });
  const [role] = await Role.findOrCreate({ where: { name: 'Administrador' as any }, defaults: { name: 'Administrador' as any } });
  await PersonRole.create({ personId: person.id, roleId: role.id });
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ username: 'fee_admin', password: 'password123' });
  return agent;
};

const setup = async () => {
  const agent = await loginAdmin();
  const { period } = await createAcademicStructure();
  const type = await ExchangeRateType.create({ code: 'USD_F', name: 'Dólar', currency: 'USD', isDefault: false, active: true } as any);
  const payload = (over: any = {}) => ({
    schoolPeriodId: period.id, key: 'mensualidad', name: 'Mensualidad', amount: 55, exchangeRateTypeId: type.id, ...over,
  });
  return { agent, period, type, payload };
};

describe('Fee versioning by effectiveMonth', () => {
  it('defaults effectiveMonth to the first billing month of the period', async () => {
    const { agent, payload } = await setup();
    const res = await agent.post('/api/payments/fees').send(payload()).expect(200);
    expect(res.body.effectiveMonth).toBe('Sep');
  });

  it('creates a second version when the effective month differs (no overwrite)', async () => {
    const { agent, period, payload } = await setup();
    await agent.post('/api/payments/fees').send(payload({ amount: 55 })).expect(200);
    await agent.post('/api/payments/fees').send(payload({ amount: 65, effectiveMonth: 'Mar' })).expect(200);

    const fees = await Fee.findAll({ where: { schoolPeriodId: period.id, key: 'mensualidad' } });
    expect(fees.map(f => `${f.effectiveMonth}:${Number(f.amount)}`).sort()).toEqual(['Mar:65', 'Sep:55']);
  });

  it('updates the same version when period+key+month already exist', async () => {
    const { agent, period, payload } = await setup();
    await agent.post('/api/payments/fees').send(payload({ amount: 55, effectiveMonth: 'Mar' })).expect(200);
    await agent.post('/api/payments/fees').send(payload({ amount: 70, effectiveMonth: 'Mar' })).expect(200);

    const fees = await Fee.findAll({ where: { schoolPeriodId: period.id, key: 'mensualidad' } });
    expect(fees).toHaveLength(1);
    expect(Number(fees[0].amount)).toBe(70);
  });

  it('rejects an effective month outside the period billing window', async () => {
    const { agent, period, payload } = await setup();
    await period.update({ billingStartMonth: 10, billingEndMonth: 7 });
    await agent.post('/api/payments/fees').send(payload({ effectiveMonth: 'Sep' })).expect(400);
    await agent.post('/api/payments/fees').send(payload({ effectiveMonth: 'Foo' })).expect(400);
  });

  it('lists versions ordered by calendar month within each key', async () => {
    const { agent, period, payload } = await setup();
    await agent.post('/api/payments/fees').send(payload({ amount: 65, effectiveMonth: 'Mar' })).expect(200);
    await agent.post('/api/payments/fees').send(payload({ amount: 55, effectiveMonth: 'Sep' })).expect(200);
    await agent.post('/api/payments/fees').send(payload({ amount: 60, effectiveMonth: 'Jan' })).expect(200);

    const res = await agent.get(`/api/payments/fees?schoolPeriodId=${period.id}`).expect(200);
    expect(res.body.map((f: any) => f.effectiveMonth)).toEqual(['Sep', 'Jan', 'Mar']);
  });
});

describe('Enrollment plan versioning', () => {
  it('stores effectiveMonth on create and defaults to the first billing month', async () => {
    const { agent, period, type } = await setup();
    const base = { schoolPeriodId: period.id, targetExchangeRateTypeId: type.id };
    const a = await agent.post('/api/payments/enrollment-plans').send({ ...base, name: 'A' }).expect(201);
    const b = await agent.post('/api/payments/enrollment-plans').send({ ...base, name: 'B', effectiveMonth: 'Mar' }).expect(201);
    expect(a.body.effectiveMonth).toBe('Sep');
    expect(b.body.effectiveMonth).toBe('Mar');
  });

  it('rejects an invalid effective month on plans', async () => {
    const { agent, period, type } = await setup();
    await agent.post('/api/payments/enrollment-plans')
      .send({ schoolPeriodId: period.id, targetExchangeRateTypeId: type.id, name: 'X', effectiveMonth: 'Foo' })
      .expect(400);
  });
});
