import request from 'supertest';
import app from '@/app';
import { Role, PersonRole, GuardianProfile, StudentGuardian } from '@/models/index';
import {
  createTestUser,
  createAcademicStructure,
  createTestInscription,
} from '../helpers/testData';

// The expanded student row shows the real representative (contact + other
// represented students). Placeholder profiles from imported data ("PLACEHOLDER
// CAPTAIN", or any profile with a ≤1-digit document) must never surface.
describe('GET /api/ledger — student guardians', () => {
  let agent: any;
  let structure: any;

  const profile = (over: any = {}) => GuardianProfile.create({
    firstName: 'María', lastName: 'Pérez', documentType: 'Venezolano', document: '12345678',
    phone: '0414-1112222', email: 'maria@example.com',
    residenceState: 'Lara', residenceMunicipality: 'Iribarren', residenceParish: 'Catedral',
    address: 'Calle 1', ...over,
  } as any);

  beforeEach(async () => {
    agent = request.agent(app);
    const { person: admin } = await createTestUser({ username: 'ledger_guardian_admin' });
    const [role] = await Role.findOrCreate({ where: { name: 'Administrador' as any } });
    await PersonRole.create({ personId: admin.id, roleId: role.id });
    await agent.post('/api/auth/login').send({ username: 'ledger_guardian_admin', password: 'password123' });
    structure = await createAcademicStructure();
  });

  const ledger = () => agent.get(`/api/ledger/${structure.period.id}/${structure.grade.id}/${structure.section.id}`).expect(200);

  it('returns the guardian contact, merged relationships, and other represented students', async () => {
    const { person: s1 } = await createTestUser({ username: 'lg_s1' });
    const insc1 = await createTestInscription(s1.id, structure.period.id, structure.grade.id, structure.section.id);
    const { person: s2 } = await createTestUser({ username: 'lg_s2' });
    await createTestInscription(s2.id, structure.period.id, structure.grade.id, structure.section.id);

    const prof = await profile();
    // The same person can hold two relationships with one student — they merge.
    await StudentGuardian.create({ studentId: s1.id, guardianId: prof.id, relationship: 'mother', isRepresentative: true });
    await StudentGuardian.create({ studentId: s1.id, guardianId: prof.id, relationship: 'representative', isRepresentative: true });
    await StudentGuardian.create({ studentId: s2.id, guardianId: prof.id, relationship: 'mother', isRepresentative: false });

    const res = await ledger();
    const st = res.body.students.find((s: any) => s.inscriptionId === insc1.id);
    expect(st.guardians).toHaveLength(1);
    const g = st.guardians[0];
    expect(g.firstName).toBe('MARÍA');
    expect(g.lastName).toBe('PÉREZ');
    expect(g.relationships).toEqual(expect.arrayContaining(['mother', 'representative']));
    expect(g.phone).toBe('0414-1112222');
    expect(g.email).toBe('maria@example.com');

    expect(g.alsoRepresents).toHaveLength(1);
    expect(g.alsoRepresents[0].personId).toBe(s2.id);
    expect(g.alsoRepresents[0].where).toContain(structure.grade.name);

    // The sibling's card shows the first student in return.
    const st2 = res.body.students.find((s: any) => s.personId === s2.id);
    expect(st2.guardians[0].alsoRepresents.map((x: any) => x.personId)).toEqual([s1.id]);
  });

  it('filters placeholder profiles by marker name or a too-short document', async () => {
    const { person: s1 } = await createTestUser({ username: 'lg_fake1' });
    const insc1 = await createTestInscription(s1.id, structure.period.id, structure.grade.id, structure.section.id);
    const { person: s2 } = await createTestUser({ username: 'lg_fake2' });
    const insc2 = await createTestInscription(s2.id, structure.period.id, structure.grade.id, structure.section.id);

    const byName = await profile({ firstName: 'PLACEHOLDER', lastName: 'CAPTAIN', document: '123456' });
    const byDoc = await profile({ firstName: 'Juan', lastName: 'Real', document: '7' });
    await StudentGuardian.create({ studentId: s1.id, guardianId: byName.id, relationship: 'representative', isRepresentative: true });
    await StudentGuardian.create({ studentId: s2.id, guardianId: byDoc.id, relationship: 'representative', isRepresentative: true });

    const res = await ledger();
    expect(res.body.students.find((s: any) => s.inscriptionId === insc1.id).guardians).toHaveLength(0);
    expect(res.body.students.find((s: any) => s.inscriptionId === insc2.id).guardians).toHaveLength(0);
  });
});
