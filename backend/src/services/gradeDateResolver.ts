import {
  InscriptionSubject,
  InscriptionSubjectRevision,
  RevisionOpportunityDate,
  PendingSubject,
  PendingSubjectEncounter,
  PeriodGrade,
  PeriodGradeSubject,
} from '@/models/index';

/**
 * Resolve the correct date for a grade based on its gradeType.
 *
 * - For 'revision' and 'revision_materia_pendiente': use the date from
 *   RevisionOpportunityDate for the opportunity where the student approved,
 *   or the last opportunity date if never approved.
 *
 * - For 'materia_pendiente': use the date from PendingSubjectEncounter for
 *   the encounter where the student approved (score >= 10, not absent),
 *   or the last encounter date if never approved.
 *
 * - For other gradeTypes (regular, transferencia, equivalencia): return null
 *   so the caller falls back to calculatedAt.
 *
 * Returns a "YYYY-MM-DD" string or null.
 */
export async function resolveGradeDate(
  inscriptionSubjectId: number,
  gradeType: string | null,
  sectionId?: number | null,
  subjectId?: number | null,
  gradeId?: number | null,
  schoolPeriodId?: number | null,
): Promise<string | null> {
  if (!gradeType) return null;

  const isRevision = gradeType === 'revision' || gradeType === 'revision_materia_pendiente';
  const isMP = gradeType === 'materia_pendiente' || gradeType === 'revision_materia_pendiente';

  if (isRevision) {
    const revDate = await resolveRevisionDate(inscriptionSubjectId, sectionId ?? null, subjectId ?? null, gradeId ?? null, schoolPeriodId ?? null);
    if (revDate) return revDate;
  }

  if (isMP) {
    const mpDate = await resolvePendingSubjectDate(inscriptionSubjectId);
    if (mpDate) return mpDate;
  }

  return null;
}

async function resolveRevisionDate(
  inscriptionSubjectId: number,
  sectionId: number | null,
  subjectId: number | null,
  gradeId: number | null,
  schoolPeriodId: number | null,
): Promise<string | null> {
  // Find all revision records for this inscription subject, ordered by opportunity
  const revisions = await InscriptionSubjectRevision.findAll({
    where: { inscriptionSubjectId },
    order: [['opportunity', 'ASC']],
  });

  if (revisions.length === 0) return null;

  // Find the approved revision (if any)
  const approved = revisions.find(r => r.status === 'approved');

  // Determine which opportunity to use
  const targetOpportunity = approved ? approved.opportunity : revisions[revisions.length - 1].opportunity;
  const revisionPeriodId = approved ? approved.revisionPeriodId : revisions[revisions.length - 1].revisionPeriodId;

  // Find the PeriodGradeSubject for this subject+grade+period
  let periodGradeSubjectId: number | null = null;
  if (schoolPeriodId && gradeId) {
    const pg = await PeriodGrade.findOne({
      where: { schoolPeriodId, gradeId },
      attributes: ['id'],
    });
    if (pg && subjectId) {
      const pgs = await PeriodGradeSubject.findOne({
        where: { periodGradeId: pg.id, subjectId },
        attributes: ['id'],
      });
      if (pgs) periodGradeSubjectId = pgs.id;
    }
  }

  // Find the RevisionOpportunityDate matching revisionPeriodId + opportunity + periodGradeSubjectId
  const where: any = {
    revisionPeriodId,
    opportunity: targetOpportunity,
  };
  if (periodGradeSubjectId) {
    where.periodGradeSubjectId = periodGradeSubjectId;
  }

  // Try with sectionId first (more specific)
  if (sectionId) {
    const withSection = await RevisionOpportunityDate.findOne({
      where: { ...where, sectionId },
    });
    if (withSection?.date) return withSection.date;
  }

  // Try without sectionId (applies to all sections)
  const withoutSection = await RevisionOpportunityDate.findOne({
    where: { ...where, sectionId: null },
  });
  if (withoutSection?.date) return withoutSection.date;

  // Fallback: get the last opportunity date for this revision period + subject (any section)
  const allDates = await RevisionOpportunityDate.findAll({
    where: periodGradeSubjectId ? { revisionPeriodId, periodGradeSubjectId } : { revisionPeriodId },
    order: [['opportunity', 'DESC']],
  });
  // Find the one matching targetOpportunity, or the last one
  const match = allDates.find(d => d.opportunity === targetOpportunity) || allDates[0];
  return match?.date || null;
}

async function resolvePendingSubjectDate(
  inscriptionSubjectId: number,
): Promise<string | null> {
  // Get the InscriptionSubject to find inscriptionId + subjectId
  const insSub = await InscriptionSubject.findByPk(inscriptionSubjectId, {
    attributes: ['inscriptionId', 'subjectId'],
  });
  if (!insSub) return null;

  // Find the PendingSubject for this inscription + subject
  const pendingSubj = await PendingSubject.findOne({
    where: { newInscriptionId: insSub.inscriptionId, subjectId: insSub.subjectId },
    attributes: ['id'],
  });
  if (!pendingSubj) return null;

  // Get all encounters ordered by encounterNumber
  const encounters = await PendingSubjectEncounter.findAll({
    where: { pendingSubjectId: pendingSubj.id },
    order: [['encounterNumber', 'ASC']],
  });

  if (encounters.length === 0) return null;

  // Find the encounter where the student approved (score >= 10, not absent)
  const approved = encounters.find(e => e.score !== null && Number(e.score) >= 10 && !e.isAbsent);
  if (approved?.date) {
    return typeof approved.date === 'string' ? approved.date.split('T')[0] : approved.date.toISOString().split('T')[0];
  }

  // Otherwise, use the last encounter's date
  const last = encounters[encounters.length - 1];
  if (last?.date) {
    return typeof last.date === 'string' ? last.date.split('T')[0] : last.date.toISOString().split('T')[0];
  }

  return null;
}
