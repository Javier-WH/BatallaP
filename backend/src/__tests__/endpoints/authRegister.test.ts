import request from 'supertest';
import app from '@/app';
import { createTestUser, createTestRole } from '../helpers/testData';
import { PersonRole, Person, Role } from '@/models/index';

async function createLoginAgent(username: string, roleName: 'Master' | 'Administrador' | 'Profesor' | 'Representante') {
  const agent = request.agent(app);
  const { user, person } = await createTestUser({ username });
  const role = await createTestRole(roleName);
  await PersonRole.create({ personId: person.id, roleId: role.id });
  await agent.post('/api/auth/login').send({ username: user.username, password: 'password123' });
  return { agent, user, person };
}

const basePayload = {
  username: 'newuser1',
  password: 'password123',
  firstName: 'Nuevo',
  lastName: 'Usuario',
  documentType: 'Venezolano',
  document: 'V-990001',
  gender: 'M',
  birthdate: '1990-01-01',
  phone1: '0414-0000000',
  address: 'Calle 1',
  whatsapp: '0414-0000000',
};

describe('POST /api/auth/register', () => {
  it('permite bootstrap sin sesión cuando no hay usuarios', async () => {
    await createTestRole('Master');

    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...basePayload, roleName: 'Master' });

    expect(res.status).toBe(201);
  });

  it('rechaza registro sin sesión cuando ya existen usuarios', async () => {
    await createTestUser({ username: 'existinguser' });
    await createTestRole('Representante');

    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...basePayload, roleName: 'Representante' });

    expect(res.status).toBe(403);
  });

  it('rechaza roles no canónicos y no crea la fila de rol', async () => {
    const { agent } = await createLoginAgent('masteruser1', 'Master');

    const res = await agent
      .post('/api/auth/register')
      .send({ ...basePayload, roleName: 'Admin' });

    expect(res.status).toBe(400);
    expect(await Role.findOne({ where: { name: 'Admin' as any } })).toBeNull();
  });

  it('Administrador puede registrar staff pero no roles privilegiados', async () => {
    const { agent } = await createLoginAgent('adminuser1', 'Administrador');
    await createTestRole('Profesor');

    const ok = await agent
      .post('/api/auth/register')
      .send({ ...basePayload, roles: ['Profesor'] });
    expect(ok.status).toBe(201);

    const denied = await agent
      .post('/api/auth/register')
      .send({ ...basePayload, username: 'newuser2', document: 'V-990002', roleName: 'Administrador' });
    expect(denied.status).toBe(403);
  });

  it('Master puede asignar roles privilegiados', async () => {
    const { agent } = await createLoginAgent('masteruser2', 'Master');
    await createTestRole('Administrador');

    const res = await agent
      .post('/api/auth/register')
      .send({ ...basePayload, roleName: 'Administrador' });

    expect(res.status).toBe(201);

    // Person normalizes 'Venezolano' documents to digits only.
    const person = await Person.findOne({ where: { document: '990001' } });
    expect(person).not.toBeNull();
    const assignment = await PersonRole.findOne({ where: { personId: person!.id } });
    const adminRole = await Role.findOne({ where: { name: 'Administrador' } });
    expect(assignment?.roleId).toBe(adminRole!.id);
  });

  it('roles no administrativos no pueden registrar usuarios', async () => {
    const { agent } = await createLoginAgent('profesoruser1', 'Profesor');

    const res = await agent
      .post('/api/auth/register')
      .send({ ...basePayload, roleName: 'Representante' });

    expect(res.status).toBe(403);
  });
});
