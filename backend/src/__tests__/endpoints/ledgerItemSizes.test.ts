import request from 'supertest';
import app from '@/app';
import { Role, PersonRole, Charge, SellableItem, ExchangeRateType, ChargeDelivery } from '@/models/index';
import { createTestUser, createAcademicStructure, createTestInscription } from '../helpers/testData';

/**
 * Sizes and inventory of sellable items: the size handed over is recorded on
 * each delivery (mandatory when the item has sizes), stock = movements −
 * delivered units, deliveries warn (never block) on negative stock, and the
 * sold/delivered counts work even without any inventory configured.
 */
describe('Sellable-item sizes and inventory', () => {
  let agent: any;
  let structure: any;
  let adminId: number;
  let typeId: number;
  let inscriptionId: number;

  const mkItem = (over: any = {}) => SellableItem.create({
    name: 'Mono Educación Física', amount: 20, exchangeRateTypeId: typeId, active: true, sizes: ['S', 'M', 'L'], ...over,
  } as any);

  const mkCharge = (itemId: number, quantity = 2) => Charge.create({
    inscriptionId, schoolPeriodId: structure.period.id, sellableItemId: itemId, type: 'item', month: null,
    description: 'Mono', amount: 20 * quantity, currency: 'USD', quantity, active: true,
  } as any);

  const deliver = (chargeId: number, body: any) => agent.post(`/api/ledger/charges/${chargeId}/deliveries`).send(body);
  const inventory = (itemId: number, qs = '') => agent.get(`/api/payments/sellable-items/${itemId}/inventory${qs}`).expect(200);
  const move = (itemId: number, body: any) => agent.post(`/api/payments/sellable-items/${itemId}/inventory-movements`).send(body);

  beforeEach(async () => {
    agent = request.agent(app);
    const { person: admin } = await createTestUser({ username: 'sizes_admin' });
    adminId = admin.id;
    const [role] = await Role.findOrCreate({ where: { name: 'Administrador' as any }, defaults: { name: 'Administrador' as any } });
    await PersonRole.create({ personId: admin.id, roleId: role.id });
    await agent.post('/api/auth/login').send({ username: 'sizes_admin', password: 'password123' });
    structure = await createAcademicStructure();
    const type = await ExchangeRateType.create({ code: `USD_S${structure.period.id}`, name: 'Dólar', currency: 'USD', isDefault: false, active: true } as any);
    typeId = type.id;
    const { person } = await createTestUser({ username: 'sizes_student' });
    inscriptionId = (await createTestInscription(person.id, structure.period.id, structure.grade.id, structure.section.id)).id;
  });

  it('saves a normalized size list on the item and blocks removing sizes in use', async () => {
    const created = await agent.post('/api/payments/sellable-items').send({
      name: 'Camisa', amount: 15, exchangeRateTypeId: typeId, sizes: [' S ', 'M', 'm', '', 'L'],
    }).expect(201);
    expect(created.body.sizes).toEqual(['S', 'M', 'L']);

    await move(created.body.id, { type: 'ingreso', size: 'L', quantity: 5 }).expect(201);
    const blocked = await agent.put(`/api/payments/sellable-items/${created.body.id}`).send({ sizes: ['S', 'M'] }).expect(400);
    expect(blocked.body.message).toContain('L');
    await agent.put(`/api/payments/sellable-items/${created.body.id}`).send({ sizes: ['S', 'M', 'L', 'XL'] }).expect(200);
  });

  it('requires a valid size to deliver an item that has sizes, and records it', async () => {
    const item = await mkItem();
    const charge = await mkCharge(item.id);

    await deliver(charge.id, { quantity: 1 }).expect(400);
    await deliver(charge.id, { quantity: 1, size: 'XXL' }).expect(400);
    const ok = await deliver(charge.id, { quantity: 1, size: 'M' }).expect(201);
    expect(ok.body.size).toBe('M');
    expect(ok.body.deliveredByPersonId).toBe(adminId);

    const ledger = await agent.get(`/api/ledger/${structure.period.id}/${structure.grade.id}/${structure.section.id}`).expect(200);
    const found = ledger.body.students[0].enrollment.charges.find((c: any) => c.id === charge.id);
    expect(found.sellableItem.sizes).toEqual(['S', 'M', 'L']);
    expect(found.deliveries[0].size).toBe('M');
  });

  it('items without sizes deliver without one', async () => {
    const item = await mkItem({ name: 'Distintivo', sizes: null });
    const charge = await mkCharge(item.id, 1);
    const res = await deliver(charge.id, { quantity: 1 }).expect(201);
    expect(res.body.size).toBeNull();
  });

  it('stock = movements − deliveries per size; undoing a delivery gives the unit back', async () => {
    const item = await mkItem();
    const charge = await mkCharge(item.id);
    await move(item.id, { type: 'ingreso', size: 'M', quantity: 10, note: 'Compra' }).expect(201);
    await move(item.id, { type: 'ajuste', size: 'M', quantity: -1, note: 'Prenda dañada' }).expect(201);
    const d = await deliver(charge.id, { quantity: 2, size: 'M' }).expect(201);

    let inv = (await inventory(item.id)).body;
    expect(inv.configured).toBe(true);
    const m = inv.rows.find((r: any) => r.size === 'M');
    expect(m.received).toBe(9);
    expect(m.delivered).toBe(2);
    expect(m.stock).toBe(7);
    expect(inv.rows.find((r: any) => r.size === 'S').stock).toBe(0);
    expect(inv.movements[0].createdBy.id).toBe(adminId);

    await agent.delete(`/api/ledger/deliveries/${d.body.id}`).expect(200);
    inv = (await inventory(item.id)).body;
    expect(inv.rows.find((r: any) => r.size === 'M').stock).toBe(9);
  });

  it('warns when stock goes negative but still registers the delivery', async () => {
    const item = await mkItem();
    const charge = await mkCharge(item.id);
    await move(item.id, { type: 'ingreso', size: 'S', quantity: 1 }).expect(201);

    const res = await deliver(charge.id, { quantity: 2, size: 'S' }).expect(201);
    expect(res.body.stockWarning).toContain('talla S');
    expect(await ChargeDelivery.count({ where: { chargeId: charge.id } })).toBe(1);
  });

  it('no warning and no stock figures while the item has no inventory configured; sales still counted by size', async () => {
    const item = await mkItem();
    const charge = await mkCharge(item.id, 3);
    const res = await deliver(charge.id, { quantity: 1, size: 'L' }).expect(201);
    expect(res.body.stockWarning).toBeNull();

    const inv = (await inventory(item.id, `?schoolPeriodId=${structure.period.id}`)).body;
    expect(inv.configured).toBe(false);
    expect(inv.sold).toBe(3);
    expect(inv.delivered).toBe(1);
    expect(inv.pendingDelivery).toBe(2);
    const l = inv.rows.find((r: any) => r.size === 'L');
    expect(l.delivered).toBe(1);
    expect(l.stock).toBeNull();

    const summary = await agent.get('/api/payments/inventory-summary').expect(200);
    const row = summary.body.find((r: any) => r.itemId === item.id);
    expect(row.sold).toBe(3);
  });

  it('validates movements: size required, ajuste needs a note, ingreso must be positive', async () => {
    const item = await mkItem();
    await move(item.id, { type: 'ingreso', quantity: 3 }).expect(400); // size missing
    await move(item.id, { type: 'ingreso', size: 'XL', quantity: 3 }).expect(400); // not in list
    await move(item.id, { type: 'ajuste', size: 'S', quantity: -1 }).expect(400); // no note
    await move(item.id, { type: 'ingreso', size: 'S', quantity: -2 }).expect(400);
    await move(item.id, { type: 'ingreso', size: 'S', quantity: 0 }).expect(400);
    await move(item.id, { type: 'otro', size: 'S', quantity: 1 }).expect(400);
  });
});
