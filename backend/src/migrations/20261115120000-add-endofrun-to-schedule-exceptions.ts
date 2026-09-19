import { QueryInterface, DataTypes } from 'sequelize';

export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    const excDesc: any = await queryInterface.describeTable('schedule_exceptions');
    if (!excDesc.endOfRun) {
      await queryInterface.addColumn('schedule_exceptions', 'endOfRun', {
        type: DataTypes.STRING(10),
        allowNull: true,
        defaultValue: null,
      });
    }
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    const excDesc: any = await queryInterface.describeTable('schedule_exceptions');
    if (excDesc.endOfRun) {
      await queryInterface.removeColumn('schedule_exceptions', 'endOfRun');
    }
  },
};
