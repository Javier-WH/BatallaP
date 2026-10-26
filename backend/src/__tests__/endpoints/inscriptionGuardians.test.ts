import request from 'supertest';
import app from '@/app';
import { createTestUser, createTestRole, createAcademicStructure, createTestInscription } from '../helpers/testData';
import { PersonRole, StudentGuardian, GuardianProfile } from '@/models/index';

const full = (firstName: string, document: string, extra: Record<string, unknown> = {}) => ({
  firstName, lastName: 'Medina', documentType: 'Venezolano', document, phone: '0414-1234567', whatsapp: '0414-1234567', email: '',
  residenceState: 'Miranda', residenceMunicipality: 'Sucre', residenceParish: 'Petare', address: 'Calle 1', ...extra,
});

describe('Edit student: guardians and benefactor', () => {
  let agent: any;
  let studentId: number;
  let inscriptionId: number;

  const save = (body: Record<string, unknown>) =>
    agent.put(`/api/inscriptions/${inscriptionId}`).send({ representativeType: 'mother', mother: full('Maria', '22222222'), ...body });
  const links = async () => {
    const rows = await StudentGuardian.findAll({ where: { studentId }, include: [{ model: GuardianProfile, as: 'profile' }], order: [['id', 'ASC']] });
    return rows.map((r: any) => ({ rel: r.relationship, rep: r.isRepresentative, benefactor: r.isBenefactor, doc: r.profile.document }));
  };

  beforeEach(async () => {
    agent = request.agent(app);
    const { person } = await createTestUser({ username: 'admin' });
    await PersonRole.create({ personId: person.id, roleId: (await createTestRole('Master')).id });
    await agent.post('/api/auth/login').send({ username: 'admin', password: 'password123' });
    const structure = await createAcademicStructure();
    const { person: kid } = await createTestUser({ username: 'kid' });
    await PersonRole.create({ personId: kid.id, roleId: (await createTestRole('Alumno')).id });
    studentId = kid.id;
    inscriptionId = (await createTestInscription(kid.id, structure.period.id, structure.grade.id, structure.section.id)).id;
  });

  describe('optional guardians', () => {
    it('saves a complete optional parent next to the representative', async () => {
      await save({ father: full('Pedro', '11111111') }).expect(200);
      expect(await links()).toEqual([
        { rel: 'mother', rep: true, benefactor: false, doc: '22222222' },
        { rel: 'father', rep: false, benefactor: false, doc: '11111111' },
      ]);
    });

    it('ignores an optional card that only holds a default document type or an unchecked box', async () => {
      await save({ father: { documentType: 'Venezolano', isBenefactor: false } }).expect(200);
      await save({ father: { firstName: '  ', lastName: '', document: '', documentType: 'Venezolano' } }).expect(200);
      expect(await links()).toEqual([{ rel: 'mother', rep: true, benefactor: false, doc: '22222222' }]);
    });

    it('saves an optional parent with only the minimum: names and document', async () => {
      await save({ father: { firstName: 'Pedro', lastName: 'Medina', documentType: 'Venezolano', document: '11111111' } }).expect(200);
      const father = (await links()).find(l => l.rel === 'father');
      expect(father?.doc).toBe('11111111');
    });

    it('answers 400 with what is missing instead of failing, and keeps everything as it was', async () => {
      await save({}).expect(200);
      const res = await save({ father: { firstName: 'Pedro' } }).expect(400);
      expect(res.body.error).toMatch(/padre/);
      expect(res.body.error).toMatch(/apellidos/);
      expect(res.body.error).toMatch(/documento/);
      expect(await links()).toEqual([{ rel: 'mother', rep: true, benefactor: false, doc: '22222222' }]);
    });
  });

  describe('benefactor', () => {
    it('flags the father as the one who pays', async () => {
      await save({ father: full('Pedro', '11111111', { isBenefactor: true }) }).expect(200);
      expect((await links()).find(l => l.rel === 'father')?.benefactor).toBe(true);
    });

    it('stores a third person as the benefactor', async () => {
      await save({ benefactor: full('Carlos', '33333333') }).expect(200);
      expect(await links()).toEqual([
        { rel: 'mother', rep: true, benefactor: false, doc: '22222222' },
        { rel: 'benefactor', rep: false, benefactor: true, doc: '33333333' },
      ]);
    });

    it('rejects two benefactors', async () => {
      const res = await save({
        mother: full('Maria', '22222222', { isBenefactor: true }), benefactor: full('Carlos', '33333333'),
      }).expect(400);
      expect(res.body.error).toMatch(/benefactor/i);
    });

    it('clears the benefactor when the form says so, and keeps it when the request does not mention it', async () => {
      await save({ father: full('Pedro', '11111111', { isBenefactor: true }) }).expect(200);
      // A save that knows nothing about the benefactor (other screens) must not erase it.
      await save({ father: full('Pedro', '11111111') }).expect(200);
      expect((await links()).find(l => l.rel === 'father')?.benefactor).toBe(true);
      await agent.put(`/api/inscriptions/${inscriptionId}`).send({ gender: 'M' }).expect(200);
      expect((await links()).find(l => l.rel === 'father')?.benefactor).toBe(true);
      // The form states it explicitly: unchecked.
      await save({ father: full('Pedro', '11111111', { isBenefactor: false }) }).expect(200);
      expect((await links()).find(l => l.rel === 'father')?.benefactor).toBe(false);
    });
  });

  describe('shared payments', () => {
    it('links two students that share only the benefactor', async () => {
      const structure = await createAcademicStructure();
      const { person: kid2 } = await createTestUser({ username: 'kid2' });
      await PersonRole.create({ personId: kid2.id, roleId: (await createTestRole('Alumno')).id });
      const ins2 = await createTestInscription(kid2.id, structure.period.id, structure.grade.id, structure.section.id);

      await save({ benefactor: full('Carlos', '33333333') }).expect(200);
      await agent.put(`/api/inscriptions/${ins2.id}`).send({
        representativeType: 'mother', mother: full('Ana', '44444444'), benefactor: full('Carlos', '33333333'),
      }).expect(200);

      const res = await agent.get(`/api/ledger/inscriptions/${inscriptionId}/shared-students?schoolPeriodId=${structure.period.id}`).expect(200);
      expect(res.body.map((s: any) => s.inscriptionId)).toEqual([ins2.id]);
    });
  });
});
