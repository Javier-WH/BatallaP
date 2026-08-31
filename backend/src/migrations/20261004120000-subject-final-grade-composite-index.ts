import { QueryInterface } from 'sequelize';

export default {
  up: async (queryInterface: QueryInterface) => {
    // Drop the old unique index on inscriptionSubjectId alone
    // The index name in MySQL is auto-generated; find and drop it.
    try {
      await queryInterface.removeIndex('subject_final_grades', 'subject_final_grades_inscription_subject_id');
    } catch {
      // Index name may vary; try the Sequelize-generated name
      try {
        await queryInterface.removeIndex('subject_final_grades', 'inscription_subject_id');
      } catch {
        // If neither exists, skip — sync() will have created the new one
      }
    }

    // Create the new composite unique index
    await queryInterface.addIndex('subject_final_grades', {
      fields: ['inscriptionSubjectId', 'gradeType'],
      unique: true,
      name: 'idx_subject_final_grades_inssub_gradetype',
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeIndex('subject_final_grades', 'idx_subject_final_grades_inssub_gradetype');
    await queryInterface.addIndex('subject_final_grades', {
      fields: ['inscriptionSubjectId'],
      unique: true,
    });
  }
};
