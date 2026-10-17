import { QueryInterface, DataTypes } from 'sequelize';

// A payment can settle several charges, each in its own currency: one row per
// (payment, charge) with the amount credited in the charge's currency.
export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    const tables = await queryInterface.showAllTables();
    if (tables.includes('payment_allocations')) return;
    await queryInterface.createTable('payment_allocations', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      paymentId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'payments', key: 'id' }, onDelete: 'CASCADE' },
      chargeId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'charges', key: 'id' }, onDelete: 'CASCADE' },
      amount: { type: DataTypes.DECIMAL(18, 2), allowNull: false },
      amountVES: { type: DataTypes.DECIMAL(18, 2), allowNull: false },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    });
    await queryInterface.addIndex('payment_allocations', ['paymentId']);
    await queryInterface.addIndex('payment_allocations', ['chargeId']);
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.dropTable('payment_allocations');
  },
};
