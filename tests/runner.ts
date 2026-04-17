#!/usr/bin/env ts-node
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import {
  runSuite,
  printSuiteHeader,
  printGlobalSummary,
  color,
  SuiteResult,
  SuiteRegisterFn
} from './lib/runner-core';

dotenv.config();

// ---------------- CLI args ----------------
const args = process.argv.slice(2);
const only = args.find(a => a.startsWith('--only='))?.split('=')[1] as
  | 'modules'
  | 'flows'
  | undefined;
const wantJson = args.includes('--json');
// First positional arg (not starting with --) is a filter
const filter = args.find(a => !a.startsWith('--'));

// ---------------- Suite registry ----------------
interface SuiteDef {
  name: string;
  kind: 'module' | 'flow';
  file: string;
}

function discoverSuites(dir: 'modules' | 'flows'): SuiteDef[] {
  const folder = path.join(__dirname, dir);
  if (!fs.existsSync(folder)) return [];
  const files = fs
    .readdirSync(folder)
    .filter(f => f.endsWith('.ts') && !f.endsWith('.d.ts'))
    .sort();
  return files.map(f => ({
    name: f.replace(/\.(spec|flow)\.ts$/, '').replace(/\.ts$/, ''),
    kind: dir === 'modules' ? 'module' : 'flow',
    file: path.join(folder, f)
  }));
}

async function loadRegister(file: string): Promise<SuiteRegisterFn> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require(file);
  const reg = mod.default || mod.register;
  if (typeof reg !== 'function') {
    throw new Error(`Module ${file} must export a default function(suiteBuilder)`);
  }
  return reg as SuiteRegisterFn;
}

// ---------------- Main ----------------
(async function main() {
  const baseURL = process.env.BASE_URL || 'http://localhost:3000/api';
  const username = process.env.USERNAME || 'Javier';

  console.log(color.bold('═'.repeat(60)));
  console.log(color.bold('  BatallaProject Smoke Test Runner'));
  console.log(`  ${color.gray('BASE_URL:')} ${baseURL}`);
  console.log(`  ${color.gray('USER:    ')} ${username}`);
  if (filter) console.log(`  ${color.gray('FILTER:  ')} ${filter}`);
  if (only) console.log(`  ${color.gray('ONLY:    ')} ${only}`);
  console.log(color.bold('═'.repeat(60)));
  console.log();

  const defs: SuiteDef[] = [];
  if (!only || only === 'modules') defs.push(...discoverSuites('modules'));
  if (!only || only === 'flows') defs.push(...discoverSuites('flows'));

  const results: SuiteResult[] = [];

  for (const def of defs) {
    if (filter && !def.name.toLowerCase().includes(filter.toLowerCase())) continue;
    try {
      const reg = await loadRegister(def.file);
      const res = await runSuite(def.name, def.kind, reg);
      results.push(res);
      printSuiteHeader(res);
    } catch (err: any) {
      console.log(
        `${color.red('✗ LOAD FAILED')} ${def.kind}/${def.name}: ${err?.message || err}`
      );
      results.push({
        name: def.name,
        kind: def.kind,
        tests: [],
        passed: 0,
        failed: 1,
        skipped: 0,
        durationMs: 0,
        setupError: { message: err?.message || String(err), stack: err?.stack }
      });
    }
  }

  console.log();
  printGlobalSummary(results);

  const totalFailed = results.reduce((s, x) => s + x.failed, 0);
  const hasSetupError = results.some(r => r.setupError);

  if (wantJson) {
    const outFile = path.join(__dirname, 'report.json');
    fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
    console.log(color.gray(`Report written to ${outFile}`));
  }

  process.exit(totalFailed > 0 || hasSetupError ? 1 : 0);
})().catch(err => {
  console.error(color.red('FATAL:'), err);
  process.exit(2);
});
