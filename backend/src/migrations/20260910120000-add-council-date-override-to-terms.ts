import { QueryInterface, DataTypes } from 'sequelize';

export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    // Guard: column may already exist if created by sequelize.sync() before
    // migrations ran. Existing rows keep NULL (no override) — no data loss.
    const tableDesc: any = await queryInterface.describeTable('terms');
    if (!tableDesc.councilCompletedAtOverride) {
      await queryInterface.addColumn('terms', 'councilCompletedAtOverride', {
        type: DataTypes.DATEONLY,
        allowNull: true,
      });
    }
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    const tableDesc: any = await queryInterface.describeTable('terms');
    if (tableDesc.councilCompletedAtOverride) {
      await queryInterface.removeColumn('terms', 'councilCompletedAtOverride');
    }
  }
};
