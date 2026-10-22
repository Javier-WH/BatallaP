import { QueryInterface, DataTypes } from 'sequelize';

// A payment shared by several students of the same representative (one
// transfer, one reference) is stored as one row per student tied together by
// `paymentGroupId`.
export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    const payments = await queryInterface.describeTable('payments');
    if (!payments.paymentGroupId) {
      await queryInterface.addColumn('payments', 'paymentGroupId', { type: DataTypes.STRING(36), allowNull: true });
      await queryInterface.addIndex('payments', ['paymentGroupId'], { name: 'payments_payment_group_id' });
    }
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.removeIndex('payments', 'payments_payment_group_id');
    await queryInterface.removeColumn('payments', 'paymentGroupId');
  },
};
