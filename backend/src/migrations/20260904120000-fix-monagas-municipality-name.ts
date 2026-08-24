import { QueryInterface } from 'sequelize';

/**
 * Renombra el municipio "Monagas" (Anzoátegui) a su nombre oficial
 * "José Gregorio Monagas" en todas las tablas que almacenan municipios.
 *
 * Esto evita la colisión con "José Tadeo Monagas" (Guárico) en la lista
 * plana de municipios del Excel de inscripción masiva.
 */
export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    const tables: Array<{ table: string; column: string }> = [
      { table: 'person_residences', column: 'birth_municipality' },
      { table: 'person_residences', column: 'residence_municipality' },
      { table: 'student_previous_schools', column: 'municipality' },
      { table: 'planteles', column: 'municipality' },
    ];

    for (const { table, column } of tables) {
      await queryInterface.sequelize.query(
        `UPDATE \`${table}\` SET \`${column}\` = 'José Gregorio Monagas' WHERE \`${column}\` = 'Monagas'`
      );
    }
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    const tables: Array<{ table: string; column: string }> = [
      { table: 'person_residences', column: 'birth_municipality' },
      { table: 'person_residences', column: 'residence_municipality' },
      { table: 'student_previous_schools', column: 'municipality' },
      { table: 'planteles', column: 'municipality' },
    ];

    for (const { table, column } of tables) {
      await queryInterface.sequelize.query(
        `UPDATE \`${table}\` SET \`${column}\` = 'Monagas' WHERE \`${column}\` = 'José Gregorio Monagas'`
      );
    }
  }
};
