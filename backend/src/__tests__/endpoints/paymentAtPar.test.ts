import request from 'supertest';
import app from '@/app';
import { Charge, ExchangeRate, ExchangeRateType, Inscription, PersonRole, SchoolPeriod } from '@/models/index';
import {
  createAcademicStructure, createTestInscription, createTestRole, createTestUser,
} from '../helpers/testData';

describe('USD/USDT at par against EUR debts', () => {
  let agent: any;
  let structure: any;
  let inscription: Inscription;
  const today = new Date().toISOString().slice(0, 10);

  const setPar = (value: boolean) =>
    agent.put(`/api/payments/par-settlement/${structure.period.id}`).send({ usdAtPar: value });

  const pay = (body: any) => agent.post('/api/ledger/payments').send({
    inscriptionId: inscription.id, schoolPeriodId: structure.period.id, paymentDate: today, ...body,
  });

  const student = async () => {
    const res = await agent
      .get(`/api/ledger/${structure.period.id}/${structure.grade.id}/${structure.section.id}`).expect(200);
    return res.body.students.find((s: any) => s.inscriptionId === inscription.id);
  };

  beforeEach(async () => {
    agent = request.agent(app);
    const { person: admin } = await createTestUser({ username: 'par_admin' });
    const role = await createTestRole('Master');
    await PersonRole.create({ personId: admin.id, roleId: role.id });
    await agent.post('/api/auth/login').send({ username: 'par_admin', password: 'password123' });

    structure = await createAcademicStructure();
    const { person } = await createTestUser({ username: 'par_student' });
    inscription = await createTestInscription(person.id, structure.period.id, structure.grade.id, structure.section.id);

    // USD 800 Bs, EUR 1000 Bs: converting 40 USD only settles 32 EUR
    const usd = await ExchangeRateType.create({ code: 'USD', name: 'USD', currency: 'USD', isDefault: true, active: true } as any);
    const eur = await ExchangeRateType.create({ code: 'EUR', name: 'EUR', currency: 'EUR', isDefault: true, active: true } as any);
    await ExchangeRate.create({ exchangeRateTypeId: usd.id, date: today, rate: 800 } as any);
    await ExchangeRate.create({ exchangeRateTypeId: eur.id, date: today, rate: 1000 } as any);

    await Charge.create({
      inscriptionId: inscription.id, schoolPeriodId: structure.period.id, type: 'mensualidad', month: 'Oct',
      description: 'Mensualidad', amount: 40, currency: 'EUR', amountVES: 40000, active: true,
    } as any);
    await Charge.create({
      inscriptionId: inscription.id, schoolPeriodId: structure.period.id, type: 'mensualidad', month: 'Nov',
      description: 'Mensualidad', amount: 40, currency: 'EUR', amountVES: 40000, active: true,
    } as any);
  });

  it('is off by default: 40 USD are converted by rate (32 EUR)', async () => {
    const res = await pay({ method: 'efectivo', currency: 'USD', amount: 40 }).expect(201);
    expect(res.body.atPar).toBe(false);
    expect(Number(res.body.equivalent)).toBe(32);
    expect((await student()).months.Oct.totalPaid).toBe(32);
  });

  it('with the period setting on, 40 USD cash settle a 40 EUR debt', async () => {
    await setPar(true).expect(200);
    const res = await pay({ method: 'efectivo', currency: 'USD', amount: 40 }).expect(201);
    expect(res.body.atPar).toBe(true);
    expect(res.body.equivalentCurrency).toBe('EUR');
    expect(Number(res.body.equivalent)).toBe(40);

    const oct = (await student()).months.Oct;
    expect(oct.totalPaid).toBe(40);
    // fully paid also in bolívares, so the next automatic payment goes to November
    expect(oct.totalPaidVES).toBe(oct.totalChargedVES);
    const next = await pay({ method: 'zinli', currency: 'USD', amount: 10, account: 'ana' }).expect(201);
    expect(next.body.month).toBe('Nov');
  });

  it('digital USD (Zelle/Zinli) and USDT also count at par', async () => {
    await setPar(true).expect(200);
    const zelle = await pay({ method: 'zelle', currency: 'USD', amount: 10, account: 'a@b.c', month: 'Oct' }).expect(201);
    const usdt = await pay({ method: 'binance', currency: 'USDT', amount: 10, account: 'ana', month: 'Oct' }).expect(201);
    expect(zelle.body.atPar).toBe(true);
    expect(usdt.body.atPar).toBe(true);
    expect((await student()).months.Oct.totalPaid).toBe(20);
  });

  it('bolívares are always converted by rate', async () => {
    await setPar(true).expect(200);
    const res = await pay({ method: 'transferencia', currency: 'VES', amount: 40000, bank: 'Banesco', reference: '1234', month: 'Oct' }).expect(201);
    expect(res.body.atPar).toBe(false);
    expect(Number(res.body.equivalent)).toBe(40); // 40000 Bs / 1000 Bs per EUR
  });

  it('does not touch debts in USD', async () => {
    await setPar(true).expect(200);
    await Charge.create({
      inscriptionId: inscription.id, schoolPeriodId: structure.period.id, type: 'mensualidad', month: 'Dec',
      description: 'Mensualidad', amount: 40, currency: 'USD', amountVES: 32000, active: true,
    } as any);
    // Settle the earlier EUR debts first: debts are paid strictly in order.
    await pay({ method: 'efectivo', currency: 'EUR', amount: 80 }).expect(201);
    const res = await pay({ method: 'efectivo', currency: 'USD', amount: 40, month: 'Dec' }).expect(201);
    expect(res.body.atPar).toBe(false);
    expect(Number(res.body.equivalent)).toBe(40);
  });

  it('a payment moved to another student is re-evaluated against its new debt', async () => {
    await setPar(true).expect(200);
    const p = await pay({ method: 'efectivo', currency: 'USD', amount: 40 }).expect(201);
    const { person } = await createTestUser({ username: 'par_student2' });
    const other = await createTestInscription(person.id, structure.period.id, structure.grade.id, structure.section.id);
    await Charge.create({
      inscriptionId: other.id, schoolPeriodId: structure.period.id, type: 'mensualidad', month: 'Oct',
      description: 'Mensualidad', amount: 40, currency: 'USD', amountVES: 32000, active: true,
    } as any);
    const moved = await agent.post(`/api/ledger/payments/${p.body.id}/move`)
      .send({ toInscriptionId: other.id, reason: 'Estudiante equivocado' }).expect(200);
    expect(moved.body.atPar).toBe(false); // the destination debt is in USD
    expect(moved.body.equivalentCurrency).toBe('USD');
  });

  it('the "__other" pseudo-month means month-less debts and still applies at par', async () => {
    await setPar(true).expect(200);
    await Charge.create({
      inscriptionId: inscription.id, schoolPeriodId: structure.period.id, type: 'matricula', month: null,
      description: 'Matrícula', amount: 40, currency: 'EUR', amountVES: 40000, active: true,
    } as any);
    const res = await pay({ method: 'efectivo', currency: 'USD', amount: 40, month: '__other' }).expect(201);
    expect(res.body.month).toBeNull();
    expect(res.body.atPar).toBe(true);
    expect((await student()).enrollment.totalPaid).toBe(40);
  });

  it('the setting is stored on the period and validated', async () => {
    await setPar(true).expect(200);
    expect((await SchoolPeriod.findByPk(structure.period.id))!.usdAtPar).toBe(true);
    await agent.put(`/api/payments/par-settlement/${structure.period.id}`).send({ usdAtPar: 'yes' }).expect(400);
    await agent.put('/api/payments/par-settlement/999999').send({ usdAtPar: true }).expect(404);
  });
});
