import { QueryInterface, DataTypes } from 'sequelize';

const CODES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Fees and enrollment plans become versioned by `effectiveMonth`.
 * Existing rows are backfilled with the first billing month of their period
 * so every previous cost keeps applying to the whole period.
 */
export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    const feesDesc: any = await queryInterface.describeTable('fees');
    if (!feesDesc.effectiveMonth) {
      await queryInterface.addColumn('fees', 'effectiveMonth', { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'Sep' });
    }
    const plansDesc: any = await queryInterface.describeTable('enrollment_plans');
    if (!plansDesc.effectiveMonth) {
      await queryInterface.addColumn('enrollment_plans', 'effectiveMonth', { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'Sep' });
    }

    const [periods]: any = await queryInterface.sequelize.query('SELECT id, billingStartMonth FROM school_periods');
    for (const p of periods) {
      const code = CODES[(Number(p.billingStartMonth ?? 9) - 1 + 12) % 12];
      await queryInterface.sequelize.query('UPDATE fees SET effectiveMonth = :code WHERE schoolPeriodId = :id', { replacements: { code, id: p.id } });
      await queryInterface.sequelize.query('UPDATE enrollment_plans SET effectiveMonth = :code WHERE schoolPeriodId = :id', { replacements: { code, id: p.id } });
    }

    // Add the new unique index BEFORE dropping the old one (the old one may back the FK on schoolPeriodId).
    const indexes: any[] = (await queryInterface.showIndex('fees')) as any[];
    if (!indexes.some(i => i.name === 'uq_fees_period_key_month')) {
      await queryInterface.addIndex('fees', ['schoolPeriodId', 'key', 'effectiveMonth'], { unique: true, name: 'uq_fees_period_key_month' });
    }
    if (indexes.some(i => i.name === 'uq_fees_period_key')) {
      await queryInterface.removeIndex('fees', 'uq_fees_period_key');
    }
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    const indexes: any[] = (await queryInterface.showIndex('fees')) as any[];
    if (!indexes.some(i => i.name === 'uq_fees_period_key')) {
      await queryInterface.addIndex('fees', ['schoolPeriodId', 'key'], { unique: true, name: 'uq_fees_period_key' });
    }
    if (indexes.some(i => i.name === 'uq_fees_period_key_month')) {
      await queryInterface.removeIndex('fees', 'uq_fees_period_key_month');
    }
    const feesDesc: any = await queryInterface.describeTable('fees');
    if (feesDesc.effectiveMonth) await queryInterface.removeColumn('fees', 'effectiveMonth');
    const plansDesc: any = await queryInterface.describeTable('enrollment_plans');
    if (plansDesc.effectiveMonth) await queryInterface.removeColumn('enrollment_plans', 'effectiveMonth');
  },
};
