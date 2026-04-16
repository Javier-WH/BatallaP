import { v4 as uuidv4 } from 'uuid';
import { Transaction } from 'sequelize';
import EnrollmentReport from '@/models/EnrollmentReport';
import Matriculation from '@/models/Matriculation';
import Person from '@/models/Person';
import PersonResidence from '@/models/PersonResidence';
import Contact from '@/models/Contact';
import StudentGuardian from '@/models/StudentGuardian';
import GuardianProfile from '@/models/GuardianProfile';
import StudentPreviousSchool from '@/models/StudentPreviousSchool';
import EnrollmentAnswer from '@/models/EnrollmentAnswer';
import EnrollmentQuestion from '@/models/EnrollmentQuestion';
import EnrollmentDocument from '@/models/EnrollmentDocument';
import SchoolPeriod from '@/models/SchoolPeriod';
import Grade from '@/models/Grade';
import Setting from '@/models/Setting';

const getSettingValue = async (key: string): Promise<string> => {
  const setting = await Setting.findOne({ where: { key } });
  return setting?.getDataValue('value') ?? '';
};

interface GuardianSnapshot {
  firstName: string;
  lastName: string;
  documentType: string;
  document: string;
  phone: string;
  email: string;
  residenceState: string;
  residenceMunicipality: string;
  residenceParish: string;
  address: string;
  occupation?: string;
  birthdate?: string | null;
}

interface SnapshotData {
  institution: {
    name: string;
    deaCode: string;
    logo: string;
  };
  period: { id: number; name: string };
  grade: { id: number; name: string };
  escolaridad: string;
  student: {
    firstName: string;
    lastName: string;
    documentType: string;
    document: string;
    gender: string;
    birthdate: string | null;
    pathology?: string;
    livingWith?: string;
    birthState?: string;
    birthMunicipality?: string;
    birthParish?: string;
    residenceState?: string;
    residenceMunicipality?: string;
    residenceParish?: string;
    phone1?: string;
    phone2?: string;
    email?: string;
    address?: string;
    whatsapp?: string;
  };
  mother?: GuardianSnapshot | null;
  father?: GuardianSnapshot | null;
  representative?: {
    relationship: string;
    data: GuardianSnapshot;
  } | null;
  previousSchools: Array<{
    plantelName: string;
    plantelCode?: string | null;
    state?: string | null;
  }>;
  enrollmentAnswers: Array<{
    prompt: string;
    answer: string | string[];
  }>;
  documents: {
    receivedCertificadoAprendizaje: boolean;
    receivedCartaBuenaConducta: boolean;
    receivedNotasCertificadas: boolean;
    receivedPartidaNacimiento: boolean;
    receivedCopiaCedulaEstudiante: boolean;
    receivedInformesMedicos: boolean;
    receivedFotoCarnetEstudiante: boolean;
  } | null;
}

const buildGuardianSnapshot = (profile: GuardianProfile): GuardianSnapshot => ({
  firstName: profile.firstName,
  lastName: profile.lastName,
  documentType: profile.documentType,
  document: profile.document,
  phone: profile.phone,
  email: profile.email,
  residenceState: profile.residenceState,
  residenceMunicipality: profile.residenceMunicipality,
  residenceParish: profile.residenceParish,
  address: profile.address,
  occupation: profile.occupation || undefined,
  birthdate: profile.getDataValue('birthdate')
    ? String(profile.getDataValue('birthdate'))
    : null,
});

