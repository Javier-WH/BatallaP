import { QueryInterface, DataTypes } from 'sequelize';

// CORRECTED: color belongs on period_grade_sections, not sections

export async function up(queryInterface: QueryInterface) {
  await queryInterface.addColumn('period_grade_sections', 'color', {
    type: DataTypes.STRING(7),
    allowNull: false,
    defaultValue: '#ffffff',
  });
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.removeColumn('period_grade_sections', 'color');
}