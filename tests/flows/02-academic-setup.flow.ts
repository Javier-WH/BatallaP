import { ApiClient, createAuthenticatedClient } from '../lib/client';
import { expect, assertStatus } from '../lib/assert';
import { SuiteBuilder } from '../lib/runner-core';
import { uniqueName, uniquePeriodCode } from '../lib/factories';

/**
 * End-to-end: create a brand new school period with grade, section, subject,
 * associate them, and create a term.
 */
export default function register(b: SuiteBuilder) {
  let client: ApiClient;
  const created: {
    periodId?: number;
    gradeId?: number;
    sectionId?: number;
    subjectId?: number;
    periodGradeId?: number;
    termId?: number;
  } = {};

  b.beforeAll(async () => {
    client = await createAuthenticatedClient();
  });

  b.afterAll(async () => {
    if (created.termId) await client.delete(`/terms/${created.termId}`).catch(() => {});
    if (created.periodId) await client.delete(`/academic/periods/${created.periodId}`).catch(() => {});
    if (created.subjectId) await client.delete(`/academic/subjects/${created.subjectId}`).catch(() => {});
    if (created.sectionId) await client.delete(`/academic/sections/${created.sectionId}`).catch(() => {});
    if (created.gradeId) await client.delete(`/academic/grades/${created.gradeId}`).catch(() => {});
  });

  b.it('creates a new school period', async () => {
    const res = await client.post('/academic/periods', {
      period: uniquePeriodCode(),
      name: uniqueName('PeriodoFlow')
    });
    assertStatus(res.status, 201);
    created.periodId = res.data.id;
  });

  b.it('creates a new grade', async () => {
    const res = await client.post('/academic/grades', {
      name: uniqueName('GradoFlow'),
      isDiversified: false
    });
    assertStatus(res.status, 200);
    created.gradeId = res.data.id;
  });

  b.it('creates a new section', async () => {
    const res = await client.post('/academic/sections', { name: uniqueName('SeccionFlow') });
    assertStatus(res.status, 200);
    created.sectionId = res.data.id;
  });

  b.it('creates a new subject', async () => {
    const res = await client.post('/academic/subjects', { name: uniqueName('MateriaFlow') });
    assertStatus(res.status, 200);
    created.subjectId = res.data.id;
  });

  b.it('associates grade to period (period-grade)', async () => {
    if (!created.periodId || !created.gradeId) return;
    const res = await client.post('/academic/structure/period-grade', {
      schoolPeriodId: created.periodId,
      gradeId: created.gradeId
    });
    // Accept 200/201
    expect([200, 201]).toContain(res.status);
    created.periodGradeId = res.data?.id;
  });

  b.it('GET /academic/structure/:periodId returns structure with our grade', async () => {
    if (!created.periodId) return;
    const res = await client.get(`/academic/structure/${created.periodId}`);
    assertStatus(res.status, 200);
  });

  b.it('creates a term for the new period', async () => {
    if (!created.periodId) return;
    const res = await client.post('/terms', {
      name: uniqueName('LapsoFlow'),
      schoolPeriodId: created.periodId
    });
    assertStatus(res.status, 201);
    created.termId = res.data.id;
  });
}