export const generateEnrollmentReport = async (
  matriculationId: number,
  transaction?: Transaction
): Promise<EnrollmentReport> => {
  const matriculation = await Matriculation.findByPk(matriculationId, {
    include: [
      { model: Person, as: 'student' },
      { model: SchoolPeriod, as: 'period' },
      { model: Grade, as: 'grade' },
    ],
    transaction,
  });

  if (!matriculation) {
    throw new Error('Matriculación no encontrada');
  }

  const person = matriculation.student as Person;
  if (!person) {
    throw new Error('Estudiante no encontrado en la matriculación');
  }

  const [residence, contact, guardians, previousSchools, answers, enrollmentDoc, institutionName, institutionDeaCode] =
    await Promise.all([
      PersonResidence.findOne({ where: { personId: person.id }, transaction }),
      Contact.findOne({ where: { personId: person.id }, transaction }),
      StudentGuardian.findAll({
        where: { studentId: person.id },
        include: [{ model: GuardianProfile, as: 'profile' }],
        transaction,
      }),
      StudentPreviousSchool.findAll({
        where: { personId: person.id },
        transaction,
      }),
      EnrollmentAnswer.findAll({
        where: { personId: person.id },
        include: [{ model: EnrollmentQuestion, as: 'question' }],
        transaction,
      }),
      EnrollmentDocument.findOne({
        where: { matriculationId },
        transaction,
      }),
      getSettingValue('institution_name'),
      getSettingValue('institution_dea_code'),
    ]);

  const period = matriculation.get('period') as SchoolPeriod;
  const grade = matriculation.get('grade') as Grade;

  // Build guardian snapshots
  const motherGuardian = guardians.find((g) => g.relationship === 'mother');
  const fatherGuardian = guardians.find((g) => g.relationship === 'father');
  const representativeGuardian = guardians.find((g) => g.isRepresentative);

  let representativeSnapshot: SnapshotData['representative'] = null;
  if (representativeGuardian && representativeGuardian.profile) {
    representativeSnapshot = {
      relationship: representativeGuardian.relationship,
      data: buildGuardianSnapshot(representativeGuardian.profile),
    };
  }

  const snapshotData: SnapshotData = {
    institution: {
      name: institutionName || 'Sin nombre configurado',
      deaCode: institutionDeaCode || '',
      logo: '/api/upload/logo',
    },
    period: { id: period.id, name: period.getDataValue('name') },
    grade: { id: grade.id, name: grade.getDataValue('name') },
    escolaridad: matriculation.escolaridad,
    student: {
      firstName: person.firstName,
      lastName: person.lastName,
      documentType: person.documentType,
      document: person.document,
      gender: person.gender,
      birthdate: person.birthdate ? String(person.birthdate) : null,
      pathology: person.pathology || undefined,
      livingWith: person.livingWith || undefined,
      birthState: residence?.birthState,
      birthMunicipality: residence?.birthMunicipality,
      birthParish: residence?.birthParish,
      residenceState: residence?.residenceState,
      residenceMunicipality: residence?.residenceMunicipality,
      residenceParish: residence?.residenceParish,
      phone1: contact?.phone1 || undefined,
      phone2: contact?.phone2 || undefined,
      email: contact?.email || undefined,
      address: contact?.address || undefined,
      whatsapp: contact?.whatsapp || undefined,
    },
    mother:
      motherGuardian?.profile
        ? buildGuardianSnapshot(motherGuardian.profile)
        : null,
    father:
      fatherGuardian?.profile
        ? buildGuardianSnapshot(fatherGuardian.profile)
        : null,
    representative: representativeSnapshot,
    previousSchools: previousSchools.map((s) => ({
      plantelName: s.plantelName,
      plantelCode: s.plantelCode,
      state: s.state,
    })),
    enrollmentAnswers: answers.map((a) => {
      const question = a.get('question') as EnrollmentQuestion | undefined;
      return {
        prompt: question?.getDataValue('prompt') ?? 'Pregunta',
        answer: a.answer,
      };
    }),
    documents: enrollmentDoc
      ? {
          receivedCertificadoAprendizaje: enrollmentDoc.receivedCertificadoAprendizaje,
          receivedCartaBuenaConducta: enrollmentDoc.receivedCartaBuenaConducta,
          receivedNotasCertificadas: enrollmentDoc.receivedNotasCertificadas,
          receivedPartidaNacimiento: enrollmentDoc.receivedPartidaNacimiento,
          receivedCopiaCedulaEstudiante: enrollmentDoc.receivedCopiaCedulaEstudiante,
          receivedInformesMedicos: enrollmentDoc.receivedInformesMedicos,
          receivedFotoCarnetEstudiante: enrollmentDoc.receivedFotoCarnetEstudiante,
        }
      : null,
  };

  const report = await EnrollmentReport.create(
    {
      uuid: uuidv4(),
      matriculationId,
      personId: person.id,
      snapshotData: snapshotData as unknown as Record<string, unknown>,
    },
    { transaction }
  );

  return report;
};

export const getReportsByPerson = async (personId: number): Promise<EnrollmentReport[]> => {
  return EnrollmentReport.findAll({
    where: { personId },
    order: [['createdAt', 'DESC']],
  });
};

export const getReportByUuid = async (uuid: string): Promise<EnrollmentReport | null> => {
  return EnrollmentReport.findOne({ where: { uuid } });
};
