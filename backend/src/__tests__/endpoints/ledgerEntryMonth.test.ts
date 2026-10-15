import request from 'supertest';
import app from '@/app';
import { Charge, EnrollmentPlan, EnrollmentPlanItem, ExchangeRateType, Fee, Inscription, PersonRole } from '@/models/index';
import {
  createAcademicStructure, createTestInscription, createTestRole, createTestUser,
} from '../helpers/testData';
import { generateChargesForInscription } from '@/services/chargeScheduleService';

describe('PUT /api/ledger/inscriptions/:id/entry-month', () => {
  const login = async () => {
    const username = `em_login_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const { person } = await createTestUser({ username });
    const role = await createTestRole('Administrador');
    await PersonRole.create({ personId: person.id, roleId: role.id });
    const a = request.agent(app);
    await a.post('/api/auth/login').send({ username, password: 'password123' });
    return a;
  };

  const setup = async () => {
    const structure = await createAcademicStructure();
    const type = await ExchangeRateType.create({ code: `USD_${structure.period.id}`, name: 'Dólar', currency: 'USD', isDefault: false, active: true } as any);
    const base = { schoolPeriodId: structure.period.id, exchangeRateTypeId: type.id };
    await Fee.create({ ...base, key: 'mensualidad', name: 'Mensualidad', amount: 55, effectiveMonth: 'Sep' } as any);
    const matricula = await Fee.create({ ...base, key: 'matricula', name: 'Matrícula', amount: 100, effectiveMonth: 'Sep' } as any);
    const plan = await EnrollmentPlan.create({ schoolPeriodId: structure.period.id, targetExchangeRateTypeId: type.id, name: 'Inscripción', effectiveMonth: 'Sep' } as any);
    await EnrollmentPlanItem.create({ enrollmentPlanId: plan.id, itemType: 'fee', feeId: matricula.id, quantity: 1 } as any);
    const { person } = await createTestUser({ username: `em_student_${Date.now()}` });
    const insc = await createTestInscription(person.id, structure.period.id, structure.grade.id, structure.section.id, { entryMonth: 'Jan' });
    await generateChargesForInscription(insc.id);
    return { ...structure, insc };
  };

  it('moving the entry month earlier adds the missing monthly debts', async () => {
    const a = await login();
    const { insc } = await setup();
    expect(await Charge.count({ where: { inscriptionId: insc.id, type: 'mensualidad' } })).toBe(7);

    const res = await a.put(`/api/ledger/inscriptions/${insc.id}/entry-month`).send({ entryMonth: 'Sep' }).expect(200);
    expect(res.body.entryMonth).toBe('Sep');
    expect(res.body.generated).toBe(4); // Oct..Jan were missing

    expect((await Inscription.findByPk(insc.id))!.entryMonth).toBe('Sep');
    expect(await Charge.count({ where: { inscriptionId: insc.id, type: 'mensualidad' } })).toBe(11);
  });

  it('rejects months outside the period billing window', async () => {
    const a = await login();
    const { insc, period } = await setup();
    await period.update({ billingStartMonth: 10, billingEndMonth: 7 });
    await a.put(`/api/ledger/inscriptions/${insc.id}/entry-month`).send({ entryMonth: 'Sep' }).expect(400);
    await a.put(`/api/ledger/inscriptions/${insc.id}/entry-month`).send({ entryMonth: 'Foo' }).expect(400);
  });

  it('returns 404 for an unknown inscription', async () => {
    const a = await login();
    await a.put('/api/ledger/inscriptions/999999/entry-month').send({ entryMonth: 'Sep' }).expect(404);
  });

  it('exposes entryMonth for each student in the ledger', async () => {
    const a = await login();
    const { insc, period, grade, section } = await setup();
    const res = await a.get(`/api/ledger/${period.id}/${grade.id}/${section.id}`).expect(200);
    const row = res.body.students.find((s: any) => s.inscriptionId === insc.id);
    expect(row.entryMonth).toBe('Jan');
  });
});
