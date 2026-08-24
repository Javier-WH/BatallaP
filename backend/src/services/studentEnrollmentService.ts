import { Transaction, Op } from 'sequelize';
import sequelize from '@/config/database';
import {
  Person,
  PersonCreationAttributes,
  Contact,
  ContactCreationAttributes,
  PersonResidence,
  StudentGuardian,
  GuardianProfile,
  StudentPreviousSchool,
  Plantel,
  Role,
  PersonRole,
  Matriculation,
  EnrollmentDocument
} from '@/models/index';
import { saveEnrollmentAnswers, EnrollmentAnswerPayload } from '@/services/enrollmentAnswerService';
import { assignGuardians, GuardianAssignment } from '@/services/studentGuardianService';
import { GuardianDocumentType } from '@/models/GuardianProfile';
import { GuardianRelationship } from '@/models/StudentGuardian';
import { EscolaridadStatus } from '@/types/enrollment';
import { generateEnrollmentReport } from '@/services/enrollmentReportService';

const ESCOLARIDAD_VALUES: EscolaridadStatus[] = ['regular', 'repitiente', 'materia_pendiente'];

export const normalizeEscolaridad = (value?: unknown): EscolaridadStatus => {
  if (typeof value !== 'string') return 'regular';
  const normalized = value.trim().toLowerCase() as EscolaridadStatus;
  if (ESCOLARIDAD_VALUES.includes(normalized)) {
    return normalized;
  }
  throw new Error('Valor de escolaridad inválido. Debe ser regular, repitiente o materia_pendiente.');
};

export type GuardianInput = {
  firstName?: string;
  lastName?: string;
  documentType?: GuardianDocumentType;
  document?: string;
  residenceState?: string;
  residenceMunicipality?: string;
  residenceParish?: string;
  address?: string;
  phone?: string;
  phone2?: string;
  whatsapp?: string;
  email?: string;
  occupation?: string;
};

const guardianRequiredFields: (keyof GuardianInput)[] = [
  'firstName',
  'lastName',
  'documentType',
  'document',
  'residenceState',
  'residenceMunicipality',
  'residenceParish',
  'address',
  'phone',
  'email'
];

// Fields that can be relaxed (made optional) in the bulk enrollment flow
const guardianContactFields: (keyof GuardianInput)[] = ['address', 'phone', 'email'];

const isEmptyValue = (value: unknown) => {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  return false;
};

export const hasGuardianData = (data?: GuardianInput | null) => {
  if (!data) return false;
  return Object.values(data).some((value) => !isEmptyValue(value));
};

export type ValidateGuardianOptions = {
  relaxContactFields?: boolean;
};

export const validateGuardianPayload = (
  label: string,
  data: GuardianInput | null | undefined,
  required: boolean,
  options?: ValidateGuardianOptions
): Required<GuardianInput> | null => {
  const hasData = hasGuardianData(data);

  if (!hasData) {
    if (required) {
      throw new Error(`Los datos de ${label} son obligatorios.`);
    }
    return null;
  }

  if (!required) {
    const hasIdentity =
      !isEmptyValue(data?.firstName) ||
      !isEmptyValue(data?.lastName) ||
      !isEmptyValue(data?.document);
    if (!hasIdentity) {
      return null;
    }
  }

  const requiredFields = options?.relaxContactFields
    ? guardianRequiredFields.filter((f) => !guardianContactFields.includes(f))
    : guardianRequiredFields;

  const missingFields = requiredFields.filter((field) => isEmptyValue(data?.[field]));
  if (missingFields.length > 0) {
    throw new Error(`Faltan campos obligatorios para ${label}: ${missingFields.join(', ')}`);
  }

  // Fill relaxed contact fields with empty string so the model's allowNull: false is satisfied
  if (options?.relaxContactFields && data) {
    return {
      ...data,
      address: data.address ?? '',
      phone: data.phone ?? '',
      email: data.email ?? ''
    } as Required<GuardianInput>;
  }

  return data as Required<GuardianInput>;
};

export const mapToGuardianProfilePayload = (data: Required<GuardianInput>) => ({
  firstName: data.firstName,
  lastName: data.lastName,
  documentType: data.documentType,
  document: data.document,
  phone: data.phone,
  phone2: data.phone2 ?? '',
  whatsapp: data.whatsapp ?? '',
  email: data.email,
  residenceState: data.residenceState,
  residenceMunicipality: data.residenceMunicipality,
  residenceParish: data.residenceParish,
  address: data.address,
  occupation: data.occupation
});

export type RegisterAndEnrollPayload = {
  firstName: string;
  lastName: string;
  documentType: string;
  document?: string | null;
  nationality?: 'Venezolano' | 'Extranjero';
  gender: 'M' | 'F';
  birthdate: string;
  pathology?: string | null;
  livingWith?: string | null;
  birthState: string;
  birthMunicipality: string;
  birthParish: string;
  residenceState: string;
  residenceMunicipality: string;
  residenceParish: string;
  mother?: GuardianInput | null;
  father?: GuardianInput | null;
  representative?: GuardianInput | null;
  representativeType?: 'mother' | 'father' | 'sibling' | 'grandparent' | 'uncle_aunt' | 'other';
  phone1?: string | null;
  phone2?: string | null;
  email?: string | null;
  address?: string | null;
  whatsapp?: string | null;
  previousSchoolIds?: (string | number)[];
  schoolPeriodId: number;
  gradeId: number;
  sectionId?: number | null;
  enrollmentAnswers?: EnrollmentAnswerPayload[];
  escolaridad?: EscolaridadStatus;
  documents?: Record<string, unknown> | null;
};

