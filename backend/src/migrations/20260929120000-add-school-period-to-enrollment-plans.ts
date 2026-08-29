import { QueryInterface, DataTypes } from 'sequelize';

export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    const tableDesc: any = await queryInterface.describeTable('enrollment_plans');
    if (!tableDesc.schoolPeriodId) {
      // Add column as nullable first
      await queryInterface.addColumn('enrollment_plans', 'schoolPeriodId', {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'school_periods', key: 'id' },
        onDelete: 'CASCADE',
      });

      // Backfill: assign the active period to existing plans
      await queryInterface.sequelize.query(`
        UPDATE enrollment_plans ep
        SET schoolPeriodId = (
          SELECT id FROM school_periods WHERE status = 'activo' LIMIT 1
        )
        WHERE ep.schoolPeriodId IS NULL;
      `);

      // Now make it NOT NULL
      await queryInterface.changeColumn('enrollment_plans', 'schoolPeriodId', {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'school_periods', key: 'id' },
        onDelete: 'CASCADE',
      });
    }
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    const tableDesc: any = await queryInterface.describeTable('enrollment_plans');
    if (tableDesc.schoolPeriodId) {
      await queryInterface.removeColumn('enrollment_plans', 'schoolPeriodId');
    }
  },
};
