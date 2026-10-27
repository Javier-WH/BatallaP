/**
 * inscriptionSubjectSectionService — keeps `InscriptionSubject.sectionId` in step
 * with the section of its inscription.
 *
 * Grade lists, the "Acta de Notas" and the teacher views find a student's marks
 * through the denormalized `InscriptionSubject.sectionId`. When a student changes
 * section and that column is not updated, he disappears from the new section's
 * lists (while the nómina, which reads `Inscription.sectionId`, still shows him)
 * and lingers in the old one.
 *
 * Only ACTIVE inscriptions with a section are touched. A withdrawn or
 * un-matriculated student has no section on the inscription, and his subjects
 * keep the section where they were actually taken (grade views rely on that).
 */
import { Op, Transaction } from 'sequelize';
import { Inscription, InscriptionSubject } from '@/models/index';

export interface SubjectSectionScope {
  inscriptionId?: number;
  schoolPeriodId?: number;
  gradeId?: number;
  sectionId?: number;
}

/** Aligns the subjects' section with the inscription's. Returns how many subject rows changed. */
export async function alignSubjectSections(scope: SubjectSectionScope = {}, transaction?: Transaction): Promise<number> {
  const where: Record<string, unknown> = {
    withdrawnAt: null,
    sectionId: scope.sectionId ?? { [Op.ne]: null },
  };
  if (scope.inscriptionId) where.id = scope.inscriptionId;
  if (scope.schoolPeriodId) where.schoolPeriodId = scope.schoolPeriodId;
  if (scope.gradeId) where.gradeId = scope.gradeId;

  const inscriptions = await Inscription.findAll({ where, attributes: ['id', 'sectionId'], transaction });
  const idsBySection = new Map<number, number[]>();
  for (const ins of inscriptions) {
    if (ins.sectionId == null) continue;
    const ids = idsBySection.get(ins.sectionId) ?? [];
    ids.push(ins.id);
    idsBySection.set(ins.sectionId, ids);
  }

  let changed = 0;
  for (const [sectionId, ids] of idsBySection) {
    const [count] = await InscriptionSubject.update(
      { sectionId },
      {
        where: { inscriptionId: { [Op.in]: ids }, [Op.or]: [{ sectionId: null }, { sectionId: { [Op.ne]: sectionId } }] },
        transaction,
      },
    );
    changed += count;
  }
  return changed;
}
