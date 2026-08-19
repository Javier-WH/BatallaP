import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  // Add gradeId column to term_section_closures
  await queryInterface.addColumn('term_section_closures', 'gradeId', {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    references: {
      model: 'grades',
      key: 'id',
    },
    onDelete: 'CASCADE',
  });

  // Drop old unique index (termId, sectionId)
  try {
    await queryInterface.removeIndex('term_section_closures', 'uq_term_section_closures_scope');
  } catch {
    // Index may not exist or already dropped
  }

  // Add new unique index (termId, sectionId, gradeId)
  await queryInterface.addIndex('term_section_closures', ['termId', 'sectionId', 'gradeId'], {
    unique: true,
    name: 'uq_term_section_closures_scope',
  });
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  try {
    await queryInterface.removeIndex('term_section_closures', 'uq_term_section_closures_scope');
  } catch {
    // ignore
  }

  await queryInterface.removeColumn('term_section_closures', 'gradeId');

  await queryInterface.addIndex('term_section_closures', ['termId', 'sectionId'], {
    unique: true,
    name: 'uq_term_section_closures_scope',
  });
}
