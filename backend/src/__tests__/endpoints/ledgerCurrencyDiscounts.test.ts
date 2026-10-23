import request from 'supertest';
import app from '@/app';
import {
  Charge, CurrencyDiscount, DiscountReason, ExchangeRate, ExchangeRateType, InscriptionDiscount, PaymentAllocation, PersonRole,
} from '@/models/index';
import { createAcademicStructure, createTestInscription, createTestRole, createTestUser } from '../helpers/testData';

const today = new Date().toISOString().slice(0, 10);
const shiftDay = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

describe('Currency discounts (paying in USDT, USD, …)', () => {
  let agent: any;
  let structure: any;
  let insc: any;

  const mkCharge = (month: string, amount = 100, type = 'mensualidad') => Charge.create({
    inscriptionId: insc.id, schoolPeriodId: structure.period.id, type, month, description: `Mensualidad ${month}`, amount, currency: 'USD', active: true,
  } as any);
  const rule = (over: any = {}) => agent.post('/api/payments/currency-discounts').send({
    schoolPeriodId: structure.period.id, name: 'Pago en USDT', currency: 'USDT', kind: 'percent', value: 20, ...over,
  });
  const pay = (body: any) => agent.post('/api/ledger/payments').send({
    inscriptionId: insc.id, schoolPeriodId: structure.period.id, method: 'binance', account: 'juan',
    currency: 'USDT', paymentDate: today, allowDuplicate: true, ...body,
  });
  const allocations = async () => {
    const charges = await Charge.findAll({ where: { inscriptionId: insc.id }, order: [['id', 'ASC']] });
    const rows = await PaymentAllocation.findAll({ where: { chargeId: charges.map(c => c.id) } });
    return charges.map(c => {
      const mine = rows.filter(r => r.chargeId === c.id);
      return { credit: mine.reduce((s, r) => s + Number(r.amount), 0), bonus: mine.reduce((s, r) => s + Number(r.bonus), 0) };
    });
  };

  beforeEach(async () => {
    const username = `cd_admin_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const { person } = await createTestUser({ username });
    const role = await createTestRole('Administrador' as any);
    await PersonRole.create({ personId: person.id, roleId: role.id });
    agent = request.agent(app);
    await agent.post('/api/auth/login').send({ username, password: 'password123' });
    structure = await createAcademicStructure();
    const { person: st } = await createTestUser({ username: `cd_student_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` });
    insc = await createTestInscription(st.id, structure.period.id, structure.grade.id, structure.section.id, { entryMonth: 'Sep' });
    const usd = await ExchangeRateType.create({ code: 'BCV', name: 'BCV', currency: 'USD', isDefault: true, active: true } as any);
    await ExchangeRate.create({ exchangeRateTypeId: usd.id, date: today, rate: 500 } as any);
  });

  describe('percent', () => {
    it('80 USDT settle a 100 USD debt at 20%, recording the bonus', async () => {
      await mkCharge('Oct');
      await rule().expect(201);
      const res = await pay({ amount: 80 }).expect(201);
      expect(await allocations()).toEqual([{ credit: 100, bonus: 20 }]);
      expect(Number(res.body.amountVES)).toBe(40000); // what was really paid
      expect(Number(res.body.equivalent)).toBe(80);
      expect(res.body.allocations[0].bonus).toBe(20);
    });

    it('a payment in another currency gets no discount', async () => {
      await mkCharge('Oct');
      await rule().expect(201);
      await pay({ amount: 80, currency: 'USD', method: 'efectivo', account: undefined }).expect(201);
      expect(await allocations()).toEqual([{ credit: 80, bonus: 0 }]);
    });

    it('a partial payment gets the bonus proportionally and the debt keeps the rest', async () => {
      await mkCharge('Oct');
      await rule().expect(201);
      await pay({ amount: 40 }).expect(201);
      expect(await allocations()).toEqual([{ credit: 50, bonus: 10 }]);
    });

    it('overflow past the debts is not boosted', async () => {
      await mkCharge('Oct');
      await rule().expect(201);
      await pay({ amount: 100 }).expect(201); // 80 settle the debt, 20 extra stay as plain credit
      expect(await allocations()).toEqual([{ credit: 120, bonus: 20 }]);
    });

    it('respects the validity window and the active flag', async () => {
      await mkCharge('Oct');
      const expired = await rule({ validFrom: shiftDay(-30), validTo: shiftDay(-1) }).expect(201);
      await pay({ amount: 10 }).expect(201);
      expect(await allocations()).toEqual([{ credit: 10, bonus: 0 }]);
      await agent.put(`/api/payments/currency-discounts/${expired.body.id}`).send({ validTo: shiftDay(5), active: false }).expect(200);
      await pay({ amount: 10 }).expect(201);
      expect(await allocations()).toEqual([{ credit: 20, bonus: 0 }]);
      await agent.put(`/api/payments/currency-discounts/${expired.body.id}`).send({ active: true }).expect(200);
      await pay({ amount: 10 }).expect(201);
      expect(await allocations()).toEqual([{ credit: 32.5, bonus: 2.5 }]);
    });

    it('stacks with a personal discount: it acts on what is still owed', async () => {
      await mkCharge('Oct');
      const reason = await DiscountReason.create({ name: `Beca ${insc.id}` } as any);
      await InscriptionDiscount.create({
        inscriptionId: insc.id, reasonId: reason.id, kind: 'percent', value: 50, appliesTo: 'mensualidad',
      } as any);
      await rule().expect(201);
      await pay({ amount: 40 }).expect(201); // owes 50 net; 40 USDT cover it at 20%
      expect(await allocations()).toEqual([{ credit: 50, bonus: 10 }]);
    });

    it('also applies to items', async () => {
      await mkCharge('Oct', 100, 'item');
      await rule().expect(201);
      await pay({ amount: 80, scope: 'item' }).expect(201);
      expect(await allocations()).toEqual([{ credit: 100, bonus: 20 }]);
    });
  });

  describe('fixed', () => {
    it('takes the amount off every debt the payment settles in full', async () => {
      await mkCharge('Oct', 55);
      await mkCharge('Nov', 55);
      await rule({ kind: 'fixed', value: 5 }).expect(201);
      await pay({ amount: 100 }).expect(201); // 50 + 50 settle both
      expect(await allocations()).toEqual([{ credit: 55, bonus: 5 }, { credit: 55, bonus: 5 }]);
    });

    it('is not granted by a partial payment, and only once per debt', async () => {
      await mkCharge('Oct', 55);
      await rule({ kind: 'fixed', value: 5 }).expect(201);
      await pay({ amount: 20 }).expect(201);
      expect(await allocations()).toEqual([{ credit: 20, bonus: 0 }]);
      await pay({ amount: 30 }).expect(201); // 35 left, minus 5 = 30 completes it
      expect(await allocations()).toEqual([{ credit: 55, bonus: 5 }]);
    });
  });

  describe('rules', () => {
    it('validates the payload and rejects overlapping rules', async () => {
      await rule({ value: 0 }).expect(400);
      await rule({ value: 100 }).expect(400);
      await rule({ currency: 'XXX' }).expect(400);
      await rule({ kind: 'other' }).expect(400);
      await rule({ validFrom: '2026-12-01', validTo: '2026-01-01' }).expect(400);
      await rule({ validFrom: '2026-01-01', validTo: '2026-06-30' }).expect(201);
      await rule({ validFrom: '2026-06-01' }).expect(400);
      await rule({ validFrom: '2026-07-01' }).expect(201);
      await rule({ currency: 'EUR', validFrom: '2026-06-01' }).expect(201);
    });

    it('lists by period; applied rules cannot be deleted, unused ones can', async () => {
      await mkCharge('Oct');
      const used = await rule().expect(201);
      await pay({ amount: 10 }).expect(201);
      const list = await agent.get(`/api/payments/currency-discounts?schoolPeriodId=${structure.period.id}`).expect(200);
      expect(list.body).toHaveLength(1);
      await agent.delete(`/api/payments/currency-discounts/${used.body.id}`).expect(400);
      await CurrencyDiscount.update({ active: false }, { where: { id: used.body.id } });
      const spare = await rule({ currency: 'EUR' }).expect(201);
      await agent.delete(`/api/payments/currency-discounts/${spare.body.id}`).expect(200)
;
    });
  });
});
