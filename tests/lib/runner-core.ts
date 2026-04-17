/**
 * Minimal test runner: describe/it/beforeAll/afterAll without external deps.
 */

type AsyncFn = () => Promise<void> | void;

export interface TestCase {
  name: string;
  fn: AsyncFn;
}

export interface TestResult {
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  durationMs: number;
  error?: { message: string; stack?: string };
}

export interface SuiteResult {
  name: string;
  kind: 'module' | 'flow';
  tests: TestResult[];
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  setupError?: { message: string; stack?: string };
}

export interface Suite {
  name: string;
  kind: 'module' | 'flow';
  beforeAll?: AsyncFn;
  afterAll?: AsyncFn;
  tests: TestCase[];
}

/**
 * Builder used inside `register(suite)` callbacks.
 */
export class SuiteBuilder {
  private suite: Suite;

  constructor(name: string, kind: 'module' | 'flow') {
    this.suite = { name, kind, tests: [] };
  }

  describe(_description: string, body: () => void) {
    // We keep it flat; "describe" is only for readability in the file.
    // The description is prepended to every test name declared inside `body`.
    const prevPrefix = this._prefix;
    this._prefix = prevPrefix ? `${prevPrefix} > ${_description}` : _description;
    body();
    this._prefix = prevPrefix;
  }

  private _prefix = '';

  it(name: string, fn: AsyncFn) {
    const finalName = this._prefix ? `${this._prefix} > ${name}` : name;
    this.suite.tests.push({ name: finalName, fn });
  }

  beforeAll(fn: AsyncFn) {
    this.suite.beforeAll = fn;
  }

  afterAll(fn: AsyncFn) {
    this.suite.afterAll = fn;
  }

  getSuite(): Suite {
    return this.suite;
  }
}

export type SuiteRegisterFn = (b: SuiteBuilder) => void | Promise<void>;

export async function runSuite(
  name: string,
  kind: 'module' | 'flow',
  register: SuiteRegisterFn,
  filter?: string
): Promise<SuiteResult> {
  const builder = new SuiteBuilder(name, kind);
  await register(builder);
  const suite = builder.getSuite();

  const result: SuiteResult = {
    name,
    kind,
    tests: [],
    passed: 0,
    failed: 0,
    skipped: 0,
    durationMs: 0
  };

  const suiteStart = Date.now();

  // Filter applies to the suite name only
  if (filter && !name.toLowerCase().includes(filter.toLowerCase())) {
    return result;
  }

  try {
    if (suite.beforeAll) {
      await suite.beforeAll();
    }
  } catch (err: any) {
    result.setupError = { message: err?.message || String(err), stack: err?.stack };
    // Mark all tests as failed because setup failed
    for (const t of suite.tests) {
      result.tests.push({
        name: t.name,
        status: 'failed',
        durationMs: 0,
        error: { message: `Setup failed: ${err?.message || err}`, stack: err?.stack }
      });
      result.failed++;
    }
    result.durationMs = Date.now() - suiteStart;
    return result;
  }

  for (const t of suite.tests) {
    const start = Date.now();
    try {
      await t.fn();
      result.tests.push({ name: t.name, status: 'passed', durationMs: Date.now() - start });
      result.passed++;
    } catch (err: any) {
      result.tests.push({
        name: t.name,
        status: 'failed',
        durationMs: Date.now() - start,
        error: { message: err?.message || String(err), stack: err?.stack }
      });
      result.failed++;
    }
  }

  try {
    if (suite.afterAll) {
      await suite.afterAll();
    }
  } catch {
    // afterAll failures are not fatal
  }

  result.durationMs = Date.now() - suiteStart;
  return result;
}

// ---------------- ANSI colors (tiny) ----------------
const enableColor = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code: string, s: string) => (enableColor ? `\x1b[${code}m${s}\x1b[0m` : s);
export const color = {
  green: (s: string) => c('32', s),
  red: (s: string) => c('31', s),
  yellow: (s: string) => c('33', s),
  cyan: (s: string) => c('36', s),
  gray: (s: string) => c('90', s),
  bold: (s: string) => c('1', s),
  dim: (s: string) => c('2', s)
};

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function printSuiteHeader(suite: SuiteResult) {
  const label = suite.kind === 'module' ? `modules/${suite.name}` : `flows/${suite.name}`;
  const padded = `[${label}]`.padEnd(40);
  if (suite.setupError) {
    console.log(
      `${padded} ${color.red('✗ SETUP FAILED')} ${color.gray(`(${formatDuration(suite.durationMs)})`)}`
    );
    console.log(`   ${color.red(suite.setupError.message)}`);
    return;
  }
  const parts: string[] = [];
  if (suite.passed > 0) parts.push(color.green(`${suite.passed} passed`));
  if (suite.failed > 0) parts.push(color.red(`${suite.failed} failed`));
  if (suite.skipped > 0) parts.push(color.yellow(`${suite.skipped} skipped`));
  const summary = parts.join(', ') || color.gray('no tests');
  const icon = suite.failed > 0 ? color.red('✗') : color.green('✓');
  console.log(
    `${padded} ${icon} ${summary} ${color.gray(`(${formatDuration(suite.durationMs)})`)}`
  );

  for (const t of suite.tests) {
    if (t.status === 'failed') {
      console.log(`   ${color.red('✗')} ${t.name}`);
      if (t.error) {
        const msg = t.error.message.split('\n').slice(0, 5).join('\n      ');
        console.log(`      ${color.red(msg)}`);
      }
    }
  }
}

export function printGlobalSummary(suites: SuiteResult[]) {
  const totalPassed = suites.reduce((s, x) => s + x.passed, 0);
  const totalFailed = suites.reduce((s, x) => s + x.failed, 0);
  const totalSkipped = suites.reduce((s, x) => s + x.skipped, 0);
  const total = totalPassed + totalFailed + totalSkipped;
  const totalMs = suites.reduce((s, x) => s + x.durationMs, 0);

  console.log(color.gray('─'.repeat(60)));
  const parts: string[] = [];
  parts.push(color.green(`${totalPassed} passed`));
  if (totalFailed > 0) parts.push(color.red(`${totalFailed} failed`));
  if (totalSkipped > 0) parts.push(color.yellow(`${totalSkipped} skipped`));
  parts.push(`${total} total`);
  console.log(
    `${color.bold('Total:')} ${parts.join(', ')}  ${color.gray(`(${formatDuration(totalMs)})`)}`
  );
  console.log(color.gray('─'.repeat(60)));
}
