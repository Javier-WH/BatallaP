import { QueryInterface, DataTypes } from 'sequelize';

export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    const desc: any = await queryInterface.describeTable('school_periods');
    if (!desc.billingStartMonth) {
      await queryInterface.addColumn('school_periods', 'billingStartMonth', {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 9,
      });
    }
    if (!desc.billingEndMonth) {
      await queryInterface.addColumn('school_periods', 'billingEndMonth', {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 8,
      });
    }
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    const desc: any = await queryInterface.describeTable('school_periods');
    if (desc.billingEndMonth) await queryInterface.removeColumn('school_periods', 'billingEndMonth');
    if (desc.billingStartMonth) await queryInterface.removeColumn('school_periods', 'billingStartMonth');
  },
};
