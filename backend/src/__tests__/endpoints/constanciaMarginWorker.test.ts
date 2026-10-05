import request from 'supertest';
import app from '@/app';
import { createTestUser, createTestRole } from '../helpers/testData';
import { ConstanciaTemplate, Person, PersonRole } from '@/models/index';

describe('Constancia - template margin and worker.ciudadano', () => {
  let agent: any;

  beforeEach(async () => {
    agent = request.agent(app);
    const { person } = await createTestUser({ username: 'admin' });
    const role = await createTestRole('Administrador');
    await PersonRole.create({ personId: person.id, roleId: role.id });
    await agent.post('/api/auth/login').send({ username: 'admin', password: 'password123' });
  });

  it('stores the margin with the template and defaults to 1in', async () => {
    const created = await agent.post('/api/constancias').send({ name: 'A', content: '<p>x</p>' }).expect(201);
    expect(created.body.margin).toBe('1in');

    await agent.put(`/api/constancias/${created.body.id}`).send({ margin: '1.5in' }).expect(200);
    const fetched = await agent.get(`/api/constancias/${created.body.id}`).expect(200);
    expect(fetched.body.margin).toBe('1.5in');
  });

  it('rejects margins outside the allowed presets', async () => {
    await agent.post('/api/constancias').send({ name: 'B', content: '', margin: '50in' }).expect(400);
  });

  it('returns the template margin with the preview', async () => {
    const tpl = await ConstanciaTemplate.create({ name: 'C', content: '<p>x</p>', margin: '0.5in' } as any);
    const res = await agent.post('/api/constancias/preview').send({ templateId: tpl.id }).expect(200);
    expect(res.body.margin).toBe('0.5in');
  });

  it.each([['F', 'ciudadana'], ['M', 'ciudadano']])(
    'resolves worker.ciudadano for gender %s',
    async (gender, expected) => {
      const { person } = await createTestUser({ username: `w${gender}` });
      await Person.update({ gender } as any, { where: { id: person.id } });
      const tpl = await ConstanciaTemplate.create({
        name: 'D', content: '<p>{{worker.ciudadano}}</p>',
      } as any);
      const res = await agent.post('/api/constancias/preview').send({ templateId: tpl.id, personId: person.id }).expect(200);
      expect(res.body.variables['worker.ciudadano']).toBe(expected);
    },
  );
});

describe('Constancia - variable catalog', () => {
  it('does not offer uppercase duplicates (the editor has a text-transform tool)', async () => {
    const agent = request.agent(app);
    const { person } = await createTestUser({ username: 'cat' });
    const role = await createTestRole('Administrador');
    await PersonRole.create({ personId: person.id, roleId: role.id });
    await agent.post('/api/auth/login').send({ username: 'cat', password: 'password123' });
    const res = await agent.get('/api/constancias/variables').expect(200);
    expect(res.body.filter((v: any) => /Upper/.test(v.key))).toEqual([]);
  });
});
