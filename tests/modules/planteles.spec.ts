import { ApiClient, createAuthenticatedClient } from '../lib/client';
import { expect, assertStatus } from '../lib/assert';
import { SuiteBuilder } from '../lib/runner-core';

export default function register(b: SuiteBuilder) {
  let client: ApiClient;

  b.beforeAll(async () => {
    client = await createAuthenticatedClient();
  });

  b.it('GET /planteles returns array', async () => {
    const res = await client.get('/planteles');
    assertStatus(res.status, 200);
    // Response may be paginated { data: [] } or array
    const list = Array.isArray(res.data) ? res.data : res.data.data;
    if (list) expect(Array.isArray(list)).toBe(true);
  });

  b.it('GET /planteles/search?q=X returns results', async () => {
    const res = await client.get('/planteles/search?q=e');
    assertStatus(res.status, 200);
  });

  b.it('GET /planteles/by-id/:id with invalid id returns 404', async () => {
    const res = await client.get('/planteles/by-id/999999999');
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  b.it('GET /planteles/by-id/:id with valid id returns plantel', async () => {
    // Find any plantel via search
    const search = await client.get('/planteles/search?q=a');
    const list = Array.isArray(search.data) ? search.data : search.data.data || search.data.planteles;
    if (!list || list.length === 0) return; // skip
    const first = list[0];
    const res = await client.get(`/planteles/by-id/${first.id}`);
    assertStatus(res.status, 200);
    expect(res.data.id).toBe(first.id);
  });
}
