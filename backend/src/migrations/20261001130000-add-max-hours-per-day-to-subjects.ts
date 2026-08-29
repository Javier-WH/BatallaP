import { QueryInterface, DataTypes } from 'sequelize';

export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    const subjDesc: any = await queryInterface.describeTable('subjects');
    if (!subjDesc.maxHoursPerDay) {
      await queryInterface.addColumn('subjects', 'maxHoursPerDay', {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      });
    }
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    const subjDesc: any = await queryInterface.describeTable('subjects');
    if (subjDesc.maxHoursPerDay) {
      await queryInterface.removeColumn('subjects', 'maxHoursPerDay');
    }
  },
};
