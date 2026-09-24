import sequelize from './src/config/database';
import { QueryTypes } from 'sequelize';

async function main() {
  const periodId = 3;
  const q = (sql: string) => sequelize.query(sql, { type: QueryTypes.SELECT, replacements: { p: periodId } });

  console.log('--- matriculations de 341 y 364 ---');
  console.log(await q(`
    SELECT m.id, m.personId, m.status, m.inscriptionId, m.gradeId, m.createdAt, m.updatedAt
    FROM matriculations m WHERE m.schoolPeriodId = :p AND m.personId IN (341, 364)`));

  console.log('--- inscriptions de 341 y 364 ---');
  console.log(await q(`
    SELECT i.id, i.personId, i.gradeId, i.sectionId, i.escolaridad, i.createdAt,
      (SELECT COUNT(*) FROM inscription_subjects ins WHERE ins.inscriptionId = i.id) AS materias
    FROM inscriptions i WHERE i.schoolPeriodId = :p AND i.personId IN (341, 364)`));

  console.log('--- comparacion: matriculation pending tipica (sin inscription) ---');
  console.log(await q(`
    SELECT m.id, m.personId, m.status, m.inscriptionId
    FROM matriculations m WHERE m.schoolPeriodId = :p AND m.status='pending' LIMIT 5`));

  console.log('--- cuantas matriculations completed tienen inscriptionId NULL ---');
  console.log(await q(`
    SELECT status, COUNT(*) AS n, SUM(inscriptionId IS NULL) AS sin_insc_id
    FROM matriculations WHERE schoolPeriodId = :p GROUP BY status`));

  console.log('--- inscripciones del periodo cuya matriculation no apunta a ellas ---');
  console.log(await q(`
    SELECT i.id, i.personId, i.sectionId, i.escolaridad, m.id AS mat_id, m.status AS mat_status
    FROM inscriptions i
    LEFT JOIN matriculations m ON m.inscriptionId = i.id
    WHERE i.schoolPeriodId = :p AND m.id IS NULL`));

  await sequelize.close();
}
main().catch(e => { console.error(e); process.exit(1); });
