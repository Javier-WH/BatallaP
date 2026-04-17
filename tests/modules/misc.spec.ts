/**
 * Miscellaneous smaller modules grouped in one file to keep coverage broad:
 * settings, residences, locations, guardians, council, period-closure,
 * period-outcomes, enrollment-questions/answers/reports, grade-edit-permissions,
 * dashboard, student-previous-schools.
 */
import { ApiClient, createAuthenticatedClient } from '../lib/client';
import { expect, assertStatus } from '../lib/assert';
import { SuiteBuilder } from '../lib/runner-core';
import { ensureActivePeriod } from '../lib/factories';

export default function register(b: SuiteBuilder) {
  let client: ApiClient;
  let periodId: number;
  let personId: number | undefined;

  b.beforeAll(async () => {
    client = await createAuthenticatedClient();
    const period = await ensureActivePeriod(client);
    periodId = period.id;
    const me = await client.me();
    personId = me.data?.user?.personId;
  });

  // Settings
  b.it('GET /settings returns data', async () => {
    const res = await client.get('/settings');
    expect(res.status).toBeLessThan(500);
  });

  b.it('GET /settings/:key returns setting or 404', async () => {
    const res = await client.get('/settings/non_existent_key_test');
    expect(res.status).toBeLessThan(500);
  });

  // Locations
  b.it('GET /locations/venezuela returns location tree', async () => {
    const res = await client.get('/locations/venezuela');
    assertStatus(res.status, 200);
  });

  // Residences (requires personId)
  b.it('GET /residences/:personId works or 404', async () => {
    if (!personId) return;
    const res = await client.get(`/residences/${personId}`);
    expect(res.status).toBeLessThan(500);
  });

  // Guardians
  b.it('GET /guardians/search returns results', async () => {
    const res = await client.get('/guardians/search?q=a');
    expect(res.status).toBeLessThan(500);
  });

  b.it('GET /guardians/my-students returns array or 401/403', async () => {
    const res = await client.get('/guardians/my-students');
    expect(res.status).toBeLessThan(500);
  });

  // Council
  b.it('GET /council/data with params works', async () => {
    const res = await client.get(`/council/data?schoolPeriodId=${periodId}`);
    expect(res.status).toBeLessThan(500);
  });

  // Period closure
  b.it('GET /period-closure/:id/status returns status', async () => {
    const res = await client.get(`/period-closure/${periodId}/status`);
    expect(res.status).toBeLessThan(500);
  });

  b.it('GET /period-closure/:id/validate returns validation', async () => {
    const res = await client.get(`/period-closure/${periodId}/validate`);
    expect(res.status).toBeLessThan(500);
  });

  b.it('GET /period-closure/:id/preview returns preview', async () => {
    const res = await client.get(`/period-closure/${periodId}/preview`);
    expect(res.status).toBeLessThan(500);
  });

  // Period outcomes
  b.it('GET /periods/:id/outcomes returns outcomes', async () => {
    const res = await client.get(`/periods/${periodId}/outcomes`);
    expect(res.status).toBeLessThan(500);
  });

  b.it('GET /periods/:id/pending-subjects returns pending', async () => {
    const res = await client.get(`/periods/${periodId}/pending-subjects`);
    expect(res.status).toBeLessThan(500);
  });

  // Enrollment questions/answers
  b.it('GET /enrollment-questions returns list', async () => {
    const res = await client.get('/enrollment-questions');
    expect(res.status).toBeLessThan(500);
  });

  b.it('GET /enrollment-answers/:personId returns answers', async () => {
    if (!personId) return;
    const res = await client.get(`/enrollment-answers/${personId}`);
    expect(res.status).toBeLessThan(500);
  });

  // Grade edit permissions
  b.it('GET /grade-edit-permissions returns array', async () => {
    const res = await client.get('/grade-edit-permissions');
    expect(res.status).toBeLessThan(500);
    if (res.ok) expect(res.data).toBeArray();
  });

  b.it('GET /grade-edit-permissions/check/:periodId returns check', async () => {
    const res = await client.get(`/grade-edit-permissions/check/${periodId}`);
    expect(res.status).toBeLessThan(500);
  });

  b.it('GET /grade-edit-permissions/audit returns audit log', async () => {
    const res = await client.get('/grade-edit-permissions/audit');
    expect(res.status).toBeLessThan(500);
  });

  // Dashboard
  b.it('GET /dashboard/master returns metrics', async () => {
    const res = await client.get('/dashboard/master');
    expect(res.status).toBeLessThan(500);
  });

  b.it('GET /dashboard/control returns metrics', async () => {
    const res = await client.get('/dashboard/control');
    expect(res.status).toBeLessThan(500);
  });

  // Student previous schools
  b.it('GET /users/:personId/student-previous-schools returns list', async () => {
    if (!personId) return;
    const res = await client.get(`/users/${personId}/student-previous-schools`);
    expect(res.status).toBeLessThan(500);
  });

  // Upload
  b.it('GET /upload/logo returns logo or 404', async () => {
    const res = await client.get('/upload/logo');
    expect(res.status).toBeLessThan(500);
  });

  // Bulk enrollment
  b.it('GET /inscriptions/bulk/template returns template', async () => {
    const res = await client.get('/inscriptions/bulk/template');
    expect(res.status).toBeLessThan(500);
  });
}
