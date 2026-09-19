import { QueryInterface, DataTypes } from 'sequelize';

// Moves the per-subject weeklyBlocks override from schedule_exceptions to
// subjects. NULL keeps meaning "use PeriodGradeSubject.weeklyBlocks".
export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    const subjDesc: any = await queryInterface.describeTable('subjects');
    if (!subjDesc.weeklyBlocks) {
      await queryInterface.addColumn('subjects', 'weeklyBlocks', {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      });
    }

    const excDesc: any = await queryInterface.describeTable('schedule_exceptions');
    if (excDesc.weeklyBlocks) {
      // Copy existing overrides into subjects before dropping the old column.
      // Correlated subquery works on both MySQL/MariaDB and SQLite.
      await queryInterface.sequelize.query(`
        UPDATE subjects SET weeklyBlocks = (
          SELECT se.weeklyBlocks FROM schedule_exceptions se
          WHERE se.subjectId = subjects.id
        )
        WHERE id IN (
          SELECT subjectId FROM schedule_exceptions WHERE weeklyBlocks IS NOT NULL
        )
      `);
      await queryInterface.removeColumn('schedule_exceptions', 'weeklyBlocks');
    }
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    const excDesc: any = await queryInterface.describeTable('schedule_exceptions');
    if (!excDesc.weeklyBlocks) {
      await queryInterface.addColumn('schedule_exceptions', 'weeklyBlocks', {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      });
      await queryInterface.sequelize.query(`
        UPDATE schedule_exceptions SET weeklyBlocks = (
          SELECT s.weeklyBlocks FROM subjects s
          WHERE s.id = schedule_exceptions.subjectId
        )
        WHERE subjectId IN (
          SELECT id FROM subjects WHERE weeklyBlocks IS NOT NULL
        )
      `);
    }

    const subjDesc: any = await queryInterface.describeTable('subjects');
    if (subjDesc.weeklyBlocks) {
      await queryInterface.removeColumn('subjects', 'weeklyBlocks');
    }
  },
};
