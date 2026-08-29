import { QueryInterface, DataTypes } from 'sequelize';

export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    // Add weeklyBlocks to period_grade_subjects
    const pgsDesc: any = await queryInterface.describeTable('period_grade_subjects');
    if (!pgsDesc.weeklyBlocks) {
      await queryInterface.addColumn('period_grade_subjects', 'weeklyBlocks', {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 2,
      });
    }

    // Add allowConsecutiveBlocks to subjects
    const subjDesc: any = await queryInterface.describeTable('subjects');
    if (!subjDesc.allowConsecutiveBlocks) {
      await queryInterface.addColumn('subjects', 'allowConsecutiveBlocks', {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    const pgsDesc: any = await queryInterface.describeTable('period_grade_subjects');
    if (pgsDesc.weeklyBlocks) {
      await queryInterface.removeColumn('period_grade_subjects', 'weeklyBlocks');
    }
    const subjDesc: any = await queryInterface.describeTable('subjects');
    if (subjDesc.allowConsecutiveBlocks) {
      await queryInterface.removeColumn('subjects', 'allowConsecutiveBlocks');
    }
  },
};
