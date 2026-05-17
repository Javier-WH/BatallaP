import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface) {
  // Add color to period_grade_sections
  await queryInterface.addColumn('period_grade_sections', 'color', {
    type: DataTypes.STRING(7),
    allowNull: false,
    defaultValue: '#ffffff',
  });

  // Clean up: remove color from sections if it exists from previous migration
  try {
    await queryInterface.removeColumn('sections', 'color');
  } catch {
    // Safe to ignore if column doesn't exist
  }
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.removeColumn('period_grade_sections', 'color');
}