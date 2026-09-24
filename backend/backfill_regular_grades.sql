-- Backfill 'regular' SubjectFinalGrade rows missing alongside 'revision' rows.
--
-- Context: for subjects that went to revision, finalGradeCalculator used to
-- persist ONLY the 'revision' row; the regular grade survived only as
-- originalScore/originalStatus inside it. Views filtered by
-- gradeType='regular' (historical finals, resumen final) then depended on
-- the term-grade fallback. This materializes the missing 'regular' rows.
--
-- Idempotent: rows that already have a 'regular' sibling are skipped, and
-- revision rows without originalScore/originalStatus are skipped (nothing
-- reliable to backfill from — the term-grade fallback keeps covering them).
-- Safe to run repeatedly. Run inside a transaction.

START TRANSACTION;

INSERT INTO subject_final_grades
  (inscriptionSubjectId, finalScore, status, gradeType, plantelId,
   schoolPeriodId, subjectId, gradeId, calculatedAt, createdAt, updatedAt)
SELECT
  rev.inscriptionSubjectId,
  rev.originalScore,
  rev.originalStatus,
  'regular',
  rev.plantelId,
  rev.schoolPeriodId,
  rev.subjectId,
  rev.gradeId,
  rev.calculatedAt,
  NOW(),
  NOW()
FROM subject_final_grades rev
WHERE rev.gradeType = 'revision'
  AND rev.originalScore IS NOT NULL
  AND rev.originalStatus IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM subject_final_grades r
    WHERE r.inscriptionSubjectId = rev.inscriptionSubjectId
      AND r.gradeType = 'regular'
  );

-- Verification: should return 0 rows after the insert.
SELECT COUNT(*) AS still_missing
FROM subject_final_grades rev
WHERE rev.gradeType = 'revision'
  AND rev.originalScore IS NOT NULL
  AND rev.originalStatus IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM subject_final_grades r
    WHERE r.inscriptionSubjectId = rev.inscriptionSubjectId
      AND r.gradeType = 'regular'
  );

COMMIT;
