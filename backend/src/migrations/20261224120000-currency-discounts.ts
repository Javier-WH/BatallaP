import { QueryInterface, DataTypes } from 'sequelize';

// Discounts for paying in a given currency (e.g. 20% for USDT), defined per
// school period. An allocation records the bonus it received from the rule.
export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    const tables = (await queryInterface.showAllTables()).map(t => String(typeof t === 'string' ? t : (t as any).tableName ?? t));
    if (!tables.includes('currency_discounts')) {
      await queryInterface.createTable('currency_discounts', {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        schoolPeriodId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'school_periods', key: 'id' } },
        name: { type: DataTypes.STRING(100), allowNull: false },
        currency: { type: DataTypes.STRING(8), allowNull: false },
        kind: { type: DataTypes.ENUM('percent', 'fixed'), allowNull: false },
        value: { type: DataTypes.DECIMAL(18, 2), allowNull: false },
        validFrom: { type: DataTypes.DATEONLY, allowNull: true },
        validTo: { type: DataTypes.DATEONLY, allowNull: true },
        active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        note: { type: DataTypes.TEXT, allowNull: true },
        createdByPersonId: { type: DataTypes.INTEGER, allowNull: true },
        createdAt: { type: DataTypes.DATE, allowNull: false },
        updatedAt: { type: DataTypes.DATE, allowNull: false },
      });
      await queryInterface.addIndex('currency_discounts', ['schoolPeriodId', 'currency', 'active'], { name: 'currency_discounts_period_currency_active' });
    }
    const allocations = await queryInterface.describeTable('payment_allocations');
    if (!allocations.bonus) {
      await queryInterface.addColumn('payment_allocations', 'bonus', { type: DataTypes.DECIMAL(18, 2), allowNull: false, defaultValue: 0 });
    }
    if (!allocations.currencyDiscountId) {
      await queryInterface.addColumn('payment_allocations', 'currencyDiscountId', { type: DataTypes.INTEGER, allowNull: true });
    }
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.removeColumn('payment_allocations', 'currencyDiscountId');
    await queryInterface.removeColumn('payment_allocations', 'bonus');
    await queryInterface.dropTable('currency_discounts');
  },
};
