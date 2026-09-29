import { TeacherAssignment } from '@/models/index';

/**
 * Thematic content belongs to the teacher of the given pgs + section, so it is
 * shared across every section of that subject/year the same teacher teaches,
 * and hidden from other teachers of the same subject.
 */
export const resolveContentTeacherId = async (pgsId: number, sectionId: number): Promise<number | null> => {
  if (!pgsId || !sectionId) return null;
  const assignment = await TeacherAssignment.findOne({
    where: { periodGradeSubjectId: pgsId, sectionId },
    attributes: ['teacherId'],
  });
  return assignment?.teacherId ?? null;
};

/**
 * Resolves the content owner for a request. Prefers the section's teacher; when
 * no sectionId is sent (frontends built before per-teacher scoping, still
 * cached by the PWA) falls back to the requesting teacher, provided they are
 * assigned to that subject/year.
 */
export const resolveRequestTeacherId = async (
  pgsId: number,
  sectionId: number | null | undefined,
  requesterPersonId: number | null | undefined,
): Promise<number | null> => {
  if (sectionId) return resolveContentTeacherId(pgsId, sectionId);
  if (!pgsId || !requesterPersonId) return null;
  const assignment = await TeacherAssignment.findOne({
    where: { periodGradeSubjectId: pgsId, teacherId: requesterPersonId },
    attributes: ['teacherId'],
  });
  return assignment?.teacherId ?? null;
};
