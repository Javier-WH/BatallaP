import { Transaction } from 'sequelize';
import sequelize from '@/config/database';
import {
  Person,
  Role,
  PersonRole,
  Contact,
  PersonResidence,
  SchoolPeriod,
  Grade,
  Section,
  PeriodGrade,
  PeriodGradeSection,
  PeriodGradeSubject,
  Subject,
  Inscription,
  InscriptionSubject
} from '@/models/index';
import { GuardianAssignment, assignGuardians } from '@/services/studentGuardianService';
import { GuardianProfilePayload } from '@/services/guardianProfileService';

const FEMALE_NAMES = ['Mariana', 'Daniela', 'Gabriela', 'Luisa', 'Patricia', 'Valentina', 'Alejandra', 'Carolina'];
const MALE_NAMES = ['Carlos', 'Jorge', 'Luis', 'Diego', 'Andrés', 'Juan', 'Mateo', 'Sebastián'];
const LAST_NAMES = ['Pérez', 'González', 'Rodríguez', 'Fernández', 'Sánchez', 'Ramírez', 'Castro', 'Romero'];

const LOCATION_PRESETS = [
  {
    birth: { state: 'Distrito Capital', municipality: 'Libertador', parish: 'San Pedro' },
    residence: {
      state: 'Miranda',
      municipality: 'Sucre',
      parish: 'Petare',
      address: 'Av. Francisco de Miranda, Res. Horizonte'
    }
  },
  {
    birth: { state: 'Aragua', municipality: 'Girardot', parish: 'Las Delicias' },
    residence: {
      state: 'Carabobo',
      municipality: 'Valencia',
      parish: 'San José',
      address: 'Urb. La Viña, Calle 110, Casa 23'
    }
  },
  {
    birth: { state: 'Zulia', municipality: 'Maracaibo', parish: 'Olegario Villalobos' },
    residence: {
      state: 'Lara',
      municipality: 'Iribarren',
      parish: 'Concepción',
      address: 'Av. Lara, Residencias La Colina'
    }
  },
  {
    birth: { state: 'Miranda', municipality: 'Chacao', parish: 'Chacao' },
    residence: {
      state: 'Distrito Capital',
      municipality: 'Libertador',
      parish: 'El Paraíso',
      address: 'Res. Vista Verde, Torre B, Apto 8'
    }
  }
];

const randomItem = <T>(items: T[]): T => items[Math.floor(Math.random() * items.length)];
const randomDigits = (length: number) => Math.floor(Math.random() * 10 ** length).toString().padStart(length, '0');
const slugify = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/gi, '').toLowerCase();
const buildDocumentNumber = (base: number, suffix?: number) =>
  suffix === undefined ? base.toString() : `${base}${suffix}`;

const buildGuardianPayload = (
  firstName: string,
  lastName: string,
  documentNumber: string,
  location: { state: string; municipality: string; parish: string; address: string }
): GuardianProfilePayload => ({
  firstName,
  lastName,
  documentType: 'Venezolano',
  document: documentNumber,
  phone: `04${Math.random() > 0.5 ? '12' : '24'}${randomDigits(7)}`,
  email: `${slugify(firstName)}.${slugify(lastName)}.${randomDigits(3)}@representantes.demo`,
  residenceState: location.state,
  residenceMunicipality: location.municipality,
  residenceParish: location.parish,
  address: location.address
});

const parseArgs = () => {
  const countArg = process.argv.find(arg => arg.startsWith('--count='));
  const count = countArg ? parseInt(countArg.split('=')[1], 10) : 40;
  return Number.isNaN(count) ? 40 : Math.max(1, count);
};

type GradeStructure = {
  sectionIds: number[];
  mandatorySubjectIds: number[];
  groupedSubjectIds: Record<number, number[]>;
};

