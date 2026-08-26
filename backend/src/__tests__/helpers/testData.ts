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

// Monotonic counters to generate unique default values across calls
// within the same test (several columns have UNIQUE constraints).
let testUserCounter = 0;
let testStructureCounter = 0;

export async function createTestUser(overrides: Partial<any> = {}) {
  testUserCounter += 1;
  const suffix = testUserCounter.toString().padStart(6, '0');

  // Do NOT pre-hash the password: the User model has a beforeCreate hook
  // that hashes it. Pre-hashing here would cause a double hash and make
  // every login fail whenever `overrides` omits `password`.
  const user = await User.create({
    username: overrides.username || `testuser${suffix}`,
    password: overrides.password || 'password123',
    ...overrides,
  });

  const person = await Person.create({
    userId: user.id,
    firstName: overrides.firstName || 'Test',
    lastName: overrides.lastName || 'User',
    document: overrides.document || `${suffix}`,
    documentType: overrides.documentType || 'Venezolano',
    birthdate: overrides.birthdate || new Date('2000-01-01'),
    gender: overrides.gender || 'M'
  });

  return { user, person };
}

export async function createTestRole(name: 'Master' | 'Administrador' | 'Control de Estudios' | 'Profesor' | 'Representante' | 'Alumno') {
  // Use findOrCreate to avoid unique constraint violations when the same role
  // is requested multiple times across different tests in the same suite.
  const [role] = await Role.findOrCreate({ where: { name } });
  return role;
}

export async function createTestPeriod(overrides: Partial<any> = {}) {
  testStructureCounter += 1;
  // Accepts either `status` or the legacy `isActive` flag
  let status = overrides.status;
  if (!status) {
    const active = overrides.isActive !== undefined ? overrides.isActive : true;
    status = active ? 'activo' : 'historico';
  }

  const idx = testStructureCounter;
  return await SchoolPeriod.create({
    period: overrides.period || `2025-2026-${idx}`,
    name: overrides.name || `Año Escolar 2025-2026 #${idx}`,
    startYear: overrides.startYear || 2025,
    endYear: overrides.endYear || 2026,
    status
  });
}

export async function createTestGrade(overrides: Partial<any> = {}) {
  testStructureCounter += 1;
  const idx = testStructureCounter;
  return await Grade.create({
    name: overrides.name || `Primer año #${idx}`,
    isDiversified: overrides.isDiversified || false
  });
}

export async function createTestSection(overrides: Partial<any> = {}) {
  testStructureCounter += 1;
  const idx = testStructureCounter;
  return await Section.create({
    name: overrides.name || `Sección ${String.fromCharCode(65 + (idx % 26))}${Math.floor(idx / 26)}`
  });
}

export async function createTestSubject(overrides: Partial<any> = {}) {
  testStructureCounter += 1;
  const idx = testStructureCounter;
  return await Subject.create({
    name: overrides.name || `Matemática #${idx}`
  });
}

export async function createTestTerm(periodId: number, overrides: Partial<any> = {}) {
  return await Term.create({
    schoolPeriodId: periodId,
    name: overrides.name || 'Primer Lapso',
    order: overrides.order || 1,
    isBlocked: overrides.isBlocked || false,
    isActive: overrides.isActive ?? false
  });
}

export async function createAcademicStructure(overrides: { periodId?: number; period?: Partial<any> } = {}) {
  let period;
  if (overrides.periodId) {
    // Reuse an existing period instead of creating a duplicate
    const { SchoolPeriod } = await import('@/models/index');
    period = await SchoolPeriod.findByPk(overrides.periodId);
    if (!period) throw new Error(`Period ${overrides.periodId} not found`);
  } else {
    period = await createTestPeriod(overrides.period || {});
  }
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
