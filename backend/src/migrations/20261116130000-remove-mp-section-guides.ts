import { QueryInterface } from 'sequelize';

export default {
  // The MP auxiliary section has no guide teacher. Remove any SectionGuide rows
  // mistakenly assigned to it (only possible before the isMateriaPendiente flag
  // existed and the section was offered in the guide-teacher UI).
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.sequelize.query(`
      DELETE sg FROM section_guides sg
      INNER JOIN sections s ON s.id = sg.sectionId
      WHERE s.isMateriaPendiente = 1
    `);
  },

  async down(): Promise<void> {
    // No-op: deleted rows were erroneous assignments and cannot be reconstructed.
  },
};
