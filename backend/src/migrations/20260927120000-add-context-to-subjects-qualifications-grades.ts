import { QueryInterface, DataTypes } from 'sequelize';

/**
 * Denormaliza contexto académico (schoolPeriodId, gradeId, sectionId, termId,
 * subjectId, date) directamente en InscriptionSubject, Qualification y
 * SubjectFinalGrade.
 *
 * Todas las columnas se añaden como NULLABLE y se mantienen así: el código
 * las popula al crear registros nuevos, y el backfill llena las filas viejas
 * vía UPDATE + JOIN. No se fuerza NOT NULL para evitar fallos si hay datos
 * huérfanos (InscriptionSubject sin Inscription, Qualification sin
 * EvaluationPlan, etc.).
 *
 * Las columnas nuevas son redundantes con los joins existentes, pero
 * permiten queries directos sin ambigüedad de período/grado/sección/lapso.
 *
 * Esta migración es idempotente: verifica si cada columna/index ya existe
 * antes de crearlo, para poder re-ejecutarse sin errores.
 */

async function columnExists(qi: QueryInterface, table: string, column: string): Promise<boolean> {
  const [rows]: any = await qi.sequelize.query(
    `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    { replacements: [table, column] }
  );
  return Number(rows[0]?.cnt) > 0;
}

async function indexExists(qi: QueryInterface, table: string, indexName: string): Promise<boolean> {
  const [rows]: any = await qi.sequelize.query(
    `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    { replacements: [table, indexName] }
  );
  return Number(rows[0]?.cnt) > 0;
}

async function addColumnIfNotExists(
  qi: QueryInterface, table: string, column: string, config: any
): Promise<void> {
  if (await columnExists(qi, table, column)) {
    console.log(`  ⏭️  Column ${table}.${column} already exists, skipping`);
    return;
  }
  await qi.addColumn(table, column, config);
  console.log(`  ✅ Added ${table}.${column}`);
}

async function addIndexIfNotExists(
  qi: QueryInterface, table: string, fields: string[], options: any
): Promise<void> {
  if (await indexExists(qi, table, options.name)) {
    console.log(`  ⏭️  Index ${options.name} already exists, skipping`);
    return;
  }
  await qi.addIndex(table, fields, options);
  console.log(`  ✅ Added index ${options.name}`);
}

