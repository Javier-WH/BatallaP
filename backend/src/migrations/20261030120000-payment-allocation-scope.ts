import { QueryInterface, DataTypes } from 'sequelize';

export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.addColumn('payments', 'allocationScope', {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'How this payment was targeted: auto|tuition|item|charge|month|oneTime',
    });
  },
  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.removeColumn('payments', 'allocationScope');
  },
};
