import request from 'supertest';
import app from '@/app';
import { Role, PersonRole, Charge, SellableItem, ExchangeRateType, PaymentAllocation } from '@/models/index';
import { createTestUser, createAcademicStructure, createTestInscription } from '../helpers/testData';

/**
 * Item payments without a chosen item spread over every pending item debt, a recorded payment can
 * be re-pointed to another destination (with audit), and several item debts can be created at once.
 */
describe('Ledger: item payments, payment destination and multi-item debts', () => {
  let agent: any;
  let structure: any;
  let typeId: number;
  let inscriptionId: number;

  const mkCharge = (over: any) => Charge.create({
    inscriptionId, schoolPeriodId: structure.period.id, month: null, currency: 'USD', quantity: 1, active: true, ...over,
  } as any);

  const pay = (body: any) => agent.post('/api/ledger/payments').send({
    inscriptionId, schoolPeriodId: structure.period.id, currency: 'USD', method: 'efectivo', ...body,
  });

  beforeEach(async () => {
    agent = request.agent(app);
    const { person: admin } = await createTestUser({ username: 'dest_admin' });
    const [role] = await Role.findOrCreate({ where: { name: 'Administrador' as any }, defaults: { name: 'Administrador' as any } });
    await PersonRole.create({ personId: admin.id, roleId: role.id });
    await agent.post('/api/auth/login').send({ username: 'dest_admin', password: 'password123' });
    structure = await createAcademicStructure();
    typeId = (await ExchangeRateType.create({ code: `USD_D${structure.period.id}`, name: 'Dólar', currency: 'USD', isDefault: false, active: true } as any)).id;
    const { person } = await createTestUser({ username: 'dest_student' });
    inscriptionId = (await createTestInscription(person.id, structure.period.id, structure.grade.id, structure.section.id)).id;
  });

  const setupDebts = async () => {
    const shirt = await SellableItem.create({ name: 'Franela', amount: 10, exchangeRateTypeId: typeId, active: true } as any);
    const pants = await SellableItem.create({ name: 'Pantalón', amount: 15, exchangeRateTypeId: typeId, active: true } as any);
    const matricula = await mkCharge({ type: 'matricula', description: 'Matrícula', amount: 55 });
    const c1 = await mkCharge({ type: 'item', sellableItemId: shirt.id, description: 'Franela', amount: 10 });
    const c2 = await mkCharge({ type: 'item', sellableItemId: pants.id, description: 'Pantalón', amount: 15 });
    return { matricula, c1, c2 };
  };

  it('scope item without chargeId spreads the payment over the pending items, skipping matrícula', async () => {
    const { matricula, c1, c2 } = await setupDebts();
    const res = await pay({ scope: 'item', amount: 25 }).expect(201);
    const allocs = await PaymentAllocation.findAll({ where: { paymentId: res.body.id } });
    const byCharge = new Map(allocs.map(a => [a.chargeId, Number(a.amount)]));
    expect(byCharge.get(c1.id)).toBeCloseTo(10, 2);
    expect(byCharge.get(c2.id)).toBeCloseTo(15, 2);
    expect(byCharge.has(matricula.id)).toBe(false);
  });

  it('scope item without chargeId is rejected when no item is pending', async () => {
    await mkCharge({ type: 'matricula', description: 'Matrícula', amount: 55 });
    const res = await pay({ scope: 'item', amount: 10 }).expect(400);
    expect(res.body.message).toContain('items vendibles pendientes');
  });

  it('re-points an automatic payment to sellable items and audits it', async () => {
    const { matricula, c1, c2 } = await setupDebts();
    const res = await pay({ scope: 'auto', amount: 25 }).expect(201);
    // Automatic order settles matrícula first.
    let allocs = await PaymentAllocation.findAll({ where: { paymentId: res.body.id } });
    expect(allocs.map(a => a.chargeId)).toEqual([matricula.id]);

    await agent.post(`/api/ledger/payments/${res.body.id}/move`).send({ scope: 'item' }).expect(400); // reason required
    await agent.post(`/api/ledger/payments/${res.body.id}/move`).send({ scope: 'item', reason: 'Era para uniformes' }).expect(200);
    allocs = await PaymentAllocation.findAll({ where: { paymentId: res.body.id } });
    const byCharge = new Map(allocs.map(a => [a.chargeId, Number(a.amount)]));
    expect(byCharge.get(c1.id)).toBeCloseTo(10, 2);
    expect(byCharge.get(c2.id)).toBeCloseTo(15, 2);
    expect(byCharge.has(matricula.id)).toBe(false);

    const audit = await agent.get(`/api/ledger/payments/audit?inscriptionId=${inscriptionId}`).expect(200);
    expect(audit.body[0].action).toBe('moved');
    expect(audit.body[0].reason).toContain('items vendibles');
  });

  it('moving to the same student without a destination is rejected, and an empty destination fails cleanly', async () => {
    await mkCharge({ type: 'matricula', description: 'Matrícula', amount: 55 });
    const res = await pay({ scope: 'auto', amount: 20 }).expect(201);
    await agent.post(`/api/ledger/payments/${res.body.id}/move`).send({ reason: 'sin cambio' }).expect(400);
    const noItems = await agent.post(`/api/ledger/payments/${res.body.id}/move`).send({ scope: 'item', reason: 'sin items' }).expect(400);
    expect(noItems.body.message).toContain('items vendibles pendientes');
    // The failed correction left the original allocation untouched.
    expect(await PaymentAllocation.count({ where: { paymentId: res.body.id } })).toBe(1);
  });

  it('bulk charges create one debt per item with a bolívar valuation', async () => {
    const shirt = await SellableItem.create({ name: 'Franela', amount: 10, exchangeRateTypeId: typeId, active: true } as any);
    const badge = await SellableItem.create({ name: 'Distintivo', amount: 2, exchangeRateTypeId: typeId, active: true } as any);
    const base = { inscriptionId, schoolPeriodId: structure.period.id, type: 'item', currency: 'USD' };
    const res = await agent.post('/api/ledger/charges/bulk').send({
      charges: [
        { ...base, sellableItemId: shirt.id, description: 'Franela', amount: 10, quantity: 1 },
        { ...base, sellableItemId: badge.id, description: 'Distintivo', amount: 4, quantity: 2 },
      ],
    }).expect(201);
    expect(res.body.created).toBe(2);
    const rows = await Charge.findAll({ where: { inscriptionId, type: 'item' }, order: [['id', 'ASC']] });
    expect(rows.map(r => r.quantity)).toEqual([1, 2]);
  });
});
