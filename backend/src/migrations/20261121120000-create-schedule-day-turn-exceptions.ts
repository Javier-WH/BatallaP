import { QueryInterface, DataTypes } from 'sequelize';

export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    const tables: string[] = await queryInterface.showAllTables();
    if (tables.includes('schedule_day_turn_exceptions')) return;

    await queryInterface.createTable('schedule_day_turn_exceptions', {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      periodGradeId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'period_grades', key: 'id' },
        onDelete: 'CASCADE',
      },
      subjectId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'subjects', key: 'id' },
        onDelete: 'CASCADE',
      },
      day: {
        type: DataTypes.STRING(15),
        allowNull: false,
      },
      turn: {
        type: DataTypes.STRING(10),
        allowNull: false,
      },
      mode: {
        type: DataTypes.STRING(10),
        allowNull: false,
        defaultValue: 'hard',
      },
      weight: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    });

    // One forced day+turn per (grade, subject)
    await queryInterface.addIndex('schedule_day_turn_exceptions', ['periodGradeId', 'subjectId'], {
      unique: true,
      name: 'schedule_day_turn_exceptions_pg_subject_unique',
    });
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.dropTable('schedule_day_turn_exceptions');
  },
};
