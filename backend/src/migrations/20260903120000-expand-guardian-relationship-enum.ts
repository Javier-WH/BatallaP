import { QueryInterface } from 'sequelize';

export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    // MySQL ALTER COLUMN to add new ENUM values. Order matters: existing values
    // must be listed first so MySQL keeps the current column definition.
    await queryInterface.sequelize.query(
      `ALTER TABLE \`student_guardians\` MODIFY COLUMN \`relationship\` ENUM('mother','father','sibling','grandparent','uncle_aunt','representative') NOT NULL`
    );
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    // Revert: first set any rows with new values back to 'representative'
    await queryInterface.sequelize.query(
      `UPDATE \`student_guardians\` SET \`relationship\` = 'representative' WHERE \`relationship\` IN ('sibling','grandparent','uncle_aunt')`
    );
    await queryInterface.sequelize.query(
      `ALTER TABLE \`student_guardians\` MODIFY COLUMN \`relationship\` ENUM('mother','father','representative') NOT NULL`
    );
  }
};
