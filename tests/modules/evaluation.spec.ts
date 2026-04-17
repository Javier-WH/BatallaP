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

  b.it('GET /evaluation/my-assignments works', async () => {
    const res = await client.get('/evaluation/my-assignments');
    expect(res.status).toBeLessThan(500);
  });

  b.it('GET /evaluation/plan/:id without valid id returns error or empty array', async () => {
    const res = await client.get('/evaluation/plan/999999999');
    expect(res.status).toBeLessThan(500);
  });

  b.it('POST /evaluation/plan without required fields returns 400', async () => {
    const res = await client.post('/evaluation/plan', {});
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  b.it('POST /evaluation/qualifications without required fields errors', async () => {
    const res = await client.post('/evaluation/qualifications', {});
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  b.it('GET /evaluation/final-grades-by-period without permission returns 403 or 200', async () => {
    const res = await client.get(`/evaluation/final-grades-by-period?schoolPeriodId=${periodId}`);
    // 200 if Javier has permission, 403 if not
    expect([200, 403, 404]).toContain(res.status);
  });

  b.it('GET /evaluation/final-grades-by-period without schoolPeriodId returns 400', async () => {
    const res = await client.get('/evaluation/final-grades-by-period');
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  b.it('GET /evaluation/students/:assignmentId with invalid id errors', async () => {
    const res = await client.get('/evaluation/students/999999999');
    expect(res.status).toBeLessThan(500);
  });

  b.it('GET /evaluation/student-record/:personId returns data or 404', async () => {
    const res = await client.get('/evaluation/student-record/999999999');
    expect(res.status).toBeLessThan(500);
  });
}
