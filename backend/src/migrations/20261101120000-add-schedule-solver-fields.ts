import { QueryInterface, DataTypes } from 'sequelize';

export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    const subjDesc: any = await queryInterface.describeTable('subjects');
    if (!subjDesc.difficulty) {
      await queryInterface.addColumn('subjects', 'difficulty', {
        type: DataTypes.STRING(10),
        allowNull: false,
        defaultValue: 'medium',
      });
    }

    const excDesc: any = await queryInterface.describeTable('schedule_exceptions');
    if (!excDesc.difficulty) {
      await queryInterface.addColumn('schedule_exceptions', 'difficulty', {
        type: DataTypes.STRING(10),
        allowNull: true,
        defaultValue: null,
      });
    }
    if (!excDesc.forcedSlot) {
      await queryInterface.addColumn('schedule_exceptions', 'forcedSlot', {
        type: DataTypes.STRING(20),
        allowNull: true,
        defaultValue: null,
      });
    }
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    const excDesc: any = await queryInterface.describeTable('schedule_exceptions');
    if (excDesc.forcedSlot) {
      await queryInterface.removeColumn('schedule_exceptions', 'forcedSlot');
    }
    if (excDesc.difficulty) {
      await queryInterface.removeColumn('schedule_exceptions', 'difficulty');
    }

    const subjDesc: any = await queryInterface.describeTable('subjects');
    if (subjDesc.difficulty) {
      await queryInterface.removeColumn('subjects', 'difficulty');
    }
  },
};
