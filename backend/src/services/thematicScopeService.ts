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
