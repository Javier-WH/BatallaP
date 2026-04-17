export class AssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AssertionError';
  }
}

function fmt(v: unknown): string {
  if (v === undefined) return 'undefined';
  if (v === null) return 'null';
  if (typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try {
    const s = JSON.stringify(v);
    return s.length > 200 ? s.slice(0, 200) + '…' : s;
  } catch {
    return String(v);
  }
}

export function expect<T>(actual: T) {
  return {
    toBe(expected: T) {
      if (actual !== expected) {
        throw new AssertionError(`Expected ${fmt(actual)} to be ${fmt(expected)}`);
      }
    },
    toEqual(expected: unknown) {
      const a = JSON.stringify(actual);
      const b = JSON.stringify(expected);
      if (a !== b) {
        throw new AssertionError(`Expected ${fmt(actual)} to equal ${fmt(expected)}`);
      }
    },
    toBeTruthy() {
      if (!actual) {
        throw new AssertionError(`Expected ${fmt(actual)} to be truthy`);
      }
    },
    toBeFalsy() {
      if (actual) {
        throw new AssertionError(`Expected ${fmt(actual)} to be falsy`);
      }
    },
    toBeDefined() {
      if (actual === undefined) {
        throw new AssertionError(`Expected value to be defined`);
      }
    },
    toBeNull() {
      if (actual !== null) {
        throw new AssertionError(`Expected ${fmt(actual)} to be null`);
      }
    },
    toHaveProperty(prop: string) {
      if (typeof actual !== 'object' || actual === null || !(prop in (actual as object))) {
        throw new AssertionError(`Expected object to have property "${prop}"`);
      }
    },
    toBeGreaterThan(n: number) {
      if (typeof actual !== 'number' || actual <= n) {
        throw new AssertionError(`Expected ${fmt(actual)} to be > ${n}`);
      }
    },
    toBeGreaterThanOrEqual(n: number) {
      if (typeof actual !== 'number' || actual < n) {
        throw new AssertionError(`Expected ${fmt(actual)} to be >= ${n}`);
      }
    },
    toBeLessThan(n: number) {
      if (typeof actual !== 'number' || actual >= n) {
        throw new AssertionError(`Expected ${fmt(actual)} to be < ${n}`);
      }
    },
    toContain(item: unknown) {
      if (Array.isArray(actual)) {
        if (!actual.includes(item as never)) {
          throw new AssertionError(`Expected array to contain ${fmt(item)}`);
        }
      } else if (typeof actual === 'string') {
        if (!actual.includes(String(item))) {
          throw new AssertionError(`Expected "${actual}" to contain "${item}"`);
        }
      } else {
        throw new AssertionError(`toContain only works on arrays or strings`);
      }
    },
    toBeArray() {
      if (!Array.isArray(actual)) {
        throw new AssertionError(`Expected ${fmt(actual)} to be an array`);
      }
    },
    toMatch(regex: RegExp) {
      if (typeof actual !== 'string' || !regex.test(actual)) {
        throw new AssertionError(`Expected ${fmt(actual)} to match ${regex}`);
      }
    }
  };
}

export function assertStatus(actualStatus: number, expectedStatus: number, context?: string): void {
  if (actualStatus !== expectedStatus) {
    throw new AssertionError(
      `${context ? context + ': ' : ''}Expected HTTP ${expectedStatus}, got ${actualStatus}`
    );
  }
}
