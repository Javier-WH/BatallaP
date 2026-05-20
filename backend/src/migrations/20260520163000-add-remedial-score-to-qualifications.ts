import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface) {
  // Check if column already exists to prevent errors
  const tableInfo = await queryInterface.describeTable('qualifications');
  if (!tableInfo.remedialScore) {
    await queryInterface.addColumn('qualifications', 'remedialScore', {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
    });
  }
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.removeColumn('qualifications', 'remedialScore');
}
