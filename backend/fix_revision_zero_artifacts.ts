/**
 * One-off cleanup: delete orphaned revision SubjectFinalGrade rows.
 *
 * When the revision period is RESET (Master), the InscriptionSubjectRevision
 * rows are deleted but the SubjectFinalGrade rows (gradeType='revision')
 * created by a previous finalize remain — mass zeros that pollute the
 * historical grades and certified grades exports.
 *
 * Criterion: a revision final grade is legitimate only if the subject has an
 * explicitly-graded revision (gradedBy IS NOT NULL). Rows without one are
 * artifacts (e.g. auto-NP from advancing opportunities in an old cycle).
 *
 * Run: npx ts-node -r tsconfig-paths/register fix_revision_zero_artifacts.ts
 */
import sequelize from './src/config/database';
import { SubjectFinalGrade } from './src/models/index';
import { Op } from 'sequelize';

async function cleanup() {
  // Find revision-type final grades with no explicitly-graded backing revision
  const candidates = await SubjectFinalGrade.findAll({
    where: { gradeType: 'revision', finalScore: 0 },
    attributes: ['id', 'inscriptionSubjectId'],
  });

  const { InscriptionSubjectRevision } = await import('./src/models/index');
  let deleted = 0;
  let kept = 0;

  for (const fg of candidates) {
    const backing = await InscriptionSubjectRevision.count({
      where: {
        inscriptionSubjectId: fg.inscriptionSubjectId,
        score: { [Op.ne]: null },
        gradedBy: { [Op.ne]: null },
      },
    });
    if (backing === 0) {
      await fg.destroy();
      deleted++;
    } else {
      kept++;
    }
  }

  console.log(`Revision zero-score rows: ${candidates.length}`);
  console.log(`  deleted (orphans): ${deleted}`);
  console.log(`  kept (backed by explicit grades): ${kept}`);

  await sequelize.close();
}

cleanup().catch(err => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
