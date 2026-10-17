import request from 'supertest';
import app from '@/app';
import { Charge, Payment, PaymentAuditLog, PersonRole } from '@/models/index';
import {
  createAcademicStructure, createTestInscription, createTestPeriod, createTestRole, createTestUser,
} from '../helpers/testData';

describe('Payment corrections: delete and move to another student', () => {
  let agent: any;
  let adminPersonId: number;
  let structure: any;
  let wrongInsc: any;
  let rightInsc: any;
  let rightNovCharge: any;
  const today = new Date().toISOString().slice(0, 10);

  const addDebt = (inscriptionId: number, month: string) => Charge.create({
    inscriptionId, schoolPeriodId: structure.period.id, type: 'mensualidad', month,
    description: 'Mensualidad', amount: 100, currency: 'USD', active: true,
  } as any);

  const pay = async (body: any = {}) => {
    const res = await agent.post('/api/ledger/payments').send({
      inscriptionId: wrongInsc.id, schoolPeriodId: structure.period.id, paymentDate: today,
      method: 'efectivo', currency: 'USD', amount: 40, ...body,
    }).expect(201);
    return res.body;
  };

  beforeEach(async () => {
    agent = request.agent(app);
    const { person: admin } = await createTestUser({ username: 'pc_admin' });
    adminPersonId = admin.id;
    const role = await createTestRole('Administrador');
    await PersonRole.create({ personId: admin.id, roleId: role.id });
    await agent.post('/api/auth/login').send({ username: 'pc_admin', password: 'password123' });

    structure = await createAcademicStructure();
    const { person: p1 } = await createTestUser({ username: 'pc_wrong' });
    const { person: p2 } = await createTestUser({ username: 'pc_right' });
    wrongInsc = await createTestInscription(p1.id, structure.period.id, structure.grade.id, structure.section.id);
    rightInsc = await createTestInscription(p2.id, structure.period.id, structure.grade.id, structure.section.id);
    await addDebt(wrongInsc.id, 'Oct');
    await addDebt(rightInsc.id, 'Nov');
    rightNovCharge = await Charge.findOne({ where: { inscriptionId: rightInsc.id, month: 'Nov' } });
  });

  describe('DELETE /payments/:id', () => {
    it('requires a reason', async () => {
      const p = await pay();
      await agent.delete(`/api/ledger/payments/${p.id}`).expect(400);
      await agent.delete(`/api/ledger/payments/${p.id}`).send({ reason: 'ab' }).expect(400);
      expect(await Payment.count()).toBe(1);
    });

    it('deletes the payment and leaves an audit entry with who, why and a snapshot', async () => {
      const p = await pay({ amount: 55 });
      await agent.delete(`/api/ledger/payments/${p.id}`).send({ reason: 'Se cargó dos veces' }).expect(200);
      expect(await Payment.count()).toBe(0);

      const log = await PaymentAuditLog.findOne({ where: { paymentId: p.id } });
      expect(log!.action).toBe('deleted');
      expect(log!.performedByPersonId).toBe(adminPersonId);
      expect(log!.reason).toBe('Se cargó dos veces');
      expect(Number(JSON.parse(log!.snapshot).amount)).toBe(55);
    });
  });

  describe('POST /payments/:id/move', () => {
    it('moves the payment to the right student, re-allocates it and keeps the original registrar', async () => {
      const p = await pay({ amount: 40 });
      expect(p.month).toBe('Oct'); // allocated to the wrong student's debt

      const res = await agent.post(`/api/ledger/payments/${p.id}/move`)
        .send({ toInscriptionId: rightInsc.id, reason: 'Pago del hermano' }).expect(200);
      expect(res.body.id).toBe(p.id);
      expect(res.body.inscriptionId).toBe(rightInsc.id);
      expect(res.body.month).toBe('Nov'); // oldest open debt of the destination
      expect(res.body.registeredByPersonId).toBe(adminPersonId);
      // the distribution links the payment to the charge it settled
      expect(res.body.chargeId).toBe(rightNovCharge.id);

      const ledger = await agent
        .get(`/api/ledger/${structure.period.id}/${structure.grade.id}/${structure.section.id}`).expect(200);
      const wrong = ledger.body.students.find((s: any) => s.inscriptionId === wrongInsc.id);
      const right = ledger.body.students.find((s: any) => s.inscriptionId === rightInsc.id);
      expect(wrong.months.Oct.totalPaid).toBe(0);
      expect(right.months.Nov.totalPaid).toBe(40);

      const log = await PaymentAuditLog.findOne({ where: { paymentId: p.id } });
      expect(log).toMatchObject({ action: 'moved', fromInscriptionId: wrongInsc.id, toInscriptionId: rightInsc.id, reason: 'Pago del hermano' });
    });

    it('requires a reason and a valid, different destination', async () => {
      const p = await pay();
      await agent.post(`/api/ledger/payments/${p.id}/move`).send({ toInscriptionId: rightInsc.id }).expect(400);
      await agent.post(`/api/ledger/payments/${p.id}/move`).send({ reason: 'x y z' }).expect(400);
      await agent.post(`/api/ledger/payments/${p.id}/move`).send({ toInscriptionId: 999999, reason: 'x y z' }).expect(400);
      await agent.post(`/api/ledger/payments/${p.id}/move`).send({ toInscriptionId: wrongInsc.id, reason: 'x y z' }).expect(400);
      expect((await Payment.findByPk(p.id))!.inscriptionId).toBe(wrongInsc.id);
    });

    it('refuses a destination of another school period', async () => {
      const p = await pay();
      const other = await createTestPeriod({ period: '2020-2021', name: 'Año 2020-2021', startYear: 2020, endYear: 2021, status: 'historico' });
      const { person } = await createTestUser({ username: 'pc_other_period' });
      const oldInsc = await createTestInscription(person.id, other.id, structure.grade.id, structure.section.id);
      const res = await agent.post(`/api/ledger/payments/${p.id}/move`)
        .send({ toInscriptionId: oldInsc.id, reason: 'prueba' }).expect(400);
      expect(res.body.message).toMatch(/mismo período/);
    });
  });

  describe('GET /payments/audit', () => {
    it('lists corrections that touched the student, newest first', async () => {
      const p = await pay();
      await agent.post(`/api/ledger/payments/${p.id}/move`).send({ toInscriptionId: rightInsc.id, reason: 'Estudiante equivocado' }).expect(200);
      await agent.delete(`/api/ledger/payments/${p.id}`).send({ reason: 'Registrado de nuevo' }).expect(200);

      const res = await agent.get('/api/ledger/payments/audit').query({ inscriptionId: rightInsc.id }).expect(200);
      expect(res.body.map((l: any) => l.action)).toEqual(['deleted', 'moved']);
      expect(res.body[0].performer.id).toBe(adminPersonId);
      expect(res.body[1].snapshot.id).toBe(p.id);
    });
  });
});
