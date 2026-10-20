import request from 'supertest';
import app from '@/app';
import { Role, PersonRole, Charge, SellableItem, ExchangeRateType, ChargeDelivery } from '@/models/index';
import {
  createTestUser,
  createAcademicStructure,
  createTestInscription,
} from '../helpers/testData';

/**
 * Item badges & deliveries: an 'item' charge carries a unit quantity and its
 * sellable item's badge icon; deliveries record the per-unit hand-over with
 * the staff member who made it.
 */
describe('Sellable-item badges and deliveries', () => {
  let agent: any;
  let structure: any;
  let item: SellableItem;

  const addItemCharge = (inscriptionId: number, periodId: number, overrides: any = {}) =>
    Charge.create({
      inscriptionId,
      schoolPeriodId: periodId,
      sellableItemId: item.id,
      type: 'item',
      month: null,
      description: item.name,
      amount: 30,
      currency: 'USD',
      quantity: 2,
      active: true,
      ...overrides,
    } as any);

  beforeEach(async () => {
    agent = request.agent(app);
    const { person: adminPerson } = await createTestUser({ username: 'admin' });
    const [adminRole] = await Role.findOrCreate({ where: { name: 'Administrador' as any }, defaults: { name: 'Administrador' as any } });
    await PersonRole.create({ personId: adminPerson.id, roleId: adminRole.id });
    await agent.post('/api/auth/login').send({ username: 'admin', password: 'password123' });
    structure = await createAcademicStructure();
    const type = await ExchangeRateType.create({ code: `USD_D${structure.period.id}`, name: 'Dólar', currency: 'USD', isDefault: false, active: true } as any);
    item = await SellableItem.create({
      name: 'Franela IPM', amount: 30, exchangeRateTypeId: type.id,
      icon: 'Shirt', active: true,
    } as any);
  });

  it('POST /charges accepts a unit quantity and exposes it in the ledger with the item icon', async () => {
    const { person } = await createTestUser({ username: 'std1' });
    const ins = await createTestInscription(person.id, structure.period.id, structure.grade.id, structure.section.id);
    const charge = await addItemCharge(ins.id, structure.period.id);

    const res = await agent.get(`/api/ledger/${structure.period.id}/${structure.grade.id}/${structure.section.id}`).expect(200);
    const student = res.body.students.find((s: any) => s.inscriptionId === ins.id);
    const found = student.enrollment.charges.find((c: any) => c.id === charge.id);
    expect(found).toBeDefined();
    expect(found.quantity).toBe(2);
    expect(found.sellableItem.icon).toBe('Shirt');
    expect(found.deliveries).toEqual([]);
  });

  it('POST /charges/:id/deliveries records partial deliveries with the delivering user', async () => {
    const { person } = await createTestUser({ username: 'std2' });
    const ins = await createTestInscription(person.id, structure.period.id, structure.grade.id, structure.section.id);
    const charge = await addItemCharge(ins.id, structure.period.id);

    const res = await agent.post(`/api/ledger/charges/${charge.id}/deliveries`)
      .send({ quantity: 1, note: 'Solo llevó uno' }).expect(201);
    expect(res.body.quantity).toBe(1);
    expect(res.body.deliveredBy).toBeDefined();

    const rows = await ChargeDelivery.findAll({ where: { chargeId: charge.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].quantity).toBe(1);
  });

  it('rejects delivering more units than the charge has', async () => {
    const { person } = await createTestUser({ username: 'std3' });
    const ins = await createTestInscription(person.id, structure.period.id, structure.grade.id, structure.section.id);
    const charge = await addItemCharge(ins.id, structure.period.id);

    await agent.post(`/api/ledger/charges/${charge.id}/deliveries`).send({ quantity: 2 }).expect(201);
    const res = await agent.post(`/api/ledger/charges/${charge.id}/deliveries`).send({ quantity: 1 }).expect(400);
    expect(res.body.message).toContain('quedan 0');
  });

  it('rejects deliveries on non-item charges', async () => {
    const { person } = await createTestUser({ username: 'std4' });
    const ins = await createTestInscription(person.id, structure.period.id, structure.grade.id, structure.section.id);
    const charge = await Charge.create({
      inscriptionId: ins.id, schoolPeriodId: structure.period.id, type: 'mensualidad',
      month: 'Sep', description: 'Mensualidad', amount: 100, currency: 'USD', active: true,
    } as any);

    await agent.post(`/api/ledger/charges/${charge.id}/deliveries`).send({ quantity: 1 }).expect(400);
  });

  it('DELETE /deliveries/:id undoes a delivery and frees the units', async () => {
    const { person } = await createTestUser({ username: 'std5' });
    const ins = await createTestInscription(person.id, structure.period.id, structure.grade.id, structure.section.id);
    const charge = await addItemCharge(ins.id, structure.period.id);

    const d1 = await agent.post(`/api/ledger/charges/${charge.id}/deliveries`).send({ quantity: 2 }).expect(201);
    await agent.post(`/api/ledger/charges/${charge.id}/deliveries`).send({ quantity: 1 }).expect(400);

    await agent.delete(`/api/ledger/deliveries/${d1.body.id}`).expect(200);
    await agent.post(`/api/ledger/charges/${charge.id}/deliveries`).send({ quantity: 1 }).expect(201);
    await agent.delete('/api/ledger/deliveries/999999').expect(404);
  });
});
