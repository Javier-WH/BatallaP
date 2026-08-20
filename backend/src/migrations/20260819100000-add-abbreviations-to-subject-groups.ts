import { QueryInterface, DataTypes } from 'sequelize';

// Optional abbreviation fields for SubjectGroup. Used in different document types:
// - bulletinAbbreviation: shown in student report cards (boletines)
// - longAbbreviation: used in final summaries (long version)
// - shortAbbreviation: used in final summaries (short version)
// When null, the group's normal name is used as fallback.

export async function up(queryInterface: QueryInterface) {
  await queryInterface.addColumn('subject_groups', 'bulletinAbbreviation', {
    type: DataTypes.STRING,
    allowNull: true,
  });
  await queryInterface.addColumn('subject_groups', 'longAbbreviation', {
    type: DataTypes.STRING,
    allowNull: true,
  });
  await queryInterface.addColumn('subject_groups', 'shortAbbreviation', {
    type: DataTypes.STRING,
    allowNull: true,
  });
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.removeColumn('subject_groups', 'bulletinAbbreviation');
  await queryInterface.removeColumn('subject_groups', 'longAbbreviation');
  await queryInterface.removeColumn('subject_groups', 'shortAbbreviation');
}
