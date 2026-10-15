import request from 'supertest';
import app from '@/app';
import {
  Charge, DiscountReason, InscriptionDiscount, PersonRole,
} from '@/models/index';
import {
  createAcademicStructure, createTestInscription, createTestRole, createTestUser,
} from '../helpers/testData';

const login = async (roleName = 'Administrador') => {
  const username = `disc_${roleName.replace(/\s/g, '')}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const { person } = await createTestUser({ username });
  const role = await createTestRole(roleName as any);
  await PersonRole.create({ personId: person.id, roleId: role.id });
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ username, password: 'password123' });
  return { agent, person };
};

const setup = async () => {
  const structure = await createAcademicStructure();
  const { person } = await createTestUser({ username: `disc_student_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` });
  const insc = await createTestInscription(person.id, structure.period.id, structure.grade.id, structure.section.id, { entryMonth: 'Sep' });
  const reason = await DiscountReason.create({ name: `Hermanos ${insc.id}` } as any);
  return { ...structure, insc, reason };
};

const monthlyCharge = (inscriptionId: number, periodId: number, month: string, amount = 100) =>
  Charge.create({ inscriptionId, schoolPeriodId: periodId, type: 'mensualidad', month, description: 'Mensualidad', amount, currency: 'USD' } as any);

describe('Discount reasons catalog', () => {
  it('lists, creates and deactivates reasons; names are unique', async () => {
    const { agent } = await login();
    const created = await agent.post('/api/payments/discount-reasons').send({ name: 'Beca musical', description: 'Orquesta' }).expect(201);
    expect(created.body.active).toBe(true);

    await agent.post('/api/payments/discount-reasons').send({ name: 'Beca musical' }).expect(400);
    await agent.post('/api/payments/discount-reasons').send({ name: '  ' }).expect(400);

    await agent.put(`/api/payments/discount-reasons/${created.body.id}`).send({ active: false }).expect(200);
    const list = await agent.get('/api/payments/discount-reasons').expect(200);
    expect(list.body.find((r: any) => r.id === created.body.id).active).toBe(false);
  });

  it('is restricted to Master/Administrador', async () => {
    const { agent } = await login('Profesor');
    await agent.get('/api/payments/discount-reasons').expect(403);
  });
});

describe('Inscription discounts CRUD', () => {
  it('creates a discount with audit info and lists it with its reason', async () => {
    const { agent, person } = await login();
    const { insc, reason } = await setup();
    const res = await agent.post(`/api/ledger/inscriptions/${insc.id}/discounts`)
      .send({ reasonId: reason.id, kind: 'percent', value: 25, appliesTo: 'mensualidad', fromMonth: 'Mar', note: 'Tercer hermano' })
      .expect(201);
    expect(res.body).toMatchObject({ kind: 'percent', value: 25, appliesTo: 'mensualidad', fromMonth: 'Mar', toMonth: null, active: true });

    const row = await InscriptionDiscount.findByPk(res.body.id);
    expect(row!.createdByPersonId).toBe(person.id);

    const list = await agent.get(`/api/ledger/inscriptions/${insc.id}/discounts`).expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].reason.name).toBe(reason.name);
  });

  it('validates the payload', async () => {
    const { agent } = await login();
    const { insc, reason, period } = await setup();
    const url = `/api/ledger/inscriptions/${insc.id}/discounts`;
    const ok = { reasonId: reason.id, kind: 'percent', value: 10, appliesTo: 'todo' };

    await agent.post(url).send({ ...ok, value: 0 }).expect(400);
    await agent.post(url).send({ ...ok, value: 150 }).expect(400);
    await agent.post(url).send({ ...ok, kind: 'weird' }).expect(400);
    await agent.post(url).send({ ...ok, appliesTo: 'item' }).expect(400);
    await agent.post(url).send({ ...ok, fromMonth: 'Foo' }).expect(400);
    await agent.post(url).send({ ...ok, fromMonth: 'Mar', toMonth: 'Jan' }).expect(400);
    await agent.post(url).send({ ...ok, reasonId: 999999 }).expect(400);
    await agent.post('/api/ledger/inscriptions/999999/discounts').send(ok).expect(404);

    await reason.update({ active: false });
    await agent.post(url).send(ok).expect(400);

    await period.update({ billingStartMonth: 10, billingEndMonth: 7 });
    const r2 = await DiscountReason.create({ name: `Otra ${Date.now()}` } as any);
    await agent.post(url).send({ ...ok, reasonId: r2.id, fromMonth: 'Sep' }).expect(400);
  });

  it('updates, deactivates and deletes a discount', async () => {
    const { agent } = await login();
    const { insc, reason } = await setup();
    const created = await agent.post(`/api/ledger/inscriptions/${insc.id}/discounts`)
      .send({ reasonId: reason.id, kind: 'fixed', value: 5, appliesTo: 'todo' }).expect(201);

    const upd = await agent.put(`/api/ledger/discounts/${created.body.id}`).send({ value: 8, active: false }).expect(200);
    expect(upd.body).toMatchObject({ value: 8, active: false });

    await agent.delete(`/api/ledger/discounts/${created.body.id}`).expect(200);
    expect(await InscriptionDiscount.count({ where: { inscriptionId: insc.id } })).toBe(0);
    await agent.delete(`/api/ledger/discounts/${created.body.id}`).expect(404);
  });
});

describe('Ledger reads netted amounts', () => {
  it('totalCharged is net of discounts, with gross and discount exposed per month', async () => {
    const { agent } = await login();
    const { insc, reason, period, grade, section } = await setup();
    await monthlyCharge(insc.id, period.id, 'Oct');
    await monthlyCharge(insc.id, period.id, 'Mar');
    await InscriptionDiscount.create({
      inscriptionId: insc.id, reasonId: reason.id, kind: 'percent', value: 50, appliesTo: 'mensualidad', fromMonth: 'Mar',
    } as any);

    const res = await agent.get(`/api/ledger/${period.id}/${grade.id}/${section.id}`).expect(200);
    const student = res.body.students.find((s: any) => s.inscriptionId === insc.id);

    expect(student.months.Oct).toMatchObject({ grossCharged: 100, totalDiscount: 0, totalCharged: 100 });
    expect(student.months.Mar).toMatchObject({ grossCharged: 100, totalDiscount: 50, totalCharged: 50 });
    expect(student.months.Mar.charges[0].discountAmount).toBe(50);
    expect(student.discounts).toHaveLength(1);
    expect(student.discounts[0]).toMatchObject({ reasonName: reason.name, kind: 'percent', value: 50 });
  });

  it('a percent discount follows a fee change; inactive discounts are ignored', async () => {
    const { agent } = await login();
    const { insc, reason, period, grade, section } = await setup();
    const charge = await monthlyCharge(insc.id, period.id, 'Oct');
    const d = await InscriptionDiscount.create({
      inscriptionId: insc.id, reasonId: reason.id, kind: 'percent', value: 10, appliesTo: 'todo',
    } as any);
    await charge.update({ amount: 200 });

    let res = await agent.get(`/api/ledger/${period.id}/${grade.id}/${section.id}`).expect(200);
    let student = res.body.students.find((s: any) => s.inscriptionId === insc.id);
    expect(student.months.Oct.totalDiscount).toBe(20);
    expect(student.months.Oct.totalCharged).toBe(180);

    await d.update({ active: false });
    res = await agent.get(`/api/ledger/${period.id}/${grade.id}/${section.id}`).expect(200);
    student = res.body.students.find((s: any) => s.inscriptionId === insc.id);
    expect(student.months.Oct.totalCharged).toBe(200);
  });

  it('exposes non-monthly totals (enrollment) with discounts applied', async () => {
    const { agent } = await login();
    const { insc, reason, period, grade, section } = await setup();
    await Charge.create({ inscriptionId: insc.id, schoolPeriodId: period.id, type: 'matricula', month: null, description: 'Matrícula', amount: 100, currency: 'USD' } as any);
    await Charge.create({ inscriptionId: insc.id, schoolPeriodId: period.id, type: 'item', month: null, description: 'Uniforme', amount: 30, currency: 'USD' } as any);
    await InscriptionDiscount.create({
      inscriptionId: insc.id, reasonId: reason.id, kind: 'percent', value: 20, appliesTo: 'todo',
    } as any);

    const res = await agent.get(`/api/ledger/${period.id}/${grade.id}/${section.id}`).expect(200);
    const nm = res.body.students.find((s: any) => s.inscriptionId === insc.id).nonMonthly;
    expect(nm.grossCharged).toBe(130);
    expect(nm.totalDiscount).toBe(20); // only the enrollment fee is discountable
    expect(nm.totalCharged).toBe(110);
    expect(nm.totalPaid).toBe(0);
  });
});

describe('Payments without a month (enrollment and other one-time debts)', () => {
  it('nonMonthly payments are not auto-distributed to a month and count in nonMonthly.totalPaid', async () => {
    const { agent } = await login();
    const { insc, period, grade, section } = await setup();
    await monthlyCharge(insc.id, period.id, 'Oct');
    await Charge.create({ inscriptionId: insc.id, schoolPeriodId: period.id, type: 'matricula', month: null, description: 'Matrícula', amount: 100, currency: 'USD' } as any);

    await agent.post('/api/ledger/payments').send({
      inscriptionId: insc.id, schoolPeriodId: period.id, amount: 40, currency: 'USD', method: 'efectivo', nonMonthly: true,
    }).expect(201);

    const res = await agent.get(`/api/ledger/${period.id}/${grade.id}/${section.id}`).expect(200);
    const student = res.body.students.find((s: any) => s.inscriptionId === insc.id);
    expect(student.nonMonthly.totalPaid).toBe(40);
    expect(student.nonMonthly.payments).toHaveLength(1);
    expect(student.months.Oct.totalPaid).toBe(0);
  });
});
