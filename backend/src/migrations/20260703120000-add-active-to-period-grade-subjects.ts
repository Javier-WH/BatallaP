import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface) {
  await queryInterface.addColumn('period_grade_subjects', 'active', {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  });
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.removeColumn('period_grade_subjects', 'active');
}
