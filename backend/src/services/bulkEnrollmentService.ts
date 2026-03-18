import ExcelJS from 'exceljs';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import fs from 'fs/promises';
import path from 'path';
import { BULK_ENROLLMENT_COLUMNS } from '@/constants/bulkEnrollmentColumns';
import { SchoolPeriod, Grade, Section } from '@/models/index';
import { registerAndEnrollStudent, RegisterAndEnrollPayload, GuardianInput } from '@/services/studentEnrollmentService';
import { GuardianDocumentType } from '@/models/GuardianProfile';

const allowedDocumentTypes: GuardianDocumentType[] = ['Venezolano', 'Extranjero', 'Pasaporte'];
const isGuardianDocumentType = (value: string): value is GuardianDocumentType =>
  allowedDocumentTypes.some((type) => type === value);
const escolaridadOptions = ['regular', 'repitiente', 'materia_pendiente'];

type CachedStructure = {
  periodsById: Map<number, SchoolPeriod>;
  periodsByName: Map<string, SchoolPeriod>;
  gradesById: Map<number, Grade>;
  gradesByName: Map<string, Grade>;
  sectionsById: Map<number, Section>;
  sectionsByName: Map<string, Section>;
};

const ensureTmpDir = async () => {
  const dir = path.join(process.cwd(), 'tmp');
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (error) {
    // directory already exists
  }
  return dir;
};

const buildStructures = async (): Promise<CachedStructure> => {
  const [periods, grades, sections] = await Promise.all([
    SchoolPeriod.findAll(),
    Grade.findAll(),
    Section.findAll()
  ]);

  const periodsById = new Map(periods.map((p) => [p.id, p]));
  const periodsByName = new Map(periods.map((p) => [p.period.toLowerCase(), p]));

  const gradesById = new Map(grades.map((g) => [g.id, g]));
  const gradesByName = new Map(grades.map((g) => [g.name.toLowerCase(), g]));

  const sectionsById = new Map(sections.map((s) => [s.id, s]));
  const sectionsByName = new Map(sections.map((s) => [s.name.toLowerCase(), s]));

  return {
    periodsById,
    periodsByName,
    gradesById,
    gradesByName,
    sectionsById,
    sectionsByName
  };
};

const headerToKey = new Map(
  BULK_ENROLLMENT_COLUMNS.map((column) => [column.header.trim().toLowerCase(), column.key])
);

const sanitizeString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const parseDateValue = (value: unknown) => {
  if (!value) return null;
  if (value instanceof Date) {
    return dayjs(value);
  }
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return dayjs(new Date(parsed.y, parsed.m - 1, parsed.d));
    }
  }
  const candidate = dayjs(String(value).trim(), ['YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY'], true);
  if (candidate.isValid()) {
    return candidate;
  }
  return null;
};

const parseGuardian = (prefix: 'mother' | 'father' | 'representative', row: Record<string, any>): GuardianInput | null => {
  const document = sanitizeString(row[`${prefix}.document`]);
  const firstName = sanitizeString(row[`${prefix}.firstName`]);
  const lastName = sanitizeString(row[`${prefix}.lastName`]);
  const hasData = [document, firstName, lastName].some((value) => value.length > 0);
  if (!hasData) {
    return null;
  }

  const documentTypeRaw = sanitizeString(row[`${prefix}.documentType`]);
  const resolvedDocumentType = isGuardianDocumentType(documentTypeRaw) ? documentTypeRaw : 'Venezolano';

  return {
    documentType: resolvedDocumentType,
    document,
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    phone: sanitizeString(row[`${prefix}.phone`]) || undefined,
    email: sanitizeString(row[`${prefix}.email`]) || undefined,
    occupation: sanitizeString(row[`${prefix}.occupation`]) || undefined,
    address: sanitizeString(row[`${prefix}.address`]) || undefined,
    residenceState: sanitizeString(row[`${prefix}.residenceState`]) || undefined,
    residenceMunicipality: sanitizeString(row[`${prefix}.residenceMunicipality`]) || undefined,
    residenceParish: sanitizeString(row[`${prefix}.residenceParish`]) || undefined
  } satisfies GuardianInput;
};

export type ParsedBulkRow = {
  rowNumber: number;
  raw: Record<string, any>;
  errors: string[];
  payload?: RegisterAndEnrollPayload;
};

export type ProcessBulkRowInput = {
  rowNumber: number;
  payload: RegisterAndEnrollPayload;
};

