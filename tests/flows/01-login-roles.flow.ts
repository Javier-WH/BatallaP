import { ApiClient, createAuthenticatedClient } from '../lib/client';
import { expect, assertStatus } from '../lib/assert';
import { SuiteBuilder } from '../lib/runner-core';

export default function register(b: SuiteBuilder) {
  let client: ApiClient;

  b.beforeAll(async () => {
    client = await createAuthenticatedClient();
  });

  b.it('user Javier has the expected set of roles', async () => {
    const res = await client.me();
    assertStatus(res.status, 200);
    const roles: string[] = res.data.user.roles || [];
    expect(roles).toBeArray();
    // We do not fail hard if some role is missing but we report
    const expected = ['Master', 'Administrador', 'Control de Estudios'];
    for (const r of expected) {
      if (!roles.includes(r)) {
        throw new Error(`Javier is missing role "${r}". Actual roles: ${JSON.stringify(roles)}`);
      }
    }
  });

  b.it('with Master role, can call /users search', async () => {
    const res = await client.get('/users');
    assertStatus(res.status, 200);
  });

  b.it('with Administrador role, can list inscriptions', async () => {
    const res = await client.get('/inscriptions');
    assertStatus(res.status, 200);
  });

  b.it('with Control de Estudios role, can query permissions check', async () => {
    const res = await client.get('/grade-edit-permissions/check/1');
    expect(res.status).toBeLessThan(500);
  });
}
