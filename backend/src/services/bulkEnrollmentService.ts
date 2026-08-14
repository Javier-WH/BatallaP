import ExcelJS from 'exceljs';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import fs from 'fs/promises';
import path from 'path';
import { ValidationError, UniqueConstraintError } from 'sequelize';
import { BULK_ENROLLMENT_COLUMNS } from '@/constants/bulkEnrollmentColumns';
import { SchoolPeriod, Grade, Section } from '@/models/index';
import { registerAndEnrollStudent, RegisterAndEnrollPayload, GuardianInput } from '@/services/studentEnrollmentService';
import { GuardianDocumentType } from '@/models/GuardianProfile';

const allowedDocumentTypes: GuardianDocumentType[] = ['Venezolano', 'Extranjero', 'Pasaporte'];
const isGuardianDocumentType = (value: string): value is GuardianDocumentType =>
  allowedDocumentTypes.some((type) => type === value);
const escolaridadOptions = ['regular', 'repitiente', 'materia_pendiente'];
const templateDataStartRow = 2;
const templateDataEndRow = 1000;
const templateFirstDataRow = 4;

const defaultStudentLocation = {
  state: 'Guárico',
  municipality: 'Monagas',
  parish: 'Altagracia de Orituco'
};

type VenezuelaMunicipality = {
  municipio: string;
  parroquias: string[];
};

type VenezuelaState = {
  estado: string;
  municipios: VenezuelaMunicipality[];
};

type LocationCatalogs = {
  states: string[];
  municipalities: string[];
  parishes: string[];
};

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

const headerToKey = new Map<string, string>();
BULK_ENROLLMENT_COLUMNS.forEach((column) => {
  const headerWithAsterisk = column.header.trim().toLowerCase();
  const headerWithoutAsterisk = headerWithAsterisk.replace(/^\*\s*/, '');
  headerToKey.set(headerWithAsterisk, column.key);
  headerToKey.set(headerWithoutAsterisk, column.key);
});

const sanitizeString = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number' || typeof value === 'bigint') {
    return String(value).trim();
  }

  return '';
};

const getColumnNumberByKey = (key: string): number => {
  const index = BULK_ENROLLMENT_COLUMNS.findIndex((column) => column.key === key);
  return index + 1;
};

const getColumnNumberByKeyInColumns = (key: string, columns: typeof BULK_ENROLLMENT_COLUMNS): number => {
  const index = columns.findIndex((column) => column.key === key);
  return index + 1;
};

const buildLocationCatalogs = async (): Promise<LocationCatalogs> => {
  const jsonPath = path.join(process.cwd(), 'src', 'assets', 'venezuela.json');

  try {
    const fileContent = await fs.readFile(jsonPath, 'utf-8');
    const data = JSON.parse(fileContent) as VenezuelaState[];

    const states = new Set<string>();
    const municipalities = new Set<string>();
    const parishes = new Set<string>();

    data.forEach((stateItem) => {
      const state = sanitizeString(stateItem.estado);
      if (state) states.add(state);

      (stateItem.municipios || []).forEach((municipalityItem) => {
        const municipality = sanitizeString(municipalityItem.municipio);
        if (municipality) municipalities.add(municipality);

        (municipalityItem.parroquias || []).forEach((parishItem) => {
          const parish = sanitizeString(parishItem);
          if (parish) parishes.add(parish);
        });
      });
    });

    const sorter = (a: string, b: string) => a.localeCompare(b, 'es');

    return {
      states: Array.from(states).sort(sorter),
      municipalities: Array.from(municipalities).sort(sorter),
      parishes: Array.from(parishes).sort(sorter)
    };
  } catch (error) {
    return {
      states: [defaultStudentLocation.state],
      municipalities: [defaultStudentLocation.municipality],
      parishes: [defaultStudentLocation.parish]
    };
  }
};

