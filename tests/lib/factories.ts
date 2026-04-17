import { ApiClient } from './client';

/**
 * All test data uses this prefix so it can be identified and cleaned up later.
 */
export const TEST_PREFIX = 'TEST_';

let counter = 0;
function uniqueSuffix(): string {
  counter += 1;
  return `${Date.now().toString(36)}${counter}`;
}

export function uniqueName(base = 'Item'): string {
  return `${TEST_PREFIX}${base}_${uniqueSuffix()}`;
}

export function uniqueUsername(): string {
  return `${TEST_PREFIX.toLowerCase()}user_${uniqueSuffix()}`;
}

export function uniqueDocument(): string {
  // 8 digits document
  const n = (Date.now() % 90000000) + 10000000 + counter;
  counter += 1;
  return String(n).slice(-8).padStart(8, '0');
}

export function uniquePeriodCode(): string {
  // Future-ish period to avoid colliding with real ones; cap at year 2099
  const y = 2040 + (counter % 50);
  counter += 1;
  return `${y}-${y + 1}`;
}

export function uniqueCode(prefix = 'T'): string {
  return `${prefix}${uniqueSuffix()}`.toUpperCase().slice(0, 15);
}

// ---------------- Idempotent ensure helpers ----------------

export async function ensureActivePeriod(client: ApiClient): Promise<any> {
  const res = await client.get('/academic/active');
  if (res.ok && res.data && res.data.id) return res.data;
  // Try /academic/periods/active
  const res2 = await client.get('/academic/periods/active');
  if (res2.ok && res2.data && res2.data.id) return res2.data;
  // As last resort, pick any existing period
  const all = await client.get('/academic/periods');
  if (all.ok && Array.isArray(all.data) && all.data.length > 0) return all.data[0];
  throw new Error('No school period found to run tests against');
}

export async function findOrCreateGrade(client: ApiClient, name: string): Promise<any> {
  const list = await client.get('/academic/grades');
  if (list.ok && Array.isArray(list.data)) {
    const found = list.data.find((g: any) => g.name === name);
    if (found) return found;
  }
  const created = await client.post('/academic/grades', { name, isDiversified: false });
  if (!created.ok) {
    throw new Error(`Failed to create grade "${name}": ${JSON.stringify(created.data)}`);
  }
  return created.data;
}

export async function findOrCreateSection(client: ApiClient, name: string): Promise<any> {
  const list = await client.get('/academic/sections');
  if (list.ok && Array.isArray(list.data)) {
    const found = list.data.find((s: any) => s.name === name);
    if (found) return found;
  }
  const created = await client.post('/academic/sections', { name });
  if (!created.ok) {
    throw new Error(`Failed to create section "${name}": ${JSON.stringify(created.data)}`);
  }
  return created.data;
}

export async function findOrCreateSubject(client: ApiClient, name: string): Promise<any> {
  const list = await client.get('/academic/subjects');
  if (list.ok && Array.isArray(list.data)) {
    const found = list.data.find((s: any) => s.name === name);
    if (found) return found;
  }
  const created = await client.post('/academic/subjects', { name });
  if (!created.ok) {
    throw new Error(`Failed to create subject "${name}": ${JSON.stringify(created.data)}`);
  }
  return created.data;
}
