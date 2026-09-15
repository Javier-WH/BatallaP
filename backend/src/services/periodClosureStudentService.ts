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
  /** Main inscription when available; MP-only falls back to the first inscription. */
  referenceInscription: Inscription;
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

  return Array.from(groups.entries()).map(([personId, groupedInscriptions]) => {
    const referenceInscription = [...groupedInscriptions].sort((a, b) => {
      const aIsMp = a.escolaridad === 'materia_pendiente' ? 1 : 0;
      const bIsMp = b.escolaridad === 'materia_pendiente' ? 1 : 0;
      return aIsMp - bIsMp || a.id - b.id;
    })[0];

    return {
      personId,
      inscriptions: groupedInscriptions,
      referenceInscription,
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
