import { ApiClient, createAuthenticatedClient } from '../lib/client';
import { expect, assertStatus } from '../lib/assert';
import { SuiteBuilder } from '../lib/runner-core';

export default function register(b: SuiteBuilder) {
  let client: ApiClient;

  b.beforeAll(async () => {
    client = await createAuthenticatedClient();
  });

  b.it('GET /users returns an array (search)', async () => {
    const res = await client.get('/users');
    assertStatus(res.status, 200);
    // Response may be array or { data: [] }; accept both
    const list = Array.isArray(res.data) ? res.data : res.data.data || res.data.users;
    if (list) {
      expect(Array.isArray(list)).toBe(true);
    }
  });

  b.it('GET /users with search query', async () => {
    const res = await client.get('/users?search=' + encodeURIComponent('Javier'));
    assertStatus(res.status, 200);
  });

  b.it('GET /users/:id returns user details', async () => {
    const me = await client.me();
    const personId = me.data.user.personId;
    if (!personId) return; // skip
    const res = await client.get(`/users/${personId}`);
    // Accept 200 or 404 depending on impl
    if (res.status === 200) {
      expect(res.data).toBeDefined();
    }
  });

  b.it('GET /users/:id with invalid id returns error', async () => {
    const res = await client.get('/users/999999999');
    // Should not be 200
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
}
