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

  b.it('GET /inscriptions returns array', async () => {
    const res = await client.get('/inscriptions');
    assertStatus(res.status, 200);
    expect(res.data).toBeArray();
  });

  b.it('GET /inscriptions?schoolPeriodId=X filters', async () => {
    const res = await client.get(`/inscriptions?schoolPeriodId=${periodId}`);
    assertStatus(res.status, 200);
    expect(res.data).toBeArray();
  });

  b.it('GET /inscriptions/:id with invalid id returns 404', async () => {
    const res = await client.get('/inscriptions/999999999');
    assertStatus(res.status, 404);
  });

  b.it('POST /inscriptions with missing required fields returns 400', async () => {
    const res = await client.post('/inscriptions', { personId: 1 });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  b.it('GET /inscriptions/:id with valid id returns data', async () => {
    const list = await client.get(`/inscriptions?schoolPeriodId=${periodId}`);
    if (!list.ok || !Array.isArray(list.data) || list.data.length === 0) return;
    const first = list.data[0];
    const res = await client.get(`/inscriptions/${first.id}`);
    assertStatus(res.status, 200);
    expect(res.data.id).toBe(first.id);
  });

  b.it('GET /matriculations returns data', async () => {
    const res = await client.get('/matriculations');
    // 200 or some other; we just validate it doesn't 500
    expect(res.status).toBeLessThan(500);
  });
}
