import { QueryInterface, DataTypes } from 'sequelize';

export default {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable('section_guides', {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      teacherId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'people', key: 'id' },
      },
      gradeId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'grades', key: 'id' },
      },
      sectionId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'sections', key: 'id' },
      },
      schoolPeriodId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'school_periods', key: 'id' },
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    });

    await queryInterface.addIndex('section_guides', ['gradeId', 'sectionId', 'schoolPeriodId'], {
      unique: true,
      name: 'unique_guide_per_grade_section_period',
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable('section_guides');
  }
};
