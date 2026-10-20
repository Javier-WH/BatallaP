import request from 'supertest';
import app from '@/app';
import { Role, PersonRole, Payment } from '@/models/index';
import { createTestUser, createAcademicStructure, createTestInscription } from '../helpers/testData';

// "Resumen de movimientos": flat list of payments with date filter and the
// registering administrator on every row.
describe('GET /api/ledger/payments/report', () => {
  let agent: any;
  let adminId: number;
  let inscriptionId: number;
  let periodId: number;

  const mkPayment = (paymentDate: string, over: any = {}) => Payment.create({
    inscriptionId, schoolPeriodId: periodId, month: null, amount: 50, currency: 'USD', method: 'efectivo',
    paymentDate: new Date(`${paymentDate}T12:00:00Z`), registeredByPersonId: adminId, ...over,
  } as any);

  beforeEach(async () => {
    agent = request.agent(app);
    const { person: admin } = await createTestUser({ username: 'report_admin', firstName: 'Javier', lastName: 'Maestro' } as any);
    adminId = admin.id;
    const [role] = await Role.findOrCreate({ where: { name: 'Administrador' as any } });
    await PersonRole.create({ personId: admin.id, roleId: role.id });
    await agent.post('/api/auth/login').send({ username: 'report_admin', password: 'password123' });

    const structure = await createAcademicStructure();
    periodId = structure.period.id;
    const { person } = await createTestUser({ username: 'report_student' });
    inscriptionId = (await createTestInscription(person.id, periodId, structure.grade.id, structure.section.id)).id;
  });

  it('lists payments newest first with student, grade and registering user', async () => {
    await mkPayment('2026-08-10');
    await mkPayment('2026-09-15', { amount: 70000, currency: 'VES', amountVES: 70000, method: 'transferencia' });

    const res = await agent.get('/api/ledger/payments/report').expect(200);
    expect(res.body.rows).toHaveLength(2);
    expect(res.body.rows[0].currency).toBe('VES');
    expect(res.body.rows[0].registeredBy).toBe('JAVIER MAESTRO');
    expect(res.body.rows[0].registeredById).toBe(adminId);
    expect(res.body.rows[0].gradeName).toBeTruthy();
    expect(res.body.registrants.map((r: any) => r.id)).toEqual([adminId]);
    expect(res.body.truncated).toBe(false);
  });

  it('filters by an inclusive date range', async () => {
    await mkPayment('2026-08-10');
    await mkPayment('2026-09-15');
    await mkPayment('2026-10-20');

    const res = await agent.get('/api/ledger/payments/report?from=2026-09-01&to=2026-09-15').expect(200);
    expect(res.body.rows).toHaveLength(1);
    expect(res.body.rows[0].paymentDate).toContain('2026-09-15');

    const open = await agent.get('/api/ledger/payments/report?from=2026-09-16').expect(200);
    expect(open.body.rows).toHaveLength(1);
    expect(open.body.rows[0].paymentDate).toContain('2026-10-20');
  });

  it('rejects malformed dates', async () => {
    await agent.get('/api/ledger/payments/report?from=15/09/2026').expect(400);
  });
});
