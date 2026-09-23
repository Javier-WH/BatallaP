import { QueryInterface, QueryTypes } from 'sequelize';

/**
 * Regla de negocio: "matricular" = asignar a una sección. No puede existir un
 * estudiante matriculado (matriculations.status = 'completed') sin sección.
 *
 * Reparación de datos NO destructiva (no borra filas):
 *  A) Matriculado sin sección en `matriculations` pero con sección en su
 *     inscripción → se restaura la sección desde la inscripción.
 *  B) Matriculado con sección en `matriculations` pero sin sección en su
 *     inscripción → se sincroniza la inscripción.
 *  C) Matriculado sin sección en ningún lado → pasa a 'pending'
 *     (No Matriculados), igual que "Sacar de Matrícula". Notas, materias y la
 *     inscripción se conservan; Control de Estudios lo vuelve a matricular.
 *
 * Idempotente. El `down` no revierte (no es posible saber qué filas estaban
 * inconsistentes, y revertir reintroduciría el estado inválido).
 */
const count = async (qi: QueryInterface, sql: string): Promise<number> => {
  const rows = await qi.sequelize.query<{ total: number | string }>(sql, { type: QueryTypes.SELECT });
  return Number(rows[0]?.total ?? 0);
};

export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    const q = queryInterface.sequelize;

    // A) Restore section from the inscription
    const restoreFromInscriptionWhere = `
      m.status = 'completed' AND m.sectionId IS NULL AND m.inscriptionId IS NOT NULL
      AND EXISTS (SELECT 1 FROM inscriptions i WHERE i.id = m.inscriptionId AND i.sectionId IS NOT NULL)`;
    const restoredA = await count(queryInterface, `SELECT COUNT(*) AS total FROM matriculations m WHERE ${restoreFromInscriptionWhere}`);
    if (restoredA > 0) {
      await q.query(`
        UPDATE matriculations
        SET sectionId = (SELECT i.sectionId FROM inscriptions i WHERE i.id = matriculations.inscriptionId)
        WHERE status = 'completed' AND sectionId IS NULL AND inscriptionId IS NOT NULL
          AND EXISTS (SELECT 1 FROM inscriptions i WHERE i.id = matriculations.inscriptionId AND i.sectionId IS NOT NULL)
      `);
    }

    // B) Sync inscription section from the matriculation
    const syncedB = await count(queryInterface, `
      SELECT COUNT(*) AS total FROM inscriptions i
      WHERE i.sectionId IS NULL AND EXISTS (
        SELECT 1 FROM matriculations m
        WHERE m.inscriptionId = i.id AND m.status = 'completed' AND m.sectionId IS NOT NULL)`);
    if (syncedB > 0) {
      await q.query(`
        UPDATE inscriptions
        SET sectionId = (
          SELECT m.sectionId FROM matriculations m
          WHERE m.inscriptionId = inscriptions.id AND m.status = 'completed' AND m.sectionId IS NOT NULL
          LIMIT 1)
        WHERE sectionId IS NULL AND EXISTS (
          SELECT 1 FROM matriculations m
          WHERE m.inscriptionId = inscriptions.id AND m.status = 'completed' AND m.sectionId IS NOT NULL)
      `);
    }

    // C) No section anywhere → back to "No Matriculados"
    const demotedC = await count(queryInterface, `
      SELECT COUNT(*) AS total FROM matriculations WHERE status = 'completed' AND sectionId IS NULL`);
    if (demotedC > 0) {
      await q.query(`UPDATE matriculations SET status = 'pending' WHERE status = 'completed' AND sectionId IS NULL`);
    }

    console.log(
      `[migration] enforce-matriculated-has-section: ` +
      `A) ${restoredA} sección restaurada desde inscripción, ` +
      `B) ${syncedB} inscripción sincronizada, ` +
      `C) ${demotedC} enviados a No Matriculados`
    );
  },

  async down(): Promise<void> {
    // Irreversible data repair — intentionally a no-op.
  },
};