const buildGradeStructure = async (
  schoolPeriodId: number,
  transaction: Transaction
): Promise<Map<number, GradeStructure>> => {
  const map = new Map<number, GradeStructure>();
  const periodGrades = await PeriodGrade.findAll({ where: { schoolPeriodId }, transaction });

  for (const pg of periodGrades) {
    const periodSections = await PeriodGradeSection.findAll({ where: { periodGradeId: pg.id }, transaction });
    const periodSubjects = await PeriodGradeSubject.findAll({
      where: { periodGradeId: pg.id },
      include: [{ model: Subject, as: 'subject', attributes: ['id', 'subjectGroupId'] }],
      transaction
    });

    const groupedSubjectIds: Record<number, number[]> = {};
    const mandatorySubjectIds: number[] = [];
    map.set(pg.gradeId, {
      sectionIds: periodSections.map(ps => ps.sectionId),
      mandatorySubjectIds,
      groupedSubjectIds
    });
    const structure = map.get(pg.gradeId)!;

    for (const ps of periodSubjects) {
      const subjectId = ps.subjectId;
      const groupId = (ps as any).subject?.subjectGroupId ?? null;

      if (!groupId) {
        structure.mandatorySubjectIds.push(subjectId);
        continue;
      }

      if (!structure.groupedSubjectIds[groupId]) {
        structure.groupedSubjectIds[groupId] = [];
      }
      structure.groupedSubjectIds[groupId].push(subjectId);
    }
  }

  return map;
};

