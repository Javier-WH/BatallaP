import { ApiClient, createAuthenticatedClient } from '../lib/client';
import { expect, assertStatus } from '../lib/assert';
import { SuiteBuilder } from '../lib/runner-core';
import { uniqueName, uniquePeriodCode } from '../lib/factories';

export default function register(b: SuiteBuilder) {
  let client: ApiClient;
  const createdIds: { periods: number[]; grades: number[]; sections: number[]; subjects: number[] } = {
    periods: [], grades: [], sections: [], subjects: []
  };

  b.beforeAll(async () => {
    client = await createAuthenticatedClient();
  });

  b.afterAll(async () => {
    // Best-effort cleanup
    for (const id of createdIds.periods.reverse()) {
      await client.delete(`/academic/periods/${id}`).catch(() => {});
    }
    for (const id of createdIds.subjects.reverse()) {
      await client.delete(`/academic/subjects/${id}`).catch(() => {});
    }
    for (const id of createdIds.sections.reverse()) {
      await client.delete(`/academic/sections/${id}`).catch(() => {});
    }
    for (const id of createdIds.grades.reverse()) {
      await client.delete(`/academic/grades/${id}`).catch(() => {});
    }
  });

  // -------- Periods --------
  b.it('GET /academic/periods returns array', async () => {
    const res = await client.get('/academic/periods');
    assertStatus(res.status, 200);
    expect(res.data).toBeArray();
  });

  b.it('GET /academic/active returns active period', async () => {
    const res = await client.get('/academic/active');
    assertStatus(res.status, 200);
    if (res.data) {
      expect(res.data).toHaveProperty('id');
      expect(res.data).toHaveProperty('period');
    }
  });

  b.it('POST /academic/periods creates new period', async () => {
    const code = uniquePeriodCode();
    const res = await client.post('/academic/periods', {
      period: code,
      name: uniqueName('Periodo')
    });
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.data).toHaveProperty('id');
    createdIds.periods.push(res.data.id);
  });

  b.it('POST /academic/periods rejects invalid format', async () => {
    const res = await client.post('/academic/periods', {
      period: 'invalid',
      name: uniqueName('Periodo')
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  b.it('PUT /academic/periods/:id updates period name', async () => {
    if (createdIds.periods.length === 0) return;
    const id = createdIds.periods[0];
    const res = await client.put(`/academic/periods/${id}`, { name: uniqueName('PeriodoRenombrado') });
    expect(res.status).toBeLessThan(500);
  });

  // -------- Grades --------
  b.it('GET /academic/grades returns array', async () => {
    const res = await client.get('/academic/grades');
    assertStatus(res.status, 200);
    expect(res.data).toBeArray();
  });

  b.it('POST /academic/grades creates new grade', async () => {
    const res = await client.post('/academic/grades', {
      name: uniqueName('Grado'),
      isDiversified: false
    });
    assertStatus(res.status, 200);
    expect(res.data).toHaveProperty('id');
    createdIds.grades.push(res.data.id);
  });

  b.it('PUT /academic/grades/:id updates grade', async () => {
    if (createdIds.grades.length === 0) return;
    const id = createdIds.grades[0];
    const res = await client.put(`/academic/grades/${id}`, { name: uniqueName('GradoUpdated') });
    expect(res.status).toBeLessThan(400);
  });

  // -------- Sections --------
  b.it('GET /academic/sections returns array', async () => {
    const res = await client.get('/academic/sections');
    assertStatus(res.status, 200);
    expect(res.data).toBeArray();
  });

  b.it('POST /academic/sections creates new section', async () => {
    const res = await client.post('/academic/sections', { name: uniqueName('Seccion') });
    assertStatus(res.status, 200);
    createdIds.sections.push(res.data.id);
  });

  // -------- Subjects --------
  b.it('GET /academic/subjects returns array', async () => {
    const res = await client.get('/academic/subjects');
    assertStatus(res.status, 200);
    expect(res.data).toBeArray();
  });

  b.it('POST /academic/subjects creates new subject', async () => {
    const res = await client.post('/academic/subjects', { name: uniqueName('Materia') });
    assertStatus(res.status, 200);
    createdIds.subjects.push(res.data.id);
  });

  // -------- Structure --------
  b.it('GET /academic/structure/:periodId returns structure', async () => {
    const active = await client.get('/academic/active');
    if (!active.ok || !active.data?.id) return;
    const res = await client.get(`/academic/structure/${active.data.id}`);
    assertStatus(res.status, 200);
  });

  // -------- Subject Groups --------
  b.it('GET /academic/subject-groups returns array', async () => {
    const res = await client.get('/academic/subject-groups');
    assertStatus(res.status, 200);
    expect(res.data).toBeArray();
  });

  // -------- Specializations --------
  b.it('GET /academic/specializations returns array', async () => {
    const res = await client.get('/academic/specializations');
    assertStatus(res.status, 200);
    expect(res.data).toBeArray();
  });
}