export type RegisterAndEnrollResult = {
  person: Person;
  matriculation: Matriculation;
  reportUuid?: string;
};

const toOptionalString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value : undefined;

const toOptionalStringArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const cleaned = value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  return cleaned.length > 0 ? cleaned : undefined;
};

export const registerAndEnrollStudent = async (
  payload: RegisterAndEnrollPayload,
  options?: { transaction?: Transaction; relaxGuardianContactFields?: boolean }
): Promise<RegisterAndEnrollResult> => {
  const t = options?.transaction ?? await sequelize.transaction();
  const relaxGuardianContactFields = options?.relaxGuardianContactFields ?? false;

  try {
    const {
      firstName,
      lastName,
      documentType,
      document,
      nationality,
      gender,
      birthdate,
      pathology,
      livingWith,
      birthState,
      birthMunicipality,
      birthParish,
      residenceState,
      residenceMunicipality,
      residenceParish,
      mother,
      father,
      representative,
      representativeType,
      phone1,
      phone2,
      email,
      address,
      whatsapp,
      previousSchoolIds,
      schoolPeriodId,
      gradeId,
      sectionId,
      enrollmentAnswers,
      escolaridad,
      documents
    } = payload;

    if (!firstName || !lastName || !documentType || !gender || !birthdate) {
      throw new Error('Datos básicos del estudiante incompletos');
    }

    if (!schoolPeriodId || !gradeId) {
      throw new Error('El periodo escolar y el grado son obligatorios');
    }

    if (!birthState || !birthMunicipality || !birthParish || !residenceState || !residenceMunicipality || !residenceParish) {
      throw new Error('Datos de nacimiento y residencia son obligatorios para registrar estudiantes.');
    }

    let finalDocument = document ?? undefined;
    if (documentType === 'Cedula Escolar' && (!finalDocument || finalDocument.trim() === '')) {
      if (!mother || !mother.document) {
        throw new Error('La cédula de la madre es obligatoria para generar la Cédula Escolar.');
      }

      const nationalityChar = nationality === 'Extranjero' ? 'E' : 'V';
      let birthOrder = 1;
      const motherProfile = await GuardianProfile.findOne({
        where: { document: mother.document },
        transaction: t
      });
      if (motherProfile) {
        const childrenCount = await StudentGuardian.count({
          where: { guardianId: motherProfile.id, relationship: 'mother' },
          transaction: t
        });
        birthOrder = childrenCount + 1;
      }

      const birthYear = birthdate ? new Date(birthdate).getFullYear().toString().slice(-2) : '00';
      finalDocument = `${nationalityChar}${birthOrder}${birthYear}${mother.document}`;
    }

    const allowedDocumentTypes: Person['documentType'][] = ['Venezolano', 'Extranjero', 'Pasaporte', 'Cedula Escolar'];
    const sanitizedDocumentType = (allowedDocumentTypes.includes(documentType as Person['documentType'])
      ? documentType
      : 'Venezolano') as Person['documentType'];

    const parsedBirthdate = new Date(birthdate);
    if (Number.isNaN(parsedBirthdate.getTime())) {
      throw new Error('Fecha de nacimiento inválida');
    }

    const personPayload: PersonCreationAttributes = {
      firstName,
      lastName,
      documentType: sanitizedDocumentType,
      document: finalDocument ?? '',
      gender,
      birthdate: parsedBirthdate,
      userId: null
    };

    if (typeof pathology === 'string' && pathology.trim()) {
      personPayload.pathology = pathology;
    }
    if (typeof livingWith === 'string' && livingWith.trim()) {
      personPayload.livingWith = livingWith;
    }

    const person = await Person.create(personPayload, { transaction: t });

    const validRepresentativeTypes = ['mother', 'father', 'sibling', 'grandparent', 'uncle_aunt', 'other'];
    const representativeSelection = typeof representativeType === 'string' && validRepresentativeTypes.includes(representativeType)
      ? representativeType
      : 'mother';
    const motherIsRepresentative = representativeSelection === 'mother';
    const fatherIsRepresentative = representativeSelection === 'father';
    const representativeDataRequired = !motherIsRepresentative && !fatherIsRepresentative;
    const motherDataRequired = motherIsRepresentative || documentType === 'Cedula Escolar';
    const fatherDataRequired = fatherIsRepresentative;

    const motherData = validateGuardianPayload('la madre', mother, motherDataRequired, { relaxContactFields: relaxGuardianContactFields });
    const fatherData = validateGuardianPayload('el padre', father, fatherDataRequired, { relaxContactFields: relaxGuardianContactFields });
    const representativeData = validateGuardianPayload('el representante', representative, representativeDataRequired, { relaxContactFields: relaxGuardianContactFields });

    if (!motherIsRepresentative && !fatherIsRepresentative && !representativeData) {
      throw new Error('Debe registrar un representante si la madre o el padre no lo son.');
    }

    if (phone1 || email || address || whatsapp || phone2) {
      const contactPayload: ContactCreationAttributes = {
        phone1: phone1 || '',
        address: address || '',
        personId: person.id
      } as ContactCreationAttributes;

      if (phone2) contactPayload.phone2 = phone2;
      if (email) contactPayload.email = email;
      if (whatsapp) contactPayload.whatsapp = whatsapp;

      await Contact.create(contactPayload, { transaction: t });
    }

    await PersonResidence.create({
      personId: person.id,
      birthState,
      birthMunicipality,
      birthParish,
      residenceState,
      residenceMunicipality,
      residenceParish,
      address: address && address.trim().length > 0 ? address : undefined
    }, { transaction: t });

    if (Array.isArray(previousSchoolIds) && previousSchoolIds.length) {
      const schoolRecords: Array<{
        personId: number;
        plantelCode: string | null;
        plantelName: string;
        state: string | null;
        dependency: string | null;
      }> = [];
      for (const item of previousSchoolIds) {
        const plantel = await Plantel.findOne({
          where: { [Op.or]: [{ code: item }, { name: item }] },
          transaction: t
        });
        schoolRecords.push({
          personId: person.id,
          plantelCode: plantel?.code || (typeof item === 'string' ? item : null),
          plantelName: plantel?.name || (typeof item === 'string' ? item : 'Desconocido'),
          state: plantel?.state || null,
          dependency: plantel?.dependency || null
        });
      }
      if (schoolRecords.length > 0) {
        await StudentPreviousSchool.bulkCreate(schoolRecords, { transaction: t });
      }
    }

    const assignments: GuardianAssignment[] = [];
    if (motherData) {
      assignments.push({
        payload: mapToGuardianProfilePayload(motherData),
        relationship: 'mother',
        isRepresentative: motherIsRepresentative
      });
    }
    if (fatherData) {
      assignments.push({
        payload: mapToGuardianProfilePayload(fatherData),
        relationship: 'father',
        isRepresentative: fatherIsRepresentative
      });
    }
    if (representativeData) {
      const repRelationship = (representativeSelection === 'sibling' || representativeSelection === 'grandparent' || representativeSelection === 'uncle_aunt')
        ? (representativeSelection as GuardianRelationship)
        : 'representative';
      assignments.push({
        payload: mapToGuardianProfilePayload(representativeData),
        relationship: repRelationship,
        isRepresentative: true
      });
    }

    if (!assignments.some((guardian) => guardian.isRepresentative)) {
      throw new Error('Debe seleccionar al menos un representante legal.');
    }

    if (assignments.length > 0) {
      await assignGuardians(person.id, assignments, t);
    }

    let role = await Role.findOne({ where: { name: 'Alumno' }, transaction: t });
    if (!role) {
      role = await Role.create({ name: 'Alumno' }, { transaction: t });
    }
    await PersonRole.create({ personId: person.id, roleId: role.id }, { transaction: t });

    const matriculation = await Matriculation.create({
      schoolPeriodId,
      gradeId,
      sectionId: sectionId || null,
      personId: person.id,
      status: 'pending',
      escolaridad: normalizeEscolaridad(escolaridad)
    }, { transaction: t });

    if (Array.isArray(enrollmentAnswers)) {
      await saveEnrollmentAnswers(person.id, enrollmentAnswers, { transaction: t });
    }

    if (documents) {
      const documentPayload = {
        receivedCertificadoAprendizaje: Boolean(documents.receivedCertificadoAprendizaje),
        receivedCartaBuenaConducta: Boolean(documents.receivedCartaBuenaConducta),
        receivedNotasCertificadas: Boolean(documents.receivedNotasCertificadas),
        receivedPartidaNacimiento: Boolean(documents.receivedPartidaNacimiento),
        receivedCopiaCedulaEstudiante: Boolean(documents.receivedCopiaCedulaEstudiante),
        receivedInformesMedicos: Boolean(documents.receivedInformesMedicos),
        receivedFotoCarnetEstudiante: Boolean(documents.receivedFotoCarnetEstudiante),
        pathCedulaRepresentante: toOptionalString(documents.pathCedulaRepresentante),
        pathFotoRepresentante: toOptionalString(documents.pathFotoRepresentante),
        pathFotoEstudiante: toOptionalString(documents.pathFotoEstudiante),
        pathInformesMedicos: toOptionalStringArray(documents.pathInformesMedicos)
      };

      await EnrollmentDocument.create({
        matriculationId: matriculation.id,
        ...documentPayload
      }, { transaction: t });
    }

    const report = await generateEnrollmentReport(matriculation.id, t);

    if (!options?.transaction) {
      await t.commit();
    }

    return { person, matriculation, reportUuid: report.uuid };
  } catch (error) {
    if (!options?.transaction && t) {
      await t.rollback();
    }
    throw error;
  }
};
