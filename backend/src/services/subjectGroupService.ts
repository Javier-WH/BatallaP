/**
 * Helpers for handling subject group logic across the system.
 *
 * A student may have one subject per SubjectGroup (e.g. one from "Área Técnica"
 * and one from "Área Deportiva"). When a student changes their group subject,
 * the old InscriptionSubject record may remain in the database with no
 * qualifications. These helpers ensure only the active subject per group is
 * considered in calculations, reports, and councils.
 */

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
