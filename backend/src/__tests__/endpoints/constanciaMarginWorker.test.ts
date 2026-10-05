import request from 'supertest';
import app from '@/app';
import { createTestUser, createTestRole, createTestSetting } from '../helpers/testData';
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

describe('Constancia - named custom fields', () => {
  it('detects custom.extra.<Name> as a custom var and fills it on preview', async () => {
    const agent = request.agent(app);
    const { person } = await createTestUser({ username: 'cf' });
    const role = await createTestRole('Administrador');
    await PersonRole.create({ personId: person.id, roleId: role.id });
    await agent.post('/api/auth/login').send({ username: 'cf', password: 'password123' });

    const tpl = await ConstanciaTemplate.create({
      name: 'E', content: '<p>Monto: {{custom.extra.MontoEnLetras}}</p>',
    } as any);

    const analysis = await agent.get(`/api/constancias/analyze/${tpl.id}`).expect(200);
    expect(analysis.body.customVars).toEqual(['extra.MontoEnLetras']);

    const res = await agent.post('/api/constancias/preview')
      .send({ templateId: tpl.id, customVars: { 'extra.MontoEnLetras': 'cien bolívares' } }).expect(200);
    expect(res.body.html).toContain('cien bolívares');
  });
});

describe('Constancia - optional images', () => {
  const sig = '<img src="data:image/png;base64,AAAA" data-wrap="front" data-toggle="FirmaDirector" style="position: absolute">';
  const anchored = '<span class="constancia-img-anchor" data-img-anchor=""><img src="data:image/png;base64,BBBB" data-wrap="front" data-anchor="text" data-toggle="SelloColegio"></span>';
  const logo = '<img src="data:image/png;base64,CCCC" data-wrap="behind">';

  async function login() {
    const agent = request.agent(app);
    const { person } = await createTestUser({ username: 'oi' });
    const role = await createTestRole('Administrador');
    await PersonRole.create({ personId: person.id, roleId: role.id });
    await agent.post('/api/auth/login').send({ username: 'oi', password: 'password123' });
    return agent;
  }

  it('lists the optional image names in the template analysis', async () => {
    const agent = await login();
    const tpl = await ConstanciaTemplate.create({ name: 'F', content: `<p>${sig}</p><p>${anchored}</p><p>${logo}</p>` } as any);
    const res = await agent.get(`/api/constancias/analyze/${tpl.id}`).expect(200);
    expect(res.body.imageToggles).toEqual(['FirmaDirector', 'SelloColegio']);
  });

  it('removes only the unchecked optional images (and their anchor wrapper)', async () => {
    const agent = await login();
    const tpl = await ConstanciaTemplate.create({ name: 'G', content: `<p>${sig}</p><p>${anchored}</p><p>${logo}</p>` } as any);
    const res = await agent.post('/api/constancias/preview')
      .send({ templateId: tpl.id, imageToggles: { FirmaDirector: false, SelloColegio: false } }).expect(200);
    expect(res.body.html).not.toContain('AAAA');
    expect(res.body.html).not.toContain('BBBB');
    expect(res.body.html).not.toContain('data-img-anchor');
    expect(res.body.html).toContain('CCCC'); // non-optional image always stays
  });

  it('keeps optional images by default and when checked', async () => {
    const agent = await login();
    const tpl = await ConstanciaTemplate.create({ name: 'H', content: `<p>${sig}</p>` } as any);
    const none = await agent.post('/api/constancias/preview').send({ templateId: tpl.id }).expect(200);
    expect(none.body.html).toContain('AAAA');
    const on = await agent.post('/api/constancias/preview')
      .send({ templateId: tpl.id, imageToggles: { FirmaDirector: true } }).expect(200);
    expect(on.body.html).toContain('AAAA');
  });
});

describe('Constancia - institution codes', () => {
  it('institution.code is the DEA code and institution.educationCode is the modality code', async () => {
    const agent = request.agent(app);
    const { person } = await createTestUser({ username: 'ic' });
    const role = await createTestRole('Administrador');
    await PersonRole.create({ personId: person.id, roleId: role.id });
    await agent.post('/api/auth/login').send({ username: 'ic', password: 'password123' });
    await createTestSetting('institution_dea_code', 'OD01234567');
    await createTestSetting('institution_code', '31059');

    const tpl = await ConstanciaTemplate.create({
      name: 'I', content: '<p>{{institution.code}} / {{institution.educationCode}}</p>',
    } as any);
    const res = await agent.post('/api/constancias/preview').send({ templateId: tpl.id, personId: person.id }).expect(200);
    expect(res.body.variables['institution.code']).toBe('OD01234567');
    expect(res.body.variables['institution.educationCode']).toBe('31059');
  });
});
