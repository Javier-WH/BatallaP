import { QueryInterface, DataTypes } from 'sequelize';

/**
 * Add 'completed' status to revision_periods and new audit fields.
 *
 * Status flow changes from:  pending → open → closed
 * to:                         pending → open → completed → closed
 *
 * - 'completed' = human check: revision grades are final, auto-fail pendings.
 *   FinalGradeCalculator reads revision grades from this point onward.
 * - 'closed' = set by periodClosureExecutor after the school year closure.
 *   Prevents further edits but does NOT trigger grade calculation.
 */
export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    // 1. Add new columns
    const tableDesc: any = await queryInterface.describeTable('revision_periods');
    if (!tableDesc.completedAt) {
      await queryInterface.addColumn('revision_periods', 'completedAt', {
        type: DataTypes.DATE,
        allowNull: true,
      });
    }
    if (!tableDesc.completedBy) {
      await queryInterface.addColumn('revision_periods', 'completedBy', {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
      });
    }

    // 2. Change the status ENUM.
    //    MySQL ENUM: we must ALTER the column type to include the new value.
    //    Existing 'closed' rows are migrated to 'completed' so they remain
    //    valid (they were closed before this migration, meaning revisions
    //    were done; the new 'closed' will only be set by periodClosureExecutor).
    await queryInterface.sequelize.query(
      `UPDATE revision_periods SET status = 'completed' WHERE status = 'closed'`
    );

    await queryInterface.changeColumn('revision_periods', 'status', {
      type: DataTypes.ENUM('pending', 'open', 'completed', 'closed'),
      allowNull: false,
      defaultValue: 'pending',
    });
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    // Revert 'completed' back to 'closed' (closest old equivalent)
    await queryInterface.sequelize.query(
      `UPDATE revision_periods SET status = 'closed' WHERE status = 'completed'`
    );

    await queryInterface.changeColumn('revision_periods', 'status', {
      type: DataTypes.ENUM('pending', 'open', 'closed'),
      allowNull: false,
      defaultValue: 'pending',
    });

    await queryInterface.removeColumn('revision_periods', 'completedBy');
    await queryInterface.removeColumn('revision_periods', 'completedAt');
  },
};
