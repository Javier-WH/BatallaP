import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface) {
  await queryInterface.addColumn('grade_edit_audits', 'actCode', {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Número de acta asociado a la modificación',
  });
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.removeColumn('grade_edit_audits', 'actCode');
}
