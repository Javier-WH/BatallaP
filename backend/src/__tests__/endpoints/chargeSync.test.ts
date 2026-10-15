import request from 'supertest';
import app from '@/app';
import {
  Charge, EnrollmentPlan, EnrollmentPlanItem, ExchangeRateType, Fee, PersonRole, Payment,
} from '@/models/index';
import {
  createAcademicStructure, createTestInscription, createTestRole, createTestSection, createTestUser,
} from '../helpers/testData';
import { generateChargesForInscription } from '@/services/chargeScheduleService';

describe('Period charge sync (preview / apply)', () => {
  let agent: any;
  let ctx: any;
  let n = 0;

  const loginAs = async (username: string, roleName: string) => {
    const { person } = await createTestUser({ username });
    const role = await createTestRole(roleName as any);
    await PersonRole.create({ personId: person.id, roleId: role.id });
    const a = request.agent(app);
    await a.post('/api/auth/login').send({ username, password: 'password123' });
    return a;
  };

  const student = async (over: any = {}, sectionId?: number) => {
    n += 1;
    const { person } = await createTestUser({ username: `sync_${n}_${Date.now()}` });
    return createTestInscription(person.id, ctx.period.id, ctx.grade.id, sectionId ?? ctx.section.id, over);
  };

  const chargesOf = (inscriptionId: number) => Charge.findAll({ where: { inscriptionId }, order: [['id', 'ASC']] });

  beforeEach(async () => {
    agent = await loginAs(`sync_admin_${Date.now()}`, 'Administrador');
    const structure = await createAcademicStructure();
    await structure.period.update({ status: 'activo' });
    const type = await ExchangeRateType.create({ code: `USD_${structure.period.id}`, name: 'Dólar', currency: 'USD', isDefault: false, active: true } as any);
    const base = { schoolPeriodId: structure.period.id, exchangeRateTypeId: type.id };
    const mensualidad = await Fee.create({ ...base, key: 'mensualidad', name: 'Mensualidad', amount: 55, effectiveMonth: 'Sep' } as any);
    const matricula = await Fee.create({ ...base, key: 'matricula', name: 'Matrícula', amount: 100, effectiveMonth: 'Sep' } as any);
    const plan = await EnrollmentPlan.create({ schoolPeriodId: structure.period.id, targetExchangeRateTypeId: type.id, name: 'Inscripción', effectiveMonth: 'Sep' } as any);
    await EnrollmentPlanItem.create({ enrollmentPlanId: plan.id, itemType: 'fee', feeId: matricula.id, quantity: 1 } as any);
    ctx = { ...structure, type, base, mensualidad, matricula, plan };
  });

  it('previews and applies generation for inscriptions that have no debts yet', async () => {
    const a = await student({ entryMonth: 'Sep' });
    const b = await student({ entryMonth: 'Jan' });

    const preview = await agent.post('/api/payments/charges/preview').send({}).expect(200);
    expect(preview.body.schoolPeriodId).toBe(ctx.period.id);
    expect(preview.body.generate.inscriptions).toBe(2);
    expect(preview.body.generate.charges).toBe((1 + 11) + (1 + 7));
    expect(preview.body.generate.amountByCurrency.USD).toBe(100 * 2 + 55 * 18);
    // preview must not write anything
    expect(await Charge.count()).toBe(0);

    const applied = await agent.post('/api/payments/charges/apply').send({}).expect(200);
    expect(applied.body.created).toBe(20);
    expect((await chargesOf(a.id)).length).toBe(12);
    expect((await chargesOf(b.id)).length).toBe(8);

    const again = await agent.post('/api/payments/charges/preview').send({}).expect(200);
    expect(again.body.generate.charges).toBe(0);
    expect(again.body.sync.charges).toBe(0);
  });

  it('a new fee version updates unpaid/partially paid months from its month, never fully paid or earlier ones', async () => {
    const insc = await student({ entryMonth: 'Sep' });
    await generateChargesForInscription(insc.id);

    // Mar: fully paid, Apr: partially paid, May+: unpaid
    await Payment.create({ inscriptionId: insc.id, schoolPeriodId: ctx.period.id, month: 'Mar', amount: 55, currency: 'USD', method: 'efectivo', paymentDate: new Date() } as any);
    await Payment.create({ inscriptionId: insc.id, schoolPeriodId: ctx.period.id, month: 'Apr', amount: 20, currency: 'USD', method: 'efectivo', paymentDate: new Date() } as any);

    await Fee.create({ ...ctx.base, key: 'mensualidad', name: 'Mensualidad', amount: 65, effectiveMonth: 'Mar' } as any);

    const preview = await agent.post('/api/payments/charges/preview').send({}).expect(200);
    expect(preview.body.sync.charges).toBe(5); // Apr..Aug
    expect(preview.body.sync.skippedPaid).toBe(1); // Mar

    const applied = await agent.post('/api/payments/charges/apply').send({}).expect(200);
    expect(applied.body.updated).toBe(5);

    const byMonth = Object.fromEntries((await chargesOf(insc.id)).filter(c => c.type === 'mensualidad').map(c => [c.month, Number(c.amount)]));
    expect(byMonth.Feb).toBe(55);
    expect(byMonth.Mar).toBe(55); // fully paid → untouched
    expect(byMonth.Apr).toBe(65); // partial → updated, balance recalculates
    expect(byMonth.Aug).toBe(65);
  });

  it('updates an unpaid enrollment charge when the plan fee changes, leaving manual debts alone', async () => {
    const insc = await student({ entryMonth: 'Sep' });
    await generateChargesForInscription(insc.id);
    const manual = await Charge.create({ inscriptionId: insc.id, schoolPeriodId: ctx.period.id, type: 'otro', description: 'Daño', amount: 10, currency: 'USD' } as any);
    await ctx.matricula.update({ amount: 120 });

    await agent.post('/api/payments/charges/apply').send({}).expect(200);

    const matricula = (await chargesOf(insc.id)).find(c => c.type === 'matricula')!;
    expect(Number(matricula.amount)).toBe(120);
    expect(Number((await Charge.findByPk(manual.id))!.amount)).toBe(10);
  });

  it('skips Materia Pendiente and withdrawn inscriptions and reports the exclusions', async () => {
    const mp = await createTestSection({ name: 'MATERIA PENDIENTE', isMateriaPendiente: true });
    const mpInsc = await student({ entryMonth: 'Sep' }, mp.id);
    const withdrawn = await student({ entryMonth: 'Sep', withdrawnAt: new Date() });
    const normal = await student({ entryMonth: 'Sep' });

    const preview = await agent.post('/api/payments/charges/preview').send({}).expect(200);
    expect(preview.body.generate.inscriptions).toBe(1);
    expect(preview.body.excludedMateriaPendiente).toBe(1);

    await agent.post('/api/payments/charges/apply').send({}).expect(200);
    expect(await chargesOf(mpInsc.id)).toHaveLength(0);
    expect(await chargesOf(withdrawn.id)).toHaveLength(0);
    expect((await chargesOf(normal.id)).length).toBe(12);
  });

  it('reports missing configuration as warnings with counts', async () => {
    await ctx.plan.update({ active: false });
    await student({ entryMonth: 'Sep' });
    await student({ entryMonth: 'Sep' });
    const preview = await agent.post('/api/payments/charges/preview').send({}).expect(200);
    const w = preview.body.warnings.find((x: any) => /plan de inscripción/i.test(x.message));
    expect(w.count).toBe(2);
  });

  it('only works on the active (or preinscription) period', async () => {
    await ctx.period.update({ status: 'historico' });
    await agent.post('/api/payments/charges/preview').send({ schoolPeriodId: ctx.period.id }).expect(400);
    await agent.post('/api/payments/charges/apply').send({ schoolPeriodId: ctx.period.id }).expect(400);
  });

  it('requires Master/Administrador', async () => {
    const profesor = await loginAs(`sync_prof_${Date.now()}`, 'Profesor');
    await profesor.post('/api/payments/charges/preview').send({}).expect(403);
    await profesor.post('/api/payments/charges/apply').send({}).expect(403);
  });
});
