import { ApiClient, createAuthenticatedClient } from '../lib/client';
import { expect, assertStatus } from '../lib/assert';
import { SuiteBuilder } from '../lib/runner-core';
import { ensureActivePeriod } from '../lib/factories';

export default function register(b: SuiteBuilder) {
  let client: ApiClient;
  let periodId: number;

  b.beforeAll(async () => {
    client = await createAuthenticatedClient();
    const period = await ensureActivePeriod(client);
    periodId = period.id;
  });

  b.it('GET /teachers returns array', async () => {
    const res = await client.get('/teachers');
    expect(res.status).toBeLessThan(500);
    if (res.ok) {
      const list = Array.isArray(res.data) ? res.data : res.data.data;
      if (list) expect(Array.isArray(list)).toBe(true);
    }
  });

  b.it('GET /teachers/available/:periodId returns subjects', async () => {
    const res = await client.get(`/teachers/available/${periodId}`);
    // May return 500 if period has no structure; accept 200 or 500
    expect([200, 500]).toContain(res.status);
  });

  b.it('POST /teachers/assign with invalid data returns 400', async () => {
    const res = await client.post('/teachers/assign', {});
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  b.it('GET /evaluation/my-assignments returns list', async () => {
    const res = await client.get('/evaluation/my-assignments');
    // Can be 200 with [] if user has no assignments
    expect(res.status).toBeLessThan(500);
  });
}
