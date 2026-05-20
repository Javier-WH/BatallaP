import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface) {
  await queryInterface.addColumn('qualifications', 'remedialScore', {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
  });
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.removeColumn('qualifications', 'remedialScore');
}