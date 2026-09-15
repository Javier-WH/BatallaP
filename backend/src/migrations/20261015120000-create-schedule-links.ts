import { QueryInterface, DataTypes } from 'sequelize';

export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.createTable('schedule_links', {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },
      schoolPeriodId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'school_periods', key: 'id' },
        onDelete: 'CASCADE',
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

    await queryInterface.createTable('schedule_link_items', {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      linkId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'schedule_links', key: 'id' },
        onDelete: 'CASCADE',
      },
      subjectId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'subjects', key: 'id' },
      },
      periodGradeId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'period_grades', key: 'id' },
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

    // A (subjectId, periodGradeId) pair can only belong to one link
    await queryInterface.addIndex('schedule_link_items', ['subjectId', 'periodGradeId'], {
      unique: true,
      name: 'schedule_link_items_subject_id_period_grade_id_unique',
    });
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    try {
      await queryInterface.removeIndex('schedule_link_items', 'schedule_link_items_subject_id_period_grade_id_unique');
    } catch (e) {
      console.log('[migration] Index not found, skipping drop');
    }
    await queryInterface.dropTable('schedule_link_items');
    await queryInterface.dropTable('schedule_links');
  },
};
