import { ApiClient, createAuthenticatedClient } from '../lib/client';
import { expect, assertStatus } from '../lib/assert';
import { SuiteBuilder } from '../lib/runner-core';
import { uniqueName, ensureActivePeriod } from '../lib/factories';

export default function register(b: SuiteBuilder) {
  let client: ApiClient;
  let periodId: number;
  const createdTerms: number[] = [];

  b.beforeAll(async () => {
    client = await createAuthenticatedClient();
    const period = await ensureActivePeriod(client);
    periodId = period.id;
  });

  b.afterAll(async () => {
    for (const id of createdTerms.reverse()) {
      await client.delete(`/terms/${id}`).catch(() => {});
    }
  });

  b.it('GET /terms returns array', async () => {
    const res = await client.get('/terms');
    assertStatus(res.status, 200);
    expect(res.data).toBeArray();
  });

  b.it('GET /terms?schoolPeriodId=X filters', async () => {
    const res = await client.get(`/terms?schoolPeriodId=${periodId}`);
    assertStatus(res.status, 200);
    expect(res.data).toBeArray();
  });

  b.it('POST /terms creates new term', async () => {
    const res = await client.post('/terms', {
      name: uniqueName('Lapso'),
      schoolPeriodId: periodId
    });
    assertStatus(res.status, 201);
    expect(res.data).toHaveProperty('id');
    createdTerms.push(res.data.id);
  });

  b.it('POST /terms without name returns 400', async () => {
    const res = await client.post('/terms', { schoolPeriodId: periodId });
    assertStatus(res.status, 400);
  });

  b.it('PUT /terms/:id updates term', async () => {
    if (createdTerms.length === 0) return;
    const id = createdTerms[0];
    const res = await client.put(`/terms/${id}`, { name: uniqueName('LapsoUpd') });
    assertStatus(res.status, 200);
  });

  b.it('GET /terms/:id returns term', async () => {
    if (createdTerms.length === 0) return;
    const id = createdTerms[0];
    const res = await client.get(`/terms/${id}`);
    assertStatus(res.status, 200);
    expect(res.data.id).toBe(id);
  });

  b.it('GET /terms/:id with invalid id returns 404', async () => {
    const res = await client.get('/terms/999999999');
    assertStatus(res.status, 404);
  });
}
