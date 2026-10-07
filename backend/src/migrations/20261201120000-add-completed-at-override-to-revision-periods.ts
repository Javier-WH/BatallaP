import { QueryInterface, DataTypes } from 'sequelize';

export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    // Guard: column may already exist if created by sequelize.sync() before
    // migrations ran. Existing rows keep NULL (no override) — no data loss.
    const tableDesc: any = await queryInterface.describeTable('revision_periods');
    if (!tableDesc.completedAtOverride) {
      await queryInterface.addColumn('revision_periods', 'completedAtOverride', {
        type: DataTypes.DATEONLY,
        allowNull: true,
      });
    }
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    const tableDesc: any = await queryInterface.describeTable('revision_periods');
    if (tableDesc.completedAtOverride) {
      await queryInterface.removeColumn('revision_periods', 'completedAtOverride');
    }
  }
};
