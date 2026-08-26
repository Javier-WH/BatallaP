/**
 * Synchronizes `InscriptionGroupTermChoice` records — the per-term mapping of
 * which subject (within a SubjectGroup) a student is taking.
 *
 * Responsibilities:
 *  - `seedChoicesForInscription`: backfill choice records for an inscription
 *    based on its current InscriptionSubject rows. Used by the migration and
 *    by the enrollment flow so that new students get choice records for every
 *    term of their period.
 *  - `changeGroupSubjectFromTerm`: switch a student's group subject starting
 *    at a given term. Preserves notes in earlier terms; optionally destroys
 *    notes in the starting term when the student is switching mid-lapso.
 *  - `setGroupSubjectForTerm`: explicitly set the subject for a single term
 *    (backfill UI).
 */

import { Transaction } from 'sequelize';
import sequelize from '@/config/database';
import {
  Inscription,
  InscriptionSubject,
  InscriptionGroupTermChoice,
  Subject,
  Term,
} from '@/models/index';

/**
 * For a given inscription, ensure every (group, term) pair has a choice record
 * pointing to the subject the student is currently enrolled in for that group.
 *
 * When the student has multiple InscriptionSubject rows for the same group
 * (legacy data from before the per-term feature), the one with qualifications
 * wins; ties go to the first row. This makes the migration non-breaking.
 *
 * Terms are scoped to the inscription's schoolPeriodId.
 */
export async function seedChoicesForInscription(
  inscriptionId: number,
  options: { transaction?: Transaction } = {}
): Promise<void> {
  const { transaction: t = await sequelize.transaction() } = options;
  const ownTransaction = !options.transaction;

  try {
    const inscription = await Inscription.findByPk(inscriptionId, { transaction: t });
    if (!inscription) return;

    const terms = await Term.findAll({
      where: { schoolPeriodId: inscription.schoolPeriodId },
      order: [['order', 'ASC']],
      transaction: t,
    });
    if (terms.length === 0) return;

    const inscriptionSubjects = await InscriptionSubject.findAll({
      where: { inscriptionId },
      include: [{ model: Subject, as: 'subject' }],
      attributes: ['id', 'inscriptionId', 'subjectId', 'schoolPeriodId', 'gradeId', 'sectionId'],
      transaction: t,
    });

    // group -> chosen subjectId (the row that exists, preferring one with notes)
    const groupToSubjectId = new Map<number, number>();
    const byGroup = new Map<number, typeof inscriptionSubjects>();
    for (const is of inscriptionSubjects) {
      const gid = is.subject?.subjectGroupId;
      if (gid == null) continue;
      const arr = byGroup.get(gid);
      if (arr) arr.push(is);
      else byGroup.set(gid, [is]);
    }
    for (const [gid, rows] of byGroup) {
      if (rows.length === 1) {
        groupToSubjectId.set(gid, rows[0].subjectId);
      } else {
        const withQuals = rows.filter((r: any) => (r.qualifications || []).length > 0);
        groupToSubjectId.set(gid, (withQuals[0] || rows[0]).subjectId);
      }
    }

    // Build choice rows for every (group, term) pair.
    const rows: { inscriptionId: number; subjectGroupId: number; termId: number; subjectId: number }[] = [];
    for (const [gid, subjectId] of groupToSubjectId) {
      for (const term of terms) {
        rows.push({ inscriptionId, subjectGroupId: gid, termId: term.id, subjectId });
      }
    }

    if (rows.length > 0) {
      // upsert via destroy+bulkCreate to honor the unique constraint
      await InscriptionGroupTermChoice.destroy({
        where: {
          inscriptionId,
          subjectGroupId: rows.map(r => r.subjectGroupId),
        },
        transaction: t,
      });
      await InscriptionGroupTermChoice.bulkCreate(rows, {
        transaction: t,
        validate: true,
      });
    }

    if (ownTransaction) await t.commit();
  } catch (error) {
    if (ownTransaction) await t.rollback();
    throw error;
  }
}

/**
 * Change a student's group subject starting at a given term.
 *
 * Behavior:
 *  - Terms strictly before `fromTermId` keep their existing choice (and thus
 *    their existing InscriptionSubject + notes are untouched).
 *  - Terms from `fromTermId` onwards are reassigned to `newSubjectId`.
 *  - The InscriptionSubject row for the new subject is created if missing.
 *  - Notes for the old subject are NEVER destroyed. They remain in the
 *    database attached to the old InscriptionSubject row. If the student
 *    later switches back to the old subject, the notes reappear
 *    automatically because `filterActiveGroupSubjectsForTerm` will resolve
 *    to the old subject again.
 *
 * Returns a summary of what was changed so the controller can report it.
 */