export async function up(queryInterface: QueryInterface): Promise<void> {
  const sequelize = queryInterface.sequelize;

  // ──────────────────────────────────────────────────────────────────────
  // 1. InscriptionSubject: schoolPeriodId, gradeId, sectionId
  // ──────────────────────────────────────────────────────────────────────
  console.log('[migration] Phase 1: InscriptionSubject context columns');
  await addColumnIfNotExists(queryInterface, 'inscription_subjects', 'schoolPeriodId', {
    type: DataTypes.INTEGER, allowNull: true,
    comment: 'Denormalizado desde Inscription.schoolPeriodId',
  });
  await addColumnIfNotExists(queryInterface, 'inscription_subjects', 'gradeId', {
    type: DataTypes.INTEGER, allowNull: true,
    comment: 'Denormalizado desde Inscription.gradeId',
  });
  await addColumnIfNotExists(queryInterface, 'inscription_subjects', 'sectionId', {
    type: DataTypes.INTEGER, allowNull: true,
    comment: 'Denormalizado desde Inscription.sectionId',
  });

  // Backfill desde inscriptions (always run — safe to re-run)
  console.log('[migration] Backfilling inscription_subjects from inscriptions');
  await sequelize.query(`
    UPDATE inscription_subjects ins
    JOIN inscriptions i ON ins.inscriptionId = i.id
    SET
      ins.schoolPeriodId = i.schoolPeriodId,
      ins.gradeId = i.gradeId,
      ins.sectionId = i.sectionId
    WHERE ins.schoolPeriodId IS NULL OR ins.gradeId IS NULL
  `);

  await addIndexIfNotExists(queryInterface, 'inscription_subjects',
    ['schoolPeriodId', 'gradeId', 'subjectId'],
    { name: 'idx_inscription_subjects_context' });

  // ──────────────────────────────────────────────────────────────────────
  // 2. Qualification: schoolPeriodId, termId, subjectId, gradeId, sectionId, date
  // ──────────────────────────────────────────────────────────────────────
  console.log('[migration] Phase 2: Qualification context columns');
  await addColumnIfNotExists(queryInterface, 'qualifications', 'schoolPeriodId', {
    type: DataTypes.INTEGER, allowNull: true,
    comment: 'Denormalizado desde PeriodGrade.schoolPeriodId via EvaluationPlan',
  });
  await addColumnIfNotExists(queryInterface, 'qualifications', 'termId', {
    type: DataTypes.INTEGER, allowNull: true,
    comment: 'Denormalizado desde EvaluationPlan.termId',
  });
  await addColumnIfNotExists(queryInterface, 'qualifications', 'subjectId', {
    type: DataTypes.INTEGER, allowNull: true,
    comment: 'Denormalizado desde PeriodGradeSubject.subjectId via EvaluationPlan',
  });
  await addColumnIfNotExists(queryInterface, 'qualifications', 'gradeId', {
    type: DataTypes.INTEGER, allowNull: true,
    comment: 'Denormalizado desde PeriodGrade.gradeId via EvaluationPlan',
  });
  await addColumnIfNotExists(queryInterface, 'qualifications', 'sectionId', {
    type: DataTypes.INTEGER, allowNull: true,
    comment: 'Denormalizado desde EvaluationPlan.sectionId',
  });
  await addColumnIfNotExists(queryInterface, 'qualifications', 'date', {
    type: DataTypes.DATEONLY, allowNull: true,
    comment: 'Denormalizado desde EvaluationPlan.date',
  });

  // Backfill desde evaluation_plans + period_grade_subjects + period_grades
  console.log('[migration] Backfilling qualifications from evaluation_plans');
  await sequelize.query(`
    UPDATE qualifications q
    JOIN evaluation_plans ep ON q.evaluationPlanId = ep.id
    JOIN period_grade_subjects pgs ON ep.periodGradeSubjectId = pgs.id
    JOIN period_grades pg ON pgs.periodGradeId = pg.id
    SET
      q.schoolPeriodId = pg.schoolPeriodId,
      q.termId = ep.termId,
      q.subjectId = pgs.subjectId,
      q.gradeId = pg.gradeId,
      q.sectionId = ep.sectionId,
      q.date = ep.date
    WHERE q.schoolPeriodId IS NULL
  `);

  await addIndexIfNotExists(queryInterface, 'qualifications',
    ['schoolPeriodId', 'gradeId', 'subjectId', 'termId'],
    { name: 'idx_qualifications_context' });

  // ──────────────────────────────────────────────────────────────────────
  // 3. SubjectFinalGrade: schoolPeriodId, subjectId, gradeId, termId
  // ──────────────────────────────────────────────────────────────────────
  console.log('[migration] Phase 3: SubjectFinalGrade context columns');
  await addColumnIfNotExists(queryInterface, 'subject_final_grades', 'schoolPeriodId', {
    type: DataTypes.INTEGER, allowNull: true,
    comment: 'Denormalizado desde Inscription.schoolPeriodId via InscriptionSubject',
  });
  await addColumnIfNotExists(queryInterface, 'subject_final_grades', 'subjectId', {
    type: DataTypes.INTEGER, allowNull: true,
    comment: 'Denormalizado desde InscriptionSubject.subjectId',
  });
  await addColumnIfNotExists(queryInterface, 'subject_final_grades', 'gradeId', {
    type: DataTypes.INTEGER, allowNull: true,
    comment: 'Denormalizado desde Inscription.gradeId via InscriptionSubject',
  });
  await addColumnIfNotExists(queryInterface, 'subject_final_grades', 'termId', {
    type: DataTypes.INTEGER, allowNull: true,
    comment: 'Lapso al que pertenece la nota (solo para revisiones; NULL para notas finales regulares)',
  });

  // Backfill desde inscription_subjects + inscriptions
  console.log('[migration] Backfilling subject_final_grades from inscription_subjects');
  await sequelize.query(`
    UPDATE subject_final_grades sfg
    JOIN inscription_subjects ins ON sfg.inscriptionSubjectId = ins.id
    JOIN inscriptions i ON ins.inscriptionId = i.id
    SET
      sfg.schoolPeriodId = i.schoolPeriodId,
      sfg.subjectId = ins.subjectId,
      sfg.gradeId = i.gradeId
    WHERE sfg.schoolPeriodId IS NULL
  `);

  await addIndexIfNotExists(queryInterface, 'subject_final_grades',
    ['schoolPeriodId', 'gradeId', 'subjectId'],
    { name: 'idx_subject_final_grades_context' });
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  // InscriptionSubject
  try { await queryInterface.removeIndex('inscription_subjects', 'idx_inscription_subjects_context'); } catch { /* ignore */ }
  await queryInterface.removeColumn('inscription_subjects', 'schoolPeriodId');
  await queryInterface.removeColumn('inscription_subjects', 'gradeId');
  await queryInterface.removeColumn('inscription_subjects', 'sectionId');

  // Qualification
  try { await queryInterface.removeIndex('qualifications', 'idx_qualifications_context'); } catch { /* ignore */ }
  await queryInterface.removeColumn('qualifications', 'schoolPeriodId');
  await queryInterface.removeColumn('qualifications', 'termId');
  await queryInterface.removeColumn('qualifications', 'subjectId');
  await queryInterface.removeColumn('qualifications', 'gradeId');
  await queryInterface.removeColumn('qualifications', 'sectionId');
  await queryInterface.removeColumn('qualifications', 'date');

  // SubjectFinalGrade
  try { await queryInterface.removeIndex('subject_final_grades', 'idx_subject_final_grades_context'); } catch { /* ignore */ }
  await queryInterface.removeColumn('subject_final_grades', 'schoolPeriodId');
  await queryInterface.removeColumn('subject_final_grades', 'subjectId');
  await queryInterface.removeColumn('subject_final_grades', 'gradeId');
  await queryInterface.removeColumn('subject_final_grades', 'termId');
}