const normalizeRow = (excelRow: Record<string, any>): Record<string, any> => {
  const normalized: Record<string, any> = {};
  for (const [header, value] of Object.entries(excelRow)) {
    const key = headerToKey.get(header.trim().toLowerCase());
    if (key) {
      normalized[key] = value;
    }
  }
  return normalized;
};

export const parseBulkExcel = async (filePath: string): Promise<ParsedBulkRow[]> => {
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const sheetRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
  const structures = await buildStructures();
  const results: ParsedBulkRow[] = [];

  sheetRows.forEach((excelRow, index) => {
    const firstCell = String(excelRow[BULK_ENROLLMENT_COLUMNS[0].header] || '').trim();
    if (!firstCell || firstCell === '(Obligatorio)') {
      return;
    }

    const normalized = normalizeRow(excelRow);
    const errors: string[] = [];

    const period = resolvePeriod(normalized, structures, errors);
    const grade = resolveGrade(normalized, structures, errors);
    const section = resolveSection(normalized, structures, errors);

    const firstName = sanitizeString(normalized.firstName);
    const lastName = sanitizeString(normalized.lastName);
    const gender = sanitizeString(normalized.gender).toUpperCase();
    if (!firstName) errors.push('Los nombres del estudiante son obligatorios.');
    if (!lastName) errors.push('Los apellidos del estudiante son obligatorios.');
    if (!['M', 'F'].includes(gender)) errors.push('El género debe ser M o F.');

    const birthdate = parseDateValue(normalized.birthdate);
    if (!birthdate) errors.push('Fecha de nacimiento inválida.');

    const documentTypeRaw = sanitizeString(normalized.documentType) || 'Venezolano';
    const documentType = isGuardianDocumentType(documentTypeRaw) ? documentTypeRaw : 'Venezolano';
    const document = sanitizeString(normalized.document) || undefined;

    const escolaridadRaw = sanitizeString(normalized.escolaridad).toLowerCase();
    const escolaridad = escolaridadOptions.includes(escolaridadRaw)
      ? (escolaridadRaw as RegisterAndEnrollPayload['escolaridad'])
      : 'regular';

    const representativeTypeRaw = sanitizeString(normalized.representativeType).toLowerCase();
    const representativeType = ['mother', 'father', 'other'].includes(representativeTypeRaw)
      ? representativeTypeRaw as RegisterAndEnrollPayload['representativeType']
      : 'mother';

    const mother = parseGuardian('mother', normalized);
    const father = parseGuardian('father', normalized);
    const representative = parseGuardian('representative', normalized);

    const previousSchoolsRaw = sanitizeString(normalized.previousSchoolIds);
    const previousSchoolIds = previousSchoolsRaw
      ? previousSchoolsRaw.split(';').map((entry) => entry.trim()).filter(Boolean)
      : undefined;

    const payload: RegisterAndEnrollPayload = {
      firstName,
      lastName,
      documentType,
      document,
      gender: gender as 'M' | 'F',
      birthdate: birthdate ? birthdate.format('YYYY-MM-DD') : '',
      pathology: sanitizeString(normalized.pathology) || null,
      livingWith: sanitizeString(normalized.livingWith) || null,
      birthState: sanitizeString(normalized.birthState),
      birthMunicipality: sanitizeString(normalized.birthMunicipality),
      birthParish: sanitizeString(normalized.birthParish),
      residenceState: sanitizeString(normalized.residenceState),
      residenceMunicipality: sanitizeString(normalized.residenceMunicipality),
      residenceParish: sanitizeString(normalized.residenceParish),
      phone1: sanitizeString(normalized.phone1) || null,
      phone2: sanitizeString(normalized.phone2) || null,
      email: sanitizeString(normalized.email) || null,
      address: sanitizeString(normalized.address) || null,
      whatsapp: sanitizeString(normalized.whatsapp) || null,
      previousSchoolIds,
      mother,
      father,
      representative,
      representativeType,
      schoolPeriodId: period?.id || 0,
      gradeId: grade?.id || 0,
      sectionId: section?.id || null,
      enrollmentAnswers: [],
      escolaridad,
      documents: undefined,
      nationality: sanitizeString(normalized.nationality) === 'E' ? 'Extranjero' : 'Venezolano'
    };

    ['birthState', 'birthMunicipality', 'birthParish', 'residenceState', 'residenceMunicipality', 'residenceParish'].forEach((field) => {
      if (!sanitizeString(normalized[field])) {
        errors.push(`El campo ${field} es obligatorio.`);
      }
    });

    if (!period) errors.push('No se encontró el período escolar especificado.');
    if (!grade) errors.push('No se encontró el grado especificado.');
    if (!birthdate) errors.push('La fecha de nacimiento es obligatoria.');

    if (period) payload.schoolPeriodId = period.id;
    if (grade) payload.gradeId = grade.id;
    if (section) payload.sectionId = section.id;

    results.push({
      rowNumber: index + 2,
      raw: normalized,
      payload: errors.length ? undefined : payload,
      errors
    });
  });

  await fs.unlink(filePath).catch(() => undefined);
  return results;
};

