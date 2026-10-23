import request from 'supertest';
import app from '@/app';
import {
  Charge, ExchangeRate, ExchangeRateType, Inscription, Payment, PersonRole,
} from '@/models/index';
import {
  createAcademicStructure, createTestInscription, createTestRole, createTestUser,
} from '../helpers/testData';

describe('Payment methods, audit and duplicate protection', () => {
  let agent: any;
  let adminPersonId: number;
  let structure: any;
  let inscription: Inscription;
  let otherInscription: Inscription;

  const today = new Date().toISOString().slice(0, 10);

  const login = async (username: string, roleName: 'Master' | 'Administrador' = 'Administrador') => {
    const a = request.agent(app);
    const { person } = await createTestUser({ username });
    const role = await createTestRole(roleName);
    await PersonRole.create({ personId: person.id, roleId: role.id });
    await a.post('/api/auth/login').send({ username, password: 'password123' });
    return { agent: a, personId: person.id };
  };

  const pay = (a: any, body: any) => a.post('/api/ledger/payments').send({
    inscriptionId: inscription.id,
    schoolPeriodId: structure.period.id,
    paymentDate: today,
    ...body,
  });

  beforeEach(async () => {
    const admin = await login('pm_admin1');
    agent = admin.agent;
    adminPersonId = admin.personId;
    structure = await createAcademicStructure();
    const { person } = await createTestUser({ username: 'pm_student' });
    inscription = await createTestInscription(person.id, structure.period.id, structure.grade.id, structure.section.id);
    const { person: p2 } = await createTestUser({ username: 'pm_student2' });
    otherInscription = await createTestInscription(p2.id, structure.period.id, structure.grade.id, structure.section.id);
    await Charge.create({
      inscriptionId: inscription.id, schoolPeriodId: structure.period.id, type: 'mensualidad',
      month: 'Oct', description: 'Mensualidad', amount: 100, currency: 'USD', active: true,
    } as any);
  });

  describe('required fields per method', () => {
    it('cash needs only currency, date and amount', async () => {
      await pay(agent, { method: 'efectivo', currency: 'USD', amount: 10 }).expect(201);
    });

    it('transferencia and pago móvil require bank and the last 4 digits', async () => {
      const base = { currency: 'VES', amount: 1000 };
      await pay(agent, { ...base, method: 'transferencia', reference: '1234' }).expect(400); // no bank
      await pay(agent, { ...base, method: 'pago_movil', bank: 'Banesco', reference: '12345' }).expect(400); // 5 digits
      await pay(agent, { ...base, method: 'pago_movil', bank: 'Banesco', reference: 'abcd' }).expect(400);
      const ok = await pay(agent, { ...base, method: 'pago_movil', bank: 'Banesco', reference: '1234' }).expect(201);
      expect(ok.body.bank).toBe('Banesco');
      expect(ok.body.reference).toBe('1234');
    });

    it('platforms require the payer account and carry no bank', async () => {
      await pay(agent, { method: 'binance', currency: 'USDT', amount: 20 }).expect(400);
      const ok = await pay(agent, {
        method: 'binance', currency: 'USDT', amount: 20, account: 'juan.perez', bank: 'Banesco',
      }).expect(201);
      expect(ok.body.account).toBe('juan.perez');
      expect(ok.body.bank).toBeNull();
    });

    it('"otro" requires a description in the notes', async () => {
      await pay(agent, { method: 'otro', currency: 'USD', amount: 5 }).expect(400);
      await pay(agent, { method: 'otro', currency: 'USD', amount: 5, notes: 'Cheque 0045' }).expect(201);
    });

    it('rejects unknown methods and currencies and future dates', async () => {
      await pay(agent, { method: 'bitcoin', currency: 'USD', amount: 5 }).expect(400);
      await pay(agent, { method: 'efectivo', currency: 'BTC', amount: 5 }).expect(400);
      await pay(agent, { method: 'efectivo', currency: 'USD', amount: 5, paymentDate: '2999-01-01' }).expect(400);
    });
  });

  describe('USDT', () => {
    it('follows the USD rate and settles a USD debt 1:1', async () => {
      const usd = await ExchangeRateType.create({ code: 'BCV', name: 'BCV', currency: 'USD', isDefault: true, active: true } as any);
      await ExchangeRate.create({ exchangeRateTypeId: usd.id, date: today, rate: 500 } as any);
      const res = await pay(agent, { method: 'binance', currency: 'USDT', amount: 40, account: 'juan', month: 'Oct' }).expect(201);
      expect(Number(res.body.amountVES)).toBe(20000);
      expect(res.body.equivalentCurrency).toBe('USD');
      expect(Number(res.body.equivalent)).toBe(40);
    });
  });

  describe('audit', () => {
    it('stores who registered the payment and exposes it in the ledger', async () => {
      const res = await pay(agent, { method: 'efectivo', currency: 'USD', amount: 10, month: 'Oct' }).expect(201);
      expect(res.body.registeredByPersonId).toBe(adminPersonId);

      const ledger = await agent
        .get(`/api/ledger/${structure.period.id}/${structure.grade.id}/${structure.section.id}`).expect(200);
      const student = ledger.body.students.find((s: any) => s.inscriptionId === inscription.id);
      expect(student.months.Oct.payments[0].registeredBy.id).toBe(adminPersonId);
    });
  });

  describe('duplicate protection', () => {
    const transfer = { method: 'transferencia', currency: 'VES', amount: 5000, bank: 'Banesco', reference: '9876' };

    it('blocks the same operation registered twice, even for another student or by another admin', async () => {
      await pay(agent, transfer).expect(201);
      const second = await login('pm_admin2');
      const res = await second.agent.post('/api/ledger/payments').send({
        ...transfer, inscriptionId: otherInscription.id, schoolPeriodId: structure.period.id, paymentDate: today,
      }).expect(409);
      expect(res.body.code).toBe('DUPLICATE_PAYMENT');
      expect(res.body.duplicate.registeredBy).toBeTruthy();
      expect(await Payment.count()).toBe(1);
    });

    it('transferencia and pago móvil of the same operation are the same payment', async () => {
      await pay(agent, transfer).expect(201);
      await pay(agent, { ...transfer, method: 'pago_movil' }).expect(409);
    });

    it('a different amount or reference is not a duplicate', async () => {
      await pay(agent, transfer).expect(201);
      await pay(agent, { ...transfer, reference: '1111' }).expect(201);
      await pay(agent, { ...transfer, amount: 6000 }).expect(201);
    });

    it('same reference and amount on a different date is still flagged', async () => {
      await pay(agent, transfer).expect(201);
      const res = await pay(agent, { ...transfer, paymentDate: '2020-01-15' }).expect(409);
      expect(res.body.code).toBe('DUPLICATE_PAYMENT');
      await pay(agent, { ...transfer, paymentDate: '2020-01-15', allowDuplicate: true }).expect(201);
    });

    it('allowDuplicate registers it anyway', async () => {
      await pay(agent, transfer).expect(201);
      await pay(agent, { ...transfer, allowDuplicate: true }).expect(201);
      expect(await Payment.count()).toBe(2);
    });

    it('cash with the same student, amount and day within minutes is flagged', async () => {
      await pay(agent, { method: 'efectivo', currency: 'USD', amount: 25 }).expect(201);
      const res = await pay(agent, { method: 'efectivo', currency: 'USD', amount: 25 }).expect(409);
      expect(res.body.code).toBe('DUPLICATE_PAYMENT');
    });

    it('a repeated submission with the same clientRequestId returns the original payment', async () => {
      const first = await pay(agent, { method: 'efectivo', currency: 'USD', amount: 7, clientRequestId: 'req-1' }).expect(201);
      const again = await pay(agent, { method: 'efectivo', currency: 'USD', amount: 7, clientRequestId: 'req-1' }).expect(200);
      expect(again.body.id).toBe(first.body.id);
      expect(await Payment.count()).toBe(1);
    });
  });

  describe('ledger totals', () => {
    it('reports charged, paid and pending per currency', async () => {
      await pay(agent, { method: 'efectivo', currency: 'USD', amount: 30, month: 'Oct' }).expect(201);
      const res = await agent
        .get(`/api/ledger/${structure.period.id}/${structure.grade.id}/${structure.section.id}`).expect(200);
      expect(res.body.totals.USD).toEqual({ charged: 100, paid: 30, pending: 70 });
    });
  });
});
