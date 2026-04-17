import { ApiClient, createAuthenticatedClient } from '../lib/client';
import { expect, assertStatus } from '../lib/assert';
import { SuiteBuilder } from '../lib/runner-core';

export default function register(b: SuiteBuilder) {
  let client: ApiClient;

  b.beforeAll(async () => {
    client = await createAuthenticatedClient();
  });

  b.it('GET /auth/me returns current session user', async () => {
    const res = await client.me();
    assertStatus(res.status, 200);
    expect(res.data.authenticated).toBe(true);
    expect(res.data.user).toBeDefined();
    expect(res.data.user.username).toBe(process.env.USERNAME || 'Javier');
  });

  b.it('login with invalid password returns 401', async () => {
    const tmp = new ApiClient(client.baseURL);
    const res = await tmp.login(process.env.USERNAME || 'Javier', 'wrong-password-xyz');
    assertStatus(res.status, 401);
  });

  b.it('login with non-existent user returns 401', async () => {
    const tmp = new ApiClient(client.baseURL);
    const res = await tmp.login('non_existent_user_xyz_123', 'whatever');
    assertStatus(res.status, 401);
  });

  b.it('/auth/me without session returns 401', async () => {
    const tmp = new ApiClient(client.baseURL);
    const res = await tmp.me();
    assertStatus(res.status, 401);
  });

  b.it('logout invalidates session', async () => {
    const tmp = await createAuthenticatedClient();
    const meOk = await tmp.me();
    assertStatus(meOk.status, 200);

    const logoutRes = await tmp.logout();
    assertStatus(logoutRes.status, 200);

    const meAfter = await tmp.me();
    assertStatus(meAfter.status, 401);
  });

  b.it('session user exposes roles array', async () => {
    const res = await client.me();
    assertStatus(res.status, 200);
    expect(res.data.user.roles).toBeArray();
    expect(res.data.user.roles.length).toBeGreaterThan(0);
  });
}
