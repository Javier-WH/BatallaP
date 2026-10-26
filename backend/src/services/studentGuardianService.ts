import { Op, Transaction } from 'sequelize';
import { findOrCreateGuardianProfile, GuardianProfilePayload } from '@/services/guardianProfileService';
import StudentGuardian, { GuardianRelationship } from '@/models/StudentGuardian';

export type GuardianAssignment = {
  payload: GuardianProfilePayload;
  relationship: GuardianRelationship;
  isRepresentative: boolean;
  isBenefactor?: boolean;
};

/** A guardian's data as the edit form sends it; every field may be blank. */
export interface EditGuardianInput {
  id?: number | null;
  firstName?: string | null;
  lastName?: string | null;
  documentType?: string | null;
  document?: string | null;
  phone?: string | null;
  phone2?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  residenceState?: string | null;
  residenceMunicipality?: string | null;
  residenceParish?: string | null;
  address?: string | null;
  occupation?: string | null;
  birthdate?: string | Date | null;
  /** This person is who pays for the student. */
  isBenefactor?: boolean | null;
}

/** Bad guardian data the user can fix: carries the HTTP status the controller should answer with. */
export class GuardianInputError extends Error {
  status = 400;
}

const blank = (v: unknown) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/**
 * Turns one guardian card of the edit form into an assignment.
 * - No name and no document: the card is empty, so it is ignored (a default
 *   document type or a stray unchecked box is not data).
 * - Anything identifying filled in: first name, last name, document type and
 *   document are required (the minimum to identify the person). Phone,
 *   address and residence may stay blank.
 */
const toPayload = (label: string, data: EditGuardianInput | null | undefined): GuardianProfilePayload | null => {
  if (!data) return null;
  if (blank(data.firstName) && blank(data.lastName) && blank(data.document)) return null;

  const missing = ([
    ['firstName', 'nombres'], ['lastName', 'apellidos'], ['documentType', 'tipo de documento'], ['document', 'número de documento'],
  ] as const).filter(([key]) => blank(data[key])).map(([, name]) => name);
  if (missing.length) throw new GuardianInputError(`Faltan datos de ${label}: ${missing.join(', ')}. Complételos o deje vacía esa sección.`);

  return {
    id: data.id ?? undefined,
    firstName: text(data.firstName),
    lastName: text(data.lastName),
    documentType: text(data.documentType) as GuardianProfilePayload['documentType'],
    document: text(data.document),
    phone: text(data.phone),
    phone2: text(data.phone2) || undefined,
    whatsapp: text(data.whatsapp) || undefined,
    email: text(data.email),
    residenceState: text(data.residenceState),
    residenceMunicipality: text(data.residenceMunicipality),
    residenceParish: text(data.residenceParish),
    address: text(data.address),
    occupation: text(data.occupation) || undefined,
    birthdate: data.birthdate ? new Date(data.birthdate) : null,
  };
};

/**
 * Assignments for "edit student" from the guardian cards of the form.
 * `benefactorSpecified` tells whether the request spoke about the benefactor at
 * all; when it did not, the stored benefactor must be kept (see assignGuardians).
 */
export const buildEditGuardianAssignments = (input: {
  mother?: EditGuardianInput | null;
  father?: EditGuardianInput | null;
  representative?: EditGuardianInput | null;
  /** Third person who pays when it is none of the above. */
  benefactor?: EditGuardianInput | null;
  representativeType?: string | null;
}): { assignments: GuardianAssignment[]; benefactorSpecified: boolean } => {
  const { mother, father, representative, benefactor, representativeType } = input;
  const assignments: GuardianAssignment[] = [];

  const motherPayload = toPayload('la madre', mother);
  if (motherPayload) {
    assignments.push({ payload: motherPayload, relationship: 'mother', isRepresentative: representativeType === 'mother', isBenefactor: mother?.isBenefactor === true });
  }
  const fatherPayload = toPayload('el padre', father);
  if (fatherPayload) {
    assignments.push({ payload: fatherPayload, relationship: 'father', isRepresentative: representativeType === 'father', isBenefactor: father?.isBenefactor === true });
  }
  const repPayload = toPayload('el representante', representative);
  if (repPayload) {
    const relationship: GuardianRelationship = representativeType === 'sibling' || representativeType === 'grandparent' || representativeType === 'uncle_aunt'
      ? representativeType
      : 'representative';
    assignments.push({ payload: repPayload, relationship, isRepresentative: true, isBenefactor: representative?.isBenefactor === true });
  }
  const benefactorPayload = toPayload('el benefactor', benefactor);
  if (benefactorPayload) {
    assignments.push({ payload: benefactorPayload, relationship: 'benefactor', isRepresentative: false, isBenefactor: true });
  }

  if (assignments.filter(a => a.isBenefactor).length > 1) {
    throw new GuardianInputError('Solo puede haber un benefactor: desmarque a uno o deje vacía la sección "Benefactor".');
  }

  const benefactorSpecified = benefactor !== undefined
    || [mother, father, representative].some(g => g && typeof g.isBenefactor === 'boolean');
  return { assignments, benefactorSpecified };
};

/**
 * Replaces the student's guardian links. Unless told otherwise, the stored
 * benefactor survives: flows that know nothing about it (enrollment, bulk
 * import…) must not erase who pays just by re-saving the parents.
 */
export const assignGuardians = async (
  studentId: number,
  assignments: GuardianAssignment[],
  transaction: Transaction,
  options: { preserveBenefactor?: boolean } = {}
) => {
  const preserve = options.preserveBenefactor ?? true;
  const previousBenefactors = preserve
    ? await StudentGuardian.findAll({
        where: { studentId, [Op.or]: [{ isBenefactor: true }, { relationship: 'benefactor' }] },
        transaction,
      })
    : [];

  await StudentGuardian.destroy({ where: { studentId }, transaction });

  const created = new Map<number, StudentGuardian>();
  for (const assignment of assignments) {
    const profile = await findOrCreateGuardianProfile(assignment.payload, { transaction });
    const row = await StudentGuardian.create(
      {
        studentId,
        guardianId: profile.id,
        relationship: assignment.relationship,
        isRepresentative: assignment.isRepresentative,
        isBenefactor: assignment.isBenefactor ?? false
      },
      { transaction }
    );
    created.set(profile.id, row);
  }

  for (const prev of previousBenefactors) {
    const same = created.get(prev.guardianId);
    if (same) {
      if (!same.isBenefactor) await same.update({ isBenefactor: true }, { transaction });
    } else if (prev.relationship === 'benefactor' && !assignments.some(a => a.relationship === 'benefactor')) {
      await StudentGuardian.create(
        { studentId, guardianId: prev.guardianId, relationship: 'benefactor', isRepresentative: false, isBenefactor: true },
        { transaction }
      );
    }
  }
};
