import request from 'supertest';
import app from '@/app';
import { Charge, ExchangeRate, ExchangeRateType, Inscription, PersonRole, SchoolPeriod } from '@/models/index';
import {
  createAcademicStructure, createTestInscription, createTestPeriod, createTestRole, createTestUser,
} from '../helpers/testData';

// Rates: 1 USD = 800 Bs, 1 EUR = 1000 Bs.
// Headline case: 40 EUR enrollment + 30 USD uniform = Bs 64,000 of debt; a
// Bs 69,000 payment settles both and leaves a Bs 5,000 excess on the uniform.
describe('payments split across debts in different currencies', () => {
  let agent: any;
  let structure: any;
  let inscription: Inscription;
  const today = new Date().toISOString().slice(0, 10);

  const pay = (body: any, insc?: Inscription) => agent.post('/api/ledger/payments').send({
    inscriptionId: (insc ?? inscription).id, schoolPeriodId: structure.period.id, paymentDate: today, ...body,
  });

  const student = async () => {
    const res = await agent
      .get(`/api/ledger/${structure.period.id}/${structure.grade.id}/${structure.section.id}`).expect(200);
    return res.body.students.find((s: any) => s.inscriptionId === inscription.id);
  };

  const charge = (opts: any) => Charge.create({
    inscriptionId: inscription.id, schoolPeriodId: structure.period.id,
    description: 'Deuda', amountVES: 0, active: true, ...opts,
  } as any);

  // The headline setup: 40 EUR enrollment + 30 USD uniform.
  const enrollmentAndUniform = async () => {
    const eur = await charge({ type: 'inscripcion', month: null, description: 'Inscripción', amount: 40, currency: 'EUR', amountVES: 40000 });
    const usd = await charge({ type: 'otro', month: null, description: 'Franela', amount: 30, currency: 'USD', amountVES: 24000 });
    return { eur, usd };
  };

  beforeEach(async () => {
    agent = request.agent(app);
    const { person: admin } = await createTestUser({ username: 'alloc_admin' });
    const role = await createTestRole('Master');
    await PersonRole.create({ personId: admin.id, roleId: role.id });
    await agent.post('/api/auth/login').send({ username: 'alloc_admin', password: 'password123' });

    structure = await createAcademicStructure();
    const { person } = await createTestUser({ username: 'alloc_student' });
    inscription = await createTestInscription(person.id, structure.period.id, structure.grade.id, structure.section.id);

    const usd = await ExchangeRateType.create({ code: 'USD', name: 'USD', currency: 'USD', isDefault: true, active: true } as any);
    const eur = await ExchangeRateType.create({ code: 'EUR', name: 'EUR', currency: 'EUR', isDefault: true, active: true } as any);
    await ExchangeRate.create({ exchangeRateTypeId: usd.id, date: today, rate: 800 } as any);
    await ExchangeRate.create({ exchangeRateTypeId: eur.id, date: today, rate: 1000 } as any);
  });

  it('Bs. 69,000 settle 40 EUR of enrollment and apply the rest in USD to the uniform', async () => {
    const { eur, usd } = await enrollmentAndUniform();
    const res = await pay({ method: 'transferencia', currency: 'VES', amount: 69000, bank: 'Banesco', reference: '1234' }).expect(201);

    const allocs = res.body.allocations;
    expect(allocs).toHaveLength(2);
    const toEur = allocs.find((a: any) => a.chargeId === eur.id);
    const toUsd = allocs.find((a: any) => a.chargeId === usd.id);
    expect(Number(toEur.amount)).toBe(40);
    expect(toEur.currency).toBe('EUR');
    // 30 USD of debt + the Bs 5,000 excess (6.25 USD at 800 Bs/USD)
    expect(Number(toUsd.amount)).toBeCloseTo(36.25, 2);
    expect(toUsd.currency).toBe('USD');

    const s = await student();
    // Each currency in its own bucket cell
    expect(s.enrollment.byCurrency.EUR.paid).toBe(40);
    expect(s.other.byCurrency.USD.paid).toBeCloseTo(36.25, 2);
    // Whole payment accounted for in bolívares
    expect(s.enrollment.totalPaidVES + s.other.totalPaidVES).toBeCloseTo(69000, 1);
  });

  it('one payment covers several debts of the same currency in order', async () => {
    const oct = await charge({ type: 'mensualidad', month: 'Oct', amount: 40, currency: 'EUR', amountVES: 40000 });
    const nov = await charge({ type: 'mensualidad', month: 'Nov', amount: 40, currency: 'EUR', amountVES: 40000 });
    const res = await pay({ method: 'efectivo', currency: 'EUR', amount: 80 }).expect(201);

    expect(res.body.allocations).toHaveLength(2);
    expect(Number(res.body.equivalent)).toBe(80);
    expect(res.body.equivalentCurrency).toBe('EUR');
    const s = await student();
    expect(s.months.Oct.totalPaid).toBe(40);
    expect(s.months.Nov.totalPaid).toBe(40);
    void oct; void nov;
  });

  it('USD at par settles the EUR debt first, then the rest in USD', async () => {
    await agent.put(`/api/payments/par-settlement/${structure.period.id}`).send({ usdAtPar: true }).expect(200);
    const { eur, usd } = await enrollmentAndUniform();
    const res = await pay({ method: 'efectivo', currency: 'USD', amount: 70 }).expect(201);

    const allocs = res.body.allocations;
    expect(Number(allocs.find((a: any) => a.chargeId === eur.id).amount)).toBe(40); // at par
    expect(Number(allocs.find((a: any) => a.chargeId === usd.id).amount)).toBe(30);
    expect(res.body.atPar).toBe(true);
  });

  it('without par, USD pays the EUR debt at its rate, then the USD debt', async () => {
    const { eur, usd } = await enrollmentAndUniform();
    const res = await pay({ method: 'efectivo', currency: 'USD', amount: 70 }).expect(201);

    const allocs = res.body.allocations;
    // 40 EUR cost 50 USD (40 × 1000 / 800); the remaining 20 USD go to the uniform
    expect(Number(allocs.find((a: any) => a.chargeId === eur.id).amount)).toBe(40);
    expect(Number(allocs.find((a: any) => a.chargeId === usd.id).amount)).toBe(20);
    const s = await student();
    expect(s.other.byCurrency.USD.paid).toBe(20); // 10 USD still owed
  });

  it('auto pays matrícula > gastos > mensualidad incluida > items > mensualidades, even when the quota was generated first', async () => {
    // The enrollment plan emits its month-less entry "Mensualidad" before matrícula —
    // it still ranks inside the enrollment package, after matrícula and gastos.
    const entryFee = await charge({ type: 'mensualidad', month: null, description: 'Mensualidad', amount: 55, currency: 'USD', amountVES: 44000 });
    const matricula = await charge({ type: 'matricula', month: null, description: 'Matrícula', amount: 55, currency: 'USD', amountVES: 44000 });
    const gastos = await charge({ type: 'gastos_administrativos', month: null, description: 'Gastos Administrativos', amount: 55, currency: 'USD', amountVES: 44000 });
    const distintivo = await charge({ type: 'item', description: 'Distintivo', amount: 10, currency: 'USD', amountVES: 8000 });
    const oct = await charge({ type: 'mensualidad', month: 'Oct', description: 'Mensualidad', amount: 55, currency: 'USD', amountVES: 44000 });

    // $55 covers matrícula first — not the entry quota nor October.
    const res = await pay({ method: 'efectivo', currency: 'USD', amount: 55 }).expect(201);
    expect(res.body.allocations).toHaveLength(1);
    expect(res.body.allocations[0].chargeId).toBe(matricula.id);
    expect(Number(res.body.allocations[0].amount)).toBe(55);

    // $120 more: gastos (55) → entry quota (55, part of the enrollment package) → distintivo (10); October is untouched.
    const res2 = await pay({ method: 'efectivo', currency: 'USD', amount: 120 }).expect(201);
    const order = res2.body.allocations.map((a: any) => a.chargeId);
    expect(order).toEqual([gastos.id, entryFee.id, distintivo.id]);
    expect(Number(res2.body.allocations.find((a: any) => a.chargeId === entryFee.id).amount)).toBe(55);
    expect(res2.body.allocations.find((a: any) => a.chargeId === oct.id)).toBeUndefined();
  });

  it('an unpaid item blocks a payment targeted to a mensualidad', async () => {
    const distintivo = await charge({ type: 'item', month: 'Oct', description: 'Distintivo', amount: 10, currency: 'USD', amountVES: 8000 });
    const oct = await charge({ type: 'mensualidad', month: 'Oct', description: 'Mensualidad', amount: 55, currency: 'USD', amountVES: 44000 });
    const nov = await charge({ type: 'mensualidad', month: 'Nov', description: 'Mensualidad', amount: 55, currency: 'USD', amountVES: 44000 });

    // Aiming straight at the Oct mensualidad charge is blocked by the pending item.
    const res = await pay({ method: 'efectivo', currency: 'USD', amount: 55, chargeId: oct.id }).expect(400);
    expect(res.body.code).toBe('OUT_OF_ORDER_PAYMENT');
    expect(res.body.blocking[0].description).toBe(distintivo.description);

    // November is blocked too — items rank before all mensualidades of the period.
    const res2 = await pay({ method: 'efectivo', currency: 'USD', amount: 55, month: 'Nov' }).expect(400);
    expect(res2.body.code).toBe('OUT_OF_ORDER_PAYMENT');
    expect(res2.body.blocking[0].description).toBe(distintivo.description);
    void nov;
  });

  it('the excess rolls on to the next debt while any is left', async () => {
    const { eur, usd } = await enrollmentAndUniform();
    const oct = await charge({ type: 'mensualidad', month: 'Oct', amount: 55, currency: 'USD', amountVES: 44000 });
    const res = await pay({ method: 'transferencia', currency: 'VES', amount: 69000, bank: 'Banesco', reference: '1234' }).expect(201);

    const allocs = res.body.allocations;
    expect(allocs).toHaveLength(3);
    // 40,000 Bs → the enrollment; 24,000 Bs → exactly the uniform (no excess on it);
    // the remaining 5,000 Bs → 6.25 USD against October
    expect(Number(allocs.find((a: any) => a.chargeId === eur.id).amount)).toBe(40);
    expect(Number(allocs.find((a: any) => a.chargeId === usd.id).amount)).toBe(30);
    expect(Number(allocs.find((a: any) => a.chargeId === oct.id).amount)).toBeCloseTo(6.25, 2);
    const s = await student();
    expect(s.other.byCurrency.USD.paid).toBe(30);
    expect(s.months.Oct.byCurrency.USD.paid).toBeCloseTo(6.25, 2);
  });

  it('tuition scope settles enrollment and monthly debts, skipping sellable items', async () => {
    const { eur, usd } = await enrollmentAndUniform();
    const item = await charge({ type: 'item', description: 'Chaqueta', amount: 35, currency: 'USD', amountVES: 28000 });
    const oct = await charge({ type: 'mensualidad', month: 'Oct', amount: 55, currency: 'USD', amountVES: 44000 });

    // tuition: 40 EUR enrollment first, then Oct (55 USD = 44 EUR at 800 Bs/USD vs 1000 Bs/EUR).
    const res = await pay({ method: 'efectivo', currency: 'EUR', amount: 84, scope: 'tuition' }).expect(201);
    const allocs = res.body.allocations;
    expect(Number(allocs.find((a: any) => a.chargeId === eur.id).amount)).toBe(40);
    expect(Number(allocs.find((a: any) => a.chargeId === oct.id).amount)).toBe(55);
    expect(allocs.find((a: any) => a.chargeId === item.id)).toBeUndefined();
    expect(allocs.find((a: any) => a.chargeId === usd.id)).toBeUndefined(); // 'otro' is skipped too
    const s = await student();
    expect(s.months.Oct.totalPaid).toBe(55);
    expect(s.other.byCurrency?.USD?.paid ?? 0).toBe(0);
  });

  it('item scope goes straight to the chosen sellable item even with earlier debts', async () => {
    const { eur } = await enrollmentAndUniform();
    const item = await charge({ type: 'item', description: 'Franela', amount: 30, currency: 'USD', amountVES: 24000 });
    const res = await pay({ method: 'efectivo', currency: 'USD', amount: 30, scope: 'item', chargeId: item.id }).expect(201);

    expect(res.body.allocations).toHaveLength(1);
    expect(res.body.allocations[0].chargeId).toBe(item.id);
    const s = await student();
    expect(s.enrollment.byCurrency?.EUR?.paid ?? 0).toBe(0);
    void eur;
  });

  it('item scope requires a valid sellable-item charge of the student', async () => {
    const { usd } = await enrollmentAndUniform();
    await pay({ method: 'efectivo', currency: 'USD', amount: 30, scope: 'item' }).expect(400);
    // An 'otro' charge is not a sellable item.
    await pay({ method: 'efectivo', currency: 'USD', amount: 30, scope: 'item', chargeId: usd.id }).expect(400);
  });

  it('an item payment rolls its excess on to the next sellable item', async () => {
    const franela = await charge({ type: 'item', description: 'Franela', amount: 30, currency: 'USD', amountVES: 24000 });
    const chaqueta = await charge({ type: 'item', description: 'Chaqueta', amount: 35, currency: 'USD', amountVES: 28000 });
    const res = await pay({ method: 'efectivo', currency: 'USD', amount: 50, scope: 'item', chargeId: franela.id }).expect(201);

    const allocs = res.body.allocations;
    expect(Number(allocs.find((a: any) => a.chargeId === franela.id).amount)).toBe(30);
    expect(Number(allocs.find((a: any) => a.chargeId === chaqueta.id).amount)).toBe(20);
  });

  it('an insufficient payment applies what it can and stops', async () => {
    const { eur, usd } = await enrollmentAndUniform();
    const res = await pay({ method: 'transferencia', currency: 'VES', amount: 20000, bank: 'Banesco', reference: '1234' }).expect(201);

    expect(res.body.allocations).toHaveLength(1);
    expect(res.body.allocations[0].chargeId).toBe(eur.id);
    expect(Number(res.body.allocations[0].amount)).toBe(20); // 20000 Bs / 1000 = 20 EUR
    const s = await student();
    expect(s.enrollment.byCurrency.EUR.paid).toBe(20);
    expect(s.other.byCurrency?.USD?.paid ?? 0).toBe(0);
    void usd;
  });

  it('a payment targeted to a charge is rejected while an earlier debt is unpaid', async () => {
    const { eur, usd } = await enrollmentAndUniform();
    const res = await pay({ method: 'efectivo', currency: 'USD', amount: 30, chargeId: usd.id }).expect(400);

    expect(res.body.code).toBe('OUT_OF_ORDER_PAYMENT');
    expect(res.body.blocking[0].description).toBe(eur.description);
    const s = await student();
    expect(s.other.byCurrency.USD.paid).toBe(0);
  });

  it('a payment targeted to the next unpaid charge settles it', async () => {
    const { usd } = await enrollmentAndUniform();
    // Pay the 40 EUR enrollment first: the uniform becomes the next debt in order.
    await pay({ method: 'efectivo', currency: 'EUR', amount: 40 }).expect(201);
    const res = await pay({ method: 'efectivo', currency: 'USD', amount: 30, chargeId: usd.id }).expect(201);

    expect(res.body.allocations).toHaveLength(1);
    expect(res.body.allocations[0].chargeId).toBe(usd.id);
    const s = await student();
    expect(s.other.byCurrency.USD.paid).toBe(30);
  });

  it('a payment targeted to a future month is rejected while an earlier month is unpaid', async () => {
    const oct = await charge({ type: 'mensualidad', month: 'Oct', amount: 40, currency: 'EUR', amountVES: 40000 });
    const nov = await charge({ type: 'mensualidad', month: 'Nov', amount: 40, currency: 'EUR', amountVES: 40000 });
    const res = await pay({ method: 'efectivo', currency: 'EUR', amount: 40, month: 'Nov' }).expect(400);

    expect(res.body.code).toBe('OUT_OF_ORDER_PAYMENT');
    expect(res.body.blocking[0].description).toBe(oct.description);
    const s = await student();
    expect(s.months.Nov.totalPaid).toBe(0);

    // After October is settled, November can be paid directly.
    await pay({ method: 'efectivo', currency: 'EUR', amount: 40, month: 'Oct' }).expect(201);
    const ok = await pay({ method: 'efectivo', currency: 'EUR', amount: 40, month: 'Nov', allowDuplicate: true }).expect(201);
    expect(ok.body.allocations).toHaveLength(1);
    expect(ok.body.allocations[0].chargeId).toBe(nov.id);
    const after = await student();
    expect(after.months.Nov.totalPaid).toBe(40);
  });

  it('a prior-period debt blocks a targeted payment in the current period', async () => {
    const prevPeriod = await createTestPeriod({ startYear: 2024, endYear: 2025 });
    await charge({ schoolPeriodId: prevPeriod.id, type: 'mensualidad', month: 'Aug', description: 'Mensualidad', amount: 40, currency: 'USD', amountVES: 32000 });
    const oct = await charge({ type: 'mensualidad', month: 'Oct', amount: 40, currency: 'USD', amountVES: 32000 });

    const res = await pay({ method: 'efectivo', currency: 'USD', amount: 40, month: 'Oct' }).expect(400);
    expect(res.body.code).toBe('OUT_OF_ORDER_PAYMENT');

    // The old debt is the next one in order: paying it directly is allowed.
    const ok = await pay({ method: 'efectivo', currency: 'USD', amount: 40, month: 'Aug', debtPeriodId: prevPeriod.id }).expect(201);
    expect(ok.body.allocations[0].periodId).toBe(prevPeriod.id);

    // Now October can be paid too.
    const nov = await pay({ method: 'efectivo', currency: 'USD', amount: 40, month: 'Oct', allowDuplicate: true }).expect(201);
    expect(nov.body.allocations[0].chargeId).toBe(oct.id);
  });

  it('moving a payment rebuilds its allocations on the destination debts', async () => {
    const { eur } = await enrollmentAndUniform();
    const res = await pay({ method: 'transferencia', currency: 'VES', amount: 69000, bank: 'Banesco', reference: '1234' }).expect(201);

    const { person } = await createTestUser({ username: 'alloc_student2' });
    const other = await createTestInscription(person.id, structure.period.id, structure.grade.id, structure.section.id);
    const dest = await Charge.create({
      inscriptionId: other.id, schoolPeriodId: structure.period.id, type: 'otro', month: null,
      description: 'Uniforme', amount: 50, currency: 'USD', amountVES: 40000, active: true,
    } as any);

    await agent.post(`/api/ledger/payments/${res.body.id}/move`)
      .send({ toInscriptionId: other.id, reason: 'Estudiante equivocado' }).expect(200);

    // The origin student's debts are owed again; the destination got the split
    const s = await student();
    expect(s.enrollment.byCurrency?.EUR?.paid ?? 0).toBe(0);
    const movedAllocs = await agent.get(`/api/ledger/payments/audit?inscriptionId=${other.id}`).expect(200);
    expect(movedAllocs.body.length).toBeGreaterThan(0);
    const destAlloc = await (await import('@/models/index')).PaymentAllocation.findAll({ where: { paymentId: res.body.id } });
    expect(destAlloc).toHaveLength(1);
    expect(destAlloc[0].chargeId).toBe(dest.id);
    // 69,000 Bs = 86.25 USD, but the debt is 50 USD → 50 applied + 36.25 excess? No:
    // the excess stays on the same charge, so the full 86.25 credits the charge.
    expect(Number(destAlloc[0].amount)).toBeCloseTo(86.25, 2);
    void eur;
  });

  it('deleting a payment removes its allocations', async () => {
    await enrollmentAndUniform();
    const res = await pay({ method: 'transferencia', currency: 'VES', amount: 69000, bank: 'Banesco', reference: '1234' }).expect(201);
    await agent.delete(`/api/ledger/payments/${res.body.id}`).send({ reason: 'Error de carga' }).expect(200);

    const s = await student();
    expect(s.enrollment.byCurrency?.EUR?.paid ?? 0).toBe(0);
    expect(s.other.byCurrency?.USD?.paid ?? 0).toBe(0);
  });
});
