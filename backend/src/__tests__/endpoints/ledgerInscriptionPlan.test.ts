import request from 'supertest';
import app from '@/app';
import {
  Charge, EnrollmentPlan, EnrollmentPlanItem, ExchangeRateType, Fee, PersonRole, Payment, SellableItem,
} from '@/models/index';
import {
  createAcademicStructure, createTestInscription, createTestRole, createTestUser,
} from '../helpers/testData';
import { generateChargesForInscription } from '@/services/chargeScheduleService';

/**
 * A student can take a different enrollment plan than the default one (basic enrollment vs. full
 * package with uniform): the plan's items are charged, items it no longer includes are retired
 * (never ones with payments), and optional plans are never the default of anybody.
 */
describe('Ledger: enrollment plan per student', () => {
  let agent: any;
  let ctx: any;
  let basic: EnrollmentPlan;
  let full: EnrollmentPlan;
  let shirt: SellableItem;
  let n = 0;

  const student = async () => {
    n += 1;
    const { person } = await createTestUser({ username: `plan_stu_${n}_${Date.now()}` });
    return createTestInscription(person.id, ctx.period.id, ctx.grade.id, ctx.section.id, { entryMonth: 'Sep' });
  };
  const planChargesOf = (inscriptionId: number) => Charge.findAll({ where: { inscriptionId, active: true }, order: [['id', 'ASC']] });
  const putPlan = (id: number, body: any) => agent.put(`/api/ledger/inscriptions/${id}/enrollment-plan`).send(body);

  const login = async () => {
    const username = `plan_adm_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const { person } = await createTestUser({ username });
    const role = await createTestRole('Administrador' as any);
    await PersonRole.create({ personId: person.id, roleId: role.id });
    agent = request.agent(app);
    await agent.post('/api/auth/login').send({ username, password: 'password123' });
  };

  const setup = async () => {
    await login();
    const structure = await createAcademicStructure();
    await structure.period.update({ status: 'activo' });
    const type = await ExchangeRateType.create({ code: `USD_P${structure.period.id}`, name: 'Dólar', currency: 'USD', isDefault: false, active: true } as any);
    const base = { schoolPeriodId: structure.period.id, exchangeRateTypeId: type.id };
    await Fee.create({ ...base, key: 'mensualidad', name: 'Mensualidad', amount: 55, effectiveMonth: 'Sep' } as any);
    const matricula = await Fee.create({ ...base, key: 'matricula', name: 'Matrícula', amount: 55, effectiveMonth: 'Sep' } as any);
    const gastos = await Fee.create({ ...base, key: 'gastos_administrativos', name: 'Gastos', amount: 30, effectiveMonth: 'Sep' } as any);
    shirt = await SellableItem.create({ name: 'Franela', amount: 10, exchangeRateTypeId: type.id, active: true } as any);
    basic = await EnrollmentPlan.create({ schoolPeriodId: structure.period.id, targetExchangeRateTypeId: type.id, name: 'Inscripción básica', effectiveMonth: 'Sep' } as any);
    full = await EnrollmentPlan.create({ schoolPeriodId: structure.period.id, targetExchangeRateTypeId: type.id, name: 'Paquete completo', effectiveMonth: 'Sep', autoApply: false } as any);
    for (const p of [basic, full]) {
      await EnrollmentPlanItem.create({ enrollmentPlanId: p.id, itemType: 'fee', feeId: matricula.id, quantity: 1 } as any);
      await EnrollmentPlanItem.create({ enrollmentPlanId: p.id, itemType: 'fee', feeId: gastos.id, quantity: 1 } as any);
    }
    await EnrollmentPlanItem.create({ enrollmentPlanId: full.id, itemType: 'sellable_item', sellableItemId: shirt.id, quantity: 2 } as any);
    ctx = { ...structure };
  };

  it('an optional plan is never the default, and lists both plans for the student', async () => {
    await setup();
    const insc = await student();
    await generateChargesForInscription(insc.id);
    expect((await planChargesOf(insc.id)).some(c => c.type === 'item')).toBe(false);

    const info = await agent.get(`/api/ledger/inscriptions/${insc.id}/enrollment-plan`).expect(200);
    expect(info.body.currentPlanId).toBe(basic.id);
    expect(info.body.inForcePlanId).toBe(basic.id);
    expect(info.body.plans.map((p: any) => p.name)).toEqual(['Inscripción básica', 'Paquete completo']);
    expect(info.body.plans[1].items.map((i: any) => i.name)).toContain('Franela');
  });

  it('assigns the full package (dry run first), charging the uniform, then goes back and retires it', async () => {
    await setup();
    const insc = await student();
    await generateChargesForInscription(insc.id);
    const before = (await planChargesOf(insc.id)).length;

    const dry = await putPlan(insc.id, { enrollmentPlanId: full.id, dryRun: true }).expect(200);
    expect(dry.body.create.map((c: any) => c.description)).toEqual(['Franela x2']);
    expect((await planChargesOf(insc.id)).length).toBe(before);
    expect((await Charge.findOne({ where: { inscriptionId: insc.id, type: 'item' } }))).toBeNull();

    const applied = await putPlan(insc.id, { enrollmentPlanId: full.id }).expect(200);
    expect(applied.body.created).toBe(1);
    const item = (await planChargesOf(insc.id)).find(c => c.type === 'item')!;
    expect(item.quantity).toBe(2);
    expect(Number(item.amount)).toBe(20);

    // Back to the default plan (null): the unpaid uniform is retired.
    const back = await putPlan(insc.id, { enrollmentPlanId: basic.id }).expect(200);
    expect(back.body.retired).toBe(1);
    expect((await planChargesOf(insc.id)).some(c => c.type === 'item')).toBe(false);
  });

  it('keeps a uniform that already has payments, and rejects plans of another period', async () => {
    await setup();
    const insc = await student();
    await generateChargesForInscription(insc.id);
    await putPlan(insc.id, { enrollmentPlanId: full.id }).expect(200);
    const item = (await planChargesOf(insc.id)).find(c => c.type === 'item')!;
    await Payment.create({ inscriptionId: insc.id, schoolPeriodId: ctx.period.id, chargeId: item.id, amount: 5, currency: 'USD', method: 'efectivo', paymentDate: new Date() } as any);

    const back = await putPlan(insc.id, { enrollmentPlanId: null }).expect(200);
    expect(back.body.retired).toBe(0);
    expect(back.body.keptWithPayments).toBe(1);
    expect((await planChargesOf(insc.id)).some(c => c.type === 'item')).toBe(true);

    await putPlan(insc.id, { enrollmentPlanId: 999999 }).expect(400);
  });

  it('the period-wide sync respects each student\'s assigned plan', async () => {
    await setup();
    const withFull = await student();
    const regular = await student();
    await generateChargesForInscription(regular.id);
    await putPlan(withFull.id, { enrollmentPlanId: full.id }).expect(200);

    const preview = await agent.post('/api/payments/charges/preview').send({}).expect(200);
    expect(preview.body.retire.charges).toBe(0);
    expect(preview.body.generate.charges).toBe(0);
    expect((await planChargesOf(regular.id)).some(c => c.type === 'item')).toBe(false);
  });
});