const createCatalogSheet = async (workbook: ExcelJS.Workbook) => {
  const catalogSheet = workbook.addWorksheet('Catalogos');
  catalogSheet.state = 'veryHidden';

  const structures = await buildStructures();
  const locationCatalogs = await buildLocationCatalogs();
  const catalogs: Array<{ name: string; values: string[] }> = [
    {
      name: 'Periodos',
      values: Array.from(structures.periodsById.values()).map((period) => period.period).filter(Boolean)
    },
    {
      name: 'Grados',
      values: Array.from(structures.gradesById.values()).map((grade) => grade.name).filter(Boolean)
    },
    {
      name: 'Secciones',
      values: Array.from(structures.sectionsById.values()).map((section) => section.name).filter(Boolean)
    },
    { name: 'Escolaridad', values: escolaridadOptions },
    { name: 'Documentos', values: allowedDocumentTypes },
    { name: 'Genero', values: ['M', 'F'] },
    { name: 'Nacionalidad', values: ['V', 'E'] },
    { name: 'Representa', values: ['mother', 'father', 'other'] },
    { name: 'EstadosVenezuela', values: locationCatalogs.states },
    { name: 'MunicipiosVenezuela', values: locationCatalogs.municipalities },
    { name: 'ParroquiasVenezuela', values: locationCatalogs.parishes }
  ];

  const namedRanges = new Map<string, string>();

  catalogs.forEach((catalog, index) => {
    const column = index + 1;
    const columnLetter = catalogSheet.getColumn(column).letter;
    const values = catalog.values.filter((value) => value.trim().length > 0);

    catalogSheet.getCell(1, column).value = catalog.name;
    values.forEach((value, valueIndex) => {
      catalogSheet.getCell(valueIndex + 2, column).value = value;
    });

    const endRow = values.length > 0 ? values.length + 1 : 2;
    const absoluteRange = `'Catalogos'!$${columnLetter}$2:$${columnLetter}$${endRow}`;
    workbook.definedNames.add(absoluteRange, catalog.name);
    namedRanges.set(catalog.name, `=${catalog.name}`);
  });

  return namedRanges;
};

const applyDropdownValidation = (
  worksheet: ExcelJS.Worksheet,
  columnNumber: number,
  formulaReference: string,
  errorMessage: string
) => {
  if (!columnNumber || !formulaReference) {
    return;
  }

  for (let row = templateDataStartRow; row <= templateDataEndRow; row += 1) {
    worksheet.getCell(row, columnNumber).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [formulaReference],
      showInputMessage: true,
      promptTitle: 'Seleccione un valor',
      prompt: 'Use la lista desplegable para evitar errores de formato.',
      showErrorMessage: true,
      errorTitle: 'Valor inválido',
      error: errorMessage
    };
  }
};

