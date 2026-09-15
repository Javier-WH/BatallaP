import { Transaction } from 'sequelize';
import {
  Grade,
  Inscription,
  InscriptionSubject,
  Person,
  Section,
} from '@/models/index';

export interface ClosureStudentGroup {
  personId: number;
  inscriptions: Inscription[];
  /** Highest-grade inscription used as the promotion reference. */
  referenceInscription: Inscription;
  /** True when every active inscription belongs to the Materia Pendiente section. */
  isPendingOnly: boolean;
}

type InscriptionWithClosureRelations = Inscription & {
  student?: Person;
  grade?: Grade;
  section?: Section | null;
};

/**
 * Loads every non-withdrawn inscription in a school period and consolidates
 * multiple inscriptions belonging to the same person into one closure unit.
 * `escolaridad` is descriptive here; it is intentionally not used as a
 * selection filter.
 */
export async function loadClosureStudentGroups(
  schoolPeriodId: number,
  options: { transaction?: Transaction } = {},
): Promise<ClosureStudentGroup[]> {
  const inscriptions = (await Inscription.findAll({
    where: {
      schoolPeriodId,
      withdrawnAt: null,
    },
    include: [
      { model: Person, as: 'student' },
      { model: Grade, as: 'grade' },
      { model: Section, as: 'section' },
      {
        model: InscriptionSubject,
        as: 'inscriptionSubjects',
        required: false,
      },
    ],
    order: [['personId', 'ASC'], ['id', 'ASC']],
    transaction: options.transaction,
  })) as InscriptionWithClosureRelations[];

  const groups = new Map<number, Inscription[]>();
  for (const inscription of inscriptions) {
    const existing = groups.get(inscription.personId) ?? [];
    existing.push(inscription);
    groups.set(inscription.personId, existing);
  }

  const isPendingSection = (inscription: InscriptionWithClosureRelations): boolean => {
    const sectionName = inscription.section?.name ?? '';
    return sectionName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim() === 'materia pendiente';
  };

  return Array.from(groups.entries()).map(([personId, groupedInscriptions]) => {
    const referenceInscription = [...groupedInscriptions].sort((a, b) => {
      const aGradeOrder = (a as InscriptionWithClosureRelations).grade?.order ?? Number.MIN_SAFE_INTEGER;
      const bGradeOrder = (b as InscriptionWithClosureRelations).grade?.order ?? Number.MIN_SAFE_INTEGER;
      const gradeResult = bGradeOrder - aGradeOrder;
      if (gradeResult !== 0) return gradeResult;

      const aIsMp = isPendingSection(a as InscriptionWithClosureRelations) ? 1 : 0;
      const bIsMp = isPendingSection(b as InscriptionWithClosureRelations) ? 1 : 0;
      return aIsMp - bIsMp || a.id - b.id;
    })[0];

    return {
      personId,
      inscriptions: groupedInscriptions,
      referenceInscription,
      isPendingOnly: groupedInscriptions.every(inscription =>
        isPendingSection(inscription as InscriptionWithClosureRelations)
      ),
    };
  });
}

export function sortClosureStudentGroups(groups: ClosureStudentGroup[]): ClosureStudentGroup[] {
  return [...groups].sort((a, b) => {
    const aGradeOrder = (a.referenceInscription as InscriptionWithClosureRelations).grade?.order ?? Number.MAX_SAFE_INTEGER;
    const bGradeOrder = (b.referenceInscription as InscriptionWithClosureRelations).grade?.order ?? Number.MAX_SAFE_INTEGER;
    if (aGradeOrder !== bGradeOrder) return aGradeOrder - bGradeOrder;

    const aSection = (a.referenceInscription as InscriptionWithClosureRelations).section?.name ?? '';
    const bSection = (b.referenceInscription as InscriptionWithClosureRelations).section?.name ?? '';
    const sectionResult = aSection.localeCompare(bSection, 'es', { sensitivity: 'base' });
    if (sectionResult !== 0) return sectionResult;

    const aDocument = (a.referenceInscription as InscriptionWithClosureRelations).student?.document ?? '';
    const bDocument = (b.referenceInscription as InscriptionWithClosureRelations).student?.document ?? '';
    return aDocument.localeCompare(bDocument, 'es', { numeric: true });
  });
}
