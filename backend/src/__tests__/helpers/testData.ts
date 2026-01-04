import {
  User,
  Person,
  Role,
  SchoolPeriod,
  Grade,
  Section,
  Subject,
  PeriodGrade,
  PeriodGradeSection,
  PeriodGradeSubject,
  Inscription,
  InscriptionSubject,
  Setting,
  Term
} from '@/models/index';
import bcrypt from 'bcrypt';

export async function createTestUser(overrides: Partial<any> = {}) {
  const hashedPassword = await bcrypt.hash('password123', 10);
  
  const user = await User.create({
    username: overrides.username || 'testuser',
    password: hashedPassword,
    ...overrides
  });

  const person = await Person.create({
    userId: user.id,
    firstName: overrides.firstName || 'Test',
    lastName: overrides.lastName || 'User',
    document: overrides.document || '12345678',
    documentType: overrides.documentType || 'Venezolano',
    birthdate: overrides.birthdate || new Date('2000-01-01'),
    gender: overrides.gender || 'M'
  });

  return { user, person };
}

export async function createTestRole(name: 'Master' | 'Administrador' | 'Control de Estudios' | 'Profesor' | 'Representante' | 'Alumno') {
  return await Role.create({ name });
}

export async function createTestPeriod(overrides: Partial<any> = {}) {
  return await SchoolPeriod.create({
    period: overrides.period || '2025-2026',
    name: overrides.name || 'Año Escolar 2025-2026',
    startYear: overrides.startYear || 2025,
    endYear: overrides.endYear || 2026,
    isActive: overrides.isActive !== undefined ? overrides.isActive : true
  });
}

export async function createTestGrade(overrides: Partial<any> = {}) {
  return await Grade.create({
    name: overrides.name || 'Primer año',
    isDiversified: overrides.isDiversified || false
  });
}

export async function createTestSection(overrides: Partial<any> = {}) {
  return await Section.create({
    name: overrides.name || 'Sección A'
  });
}

export async function createTestSubject(overrides: Partial<any> = {}) {
  return await Subject.create({
    name: overrides.name || 'Matemática'
  });
}

export async function createTestTerm(periodId: number, overrides: Partial<any> = {}) {
  return await Term.create({
    schoolPeriodId: periodId,
    name: overrides.name || 'Primer Lapso',
    order: overrides.order || 1,
    isBlocked: overrides.isBlocked || false
  });
}

export async function createAcademicStructure() {
  const period = await createTestPeriod();
  const grade = await createTestGrade();
  const section = await createTestSection();
  const subject = await createTestSubject();

  const periodGrade = await PeriodGrade.create({
    schoolPeriodId: period.id,
    gradeId: grade.id
  });

  const periodGradeSection = await PeriodGradeSection.create({
    periodGradeId: periodGrade.id,
    sectionId: section.id
  });

  const periodGradeSubject = await PeriodGradeSubject.create({
    periodGradeId: periodGrade.id,
    subjectId: subject.id
  });

  return {
    period,
    grade,
    section,
    subject,
    periodGrade,
    periodGradeSection,
    periodGradeSubject
  };
}

export async function createTestInscription(
  personId: number,
  periodId: number,
  gradeId: number,
  sectionId: number,
  overrides: Partial<any> = {}
) {
  return await Inscription.create({
    personId,
    schoolPeriodId: periodId,
    gradeId,
    sectionId,
    escolaridad: overrides.escolaridad || 'regular',
    isRepeater: overrides.isRepeater || false,
    ...overrides
  });
}

export async function createTestSetting(key: string, value: string) {
  return await Setting.create({ key, value });
}
