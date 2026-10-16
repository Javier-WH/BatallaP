import { QueryInterface } from 'sequelize';
import sequelize from '@/config/database';

// Repairs rows left behind when evaluation plans were deleted directly:
// - orphaned qualifications / edit requests / criteria / indicators
// - stale subject_term_grades and computed 'regular' subject_final_grades
//   for subjects that no longer have any contribution (no qualifications and
//   no council points) in non-historical periods.
// Historical (closed) periods are intentionally excluded: their snapshots
// are frozen official records.
export default {
  async up(_queryInterface: QueryInterface): Promise<void> {
    // 1. Orphaned edit requests point at deleted qualifications
    await sequelize.query(`
      DELETE FROM qualification_edit_requests
      WHERE qualificationId NOT IN (SELECT id FROM qualifications)
    `);

    // 2. Orphaned qualifications (evaluation plan or inscription subject gone)
    await sequelize.query(`
      DELETE FROM qualifications
      WHERE evaluationPlanId NOT IN (SELECT id FROM evaluation_plans)
         OR inscriptionSubjectId NOT IN (SELECT id FROM inscription_subjects)
    `);

    // 3. Orphaned indicators before orphaned criteria (indicators reference criteria)
    await sequelize.query(`
      DELETE FROM evaluation_indicators
      WHERE evaluationCriteriaId NOT IN (SELECT id FROM evaluation_criteria)
    `);
    await sequelize.query(`
      DELETE FROM evaluation_criteria
      WHERE evaluationPlanId NOT IN (SELECT id FROM evaluation_plans)
    `);

    // 4. Ghost term-grade snapshots: subject with no contributions left,
    //    only for periods that are still open ('activo'/'preinscripcion').
    //    Closed ('historico') periods keep their frozen records untouched.
    await sequelize.query(`
      DELETE FROM subject_term_grades
      WHERE inscriptionSubjectId IN (
        SELECT s.id FROM inscription_subjects s
        JOIN inscriptions i ON i.id = s.inscriptionId
        JOIN school_periods sp ON sp.id = i.schoolPeriodId
        WHERE sp.status IN ('activo', 'preinscripcion')
          AND NOT EXISTS (SELECT 1 FROM qualifications q WHERE q.inscriptionSubjectId = s.id)
          AND NOT EXISTS (SELECT 1 FROM council_points cp WHERE cp.inscriptionSubjectId = s.id)
      )
    `);

    // 5. Same scope for computed 'regular' final grades. Non-regular types
    //    (revision, materia_pendiente, transferencia, equivalencia) are
    //    official records and are never deleted here.
    await sequelize.query(`
      DELETE FROM subject_final_grades
      WHERE gradeType = 'regular'
        AND inscriptionSubjectId IN (
          SELECT s.id FROM inscription_subjects s
          JOIN inscriptions i ON i.id = s.inscriptionId
          JOIN school_periods sp ON sp.id = i.schoolPeriodId
          WHERE sp.status IN ('activo', 'preinscripcion')
            AND NOT EXISTS (SELECT 1 FROM qualifications q WHERE q.inscriptionSubjectId = s.id)
            AND NOT EXISTS (SELECT 1 FROM council_points cp WHERE cp.inscriptionSubjectId = s.id)
        )
    `);
  },

  async down(_queryInterface: QueryInterface): Promise<void> {
    // Data cleanup is not reversible — deleted rows cannot be reconstructed.
  },
};
