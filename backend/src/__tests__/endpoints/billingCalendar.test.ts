import request from 'supertest';
import app from '@/app';
import { Role, PersonRole, SchoolPeriod } from '@/models/index';
import { createTestUser, createAcademicStructure, createTestInscription } from '../helpers/testData';

const loginAdmin = async () => {
  const { person } = await createTestUser({ username: 'billing_admin' });
  const [role] = await Role.findOrCreate({ where: { name: 'Administrador' as any }, defaults: { name: 'Administrador' as any } });
  await PersonRole.create({ personId: person.id, roleId: role.id });
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ username: 'billing_admin', password: 'password123' });
  return agent;
};

describe('Billing calendar (period billing window)', () => {
  it('defaults new periods to September → August', async () => {
    const { period } = await createAcademicStructure();
    const fresh = await SchoolPeriod.findByPk(period.id);
    expect(fresh!.billingStartMonth).toBe(9);
    expect(fresh!.billingEndMonth).toBe(8);
  });

  it('updates the billing window via PUT /api/payments/billing-calendar/:id', async () => {
    const agent = await loginAdmin();
    const { period } = await createAcademicStructure();
    const res = await agent
      .put(`/api/payments/billing-calendar/${period.id}`)
      .send({ billingStartMonth: 10, billingEndMonth: 7 })
      .expect(200);
    expect(res.body).toMatchObject({ billingStartMonth: 10, billingEndMonth: 7 });
    expect(res.body.months).toEqual(['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul']);
  });

  it('rejects invalid months with 400', async () => {
    const agent = await loginAdmin();
    const { period } = await createAcademicStructure();
    await agent.put(`/api/payments/billing-calendar/${period.id}`).send({ billingStartMonth: 0, billingEndMonth: 8 }).expect(400);
    await agent.put(`/api/payments/billing-calendar/${period.id}`).send({ billingStartMonth: 9, billingEndMonth: 13 }).expect(400);
    await agent.put(`/api/payments/billing-calendar/${period.id}`).send({ billingStartMonth: 'x', billingEndMonth: 8 }).expect(400);
  });

  it('returns 404 for an unknown period', async () => {
    const agent = await loginAdmin();
    await agent.put('/api/payments/billing-calendar/999999').send({ billingStartMonth: 9, billingEndMonth: 8 }).expect(404);
  });

  it('ledger response exposes the period billing months', async () => {
    const agent = await loginAdmin();
    const { period, grade, section } = await createAcademicStructure();
    await period.update({ billingStartMonth: 10, billingEndMonth: 7 });
    const { person } = await createTestUser({ username: 'ledger_student' });
    await createTestInscription(person.id, period.id, grade.id, section.id);

    const res = await agent.get(`/api/ledger/${period.id}/${grade.id}/${section.id}`).expect(200);
    expect(res.body.months).toEqual(['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul']);
  });
});