export type PreviewBulkResult = {
  rows: ParsedBulkRow[];
  total: number;
  valid: number;
  invalid: number;
};

export const previewBulkEnrollment = async (filePath: string): Promise<PreviewBulkResult> => {
  const rows = await parseBulkExcel(filePath);
  const valid = rows.filter((row) => !row.errors.length && row.payload).length;
  const invalid = rows.filter((row) => row.errors.length).length;
  return {
    rows,
    total: rows.length,
    valid,
    invalid
  };
};

const resolvePeriod = (
  normalized: Record<string, any>,
  structures: CachedStructure,
  errors: string[]
): SchoolPeriod | undefined => {
  const idValue = normalized.schoolPeriodId;
  if (idValue) {
    const period = structures.periodsById.get(Number(idValue));
    if (period) return period;
    errors.push(`No existe el periodo con ID ${idValue}.`);
  }
  const name = sanitizeString(normalized.schoolPeriod).toLowerCase();
  if (name) {
    const period = structures.periodsByName.get(name);
    if (period) return period;
    errors.push(`No existe el periodo "${normalized.schoolPeriod}".`);
  }
  return undefined;
};

const resolveGrade = (
  normalized: Record<string, any>,
  structures: CachedStructure,
  errors: string[]
): Grade | undefined => {
  const idValue = normalized.gradeId;
  if (idValue) {
    const grade = structures.gradesById.get(Number(idValue));
    if (grade) return grade;
    errors.push(`No existe el grado con ID ${idValue}.`);
  }
  const name = sanitizeString(normalized.grade).toLowerCase();
  if (name) {
    const grade = structures.gradesByName.get(name);
    if (grade) return grade;
    errors.push(`No existe el grado "${normalized.grade}".`);
  }
  return undefined;
};

const resolveSection = (
  normalized: Record<string, any>,
  structures: CachedStructure,
  errors: string[]
): Section | undefined => {
  const idValue = normalized.sectionId;
  if (idValue) {
    const section = structures.sectionsById.get(Number(idValue));
    if (section) return section;
    errors.push(`No existe la sección con ID ${idValue}.`);
  }
  const name = sanitizeString(normalized.section).toLowerCase();
  if (name) {
    const section = structures.sectionsByName.get(name);
    if (section) return section;
    errors.push(`No existe la sección "${normalized.section}".`);
  }
  return undefined;
};

export type ProcessBulkResult = {
  rowNumber: number;
  success: boolean;
  message: string;
  personId?: number;
  matriculationId?: number;
};

export const processBulkEnrollment = async (rows: ProcessBulkRowInput[]): Promise<ProcessBulkResult[]> => {
  const results: ProcessBulkResult[] = [];
  for (const row of rows) {
    try {
      const { person, matriculation } = await registerAndEnrollStudent(row.payload);
      results.push({
        rowNumber: row.rowNumber,
        success: true,
        message: 'Inscripción registrada',
        personId: person.id,
        matriculationId: matriculation.id
      });
    } catch (error: any) {
      results.push({
        rowNumber: row.rowNumber,
        success: false,
        message: error?.message || 'Error procesando la fila'
      });
    }
  }
  return results;
};

export type BulkTemplateOptions = {
  schoolPeriodId?: number;
  gradeId?: number;
};

export const generateTemplate = async (options: BulkTemplateOptions = {}) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Inscripciones');

  const headerRow = worksheet.addRow(BULK_ENROLLMENT_COLUMNS.map((col) => col.header));
  headerRow.font = { bold: true };

  worksheet.addRow(BULK_ENROLLMENT_COLUMNS.map((col) => (col.required ? '(Obligatorio)' : '')));

  worksheet.columns = BULK_ENROLLMENT_COLUMNS.map((col) => ({ width: Math.min(Math.max(col.header.length + 5, 18), 40) }));

  const timestamp = dayjs().format('YYYYMMDD_HHmm');
  const fileName = `plantilla_inscripciones_${timestamp}.xlsx`;
  const dir = await ensureTmpDir();
  const tempPath = path.join(dir, fileName);

  await workbook.xlsx.writeFile(tempPath);
  const buffer = await fs.readFile(tempPath);
  await fs.unlink(tempPath);

  return { buffer, fileName };
};
