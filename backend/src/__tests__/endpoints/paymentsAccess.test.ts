import request from 'supertest';
import app from '@/app';
import { Role, PersonRole } from '@/models/index';
import { createTestUser, createAcademicStructure } from '../helpers/testData';

const login = async (username: string, roleName?: string) => {
  const { person } = await createTestUser({ username });
  if (roleName) {
    const [role] = await Role.findOrCreate({ where: { name: roleName as any }, defaults: { name: roleName as any } });
    await PersonRole.create({ personId: person.id, roleId: role.id });
  }
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ username, password: 'password123' });
  return agent;
};

describe('Payments module access control', () => {
  it('rejects unauthenticated access to ledger and payments (401)', async () => {
    const { period } = await createAcademicStructure();
    await request(app).get(`/api/ledger/sections/${period.id}`).expect(401);
    await request(app).get('/api/payments/fees').expect(401);
  });

  it.each(['Profesor', 'Representante', 'Alumno', 'Control de Estudios'])(
    'rejects role %s with 403',
    async (roleName) => {
      const { period } = await createAcademicStructure();
      const agent = await login(`user_${roleName.replace(/\s/g, '')}`, roleName);
      await agent.get(`/api/ledger/sections/${period.id}`).expect(403);
      await agent.get('/api/payments/fees').expect(403);
    }
  );

  it('keeps read-only exchange rates open to any authenticated role', async () => {
    const agent = await login('rates_profesor', 'Profesor');
    await agent.get('/api/payments/exchange-rates').expect(200);
    await agent.get('/api/payments/exchange-rates/at-date').expect(200);
    await request(app).get('/api/payments/exchange-rates').expect(401);
  });

  it.each(['Master', 'Administrador'])('allows role %s', async (roleName) => {
    const { period } = await createAcademicStructure();
    const agent = await login(`user_${roleName}`, roleName);
    await agent.get(`/api/ledger/sections/${period.id}`).expect(200);
    await agent.get('/api/payments/fees').expect(200);
  });
});
