import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface) {
  await queryInterface.addColumn('grade_edit_audits', 'previousPlantelId', {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Plantel asociado a la nota antes de la modificación',
  });

  await queryInterface.addColumn('grade_edit_audits', 'newPlantelId', {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Plantel asociado a la nota después de la modificación',
  });
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.removeColumn('grade_edit_audits', 'previousPlantelId');
  await queryInterface.removeColumn('grade_edit_audits', 'newPlantelId');
}
