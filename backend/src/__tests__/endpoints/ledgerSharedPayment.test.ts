import request from 'supertest';
import app from '@/app';
import {
  Role, PersonRole, Charge, ExchangeRateType, ExchangeRate, Payment, PaymentAllocation, PaymentAuditLog,
  GuardianProfile, StudentGuardian, CurrencyDiscount,
} from '@/models/index';
import { createTestUser, createAcademicStructure, createTestInscription } from '../helpers/testData';

/**
 * One physical payment (one transfer) of a representative for several students: split by priority
 * (each student's enrollment before anybody's tuition), stored as one row per student tied by a group id.
 */
describe('Ledger: shared payment between students of the same representative', () => {
  let agent: any;
  let structure: any;
  let ins1: number;
  let ins2: number;
  let person1: number;
  let person2: number;

  const mkCharge = (inscriptionId: number, over: any) => Charge.create({
    inscriptionId, schoolPeriodId: structure.period.id, month: null, currency: 'EUR', quantity: 1, active: true, ...over,
  } as any);

  const enrollment = (inscriptionId: number, amount = 165) =>
    mkCharge(inscriptionId, { type: 'matricula', description: 'Matrícula', amount });
  const tuition = (inscriptionId: number, month = 'Oct', amount = 55) =>
    mkCharge(inscriptionId, { type: 'mensualidad', description: `Mensualidad ${month}`, amount, month });

  const shared = (body: any) => agent.post('/api/ledger/payments/shared').send({
    inscriptionIds: [ins1, ins2], schoolPeriodId: structure.period.id, currency: 'EUR', method: 'efectivo', ...body,
  });

  beforeEach(async () => {
    agent = request.agent(app);
    const { person: admin } = await createTestUser({ username: 'shared_admin' });
    const [role] = await Role.findOrCreate({ where: { name: 'Administrador' as any }, defaults: { name: 'Administrador' as any } });
    await PersonRole.create({ personId: admin.id, roleId: role.id });
    await agent.post('/api/auth/login').send({ username: 'shared_admin', password: 'password123' });
    structure = await createAcademicStructure();
    const { person: s1 } = await createTestUser({ username: 'shared_s1' });
    const { person: s2 } = await createTestUser({ username: 'shared_s2' });
    person1 = s1.id;
    person2 = s2.id;
    ins1 = (await createTestInscription(s1.id, structure.period.id, structure.grade.id, structure.section.id)).id;
    ins2 = (await createTestInscription(s2.id, structure.period.id, structure.grade.id, structure.section.id)).id;
    const prof = await GuardianProfile.create({
      firstName: 'María', lastName: 'Pérez', documentType: 'Venezolano', document: '12345678',
      phone: '0414-1112222', email: 'maria@example.com',
      residenceState: 'Lara', residenceMunicipality: 'Iribarren', residenceParish: 'Catedral', address: 'Calle 1',
    } as any);
    await StudentGuardian.create({ studentId: s1.id, guardianId: prof.id, relationship: 'mother', isRepresentative: true });
    await StudentGuardian.create({ studentId: s2.id, guardianId: prof.id, relationship: 'mother', isRepresentative: true });
  });

  const allocationsOf = async (paymentId: number) => {
    const rows = await PaymentAllocation.findAll({ where: { paymentId } });
    return new Map(rows.map(a => [a.chargeId, Number(a.amount)]));
  };

  it('330 for two students owing 165 of enrollment each settles both enrollments, not the first one\'s tuition', async () => {
    const e1 = await enrollment(ins1);
    const e2 = await enrollment(ins2);
    const m1 = await tuition(ins1);
    const res = await shared({ amount: 330 }).expect(201);
    expect(res.body.payments).toHaveLength(2);
    const [a, b] = res.body.payments;
    expect(a.paymentGroupId).toBeTruthy();
    expect(a.paymentGroupId).toBe(b.paymentGroupId);
    expect(Number(a.amount)).toBeCloseTo(165, 2);
    expect(Number(b.amount)).toBeCloseTo(165, 2);
    expect((await allocationsOf(a.id)).get(e1.id)).toBeCloseTo(165, 2);
    expect((await allocationsOf(b.id)).get(e2.id)).toBeCloseTo(165, 2);
    expect((await allocationsOf(a.id)).has(m1.id)).toBe(false);
  });

  it('with more money than both enrollments the rest follows the priority order', async () => {
    await enrollment(ins1);
    await enrollment(ins2);
    const m1 = await tuition(ins1);
    const res = await shared({ amount: 350 }).expect(201);
    const first = res.body.payments.find((p: any) => p.inscriptionId === ins1);
    const second = res.body.payments.find((p: any) => p.inscriptionId === ins2);
    expect(Number(first.amount)).toBeCloseTo(185, 2); // 165 enrollment + 20 of tuition
    expect(Number(second.amount)).toBeCloseTo(165, 2);
    expect((await allocationsOf(first.id)).get(m1.id)).toBeCloseTo(20, 2);
  });

  it('a bolívar payment against EUR debts is split with exact shares', async () => {
    const type = await ExchangeRateType.create({ code: `EUR_S${structure.period.id}`, name: 'Euro', currency: 'EUR', isDefault: true, active: true } as any);
    await ExchangeRate.create({ exchangeRateTypeId: type.id, rate: 200, date: new Date().toISOString().slice(0, 10) } as any);
    const e1 = await enrollment(ins1, 100);
    const e2 = await enrollment(ins2, 100);
    const res = await shared({ currency: 'VES', amount: 40000 }).expect(201);
    const total = res.body.payments.reduce((s: number, p: any) => s + Number(p.amount), 0);
    expect(total).toBeCloseTo(40000, 2);
    const p1 = res.body.payments.find((p: any) => p.inscriptionId === ins1);
    const p2 = res.body.payments.find((p: any) => p.inscriptionId === ins2);
    expect((await allocationsOf(p1.id)).get(e1.id)).toBeCloseTo(100, 2);
    expect((await allocationsOf(p2.id)).get(e2.id)).toBeCloseTo(100, 2);
  });

  it('previews the split without storing anything', async () => {
    await enrollment(ins1);
    await enrollment(ins2);
    const res = await agent.post('/api/ledger/payments/shared/preview').send({
      inscriptionIds: [ins1, ins2], amount: 330, currency: 'EUR',
    }).expect(200);
    expect(res.body.portions.map((p: any) => p.amount)).toEqual([165, 165]);
    expect(res.body.portions[0].allocations[0].description).toBe('Matrícula');
    expect(await Payment.count()).toBe(0);
  });

  it('accepts edited shares only when they add up to the total', async () => {
    const e1 = await enrollment(ins1);
    await enrollment(ins2);
    await shared({ amount: 330, portions: [{ inscriptionId: ins1, amount: 200 }, { inscriptionId: ins2, amount: 130 }] }).expect(201);
    const mine = await Payment.findOne({ where: { inscriptionId: ins1 } });
    expect(Number(mine!.amount)).toBeCloseTo(200, 2);
    expect((await allocationsOf(mine!.id)).get(e1.id)).toBeGreaterThan(160);
    await shared({ amount: 330, reference: undefined, portions: [{ inscriptionId: ins1, amount: 200 }, { inscriptionId: ins2, amount: 50 }], allowDuplicate: true })
      .expect(400);
  });

  it('keeps the duplicate protection on the whole operation and the idempotency key', async () => {
    await enrollment(ins1);
    await enrollment(ins2);
    const body = { amount: 330, method: 'transferencia', bank: 'Banesco', reference: '1234', clientRequestId: 'req-shared-1' };
    const first = await shared(body).expect(201);
    const again = await shared(body).expect(200);
    expect(again.body.payments).toHaveLength(2);
    expect(again.body.groupId).toBe(first.body.groupId);
    const other = await shared({ ...body, clientRequestId: 'req-shared-2' }).expect(409);
    expect(other.body.code).toBe('DUPLICATE_PAYMENT');
    expect(await Payment.count()).toBe(2);
  });

  it('is atomic: a failing share creates no payment at all', async () => {
    await enrollment(ins1);
    // Student 2 has no item debt, so the item scope fails for his share.
    await shared({ amount: 100, scope: 'item', portions: [{ inscriptionId: ins1, amount: 50 }, { inscriptionId: ins2, amount: 50 }] }).expect(400);
    expect(await Payment.count()).toBe(0);
  });

  it('deleting a shared payment needs a decision: single, or the whole group (audited)', async () => {
    await enrollment(ins1);
    await enrollment(ins2);
    const res = await shared({ amount: 330 }).expect(201);
    const [a, b] = res.body.payments;

    const ask = await agent.delete(`/api/ledger/payments/${a.id}`).send({ reason: 'error de captura' }).expect(409);
    expect(ask.body.code).toBe('SHARED_PAYMENT');
    expect(ask.body.others).toHaveLength(1);
    expect(await Payment.count()).toBe(2);

    await agent.delete(`/api/ledger/payments/${a.id}`).send({ reason: 'error de captura', applyTo: 'single' }).expect(200);
    expect(await Payment.findByPk(a.id)).toBeNull();
    expect(await Payment.findByPk(b.id)).not.toBeNull();

    // The remaining row is now alone: no decision needed anymore.
    await agent.delete(`/api/ledger/payments/${b.id}`).send({ reason: 'error de captura' }).expect(200);

    const again = await shared({ amount: 330, allowDuplicate: true }).expect(201);
    await agent.delete(`/api/ledger/payments/${again.body.payments[0].id}`).send({ reason: 'todo mal', applyTo: 'group' }).expect(200);
    expect(await Payment.count()).toBe(0);
    expect(await PaymentAuditLog.count({ where: { action: 'deleted' } })).toBe(4);
  });

  it('lists the students sharing a representative, with their pending debt', async () => {
    await enrollment(ins2);
    const { person: s3 } = await createTestUser({ username: 'shared_s3' });
    const prof = await GuardianProfile.findOne();
    await createTestInscription(s3.id, structure.period.id, structure.grade.id, structure.section.id);
    await StudentGuardian.create({ studentId: s3.id, guardianId: prof!.id, relationship: 'mother', isRepresentative: false });

    const res = await agent.get(`/api/ledger/inscriptions/${ins1}/shared-students?schoolPeriodId=${structure.period.id}`).expect(200);
    expect(res.body).toHaveLength(2);
    const withDebt = res.body.find((s: any) => s.inscriptionId === ins2);
    expect(withDebt.hasDebt).toBe(true);
    expect(withDebt.pending.EUR).toBeCloseTo(165, 2);
    expect(res.body.find((s: any) => s.personId === s3.id).hasDebt).toBe(false);
    expect(res.body.some((s: any) => s.personId === person1)).toBe(false);
    expect(person2).toBeTruthy();
  });

  it('the ledger tells each row who else received a share', async () => {
    await enrollment(ins1);
    await enrollment(ins2);
    await shared({ amount: 330 }).expect(201);
    const { period, grade, section } = structure;
    const res = await agent.get(`/api/ledger/${period.id}/${grade.id}/${section.id}`).expect(200);
    const st = res.body.students.find((s: any) => s.inscriptionId === ins1);
    const pay = [st.enrollment, ...Object.values(st.months)].flatMap((b: any) => b?.payments ?? [])[0];
    expect(pay.paymentGroupId).toBeTruthy();
    expect(pay.sharedWith).toHaveLength(1);
    expect(Number(pay.sharedWith[0].amount)).toBeCloseTo(165, 2);
  });

  it('each represented student carries what they owe, for the representative grand total', async () => {
    await enrollment(ins1);
    await enrollment(ins2, 100);
    const { period, grade, section } = structure;
    const res = await agent.get(`/api/ledger/${period.id}/${grade.id}/${section.id}`).expect(200);
    const st = res.body.students.find((s: any) => s.inscriptionId === ins1);
    const other = st.guardians[0].alsoRepresents.find((a: any) => a.personId === person2);
    expect(other.pending.EUR).toBeCloseTo(100, 2);
  });

  it("the representative's debt can be cut at a month: later months are not counted yet", async () => {
    await enrollment(ins2, 100);
    await tuition(ins2, 'Oct', 55);
    await tuition(ins2, 'Mar', 55);
    const { period, grade, section } = structure;
    const owed = async (q = '') => {
      const res = await agent.get(`/api/ledger/${period.id}/${grade.id}/${section.id}${q}`).expect(200);
      const st = res.body.students.find((s: any) => s.inscriptionId === ins1);
      return st.guardians[0].alsoRepresents.find((a: any) => a.personId === person2).pending.EUR;
    };
    expect(await owed()).toBeCloseTo(210, 2);
    expect(await owed('?upToMonth=Oct')).toBeCloseTo(155, 2);
    expect(await owed('?upToMonth=Mar')).toBeCloseTo(210, 2);
    expect(await owed('?upToMonth=Nope')).toBeCloseTo(210, 2);
  });

  it('a currency discount stretches a shared payment over every student', async () => {
    await enrollment(ins1, 100);
    await enrollment(ins2, 100);
    await CurrencyDiscount.create({
      schoolPeriodId: structure.period.id, name: 'USDT', currency: 'USDT', kind: 'percent', value: 20,
    } as any);
    const res = await shared({ amount: 160, currency: 'USDT', method: 'binance', account: 'juan' }).expect(201);
    expect(res.body.payments).toHaveLength(2);
    expect(res.body.payments.map((p: any) => Number(p.amount))).toEqual([80, 80]);
    const rows = await PaymentAllocation.findAll();
    expect(rows.map(r => [Number(r.amount), Number(r.bonus)])).toEqual([[100, 20], [100, 20]]);
  });
});
