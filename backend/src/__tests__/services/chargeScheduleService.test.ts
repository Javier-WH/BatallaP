import {
  Charge, EnrollmentPlan, EnrollmentPlanItem, ExchangeRateType, Fee, SellableItem,
} from '@/models/index';
import { generateChargesForInscription } from '@/services/chargeScheduleService';
import {
  createAcademicStructure, createTestInscription, createTestSection, createTestUser,
} from '../helpers/testData';

const MONTHLY_ALL = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'];

async function setup(opts: { withPlan?: boolean; withMonthly?: boolean } = {}) {
  const { withPlan = true, withMonthly = true } = opts;
  const { period, grade, section } = await createAcademicStructure();
  const type = await ExchangeRateType.create({ code: `USD_${period.id}`, name: 'Dólar', currency: 'USD', isDefault: false, active: true } as any);
  const base = { schoolPeriodId: period.id, exchangeRateTypeId: type.id };

  if (withMonthly) {
    await Fee.create({ ...base, key: 'mensualidad', name: 'Mensualidad', amount: 55, effectiveMonth: 'Sep' } as any);
    await Fee.create({ ...base, key: 'mensualidad', name: 'Mensualidad', amount: 65, effectiveMonth: 'Mar' } as any);
  }
  const matricula = await Fee.create({ ...base, key: 'matricula', name: 'Matrícula', amount: 100, effectiveMonth: 'Sep' } as any);
  const gastos = await Fee.create({ ...base, key: 'gastos_administrativos', name: 'Gastos Administrativos', amount: 20, effectiveMonth: 'Sep' } as any);

  let plan: EnrollmentPlan | null = null;
  if (withPlan) {
    plan = await EnrollmentPlan.create({ schoolPeriodId: period.id, targetExchangeRateTypeId: type.id, name: 'Inscripción', effectiveMonth: 'Sep' } as any);
    await EnrollmentPlanItem.create({ enrollmentPlanId: plan.id, itemType: 'fee', feeId: matricula.id, quantity: 1 } as any);
    await EnrollmentPlanItem.create({ enrollmentPlanId: plan.id, itemType: 'fee', feeId: gastos.id, quantity: 1 } as any);
  }
  return { period, grade, section, type, matricula, gastos, plan };
}

let n = 0;
async function enroll(ctx: { period: any; grade: any; section: any }, over: any = {}, sectionId?: number) {
  n += 1;
  const { person } = await createTestUser({ username: `sched_${n}_${Date.now()}` });
  return createTestInscription(person.id, ctx.period.id, ctx.grade.id, sectionId ?? ctx.section.id, over);
}

const chargesOf = (inscriptionId: number) => Charge.findAll({ where: { inscriptionId }, order: [['id', 'ASC']] });

