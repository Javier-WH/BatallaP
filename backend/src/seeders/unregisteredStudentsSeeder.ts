import { Transaction } from 'sequelize';
import sequelize from '@/config/database';
import {
  Person,
  Role,
  PersonRole,
  Contact,
  PersonResidence,
  Matriculation,
  SchoolPeriod,
  PeriodGrade,
  PeriodGradeSection
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
  const count = countArg ? parseInt(countArg.split('=')[1], 10) : 100;
  return Number.isNaN(count) ? 100 : Math.max(1, count);
};

const createUnregisteredStudents = async (targetCount: number) => {
  const transaction: Transaction = await sequelize.transaction();

  try {
    const activePeriod = await SchoolPeriod.findOne({ where: { isActive: true }, transaction });
    if (!activePeriod) {
      throw new Error('No existe un período escolar activo. Configure uno antes de generar estudiantes.');
    }

    const periodGrades = await PeriodGrade.findAll({
      where: { schoolPeriodId: activePeriod.id },
      transaction
    });

    if (periodGrades.length === 0) {
      throw new Error('No hay grados asociados al período activo. Ejecute el seeder de estructura académica.');
    }

    const gradeSectionMap = new Map<number, number[]>();
    for (const pg of periodGrades) {
      const sections = await PeriodGradeSection.findAll({
        where: { periodGradeId: pg.id },
        transaction
      });
      gradeSectionMap.set(pg.gradeId, sections.map(section => section.sectionId));
    }

    const gradeIds = periodGrades.map(pg => pg.gradeId);
    const hasSections = gradeIds.some(gradeId => (gradeSectionMap.get(gradeId) || []).length > 0);
    if (!hasSections) {
      throw new Error('Ningún grado tiene secciones asociadas al período activo.');
    }

    const [studentRole] = await Role.findOrCreate({
      where: { name: 'Alumno' },
      defaults: { name: 'Alumno' },
      transaction
    });

    let created = 0;
    let attempts = 0;

    const getPlacement = () => {
      const placementIndex = attempts - 1;
      const gradeId = gradeIds[placementIndex % gradeIds.length];
      const sections = gradeSectionMap.get(gradeId) || [];
      const sectionId = sections.length ? sections[placementIndex % sections.length] : null;
      return { gradeId, sectionId };
    };

    while (created < targetCount && attempts < targetCount * 5) {
      attempts += 1;
      const baseDocumentNumber = 50000000 + attempts;
      const document = buildDocumentNumber(baseDocumentNumber);

      const existing = await Person.findOne({ where: { document }, transaction });
      if (existing) {
        const alreadyMatriculated = await Matriculation.findOne({
          where: { personId: existing.id, schoolPeriodId: activePeriod.id },
          transaction
        });
        if (alreadyMatriculated) {
          continue;
        }
        const placement = getPlacement();
        await Matriculation.create(
          {
            personId: existing.id,
            schoolPeriodId: activePeriod.id,
            gradeId: placement.gradeId,
            sectionId: placement.sectionId ?? null,
            status: 'pending',
            inscriptionId: null,
            escolaridad: 'regular'
          },
          { transaction }
        );
        created += 1;
        continue;
      }

      const isMale = Math.random() > 0.5;
      const firstName = isMale ? randomItem(MALE_NAMES) : randomItem(FEMALE_NAMES);
      const lastName = `${randomItem(LAST_NAMES)} ${randomItem(LAST_NAMES)}`;
      const gender: 'M' | 'F' = isMale ? 'M' : 'F';
      const birthYear = 2009 + (attempts % 6);
      const birthdate = new Date(birthYear, attempts % 12, (attempts % 28) + 1);
      const locationPreset = LOCATION_PRESETS[attempts % LOCATION_PRESETS.length];
      const residence = locationPreset.residence;
      const placement = getPlacement();

      const person = await Person.create(
        {
          firstName,
          lastName,
          documentType: 'Venezolano',
          document,
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
          email: `${slugify(firstName)}.${slugify(lastName.split(' ')[0])}${randomDigits(3)}@preinscritos.demo`,
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

      const representativeSelector = Math.random();
      const motherIsRepresentative = representativeSelector < 0.45;
      const fatherIsRepresentative = !motherIsRepresentative && representativeSelector < 0.75;
      const hasExternalRepresentative = !motherIsRepresentative && !fatherIsRepresentative;

      const guardianAssignments: GuardianAssignment[] = [
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
        guardianAssignments.push({
          payload: buildGuardianPayload(
            randomItem([...MALE_NAMES, ...FEMALE_NAMES]),
            randomItem(LAST_NAMES),
            buildDocumentNumber(baseDocumentNumber, 3),
            residence
          ),
          relationship: 'representative',
          isRepresentative: true
        });
      }

      await assignGuardians(person.id, guardianAssignments, transaction);

      await Matriculation.create(
        {
          personId: person.id,
          schoolPeriodId: activePeriod.id,
          gradeId: placement.gradeId,
          sectionId: placement.sectionId ?? null,
          status: 'pending',
          inscriptionId: null,
          escolaridad: 'regular'
        },
        { transaction }
      );

      created += 1;
    }

    await transaction.commit();
    console.log(`✅ Se generaron ${created} estudiantes sin inscripción activa.`);
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Error generando estudiantes sin matricular:', error);
    throw error;
  }
};

if (require.main === module) {
  const count = parseArgs();
  sequelize.authenticate()
    .then(() => createUnregisteredStudents(count))
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

export default createUnregisteredStudents;
