import request from 'supertest';
import app from '@/app';
import { createTestUser, createTestRole } from '../helpers/testData';
import { PersonRole, Bank } from '@/models/index';

describe('Bank Endpoints — catálogo de bancos', () => {
  let agent: any;

  const login = async (username: string, roleName: 'Master' | 'Administrador' | 'Control de Estudios' | 'Profesor' | 'Representante' | 'Alumno') => {
    const { person } = await createTestUser({ username });
    const role = await createTestRole(roleName);
    await PersonRole.create({ personId: person.id, roleId: role.id });
    const a = request.agent(app);
    await a.post('/api/auth/login').send({ username, password: 'password123' });
    return a;
  };

  it('GET /api/banks requiere sesión', async () => {
    await request(app).get('/api/banks').expect(401);
  });

  it('GET /api/banks lista el catálogo ordenado por nombre corto', async () => {
    agent = await login('admin1', 'Administrador');
    await Bank.bulkCreate([
      { code: '0134', name: 'Banesco, Banco Universal', shortName: 'Banesco' },
      { code: '0102', name: 'Banco de Venezuela', shortName: 'Banco de Venezuela' },
    ]);

    const res = await agent.get('/api/banks').expect(200);
    expect(res.body.length).toBe(2);
    expect(res.body[0].shortName).toBe('Banco de Venezuela');
    expect(res.body[1].shortName).toBe('Banesco');
  });

  it('GET /api/banks?active=1 omite bancos desactivados', async () => {
    agent = await login('admin2', 'Administrador');
    await Bank.bulkCreate([
      { code: '0134', name: 'Banesco', shortName: 'Banesco', active: true },
      { code: '0191', name: 'BNC', shortName: 'BNC', active: false },
    ]);

    const res = await agent.get('/api/banks').query({ active: '1' }).expect(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].code).toBe('0134');
  });

  it('POST /api/banks crea un banco personalizado', async () => {
    agent = await login('admin3', 'Administrador');
    const res = await agent
      .post('/api/banks')
      .field('code', '9999')
      .field('name', 'Banco de Prueba')
      .field('shortName', 'Prueba')
      .field('rif', 'J123456789')
      .expect(201);

    expect(res.body.code).toBe('9999');
    expect(res.body.active).toBe(true);
    expect(await Bank.findOne({ where: { code: '9999' } })).not.toBeNull();
  });

  it('POST /api/banks rechaza código inválido o duplicado', async () => {
    agent = await login('admin4', 'Administrador');
    await Bank.create({ code: '0134', name: 'Banesco', shortName: 'Banesco' });

    await agent
      .post('/api/banks')
      .field('code', '123') // only 3 digits
      .field('name', 'X')
      .field('shortName', 'X')
      .expect(400);

    await agent
      .post('/api/banks')
      .field('code', '0134')
      .field('name', 'Duplicado')
      .field('shortName', 'Duplicado')
      .expect(409);
  });

  it('PUT /api/banks/:id permite activar/desactivar', async () => {
    agent = await login('admin5', 'Administrador');
    const bank = await Bank.create({ code: '0134', name: 'Banesco', shortName: 'Banesco' });

    const res = await agent
      .put(`/api/banks/${bank.id}`)
      .field('active', 'false')
      .expect(200);
    expect(res.body.active).toBe(false);

    const res2 = await agent
      .put(`/api/banks/${bank.id}`)
      .field('active', 'true')
      .field('shortName', 'Banesco PA')
      .expect(200);
    expect(res2.body.active).toBe(true);
    expect(res2.body.shortName).toBe('Banesco PA');
  });

  it('roles sin acceso a pagos no pueden crear ni editar bancos', async () => {
    agent = await login('teacher1', 'Profesor');
    const bank = await Bank.create({ code: '0134', name: 'Banesco', shortName: 'Banesco' });

    await agent
      .post('/api/banks')
      .field('code', '9999')
      .field('name', 'X')
      .field('shortName', 'X')
      .expect(403);

    await agent
      .put(`/api/banks/${bank.id}`)
      .field('active', 'false')
      .expect(403);

    // …but they CAN read the catalog.
    await agent.get('/api/banks').expect(200);
  });
});
