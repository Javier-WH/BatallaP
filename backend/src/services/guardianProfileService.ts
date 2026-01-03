import GuardianProfile, { GuardianDocumentType } from '@/models/GuardianProfile';
import Person from '@/models/Person';
import Role from '@/models/Role';
import Contact from '@/models/Contact';
import PersonResidence from '@/models/PersonResidence';
import { Transaction, Op } from 'sequelize';

export type GuardianProfilePayload = {
  firstName: string;
  lastName: string;
  documentType: GuardianDocumentType;
  document: string;
  phone: string;
  email: string;
  residenceState: string;
  residenceMunicipality: string;
  residenceParish: string;
  address: string;
  occupation?: string;
};

interface Options {
  transaction?: Transaction;
}

const normalizeDocument = (document: string) => document.trim();

export const findGuardianProfile = async (documentType: GuardianDocumentType, document: string) => {
  const normalizedDoc = normalizeDocument(document);

  // 1. Try to find in GuardianProfile table first
  const guardianProfile = await GuardianProfile.findOne({
    where: {
      documentType,
      document: normalizedDoc
    }
  });

  if (guardianProfile) {
    return guardianProfile;
  }

  // 2. If not found, try to find in Person table
  const person = await Person.findOne({
    where: {
      documentType,
      document: normalizedDoc
    },
    include: [
      {
        model: Role,
        as: 'roles',
        through: { attributes: [] } // Avoid including join table attributes
      },
      {
        model: Contact,
        as: 'contact'
      },
      {
        model: PersonResidence,
        as: 'residence'
      }
    ]
  });

  // If found in Person, map to GuardianProfile structure
  if (person) {
    // Check if person is a student
    const isStudent = person.roles?.some(role => role.name === 'Alumno');

    // Allow if they are NOT a student, OR if they have other roles besides Student (e.g. Student + Representative?? Unlikely but possible in some systems)
    // Actually request said "excepto los estudiantes", imply pure students. 
    // If a person is both Student and Representative, they should probably be findable as Representative.
    // But usually a Student is a child. 
    // Let's stick to strict exclusion: If they have role 'Alumno', they might be the kid.
    // However, in adult education, a student can be a representative. 
    // User said: "todos los registros excepto los estudiantes".
    // Let's assume if they have the 'Alumno' role, they are a student and should be excluded unless they explicitly have another role like 'Representante'.

    // Simplest interpretation: Filter out if 'Alumno' is their ONLY role.
    const isStudentOnly = person.roles?.length === 1 && person.roles[0].name === 'Alumno';

    // Or even stricter: if they have 'Alumno' role at all? 
    // "todos los registros excepto los estudiantes" usually means "don't return students".
    // Let's filter out if they have the Alumno role.
    // BUT, what if a teacher is also a student? 
    // Let's stick to the previous logic: exclude if ONLY student.

    if (!isStudentOnly) {
      return {
        id: person.id,
        firstName: person.firstName,
        lastName: person.lastName,
        documentType: person.documentType as GuardianDocumentType,
        document: person.document,
        phone: person.contact?.phone1 || person.contact?.phone2 || '',
        email: person.contact?.email || '',
        residenceState: person.residence?.residenceState || '',
        residenceMunicipality: person.residence?.residenceMunicipality || '',
        residenceParish: person.residence?.residenceParish || '',
        address: person.contact?.address || ''
      } as GuardianProfile;
    }
  }

  return null;
};

export const findOrCreateGuardianProfile = async (
  payload: GuardianProfilePayload,
  options: Options = {}
): Promise<GuardianProfile> => {
  const normalizedDocument = normalizeDocument(payload.document);

  const [profile, created] = await GuardianProfile.findOrCreate({
    where: {
      documentType: payload.documentType,
      document: normalizedDocument
    },
    defaults: {
      ...payload,
      document: normalizedDocument
    },
    ...options
  });

  if (!created) {
    await profile.update(
      {
        ...payload,
        document: normalizedDocument
      },
      options
    );
  }

  return profile;
};