const seedInscriptions = async (targetCount: number) => {
  const transaction = await sequelize.transaction();
  try {
    const activePeriod = await SchoolPeriod.findOne({ where: { isActive: true }, transaction });
    if (!activePeriod) {
      throw new Error('No existe un período escolar activo. Ejecute el seeder principal primero.');
    }

    const grades = await Grade.findAll({ order: [['order', 'ASC']], transaction });
    if (grades.length === 0) {
      throw new Error('No se encontraron grados. Ejecute el seeder principal primero.');
    }

    const sections = await Section.findAll({ order: [['createdAt', 'ASC']], transaction });
    if (sections.length === 0) {
      throw new Error('No existen secciones base. Ejecute el seeder de estructura académica.');
    }

    const gradeStructure = await buildGradeStructure(activePeriod.id, transaction);
    if (gradeStructure.size === 0) {
      throw new Error('No existe estructura académica (PeriodGrade / materias / secciones). Ejecute academicStructureSeeder primero.');
    }

    const [studentRole] = await Role.findOrCreate({
      where: { name: 'Alumno' },
      defaults: { name: 'Alumno' },
      transaction
    });

    let created = 0;
    let attempts = 0;

    while (created < targetCount && attempts < targetCount * 5) {
      attempts += 1;
      const baseDocumentNumber = 30000000 + attempts;
      const studentDocument = buildDocumentNumber(baseDocumentNumber);
      const existing = await Person.findOne({ where: { document: studentDocument }, transaction });
      if (existing) {
        continue;
      }

      const isMale = Math.random() > 0.5;
      const firstName = isMale ? randomItem(MALE_NAMES) : randomItem(FEMALE_NAMES);
      const lastName = `${randomItem(LAST_NAMES)} ${randomItem(LAST_NAMES)}`;
      const gender: 'M' | 'F' = isMale ? 'M' : 'F';
      const birthYear = 2008 + (attempts % 5);
      const birthdate = new Date(birthYear, attempts % 12, (attempts % 28) + 1);
      const locationPreset = LOCATION_PRESETS[attempts % LOCATION_PRESETS.length];
      const residence = locationPreset.residence;
      const grade = grades[created % grades.length];
      const structure = gradeStructure.get(grade.id);

      const hasMandatorySubjects = structure?.mandatorySubjectIds.length ?? 0;
      const hasGroupedSubjects = structure
        ? Object.values(structure.groupedSubjectIds).some(subjectList => subjectList.length > 0)
        : false;

      if (
        !structure ||
        structure.sectionIds.length === 0 ||
        (!hasMandatorySubjects && !hasGroupedSubjects)
      ) {
        throw new Error(
          `El grado "${grade.name}" no tiene secciones o materias asignadas. Ejecute academicStructureSeeder antes de generar inscripciones.`
        );
      }

      const sectionId = structure.sectionIds[created % structure.sectionIds.length];
      const section = sections.find(sec => sec.id === sectionId) ?? sections[created % sections.length];

      const person = await Person.create(
        {
          firstName,
          lastName,
          documentType: 'Venezolano',
          document: studentDocument,
          gender,
          birthdate,
          userId: null
        },
        { transaction }
      );

      await PersonRole.create({ personId: person.id, roleId: studentRole.id }, { transaction });

      await Contact.create(
        {
          personId: person.id,
          phone1: `04${Math.random() > 0.5 ? '12' : '14'}${randomDigits(7)}`,
          email: `${slugify(firstName)}.${slugify(lastName.split(' ')[0])}${randomDigits(3)}@estudiantes.demo`,
          address: residence.address,
          whatsapp: `04${Math.random() > 0.5 ? '12' : '24'}${randomDigits(7)}`
        },
        { transaction }
      );

      await PersonResidence.create(
        {
          personId: person.id,
          birthState: locationPreset.birth.state,
          birthMunicipality: locationPreset.birth.municipality,
          birthParish: locationPreset.birth.parish,
          residenceState: residence.state,
          residenceMunicipality: residence.municipality,
          residenceParish: residence.parish
        },
        { transaction }
      );

      const motherPayload = buildGuardianPayload(
        randomItem(FEMALE_NAMES),
        lastName,
        buildDocumentNumber(baseDocumentNumber, 1),
        residence
      );
      const fatherPayload = buildGuardianPayload(
        randomItem(MALE_NAMES),
        lastName,
        buildDocumentNumber(baseDocumentNumber, 2),
        residence
      );

      const representativeType = Math.random();
      const motherIsRepresentative = representativeType < 0.4;
      const fatherIsRepresentative = !motherIsRepresentative && representativeType < 0.75;
      const hasExternalRepresentative = !motherIsRepresentative && !fatherIsRepresentative;

      const assignments: GuardianAssignment[] = [
        {
          payload: motherPayload,
          relationship: 'mother',
          isRepresentative: motherIsRepresentative
        },
        {
          payload: fatherPayload,
          relationship: 'father',
          isRepresentative: fatherIsRepresentative
        }
      ];

      if (hasExternalRepresentative) {
        const repPayload = buildGuardianPayload(
          randomItem([...FEMALE_NAMES, ...MALE_NAMES]),
          randomItem(LAST_NAMES),
          buildDocumentNumber(baseDocumentNumber, 3),
          residence
        );
        assignments.push({
          payload: repPayload,
          relationship: 'representative',
          isRepresentative: true
        });
      }

      await assignGuardians(person.id, assignments, transaction);

      const inscription = await Inscription.create(
        {
          personId: person.id,
          schoolPeriodId: activePeriod.id,
          gradeId: grade.id,
          sectionId: section?.id ?? undefined,
          escolaridad: 'regular'
        },
        { transaction }
      );

      const subjectIds: number[] = [...structure.mandatorySubjectIds];

      for (const groupedSubjects of Object.values(structure.groupedSubjectIds)) {
        if (groupedSubjects.length === 0) {
          continue;
        }
        subjectIds.push(randomItem<number>(groupedSubjects));
      }

      if (subjectIds.length > 0) {
        await InscriptionSubject.bulkCreate(
          subjectIds.map(subjectId => ({
            inscriptionId: inscription.id,
            subjectId
          })),
          { transaction }
        );
      }

      created += 1;
    }

    await transaction.commit();
    console.log(`✅ Se generaron ${created} inscripciones completas con representantes y materias.`);
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Error generando inscripciones masivas:', error);
    throw error;
  }
};

if (require.main === module) {
  const count = parseArgs();
  sequelize.authenticate()
    .then(() => seedInscriptions(count))
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export default seedInscriptions;
