import { QueryInterface } from 'sequelize';

// A UI bug saved payments of "Inscripción y otros" with the pseudo-month
// '__other' instead of NULL, so they matched no debt bucket. Normalize them:
// month NULL = payment of month-less debts (enrollment and others).
export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.sequelize.query("UPDATE payments SET month = NULL WHERE month = '__other'");
  },

  async down(): Promise<void> {
    // Not reversible: the original value was a bug.
  },
};
