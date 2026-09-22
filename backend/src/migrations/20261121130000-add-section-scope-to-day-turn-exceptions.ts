import { QueryInterface, DataTypes } from 'sequelize';

export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    const desc: any = await queryInterface.describeTable('schedule_day_turn_exceptions');

    if (!desc.periodGradeSectionId) {
      await queryInterface.addColumn('schedule_day_turn_exceptions', 'periodGradeSectionId', {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
        references: { model: 'period_grade_sections', key: 'id' },
        onDelete: 'CASCADE',
      });
    }

    // Widen the uniqueness scope to (grade, section, subject); section NULL = whole grade
    try {
      await queryInterface.removeIndex('schedule_day_turn_exceptions', 'schedule_day_turn_exceptions_pg_subject_unique');
    } catch {
      console.log('[migration] Old day-turn index not found, skipping drop');
    }
    try {
      await queryInterface.addIndex('schedule_day_turn_exceptions', ['periodGradeId', 'periodGradeSectionId', 'subjectId'], {
        unique: true,
        name: 'schedule_day_turn_exceptions_pg_section_subject_unique',
      });
    } catch {
      console.log('[migration] New day-turn index already exists, skipping');
    }
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    try {
      await queryInterface.removeIndex('schedule_day_turn_exceptions', 'schedule_day_turn_exceptions_pg_section_subject_unique');
    } catch {
      console.log('[migration] New day-turn index not found, skipping drop');
    }
    const desc: any = await queryInterface.describeTable('schedule_day_turn_exceptions');
    if (desc.periodGradeSectionId) {
      await queryInterface.removeColumn('schedule_day_turn_exceptions', 'periodGradeSectionId');
    }
    await queryInterface.addIndex('schedule_day_turn_exceptions', ['periodGradeId', 'subjectId'], {
      unique: true,
      name: 'schedule_day_turn_exceptions_pg_subject_unique',
    });
  },
};
