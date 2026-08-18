import { QueryInterface, DataTypes } from 'sequelize';

// Optional visual identity per subject. When null, the frontend falls back to a
// keyword-based map (see frontend/src/utils/subjectVisuals.ts).

export async function up(queryInterface: QueryInterface) {
  await queryInterface.addColumn('subjects', 'icon', {
    type: DataTypes.STRING(50),
    allowNull: true,
  });
  await queryInterface.addColumn('subjects', 'color', {
    type: DataTypes.STRING(7),
    allowNull: true,
  });
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.removeColumn('subjects', 'icon');
  await queryInterface.removeColumn('subjects', 'color');
}
