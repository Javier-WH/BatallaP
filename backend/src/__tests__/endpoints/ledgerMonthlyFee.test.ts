import request from 'supertest';
import app from '@/app';
import { Role, PersonRole, Fee, ExchangeRateType } from '@/models/index';
import { createTestUser, createAcademicStructure, createTestInscription } from '../helpers/testData';

describe('Ledger monthly fee resolution by month', () => {
  it('returns the monthly fee in force for each billing month', async () => {
    const { person: adminPerson } = await createTestUser({ username: 'ml_admin' });
    const [role] = await Role.findOrCreate({ where: { name: 'Administrador' as any }, defaults: { name: 'Administrador' as any } });
    await PersonRole.create({ personId: adminPerson.id, roleId: role.id });
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ username: 'ml_admin', password: 'password123' });

    const { period, grade, section } = await createAcademicStructure();
    const type = await ExchangeRateType.create({ code: 'USD_L', name: 'Dólar', currency: 'USD', isDefault: false, active: true } as any);
    const base = { schoolPeriodId: period.id, key: 'mensualidad' as const, name: 'Mensualidad', exchangeRateTypeId: type.id };
    await Fee.create({ ...base, amount: 55, effectiveMonth: 'Sep' } as any);
    await Fee.create({ ...base, amount: 65, effectiveMonth: 'Mar' } as any);
    const { person } = await createTestUser({ username: 'ml_student' });
    await createTestInscription(person.id, period.id, grade.id, section.id);

    const res = await agent.get(`/api/ledger/${period.id}/${grade.id}/${section.id}`).expect(200);
    const byMonth = res.body.monthlyFeeByMonth;
    expect(byMonth.Sep.amount).toBe(55);
    expect(byMonth.Feb.amount).toBe(55);
    expect(byMonth.Mar.amount).toBe(65);
    expect(byMonth.Aug.amount).toBe(65);
    expect(byMonth.Mar.currency).toBe('USD');
    expect(res.body.monthlyFee).not.toBeNull();
  });
});
