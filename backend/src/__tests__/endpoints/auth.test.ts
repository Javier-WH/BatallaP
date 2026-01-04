import request from 'supertest';
import app from '@/app';
import { createTestUser, createTestRole } from '../helpers/testData';
import { PersonRole } from '@/models/index';

describe('Auth Endpoints', () => {
  let agent: any;
  describe('POST /api/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      agent = request.agent(app);
      await createTestUser({ 
        username: 'testuser',
        password: 'password123' 
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'password123'
        })
        .expect(200);

      expect(response.body.message).toMatch(/login|exitoso/i);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.username).toBe('testuser');
    });

    it('should fail login with invalid password', async () => {
      await createTestUser({ 
        username: 'testuser',
        password: 'password123' 
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body.message).toMatch(/invalid|inválidas/i);
    });

    it('should fail login with non-existent user', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'nonexistent',
          password: 'password123'
        })
        .expect(401);

      expect(response.body.message).toMatch(/invalid|inválidas/i);
    });

    it('should return user with roles', async () => {
      const { user, person } = await createTestUser({ username: 'admin' });
      const role = await createTestRole('Master');
      
      await PersonRole.create({
        personId: person.id,
        roleId: role.id
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'password123'
        })
        .expect(200);

      expect(response.body.user.roles).toBeDefined();
      expect(response.body.user.roles.length).toBe(1);
      expect(response.body.user.roles[0].name).toBe('Master');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      const agent = request.agent(app);
      
      await createTestUser({ username: 'testuser' });
      
      await agent
        .post('/api/auth/login')
        .send({ username: 'testuser', password: 'password123' });

      const response = await agent
        .post('/api/auth/logout')
        .expect(200);

      expect(response.body.message).toMatch(/logout|exitoso/i);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user when authenticated', async () => {
      const agent = request.agent(app);
      
      await createTestUser({ username: 'testuser' });
      
      await agent
        .post('/api/auth/login')
        .send({ username: 'testuser', password: 'password123' });

      const response = await agent
        .get('/api/auth/me')
        .expect(200);

      expect(response.body.username).toBe('testuser');
    });

    it('should return 401 when not authenticated', async () => {
      await request(app)
        .get('/api/auth/me')
        .expect(401);
    });
  });
});
