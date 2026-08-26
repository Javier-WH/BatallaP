import request from 'supertest';
import app from '@/app';
import { createTestUser, createTestRole } from '../helpers/testData';
import { PersonRole, User } from '@/models/index';

describe('User Endpoints', () => {
  let agent: any;

  beforeEach(async () => {
    agent = request.agent(app);

    const { person } = await createTestUser({ username: 'admin' });
    const role = await createTestRole('Master');
    await PersonRole.create({ personId: person.id, roleId: role.id });

    await agent
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'password123' });
  });

  describe('GET /api/users', () => {
    it('should return all users', async () => {
      await createTestUser({ username: 'user1' });
      await createTestUser({ username: 'user2' });

      const response = await agent
        .get('/api/users')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(3);
    });

    it('should return users with their roles', async () => {
      const { person } = await createTestUser({ username: 'teacher' });
      const role = await createTestRole('Profesor');

      await PersonRole.create({
        personId: person.id,
        roleId: role.id
      });

      const response = await agent
        .get('/api/users')
        .expect(200);

      const teacher = response.body.find((u: any) => u.username === 'teacher');
      expect(teacher).toBeDefined();
      expect(teacher.roles).toBeDefined();
      expect(teacher.roles.length).toBe(1);
      expect(teacher.roles[0].name).toBe('Profesor');
    });

    it('should search users by name via ?q=', async () => {
      await createTestUser({
        username: 'john',
        firstName: 'John',
        lastName: 'Doe'
      });

      const response = await agent
        .get('/api/users?q=John')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      // Person.beforeCreate uppercases names
      expect(response.body[0].firstName).toBe('JOHN');
    });

    it('should search users by document via ?q=', async () => {
      await createTestUser({
        username: 'user1',
        document: '12345678'
      });

      const response = await agent
        .get('/api/users?q=12345678')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0].document).toBe('12345678');
    });
  });

  describe('GET /api/users/:id', () => {
    it('should return user by id (person with nested user)', async () => {
      const { user, person } = await createTestUser({ username: 'testuser' });

      const response = await agent
        .get(`/api/users/${person.id}`)
        .expect(200);

      expect(response.body.id).toBe(person.id);
      // getUserDetails returns the full Person with nested user
      expect(response.body.user).toBeDefined();
      expect(response.body.user.username).toBe('testuser');
    });

    it('should return 404 for non-existent user', async () => {
      await agent
        .get('/api/users/99999')
        .expect(404);
    });
  });

  describe('PUT /api/users/:id', () => {
    it('should update user information', async () => {
      const { person } = await createTestUser({
        username: 'updateme',
        firstName: 'Old',
        lastName: 'Name'
      });

      const response = await agent
        .put(`/api/users/${person.id}`)
        .send({
          firstName: 'New',
          lastName: 'Name'
        })
        .expect(200);

      // updateUser returns { message: '...' }
      expect(response.body.message).toMatch(/updated|actualizado/i);
    });
  });

  describe('DELETE /api/users/:id/account', () => {
    it('should delete user account', async () => {
      const { user, person } = await createTestUser({ username: 'deleteme' });

      await agent
        .delete(`/api/users/${person.id}/account`)
        .expect(200);

      const deleted = await User.findByPk(user.id);
      expect(deleted).toBeNull();
    });
  });
});
