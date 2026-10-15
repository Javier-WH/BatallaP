import request from 'supertest';
import app from '@/app';
import {
  Charge, EnrollmentPlan, EnrollmentPlanItem, ExchangeRateType, Fee, Inscription, Matriculation, Payment, PersonRole,
} from '@/models/index';
import {
  createAcademicStructure, createTestRole, createTestSection, createTestUser,
} from '../helpers/testData';

const enrollPayload = (sectionId: number, extra: any = {}) => ({
  firstName: 'Test',
  lastName: 'Student',
  documentType: 'Venezolano',
  document: '12345678',
  gender: 'M',
  birthdate: '2000-01-01',
  birthState: 'GUÁRICO',
  birthMunicipality: 'JOSÉ TADEO MONAGAS',
  birthParish: 'Altagracia de Orituco',
  residenceState: 'Guárico',
  residenceMunicipality: 'José Tadeo Monagas',
  residenceParish: 'Altagracia de Orituco',
  mother: {
    firstName: 'Madre', lastName: 'Test', documentType: 'Venezolano', document: '99999999',
    phone: '0000000000', email: 'no@email.com', residenceState: 'GUÁRICO',
    residenceMunicipality: 'JOSÉ TADEO MONAGAS', residenceParish: 'ALTAGRACIA DE ORITUCO', address: 'N/A',
  },
  representativeType: 'mother',
  sectionId,
  escolaridad: 'regular',
  ...extra,
});

describe('Enrollment generates the student debts', () => {
  let agent: any;
  let structure: any;

  const configureCosts = async () => {
    const type = await ExchangeRateType.create({ code: 'USD_E', name: 'Dólar', currency: 'USD', isDefault: false, active: true } as any);
    const base = { schoolPeriodId: structure.period.id, exchangeRateTypeId: type.id };
    await Fee.create({ ...base, key: 'mensualidad', name: 'Mensualidad', amount: 55, effectiveMonth: 'Sep' } as any);
    const matricula = await Fee.create({ ...base, key: 'matricula', name: 'Matrícula', amount: 100, effectiveMonth: 'Sep' } as any);
    const plan = await EnrollmentPlan.create({ schoolPeriodId: structure.period.id, targetExchangeRateTypeId: type.id, name: 'Inscripción', effectiveMonth: 'Sep' } as any);
    await EnrollmentPlanItem.create({ enrollmentPlanId: plan.id, itemType: 'fee', feeId: matricula.id, quantity: 1 } as any);
  };

  const pendingMatriculation = async (username: string) => {
    const { person } = await createTestUser({ username });
    const alumno = await createTestRole('Alumno');
    await PersonRole.create({ personId: person.id, roleId: alumno.id });
    return Matriculation.create({
      schoolPeriodId: structure.period.id,
      gradeId: structure.grade.id,
      personId: person.id,
      status: 'pending',
      escolaridad: 'regular',
      hiddenFromControlEstudios: false,
    } as any);
  };

  beforeEach(async () => {
    agent = request.agent(app);
    const { person: admin } = await createTestUser({ username: 'admin' });
    const master = await createTestRole('Master');
    await PersonRole.create({ personId: admin.id, roleId: master.id });
    await agent.post('/api/auth/login').send({ username: 'admin', password: 'password123' });
    structure = await createAcademicStructure();
    await configureCosts();
  });

  it('matriculating a student creates enrollment + monthly debts from the chosen entry month', async () => {
    const matriculation = await pendingMatriculation('st_a');
    await agent
      .post(`/api/matriculations/${matriculation.id}/enroll`)
      .send(enrollPayload(structure.section.id, { entryMonth: 'Jan' }))
      .expect(201);

    const inscription = (await Inscription.findOne({ where: { personId: matriculation.personId } }))!;
    expect(inscription.entryMonth).toBe('Jan');

    const charges = await Charge.findAll({ where: { inscriptionId: inscription.id } });
    expect(charges.filter(c => c.type === 'matricula')).toHaveLength(1);
    expect(charges.filter(c => c.type === 'mensualidad').map(c => c.month)).toEqual(['Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug']);
  });

  it('ignores an entry month outside the billing window and falls back to the inscription date', async () => {
    const matriculation = await pendingMatriculation('st_b');
    await agent
      .post(`/api/matriculations/${matriculation.id}/enroll`)
      .send(enrollPayload(structure.section.id, { entryMonth: 'Foo' }))
      .expect(201);
    const inscription = (await Inscription.findOne({ where: { personId: matriculation.personId } }))!;
    expect(inscription.entryMonth).toMatch(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$/);
  });

  it('does not bill when the student is matriculated into a Materia Pendiente section', async () => {
    const mp = await createTestSection({ name: 'MATERIA PENDIENTE', isMateriaPendiente: true });
    const matriculation = await pendingMatriculation('st_mp');
    await agent
      .post(`/api/matriculations/${matriculation.id}/enroll`)
      .send(enrollPayload(mp.id, { entryMonth: 'Sep' }));
    const inscription = await Inscription.findOne({ where: { personId: matriculation.personId } });
    if (inscription) expect(await Charge.count({ where: { inscriptionId: inscription.id } })).toBe(0);
  });

  it('withdrawing deactivates unpaid scheduled debts but keeps those with payments; reactivating regenerates', async () => {
    const matriculation = await pendingMatriculation('st_w');
    await agent
      .post(`/api/matriculations/${matriculation.id}/enroll`)
      .send(enrollPayload(structure.section.id, { entryMonth: 'Sep' }))
      .expect(201);
    const inscription = (await Inscription.findOne({ where: { personId: matriculation.personId } }))!;

    await Payment.create({
      inscriptionId: inscription.id, schoolPeriodId: structure.period.id, month: 'Oct',
      amount: 20, currency: 'USD', method: 'efectivo', paymentDate: new Date(),
    } as any);

    await agent.post(`/api/inscriptions/${inscription.id}/withdraw`).expect(200);
    const afterWithdraw = await Charge.findAll({ where: { inscriptionId: inscription.id } });
    expect(afterWithdraw.find(c => c.month === 'Oct')!.active).toBe(true);
    expect(afterWithdraw.find(c => c.month === 'Nov')!.active).toBe(false);
    expect(afterWithdraw.find(c => c.type === 'matricula')!.active).toBe(false);

    await agent.post(`/api/inscriptions/${inscription.id}/reactivate`).expect(200);
    const afterReactivate = await Charge.findAll({ where: { inscriptionId: inscription.id } });
    expect(afterReactivate.every(c => c.active)).toBe(true);
    expect(afterReactivate).toHaveLength(afterWithdraw.length);
  });
});
