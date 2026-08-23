/**
 * Helpers for handling subject group logic across the system.
 *
 * A student may have one subject per SubjectGroup (e.g. one from "Área Técnica"
 * and one from "Área Deportiva"). When a student changes their group subject,
 * the old InscriptionSubject record may remain in the database with no
 * qualifications. These helpers ensure only the active subject per group is
 * considered in calculations, reports, and councils.
 *
 * As of the per-term choice feature, the source of truth for "which subject is
 * the student taking in group X during term T" is `InscriptionGroupTermChoice`.
 * `filterActiveGroupSubjectsForTerm` consults it; the legacy
 * `filterActiveGroupSubjects` is kept for callers that operate across all terms
 * (e.g. annual reports) and falls back to "the one with qualifications".
 */

import { InscriptionGroupTermChoice } from '@/models/index';

/**
 * Given an array of InscriptionSubject-like records (with `subject` eagerly
 * loaded), returns a new array where, for each `subjectGroupId`, only ONE
 * subject is kept: the one with qualifications, or if none have qualifications,
 * the first one encountered.
 *
 * Subjects without a `subjectGroupId` (core subjects) are passed through
 * unchanged.
 *
 * The order of the returned array preserves the original input order.
 *
 * @deprecated Prefer `filterActiveGroupSubjectsForTerm` when a termId is
 *   available — it consults the explicit per-term choice records and is
 *   accurate for students who switched group subjects mid-year.
 */
export function filterActiveGroupSubjects<
  T extends {
    subject?: { subjectGroupId?: number | null } | null;
    qualifications?: unknown[] | null;
  }
>(
  inscriptionSubjects: T[]
): T[] {
  const byGroup = new Map<number, T[]>();
  const result: T[] = [];

  for (const is of inscriptionSubjects) {
    const groupId = is.subject?.subjectGroupId;
    if (groupId == null) {
      result.push(is); // Core subject — always include
    } else {
      const arr = byGroup.get(groupId);
      if (arr) {
        arr.push(is);
      } else {
        byGroup.set(groupId, [is]);
      }
    }
  }

  // For each group, pick the active subject
  for (const subjects of byGroup.values()) {
    if (subjects.length === 1) {
      result.push(subjects[0]);
    } else {
      // Prefer the subject with qualifications; fall back to the first
      const withQuals = subjects.filter(
        s => (s.qualifications || []).length > 0
      );
      result.push(withQuals.length > 0 ? withQuals[0] : subjects[0]);
    }
  }

  return result;
}

/**
 * Same shape as `filterActiveGroupSubjects`, but resolves the active subject
 * per group from the explicit `InscriptionGroupTermChoice` records for the
 * given term. When a group has no choice record for that term (e.g. data
 * created before the feature), it falls back to the legacy heuristic so the
 * migration is non-breaking.
 *
 * @param inscriptionSubjects  Eagerly loaded InscriptionSubject rows. Must
 *        include `inscriptionId` when `termId` is provided so we can look up
 *        the choice records.
 * @param termId  The term to resolve choices for. When omitted, behaves like
 *        the legacy `filterActiveGroupSubjects`.
 */
export async function filterActiveGroupSubjectsForTerm<
  T extends {
    inscriptionId?: number;
    subject?: { id?: number; subjectGroupId?: number | null } | null;
    qualifications?: unknown[] | null;
  }
>(
  inscriptionSubjects: T[],
  termId?: number
): Promise<T[]> {
  if (termId == null) {
    return filterActiveGroupSubjects(inscriptionSubjects);
  }

  // Collect (inscriptionId, subjectGroupId) pairs to look up.
  const lookup = new Set<string>();
  for (const is of inscriptionSubjects) {
    const gid = is.subject?.subjectGroupId;
    const insId = is.inscriptionId;
    if (gid != null && insId != null) lookup.add(`${insId}:${gid}`);
  }

  // Map: `${inscriptionId}:${subjectGroupId}` -> chosen subjectId
  const choiceSubjectId = new Map<string, number>();
  if (lookup.size > 0) {
    const inscriptions = [...new Set(inscriptionSubjects.map(is => is.inscriptionId).filter((x): x is number => x != null))];
    const groupIds = [...new Set(inscriptionSubjects.map(is => is.subject?.subjectGroupId).filter((x): x is number => x != null))];
    if (inscriptions.length > 0 && groupIds.length > 0) {
      const choices = await InscriptionGroupTermChoice.findAll({
        where: {
          inscriptionId: inscriptions,
          subjectGroupId: groupIds,
          termId,
        },
        attributes: ['inscriptionId', 'subjectGroupId', 'subjectId'],
      });
      for (const c of choices) {
        choiceSubjectId.set(`${c.inscriptionId}:${c.subjectGroupId}`, c.subjectId);
      }
    }
  }

  const byGroup = new Map<number, T[]>();
  const result: T[] = [];

  for (const is of inscriptionSubjects) {
    const groupId = is.subject?.subjectGroupId;
    if (groupId == null) {
      result.push(is);
    } else {
      const arr = byGroup.get(groupId);
      if (arr) arr.push(is);
      else byGroup.set(groupId, [is]);
    }
  }

  for (const [groupId, subjects] of byGroup) {
    if (subjects.length === 1) {
      result.push(subjects[0]);
      continue;
    }
    // Prefer the subject chosen for this term; fall back to the legacy heuristic.
    const insId = subjects[0].inscriptionId;
    const chosenSubjectId = insId != null ? choiceSubjectId.get(`${insId}:${groupId}`) : undefined;
    if (chosenSubjectId != null) {
      const match = subjects.find(s => s.subject?.id === chosenSubjectId);
      if (match) { result.push(match); continue; }
    }
    const withQuals = subjects.filter(s => (s.qualifications || []).length > 0);
    result.push(withQuals.length > 0 ? withQuals[0] : subjects[0]);
  }

  return result;
}

