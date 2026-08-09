import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface) {
  await queryInterface.addColumn('evaluation_plans', 'thematicContentIds', {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: null,
    comment: 'IDs de los contenidos temáticos asociados a la evaluación',
  });
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.removeColumn('evaluation_plans', 'thematicContentIds');
}
