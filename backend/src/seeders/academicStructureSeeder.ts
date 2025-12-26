import sequelize from '@/config/database';
import {
  SchoolPeriod,
  Grade,
  Section,
  PeriodGrade,
  PeriodGradeSection,
  PeriodGradeSubject,
  Subject
} from '@/models/index';
import { Transaction } from 'sequelize';

const SECTION_SUFFIXES = ['A', 'B'];

const GRADE_SUBJECTS: Record<number, string[]> = {
  1: [
    'Arte y Patrimonio',
    'Castellano',
    'Ciencias Naturales',
    'Educación Física',
    'Geografía, Historia y Ciudadanía',
    'Inglés y otras Lenguas Extranjeras',
    'Matemáticas',
    'Orientación y Convivencia',
    'Artes Gráficas',
    'Redacción y Ortografía'
  ],
  2: [
    'Arte y Patrimonio',
    'Castellano',
    'Ciencias Naturales',
    'Educación Física',
    'Geografía, Historia y Ciudadanía',
    'Inglés y otras Lenguas Extranjeras',
    'Matemáticas',
    'Orientación y Convivencia',
    'Artes Gráficas',
    'Redacción y Ortografía'
  ],
  3: [
    'Castellano',
    'Biología',
    'Física',
    'Química',
    'Educación Física',
    'Geografía, Historia y Ciudadanía',
    'Inglés y otras Lenguas Extranjeras',
    'Matemáticas',
    'Orientación y Convivencia',
    'Artes Gráficas',
    'Ecología'
  ],
  4: [
    'Castellano',
    'Biología',
    'Física',
    'Química',
    'Educación Física',
    'Formación para la Soberanía Nacional',
    'Geografía, Historia y Ciudadanía',
    'Inglés y otras Lenguas Extranjeras',
    'Matemáticas',
    'Orientación y Convivencia',
    'Artes Gráficas',
    'Agrupación de Desfile'
  ],
  5: [
    'Castellano',
    'Biología',
    'Física',
    'Química',
    'Ciencias de la Tierra',
    'Educación Física',
    'Formación para la Soberanía Nacional',
    'Geografía, Historia y Ciudadanía',
    'Inglés y otras Lenguas Extranjeras',
    'Matemáticas',
    'Orientación y Convivencia',
    'Artes Gráficas',
    'Agrupación de Desfile'
  ]
};

const ensureSectionsForGrade = async (grade: Grade, transaction: Transaction) => {
  const sectionRecords: Section[] = [];
  for (const suffix of SECTION_SUFFIXES) {
    const name = `Sección ${suffix}`;
    const [section] = await Section.findOrCreate({
      where: { name },
      defaults: { name },
      transaction
    });
    sectionRecords.push(section);
  }
  return sectionRecords;
};

const ensurePeriodGrade = async (
  schoolPeriodId: number,
  gradeId: number,
  transaction: Transaction
) => {
  const [periodGrade] = await PeriodGrade.findOrCreate({
    where: { schoolPeriodId, gradeId },
    defaults: { schoolPeriodId, gradeId },
    transaction
  });
  return periodGrade;
};

const assignSectionsToPeriodGrade = async (
  periodGradeId: number,
  sections: Section[],
  transaction: Transaction
) => {
  for (const section of sections) {
    await PeriodGradeSection.findOrCreate({
      where: { periodGradeId, sectionId: section.id },
      defaults: { periodGradeId, sectionId: section.id },
      transaction
    });
  }
};

const assignSubjectsToPeriodGrade = async (
  periodGradeId: number,
  subjects: Subject[],
  transaction: Transaction
) => {
  let order = 1;
  for (const subject of subjects) {
    await PeriodGradeSubject.findOrCreate({
      where: { periodGradeId, subjectId: subject.id },
      defaults: { periodGradeId, subjectId: subject.id, order },
      transaction
    });
    order += 1;
  }
};

const ensurePensumSubjects = async (transaction: Transaction) => {
  const uniqueNames = new Set<string>(Object.values(GRADE_SUBJECTS).flat());
  const subjectsMap = new Map<string, Subject>();

  for (const name of uniqueNames) {
    const [subject] = await Subject.findOrCreate({
      where: { name },
      defaults: { name },
      transaction
    });
    subjectsMap.set(name, subject);
  }

  return subjectsMap;
};

const seedAcademicStructure = async () => {
  const transaction = await sequelize.transaction();
  try {
    const activePeriod = await SchoolPeriod.findOne({ where: { isActive: true }, transaction });
    if (!activePeriod) {
      throw new Error('No existe un período escolar activo. Ejecute el seeder principal primero.');
    }

    const grades = await Grade.findAll({ order: [['order', 'ASC']], transaction });
    if (!grades.length) {
      throw new Error('No se encontraron grados. Ejecute el seeder principal primero.');
    }

    const subjectMap = await ensurePensumSubjects(transaction);

    let structuresCreated = 0;
    for (const grade of grades) {
      const gradeOrder = grade.order ?? grade.id;
      const subjectNames = GRADE_SUBJECTS[gradeOrder] ?? [];

      const periodGrade = await ensurePeriodGrade(activePeriod.id, grade.id, transaction);
      const sections = await ensureSectionsForGrade(grade, transaction);
      await assignSectionsToPeriodGrade(periodGrade.id, sections, transaction);

      if (subjectNames.length > 0) {
        const subjects = subjectNames.map(name => {
          const subject = subjectMap.get(name);
          if (!subject) {
            throw new Error(`La materia "${name}" no existe y no pudo ser creada.`);
          }
          return subject;
        });
        await assignSubjectsToPeriodGrade(periodGrade.id, subjects, transaction);
      } else {
        console.warn(`⚠️ No hay pensum definido para ${grade.name}. Solo se asignaron secciones.`);
      }

      structuresCreated += 1;
    }

    await transaction.commit();
    console.log(`✅ Estructura académica configurada para ${structuresCreated} grados.`);
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Error configurando estructura académica:', error);
    throw error;
  }
};

if (require.main === module) {
  sequelize.authenticate()
    .then(() => seedAcademicStructure())
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

export default seedAcademicStructure;
