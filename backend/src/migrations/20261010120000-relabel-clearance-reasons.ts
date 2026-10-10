import { QueryInterface } from 'sequelize';

const RELABELS: Array<[string, string, string]> = [
  // [code, newLabel, oldLabel]
  ['nurse_visit', 'Enfermo', 'Visita a enfermería'],
  ['parent_note', 'Llegó tarde', 'Nota del representante'],
];

export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    // Shorter chip labels so the unblock panel fits without scrolling and
    // covers the new in-shift 'inasistente' block (student arrived late).
    // Existing clearances keep the same codes — only display labels change.
    for (const [code, newLabel] of RELABELS) {
      await queryInterface.sequelize.query(
        `UPDATE clearance_reasons SET label = '${newLabel}' WHERE code = '${code}'`
      );
    }
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    for (const [code, , oldLabel] of RELABELS) {
      await queryInterface.sequelize.query(
        `UPDATE clearance_reasons SET label = '${oldLabel}' WHERE code = '${code}'`
      );
    }
  },
};