describe('generateChargesForInscription', () => {
  it('Sep entry: plan items + 11 monthly charges (first month covered by enrollment) with the fee version of each month', async () => {
    const ctx = await setup();
    const insc = await enroll(ctx, { entryMonth: 'Sep' });

    const res = await generateChargesForInscription(insc.id);
    expect(res.created).toBe(13);

    const charges = await chargesOf(insc.id);
    expect(charges.every(c => c.source === 'schedule' && c.active)).toBe(true);

    const matricula = charges.find(c => c.type === 'matricula')!;
    expect(Number(matricula.amount)).toBe(100);
    expect(matricula.month).toBeNull();
    expect(charges.find(c => c.type === 'gastos_administrativos')!.amount).toBeDefined();

    const monthly = charges.filter(c => c.type === 'mensualidad');
    expect(monthly.map(c => c.month)).toEqual(MONTHLY_ALL);
    expect(Number(monthly.find(c => c.month === 'Feb')!.amount)).toBe(55);
    expect(Number(monthly.find(c => c.month === 'Mar')!.amount)).toBe(65);
    expect(monthly[0].currency).toBe('USD');
  });

  it('January entry: plan items + 7 monthly charges (Feb→Aug)', async () => {
    const ctx = await setup();
    const insc = await enroll(ctx, { entryMonth: 'Jan' });
    await generateChargesForInscription(insc.id);

    const monthly = (await chargesOf(insc.id)).filter(c => c.type === 'mensualidad');
    expect(monthly.map(c => c.month)).toEqual(['Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug']);
  });

  it('null entryMonth means the student is charged since the first month of the period', async () => {
    const ctx = await setup();
    const insc = await enroll(ctx);
    await generateChargesForInscription(insc.id);
    const monthly = (await chargesOf(insc.id)).filter(c => c.type === 'mensualidad');
    expect(monthly).toHaveLength(11);
  });

  it('resolves plan fee items by key at the entry month (later fee version applies)', async () => {
    const ctx = await setup();
    await Fee.create({ schoolPeriodId: ctx.period.id, exchangeRateTypeId: ctx.type.id, key: 'matricula', name: 'Matrícula', amount: 150, effectiveMonth: 'Mar' } as any);
    const insc = await enroll(ctx, { entryMonth: 'Apr' });
    await generateChargesForInscription(insc.id);
    const matricula = (await chargesOf(insc.id)).find(c => c.type === 'matricula')!;
    expect(Number(matricula.amount)).toBe(150);
  });

  it('charges sellable plan items with quantity', async () => {
    const ctx = await setup();
    const item = await SellableItem.create({ name: 'Uniforme', amount: 30, exchangeRateTypeId: ctx.type.id } as any);
    await EnrollmentPlanItem.create({ enrollmentPlanId: ctx.plan!.id, itemType: 'sellable_item', sellableItemId: item.id, quantity: 2 } as any);
    const insc = await enroll(ctx, { entryMonth: 'Sep' });
    await generateChargesForInscription(insc.id);

    const charge = (await chargesOf(insc.id)).find(c => c.type === 'item')!;
    expect(Number(charge.amount)).toBe(60);
    expect(charge.sellableItemId).toBe(item.id);
  });

  it('does not generate debt for Materia Pendiente sections', async () => {
    const ctx = await setup();
    const mp = await createTestSection({ name: 'MATERIA PENDIENTE', isMateriaPendiente: true });
    const insc = await enroll(ctx, { entryMonth: 'Sep', escolaridad: 'materia_pendiente' }, mp.id);

    const res = await generateChargesForInscription(insc.id);
    expect(res.excludedMateriaPendiente).toBe(true);
    expect(res.created).toBe(0);
    expect(await chargesOf(insc.id)).toHaveLength(0);
  });

  it.each(['regular', 'repitiente', 'transferencia'])('escolaridad %s is billed like any other inscription', async (escolaridad) => {
    const ctx = await setup();
    const insc = await enroll(ctx, { entryMonth: 'Sep', escolaridad });
    const res = await generateChargesForInscription(insc.id);
    expect(res.created).toBe(13);
  });

  it('a MP-like escolaridad in a regular section is still billed (escolaridad is never used to filter)', async () => {
    const ctx = await setup();
    const insc = await enroll(ctx, { entryMonth: 'Sep', escolaridad: 'materia_pendiente' });
    const res = await generateChargesForInscription(insc.id);
    expect(res.excludedMateriaPendiente).toBe(false);
    expect(res.created).toBe(13);
  });

  it('is idempotent: a second run creates nothing', async () => {
    const ctx = await setup();
    const insc = await enroll(ctx, { entryMonth: 'Sep' });
    await generateChargesForInscription(insc.id);
    const second = await generateChargesForInscription(insc.id);
    expect(second.created).toBe(0);
    expect(second.skipped).toBe(13);
    expect(await chargesOf(insc.id)).toHaveLength(13);
  });

  it('reactivates previously deactivated scheduled charges instead of duplicating them', async () => {
    const ctx = await setup();
    const insc = await enroll(ctx, { entryMonth: 'Sep' });
    await generateChargesForInscription(insc.id);
    await Charge.update({ active: false }, { where: { inscriptionId: insc.id, month: 'Oct' } });

    const res = await generateChargesForInscription(insc.id);
    expect(res.reactivated).toBe(1);
    const oct = (await chargesOf(insc.id)).find(c => c.month === 'Oct')!;
    expect(oct.active).toBe(true);
    expect(await chargesOf(insc.id)).toHaveLength(13);
  });

  it('warns when there is no enrollment plan in force, but still bills monthly fees', async () => {
    const ctx = await setup({ withPlan: false });
    const insc = await enroll(ctx, { entryMonth: 'Sep' });
    const res = await generateChargesForInscription(insc.id);
    expect(res.warnings.some(w => /plan de inscripción/i.test(w))).toBe(true);
    expect(res.created).toBe(11);
  });

  it('warns and skips months without a monthly fee in force', async () => {
    const ctx = await setup({ withMonthly: false });
    await Fee.create({ schoolPeriodId: ctx.period.id, exchangeRateTypeId: ctx.type.id, key: 'mensualidad', name: 'Mensualidad', amount: 70, effectiveMonth: 'Mar' } as any);
    const insc = await enroll(ctx, { entryMonth: 'Sep' });
    const res = await generateChargesForInscription(insc.id);

    const monthly = (await chargesOf(insc.id)).filter(c => c.type === 'mensualidad');
    expect(monthly.map(c => c.month)).toEqual(['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug']);
    expect(res.warnings.length).toBeGreaterThan(0);
  });

  it('never touches manual charges', async () => {
    const ctx = await setup();
    const insc = await enroll(ctx, { entryMonth: 'Sep' });
    await Charge.create({ inscriptionId: insc.id, schoolPeriodId: ctx.period.id, type: 'otro', description: 'Daño', amount: 10, currency: 'USD' } as any);
    await generateChargesForInscription(insc.id);
    const manual = (await chargesOf(insc.id)).filter(c => c.source === 'manual');
    expect(manual).toHaveLength(1);
  });

  it('does not bill withdrawn inscriptions', async () => {
    const ctx = await setup();
    const insc = await enroll(ctx, { entryMonth: 'Sep', withdrawnAt: new Date() });
    const res = await generateChargesForInscription(insc.id);
    expect(res.created).toBe(0);
  });

  it("bills plan items in the plan's target currency under same_amount (55 USD → 55 EUR)", async () => {
    const ctx = await setup();
    const eurType = await ExchangeRateType.create({ code: `EUR_${ctx.period.id}`, name: 'Euro', currency: 'EUR', isDefault: false, active: true } as any);
    await ctx.plan!.update({ targetExchangeRateTypeId: eurType.id, conversionMode: 'same_amount' } as any);
    const insc = await enroll(ctx, { entryMonth: 'Sep' });
    await generateChargesForInscription(insc.id);

    const charges = await chargesOf(insc.id);
    const planCharges = charges.filter(c => c.scheduleKey?.startsWith('plan:'));
    expect(planCharges.every(c => c.currency === 'EUR')).toBe(true);
    expect(Number(charges.find(c => c.type === 'matricula')!.amount)).toBe(100);
    expect(Number(charges.find(c => c.type === 'gastos_administrativos')!.amount)).toBe(20);
    // Monthly fees are not plan items: they keep the fee's own currency.
    expect(charges.filter(c => c.scheduleKey?.startsWith('mensualidad:')).every(c => c.currency === 'USD')).toBe(true);
  });

  it('converts plan items through bolívares under exchange_rate mode', async () => {
    const ctx = await setup();
    const { ExchangeRate } = await import('@/models/index');
    const eurType = await ExchangeRateType.create({ code: `EUR_${ctx.period.id}`, name: 'Euro', currency: 'EUR', isDefault: true, active: true } as any);
    const today = new Date().toISOString().slice(0, 10);
    // USD at 100 VES, EUR at 200 VES → a 100 USD item becomes 50 EUR.
    await ExchangeRate.create({ exchangeRateTypeId: ctx.type.id, date: today, rate: 100 } as any);
    await ExchangeRate.create({ exchangeRateTypeId: eurType.id, date: today, rate: 200 } as any);
    await ctx.plan!.update({ targetExchangeRateTypeId: eurType.id, conversionMode: 'exchange_rate' } as any);
    const insc = await enroll(ctx, { entryMonth: 'Sep' });
    await generateChargesForInscription(insc.id);

    const charges = await chargesOf(insc.id);
    const matricula = charges.find(c => c.type === 'matricula')!;
    expect(matricula.currency).toBe('EUR');
    expect(Number(matricula.amount)).toBe(50);
    const gastos = charges.find(c => c.type === 'gastos_administrativos')!;
    expect(gastos.currency).toBe('EUR');
    expect(Number(gastos.amount)).toBe(10);
  });

  it('exchange_rate mode keeps the item currency and warns when a rate is missing', async () => {
    const ctx = await setup();
    const eurType = await ExchangeRateType.create({ code: `EUR_${ctx.period.id}`, name: 'Euro', currency: 'EUR', isDefault: true, active: true } as any);
    await ctx.plan!.update({ targetExchangeRateTypeId: eurType.id, conversionMode: 'exchange_rate' } as any);
    const insc = await enroll(ctx, { entryMonth: 'Sep' });
    const res = await generateChargesForInscription(insc.id);

    const charges = await chargesOf(insc.id);
    expect(charges.find(c => c.type === 'matricula')!.currency).toBe('USD');
    expect(res.warnings.some(w => /convertir USD a EUR/i.test(w))).toBe(true);
  });
});
