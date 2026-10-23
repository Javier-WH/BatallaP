/**
 * rebalanceDiscountedPayments.ts
 *
 * One-off repair: for every inscription with an active discount, takes back the
 * payment credit that exceeds the (net) amount of a discounted charge and
 * re-applies it to the next pending debts. Safe to re-run (idempotent).
 *
 *   npx ts-node -r tsconfig-paths/register src/scripts/rebalanceDiscountedPayments.ts
 */
import sequelize from '@/config/database';
import { InscriptionDiscount } from '@/models/index';
import { releaseOverpaidAllocations } from '@/services/paymentAllocationService';

(async () => {
  const rows = await InscriptionDiscount.findAll({ where: { active: true }, attributes: ['inscriptionId'] });
  const ids = [...new Set(rows.map(r => r.inscriptionId))];
  for (const id of ids) {
    await sequelize.transaction(t => releaseOverpaidAllocations(id, t));
    console.log(`[rebalance] inscription ${id} done`);
  }
  console.log(`[rebalance] ${ids.length} inscription(s) processed`);
  await sequelize.close();
})().catch(e => { console.error(e); process.exit(1); });
