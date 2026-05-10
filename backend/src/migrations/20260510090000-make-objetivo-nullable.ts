import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface) {
  await queryInterface.changeColumn('evaluation_plans', 'objetivo', {
    type: DataTypes.TEXT,
    allowNull: true,
  });
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.changeColumn('evaluation_plans', 'objetivo', {
    type: DataTypes.TEXT,
    allowNull: false,
  });
}