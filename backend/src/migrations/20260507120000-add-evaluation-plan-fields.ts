import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface) {
  await queryInterface.addColumn('evaluation_plans', 'temaGenerador', {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Tema generador de la evaluacion',
  });

  await queryInterface.addColumn('evaluation_plans', 'referentesTeoricos', {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Referentes teoricos de la evaluacion',
  });

  await queryInterface.addColumn('evaluation_plans', 'referentesEticos', {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Referentes eticos e indispensables',
  });

  await queryInterface.addColumn('evaluation_plans', 'estrategiaEvaluacion', {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Estrategia de evaluacion',
  });

  await queryInterface.addColumn('evaluation_plans', 'tipoEvaluacion', {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Tipo de evaluacion',
  });

  await queryInterface.addColumn('evaluation_plans', 'formaEvaluacion', {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Forma de evaluacion',
  });

  await queryInterface.addColumn('evaluation_plans', 'indicador', {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Indicador de desempeño',
  });
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.removeColumn('evaluation_plans', 'temaGenerador');
  await queryInterface.removeColumn('evaluation_plans', 'referentesTeoricos');
  await queryInterface.removeColumn('evaluation_plans', 'referentesEticos');
  await queryInterface.removeColumn('evaluation_plans', 'estrategiaEvaluacion');
  await queryInterface.removeColumn('evaluation_plans', 'tipoEvaluacion');
  await queryInterface.removeColumn('evaluation_plans', 'formaEvaluacion');
  await queryInterface.removeColumn('evaluation_plans', 'indicador');
}