const applyConditionalDefaultFormulaToColumn = (
  worksheet: ExcelJS.Worksheet,
  targetColumnNumber: number,
  triggerColumnNumber: number,
  defaultValue: string
) => {
  if (!targetColumnNumber || !triggerColumnNumber || !defaultValue) {
    return;
  }

  const triggerColumnLetter = worksheet.getColumn(triggerColumnNumber).letter;
  if (!triggerColumnLetter) {
    return;
  }

  const escapedDefaultValue = defaultValue.replace(/"/g, '""');

  for (let row = templateFirstDataRow; row <= templateDataEndRow; row += 1) {
    worksheet.getCell(row, targetColumnNumber).value = {
      formula: `IF($${triggerColumnLetter}${row}<>"","${escapedDefaultValue}","")`
    };
  }
};

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
    // Limpiar el header: quitar asterisco al inicio si existe, trim y lowercase
    const cleanHeader = header.trim().toLowerCase().replace(/^\*\s*/, '');
    const key = headerToKey.get(cleanHeader) || headerToKey.get(header.trim().toLowerCase());
    
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
  // Leer desde la fila 3 (índice 2) donde están los headers reales, después del título y fila vacía
  const sheetRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '', range: 2 });
  const structures = await buildStructures();
  const results: ParsedBulkRow[] = [];

  sheetRows.forEach((excelRow, index) => {
    // La primera columna ahora es '* Nombres estudiante'
    const firstColHeader = BULK_ENROLLMENT_COLUMNS[0].header;
    const firstCell = String(excelRow[firstColHeader] || excelRow[firstColHeader.replace(/^\*\s*/, '')] || '').trim();
    if (!firstCell) {
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

    // The Excel template only has "Representante" columns. Route the data to
    // the correct guardian slot based on representativeType so the downstream
    // studentEnrollmentService validates the right guardian.
    const representative = parseGuardian('representative', normalized);
    let mother: GuardianInput | null = null;
    let father: GuardianInput | null = null;
    let representativeData: GuardianInput | null = null;

    if (representativeType === 'mother') {
      mother = representative;
    } else if (representativeType === 'father') {
      father = representative;
    } else {
      representativeData = representative;
    }

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
      representative: representativeData,
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
  reportUuid?: string;
};

export const processBulkEnrollment = async (rows: ProcessBulkRowInput[]): Promise<ProcessBulkResult[]> => {
  const results: ProcessBulkResult[] = [];
  for (const row of rows) {
    try {
      const { person, matriculation, reportUuid } = await registerAndEnrollStudent(row.payload, {
        relaxGuardianContactFields: true
      });
      results.push({
        rowNumber: row.rowNumber,
        success: true,
        message: 'Inscripción registrada',
        personId: person.id,
        matriculationId: matriculation.id,
        reportUuid
      });
    } catch (error: unknown) {
      let message = 'Error procesando la fila';

      if (error instanceof UniqueConstraintError) {
        const fields = error.errors.map((e) => `${e.path ?? 'campo desconocido'}: ${e.message}`).join('; ');
        message = `Registro duplicado — ${fields}`;
      } else if (error instanceof ValidationError) {
        const details = error.errors.map((e) => {
          const field = e.path ?? 'campo desconocido';
          return `[${field}] ${e.message}`;
        }).join('; ');
        message = `Error de validación — ${details}`;
      } else if (error instanceof Error) {
        message = error.message;
      }

      results.push({
        rowNumber: row.rowNumber,
        success: false,
        message
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

  // 1. Título de identificación
  const titleRow = worksheet.addRow(['PLANTILLA PARA INSCRIPCIÓN MASIVA DE ESTUDIANTES']);
  titleRow.font = { bold: true, size: 14 };
  titleRow.alignment = { horizontal: 'center' };
  worksheet.mergeCells(1, 1, 1, 10);

  worksheet.addRow([]); // Fila vacía de separación

  // 3. Filtrar columnas: excluir solo las columnas de ID opcionales
  const hiddenKeys = new Set(['schoolPeriodId', 'gradeId', 'sectionId']);
  const visibleColumns = BULK_ENROLLMENT_COLUMNS.filter((col) => !hiddenKeys.has(col.key));

  const headerRow = worksheet.addRow(visibleColumns.map((col) => col.header));
  headerRow.font = { bold: true };

  worksheet.columns = visibleColumns.map((col) => ({ width: Math.min(Math.max(col.header.length + 5, 18), 40) }));

  const catalogRanges = await createCatalogSheet(workbook);
  const validationConfig: Array<{ key: string; catalog: string; message: string }> = [
    { key: 'schoolPeriod', catalog: 'Periodos', message: 'Seleccione un período válido de la lista.' },
    { key: 'grade', catalog: 'Grados', message: 'Seleccione un grado válido de la lista.' },
    { key: 'section', catalog: 'Secciones', message: 'Seleccione una sección válida de la lista.' },
    { key: 'escolaridad', catalog: 'Escolaridad', message: 'Seleccione una escolaridad válida.' },
    { key: 'documentType', catalog: 'Documentos', message: 'Seleccione un tipo de documento válido.' },
    { key: 'gender', catalog: 'Genero', message: 'Seleccione M o F.' },
    { key: 'nationality', catalog: 'Nacionalidad', message: 'Seleccione V o E.' },
    { key: 'representativeType', catalog: 'Representa', message: 'Seleccione quién representa al estudiante.' },
    { key: 'birthState', catalog: 'EstadosVenezuela', message: 'Seleccione un estado válido de la lista.' },
    { key: 'birthMunicipality', catalog: 'MunicipiosVenezuela', message: 'Seleccione un municipio válido de la lista.' },
    { key: 'birthParish', catalog: 'ParroquiasVenezuela', message: 'Seleccione una parroquia válida de la lista.' },
    { key: 'residenceState', catalog: 'EstadosVenezuela', message: 'Seleccione un estado válido de la lista.' },
    { key: 'residenceMunicipality', catalog: 'MunicipiosVenezuela', message: 'Seleccione un municipio válido de la lista.' },
    { key: 'residenceParish', catalog: 'ParroquiasVenezuela', message: 'Seleccione una parroquia válida de la lista.' },
    { key: 'representative.residenceState', catalog: 'EstadosVenezuela', message: 'Seleccione un estado válido de la lista.' },
    { key: 'representative.residenceMunicipality', catalog: 'MunicipiosVenezuela', message: 'Seleccione un municipio válido de la lista.' },
    { key: 'representative.residenceParish', catalog: 'ParroquiasVenezuela', message: 'Seleccione una parroquia válida de la lista.' },
    { key: 'representative.documentType', catalog: 'Documentos', message: 'Seleccione un tipo de documento válido.' }
  ];

  validationConfig.forEach((validation) => {
    const columnNumber = getColumnNumberByKeyInColumns(validation.key, visibleColumns);
    const formulaReference = catalogRanges.get(validation.catalog) || '';
    if (columnNumber > 0) {
      applyDropdownValidation(worksheet, columnNumber, formulaReference, validation.message);
    }
  });

  // Valores por defecto condicionados: solo cuando haya nombre de estudiante
  const firstNameColumnNumber = getColumnNumberByKeyInColumns('firstName', visibleColumns);
  applyConditionalDefaultFormulaToColumn(
    worksheet,
    getColumnNumberByKeyInColumns('birthState', visibleColumns),
    firstNameColumnNumber,
    defaultStudentLocation.state
  );
  applyConditionalDefaultFormulaToColumn(
    worksheet,
    getColumnNumberByKeyInColumns('birthMunicipality', visibleColumns),
    firstNameColumnNumber,
    defaultStudentLocation.municipality
  );
  applyConditionalDefaultFormulaToColumn(
    worksheet,
    getColumnNumberByKeyInColumns('birthParish', visibleColumns),
    firstNameColumnNumber,
    defaultStudentLocation.parish
  );
  applyConditionalDefaultFormulaToColumn(
    worksheet,
    getColumnNumberByKeyInColumns('residenceState', visibleColumns),
    firstNameColumnNumber,
    defaultStudentLocation.state
  );
  applyConditionalDefaultFormulaToColumn(
    worksheet,
    getColumnNumberByKeyInColumns('residenceMunicipality', visibleColumns),
    firstNameColumnNumber,
    defaultStudentLocation.municipality
  );
  applyConditionalDefaultFormulaToColumn(
    worksheet,
    getColumnNumberByKeyInColumns('residenceParish', visibleColumns),
    firstNameColumnNumber,
    defaultStudentLocation.parish
  );

  // Autoseleccionar período activo cuando haya nombre de estudiante
  const activePeriod = await SchoolPeriod.findOne({ where: { status: 'activo' } });
  if (activePeriod) {
    applyConditionalDefaultFormulaToColumn(
      worksheet,
      getColumnNumberByKeyInColumns('schoolPeriod', visibleColumns),
      firstNameColumnNumber,
      activePeriod.period
    );
  }

  // Valores por defecto condicionados para representante
  const representativeFirstNameColumnNumber = getColumnNumberByKeyInColumns('representative.firstName', visibleColumns);
  applyConditionalDefaultFormulaToColumn(
    worksheet,
    getColumnNumberByKeyInColumns('representative.residenceState', visibleColumns),
    representativeFirstNameColumnNumber,
    defaultStudentLocation.state
  );
  applyConditionalDefaultFormulaToColumn(
    worksheet,
    getColumnNumberByKeyInColumns('representative.residenceMunicipality', visibleColumns),
    representativeFirstNameColumnNumber,
    defaultStudentLocation.municipality
  );
  applyConditionalDefaultFormulaToColumn(
    worksheet,
    getColumnNumberByKeyInColumns('representative.residenceParish', visibleColumns),
    representativeFirstNameColumnNumber,
    defaultStudentLocation.parish
  );

  // 2. Configurar protección: desbloquear todas las celdas primero, luego bloquear solo headers
  for (let row = 1; row <= templateDataEndRow; row += 1) {
    for (let col = 1; col <= visibleColumns.length; col += 1) {
      const cell = worksheet.getCell(row, col);
      cell.protection = { locked: false };
    }
  }

  // Bloquear solo las filas de encabezado (fila 1: título, fila 2: vacía, fila 3: headers)
  for (let row = 1; row <= 3; row += 1) {
    for (let col = 1; col <= visibleColumns.length; col += 1) {
      const cell = worksheet.getCell(row, col);
      cell.protection = { locked: true };
    }
  }

  await worksheet.protect('inscripciones2025', {
    selectLockedCells: true,
    selectUnlockedCells: true,
    formatCells: false,
    formatColumns: false,
    formatRows: false,
    insertColumns: false,
    insertRows: false,
    insertHyperlinks: false,
    deleteColumns: false,
    deleteRows: false,
    sort: false,
    autoFilter: false,
    pivotTables: false
  });

  const timestamp = dayjs().format('YYYYMMDD_HHmm');
  const fileName = `plantilla_inscripciones_${timestamp}.xlsx`;
  const dir = await ensureTmpDir();
  const tempPath = path.join(dir, fileName);

  await workbook.xlsx.writeFile(tempPath);
  const buffer = await fs.readFile(tempPath);
  await fs.unlink(tempPath);

  return { buffer, fileName };
};