export interface ChangeGroupSubjectResult {
  inscriptionId: number;
  subjectGroupId: number;
  fromTermId: number;
  newSubjectId: number;
  termsAffected: number[];
}

export async function changeGroupSubjectFromTerm(
  inscriptionId: number,
  subjectGroupId: number,
  newSubjectId: number,
  fromTermId: number,
  options: { transaction?: Transaction } = {}
): Promise<ChangeGroupSubjectResult> {
  const { transaction: t = await sequelize.transaction() } = options;
  const ownTransaction = !options.transaction;

  try {
    const inscription = await Inscription.findByPk(inscriptionId, { transaction: t });
    if (!inscription) throw new Error('Inscription not found');

    const terms = await Term.findAll({
      where: { schoolPeriodId: inscription.schoolPeriodId },
      order: [['order', 'ASC']],
      transaction: t,
    });
    const fromIdx = terms.findIndex(term => term.id === fromTermId);
    if (fromIdx === -1) throw new Error('fromTermId does not belong to this inscription period');

    const affectedTerms = terms.slice(fromIdx).map(term => term.id);

    // Update choice records for affected terms.
    await InscriptionGroupTermChoice.destroy({
      where: { inscriptionId, subjectGroupId, termId: affectedTerms },
      transaction: t,
    });
    await InscriptionGroupTermChoice.bulkCreate(
      affectedTerms.map(termId => ({ inscriptionId, subjectGroupId, termId, subjectId: newSubjectId })),
      { transaction: t, validate: true }
    );

    // Ensure the new subject has an InscriptionSubject row so the professor
    // can enter notes. The old subject's row and notes are left untouched.
    const ctxIns = await Inscription.findByPk(inscriptionId, { attributes: ['id', 'schoolPeriodId', 'gradeId', 'sectionId'], transaction: t });
    await InscriptionSubject.findOrCreate({
      where: { inscriptionId, subjectId: newSubjectId },
      defaults: {
        inscriptionId,
        subjectId: newSubjectId,
        schoolPeriodId: ctxIns?.schoolPeriodId ?? null,
        gradeId: ctxIns?.gradeId ?? null,
        sectionId: ctxIns?.sectionId ?? null,
      },
      transaction: t,
    });

    if (ownTransaction) await t.commit();
    return {
      inscriptionId,
      subjectGroupId,
      fromTermId,
      newSubjectId,
      termsAffected: affectedTerms,
    };
  } catch (error) {
    if (ownTransaction) await t.rollback();
    throw error;
  }
}

/**
 * Explicitly set the subject for a single (inscription, group, term). Used by
 * the backfill UI to record historical choices. Does NOT touch notes — the
 * caller is asserting "this is what the student took in that term".
 */
export async function setGroupSubjectForTerm(
  inscriptionId: number,
  subjectGroupId: number,
  termId: number,
  subjectId: number,
  options: { transaction?: Transaction } = {}
): Promise<void> {
  const { transaction: t = await sequelize.transaction() } = options;
  const ownTransaction = !options.transaction;

  try {
    await InscriptionGroupTermChoice.destroy({
      where: { inscriptionId, subjectGroupId, termId },
      transaction: t,
    });
    await InscriptionGroupTermChoice.create(
      { inscriptionId, subjectGroupId, termId, subjectId },
      { transaction: t }
    );
    // Ensure the InscriptionSubject row exists so notes can be attached.
    const ctxIns = await Inscription.findByPk(inscriptionId, { attributes: ['id', 'schoolPeriodId', 'gradeId', 'sectionId'], transaction: t });
    await InscriptionSubject.findOrCreate({
      where: { inscriptionId, subjectId },
      defaults: {
        inscriptionId,
        subjectId,
        schoolPeriodId: ctxIns?.schoolPeriodId ?? null,
        gradeId: ctxIns?.gradeId ?? null,
        sectionId: ctxIns?.sectionId ?? null,
      },
      transaction: t,
    });
    if (ownTransaction) await t.commit();
  } catch (error) {
    if (ownTransaction) await t.rollback();
    throw error;
  }
}

/**
 * Bulk seed for all inscriptions in a period. Used by the one-time migration.
 */
export async function seedChoicesForPeriod(
  schoolPeriodId: number,
  options: { transaction?: Transaction } = {}
): Promise<number> {
  const { transaction: t = await sequelize.transaction() } = options;
  const ownTransaction = !options.transaction;

  try {
    const inscriptions = await Inscription.findAll({
      where: { schoolPeriodId },
      attributes: ['id'],
      transaction: t,
    });
    let count = 0;
    for (const ins of inscriptions) {
      await seedChoicesForInscription(ins.id, { transaction: t });
      count++;
    }
    if (ownTransaction) await t.commit();
    return count;
  } catch (error) {
    if (ownTransaction) await t.rollback();
    throw error;
  }
}
