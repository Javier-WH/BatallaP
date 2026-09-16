import sequelize from './src/config/database';
import './src/models/index';
import { PeriodClosureExecutor } from './src/services/periodClosureExecutor';

async function run() {
  const periodId = Number(process.argv[2] || 2);
  console.log(`[run_closure] Executing closure for period ${periodId}...`);

  const result = await PeriodClosureExecutor.executeClosure(periodId);

  console.log('[run_closure] success:', result.success);
  console.log('[run_closure] stats:', JSON.stringify(result.stats));
  if (result.errors?.length) {
    console.log('[run_closure] errors:', JSON.stringify(result.errors, null, 2));
  }
  const log = result.log as any;
  const entries: any[] = log?.processLog || [];
  const failed = entries.filter((e: any) => e.failed || e.skipped);
  console.log(`[run_closure] processLog entries=${entries.length} skipped/failed=${failed.length}`);
  for (const f of failed.slice(0, 20)) {
    console.log('  -', JSON.stringify(f));
  }

  await sequelize.close();
  process.exit(result.success ? 0 : 1);
}

run().catch(err => {
  console.error('[run_closure] fatal:', err);
  process.exit(1);
});
