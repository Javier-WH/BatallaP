"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateTemplate = exports.processBulkEnrollment = exports.previewBulkEnrollment = exports.parseBulkExcel = void 0;
const exceljs_1 = __importDefault(require("exceljs"));
const dayjs_1 = __importDefault(require("dayjs"));
const XLSX = __importStar(require("xlsx"));
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const sequelize_1 = require("sequelize");
const bulkEnrollmentColumns_1 = require("../constants/bulkEnrollmentColumns.js");
const index_1 = require("../models/index.js");
const studentEnrollmentService_1 = require("./studentEnrollmentService.js");
const allowedDocumentTypes = ['Venezolano', 'Extranjero', 'Pasaporte', 'Cedula Escolar'];
const isDocumentType = (value) => allowedDocumentTypes.some((type) => type === value);
// Guardian documents exclude 'Cédula Escolar'.
const guardianDocumentTypes = ['Venezolano', 'Extranjero', 'Pasaporte'];
const isGuardianDocumentType = (value) => guardianDocumentTypes.some((type) => type === value);
const escolaridadOptions = ['regular', 'repitiente', 'materia_pendiente'];
const templateDataStartRow = 2;
const templateDataEndRow = 1000;
const templateFirstDataRow = 4;
const defaultStudentLocation = {
    state: 'Guárico',
    municipality: 'Monagas',
    parish: 'Altagracia de Orituco'
};
const ensureTmpDir = () => __awaiter(void 0, void 0, void 0, function* () {
    const dir = path_1.default.join(process.cwd(), 'tmp');
    try {
        yield promises_1.default.mkdir(dir, { recursive: true });
    }
    catch (error) {
        // directory already exists
    }
    return dir;
});
const buildStructures = () => __awaiter(void 0, void 0, void 0, function* () {
    const [periods, grades, sections] = yield Promise.all([
        index_1.SchoolPeriod.findAll(),
        index_1.Grade.findAll(),
        index_1.Section.findAll()
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
});
const headerToKey = new Map();
bulkEnrollmentColumns_1.BULK_ENROLLMENT_COLUMNS.forEach((column) => {
    const headerWithAsterisk = column.header.trim().toLowerCase();
    const headerWithoutAsterisk = headerWithAsterisk.replace(/^\*\s*/, '');
    headerToKey.set(headerWithAsterisk, column.key);
    headerToKey.set(headerWithoutAsterisk, column.key);
});
const sanitizeString = (value) => {
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
const getColumnNumberByKey = (key) => {
    const index = bulkEnrollmentColumns_1.BULK_ENROLLMENT_COLUMNS.findIndex((column) => column.key === key);
    return index + 1;
};
const getColumnNumberByKeyInColumns = (key, columns) => {
    const index = columns.findIndex((column) => column.key === key);
    return index + 1;
};
const buildLocationCatalogs = () => __awaiter(void 0, void 0, void 0, function* () {
    const candidates = [
        path_1.default.join(process.cwd(), 'src', 'assets', 'venezuela.json'),
        path_1.default.join(process.cwd(), 'assets', 'venezuela.json'),
        path_1.default.join(process.cwd(), 'dist', 'assets', 'venezuela.json'),
        path_1.default.join(__dirname, '..', 'assets', 'venezuela.json'),
        path_1.default.join(__dirname, '..', '..', 'src', 'assets', 'venezuela.json')
    ];
    let jsonPath = candidates[0];
    const fsSync = require('fs');
    for (const candidate of candidates) {
        if (fsSync.existsSync(candidate)) {
            jsonPath = candidate;
            break;
        }
    }
    try {
        const fileContent = yield promises_1.default.readFile(jsonPath, 'utf-8');
        const data = JSON.parse(fileContent);
        const states = new Set();
        const municipalities = new Set();
        const parishes = new Set();
        data.forEach((stateItem) => {
            const state = sanitizeString(stateItem.estado);
            if (state)
                states.add(state);
            (stateItem.municipios || []).forEach((municipalityItem) => {
                const municipality = sanitizeString(municipalityItem.municipio);
                if (municipality)
                    municipalities.add(municipality);
                (municipalityItem.parroquias || []).forEach((parishItem) => {
                    const parish = sanitizeString(parishItem);
                    if (parish)
                        parishes.add(parish);
                });
            });
        });
        const sorter = (a, b) => a.localeCompare(b, 'es');
        return {
            states: Array.from(states).sort(sorter),
            municipalities: Array.from(municipalities).sort(sorter),
            parishes: Array.from(parishes).sort(sorter)
        };
    }
    catch (error) {
        return {
            states: [defaultStudentLocation.state],
            municipalities: [defaultStudentLocation.municipality],
            parishes: [defaultStudentLocation.parish]
        };
    }
});
const createCatalogSheet = (workbook) => __awaiter(void 0, void 0, void 0, function* () {
    const catalogSheet = workbook.addWorksheet('Catalogos');
    catalogSheet.state = 'veryHidden';
    const structures = yield buildStructures();
    const locationCatalogs = yield buildLocationCatalogs();
    const catalogs = [
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
        { name: 'Representa', values: ['mother', 'father', 'sibling', 'grandparent', 'uncle_aunt', 'other'] },
        { name: 'EstadosVenezuela', values: locationCatalogs.states },
        { name: 'MunicipiosVenezuela', values: locationCatalogs.municipalities },
        { name: 'ParroquiasVenezuela', values: locationCatalogs.parishes }
    ];
    const namedRanges = new Map();
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
});
const applyDropdownValidation = (worksheet, columnNumber, formulaReference, errorMessage) => {
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
const applyConditionalDefaultFormulaToColumn = (worksheet, targetColumnNumber, triggerColumnNumber, defaultValue) => {
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
const parseDateValue = (value) => {
    if (!value)
        return null;
    if (value instanceof Date) {
        return (0, dayjs_1.default)(value);
    }
    if (typeof value === 'number') {
        const parsed = XLSX.SSF.parse_date_code(value);
        if (parsed) {
            return (0, dayjs_1.default)(new Date(parsed.y, parsed.m - 1, parsed.d));
        }
    }
    const candidate = (0, dayjs_1.default)(String(value).trim(), ['YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY'], true);
    if (candidate.isValid()) {
        return candidate;
    }
    return null;
};
const parseGuardian = (prefix, row) => {
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
    };
};
const normalizeRow = (excelRow) => {
    const normalized = {};
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
const parseBulkExcel = (filePath) => __awaiter(void 0, void 0, void 0, function* () {
    const workbook = XLSX.readFile(filePath, { cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    // Leer desde la fila 3 (índice 2) donde están los headers reales, después del título y fila vacía
    const sheetRows = XLSX.utils.sheet_to_json(sheet, { defval: '', range: 2 });
    const structures = yield buildStructures();
    const results = [];
    sheetRows.forEach((excelRow, index) => {
        // La primera columna ahora es '* Nombres estudiante'
        const firstColHeader = bulkEnrollmentColumns_1.BULK_ENROLLMENT_COLUMNS[0].header;
        const firstCell = String(excelRow[firstColHeader] || excelRow[firstColHeader.replace(/^\*\s*/, '')] || '').trim();
        if (!firstCell) {
            return;
        }
        const normalized = normalizeRow(excelRow);
        const errors = [];
        const period = resolvePeriod(normalized, structures, errors);
        const grade = resolveGrade(normalized, structures, errors);
        const section = resolveSection(normalized, structures, errors);
        const firstName = sanitizeString(normalized.firstName);
        const lastName = sanitizeString(normalized.lastName);
        const gender = sanitizeString(normalized.gender).toUpperCase();
        if (!firstName)
            errors.push('Los nombres del estudiante son obligatorios.');
        if (!lastName)
            errors.push('Los apellidos del estudiante son obligatorios.');
        if (!['M', 'F'].includes(gender))
            errors.push('El género debe ser M o F.');
        const birthdate = parseDateValue(normalized.birthdate);
        if (!birthdate)
            errors.push('Fecha de nacimiento inválida.');
        const documentTypeRaw = sanitizeString(normalized.documentType) || 'Venezolano';
        const documentType = isDocumentType(documentTypeRaw) ? documentTypeRaw : 'Venezolano';
        const document = sanitizeString(normalized.document) || undefined;
        const escolaridadRaw = sanitizeString(normalized.escolaridad).toLowerCase();
        const escolaridad = escolaridadOptions.includes(escolaridadRaw)
            ? escolaridadRaw
            : 'regular';
        const representativeTypeRaw = sanitizeString(normalized.representativeType).toLowerCase();
        const validRepTypes = ['mother', 'father', 'sibling', 'grandparent', 'uncle_aunt', 'other'];
        const representativeType = validRepTypes.includes(representativeTypeRaw)
            ? representativeTypeRaw
            : 'mother';
        // The Excel template only has "Representante" columns. Route the data to
        // the correct guardian slot based on representativeType so the downstream
        // studentEnrollmentService validates the right guardian.
        const representative = parseGuardian('representative', normalized);
        let mother = null;
        let father = null;
        let representativeData = null;
        if (representativeType === 'mother') {
            mother = representative;
        }
        else if (representativeType === 'father') {
            father = representative;
        }
        else {
            representativeData = representative;
        }
        const previousSchoolsRaw = sanitizeString(normalized.previousSchoolIds);
        const previousSchoolIds = previousSchoolsRaw
            ? previousSchoolsRaw.split(';').map((entry) => entry.trim()).filter(Boolean)
            : undefined;
        const payload = {
            firstName,
            lastName,
            documentType,
            document,
            gender: gender,
            birthdate: birthdate ? birthdate.format('YYYY-MM-DD') : '',
            pathology: sanitizeString(normalized.pathology) || null,
            livingWith: sanitizeString(normalized.livingWith) || null,
            birthState: sanitizeString(normalized.birthState),
            birthMunicipality: sanitizeString(normalized.birthMunicipality),
            birthParish: sanitizeString(normalized.birthParish),
            residenceState: sanitizeString(normalized.residenceState),
            residenceMunicipality: sanitizeString(normalized.residenceMunicipality),
            residenceParish: sanitizeString(normalized.residenceParish),
            // Student phone is inherited from the representative.
            phone1: ((mother === null || mother === void 0 ? void 0 : mother.phone) || (father === null || father === void 0 ? void 0 : father.phone) || (representativeData === null || representativeData === void 0 ? void 0 : representativeData.phone) || '') || null,
            phone2: ((mother === null || mother === void 0 ? void 0 : mother.phone2) || (father === null || father === void 0 ? void 0 : father.phone2) || (representativeData === null || representativeData === void 0 ? void 0 : representativeData.phone2) || '') || null,
            email: sanitizeString(normalized.email) || null,
            address: sanitizeString(normalized.address) || null,
            whatsapp: ((mother === null || mother === void 0 ? void 0 : mother.whatsapp) || (mother === null || mother === void 0 ? void 0 : mother.phone) || (father === null || father === void 0 ? void 0 : father.whatsapp) || (father === null || father === void 0 ? void 0 : father.phone) || (representativeData === null || representativeData === void 0 ? void 0 : representativeData.whatsapp) || (representativeData === null || representativeData === void 0 ? void 0 : representativeData.phone) || '') || null,
            previousSchoolIds,
            mother,
            father,
            representative: representativeData,
            representativeType,
            schoolPeriodId: (period === null || period === void 0 ? void 0 : period.id) || 0,
            gradeId: (grade === null || grade === void 0 ? void 0 : grade.id) || 0,
            sectionId: (section === null || section === void 0 ? void 0 : section.id) || null,
            enrollmentAnswers: [],
            escolaridad,
            documents: undefined,
            // Derive nationality from documentType: 'Extranjero' → E, everything else → V.
            // This is only used when documentType === 'Cédula Escolar' to generate the document number.
            nationality: documentType === 'Extranjero' ? 'Extranjero' : 'Venezolano'
        };
        ['birthState', 'birthMunicipality', 'birthParish', 'residenceState', 'residenceMunicipality', 'residenceParish'].forEach((field) => {
            if (!sanitizeString(normalized[field])) {
                errors.push(`El campo ${field} es obligatorio.`);
            }
        });
        if (!period)
            errors.push('No se encontró el período escolar especificado.');
        if (!grade)
            errors.push('No se encontró el grado especificado.');
        if (!birthdate)
            errors.push('La fecha de nacimiento es obligatoria.');
        if (period)
            payload.schoolPeriodId = period.id;
        if (grade)
            payload.gradeId = grade.id;
        if (section)
            payload.sectionId = section.id;
        results.push({
            rowNumber: index + 2,
            raw: normalized,
            payload: errors.length ? undefined : payload,
            errors
        });
    });
    yield promises_1.default.unlink(filePath).catch(() => undefined);
    return results;
});
exports.parseBulkExcel = parseBulkExcel;
const previewBulkEnrollment = (filePath) => __awaiter(void 0, void 0, void 0, function* () {
    const rows = yield (0, exports.parseBulkExcel)(filePath);
    const valid = rows.filter((row) => !row.errors.length && row.payload).length;
    const invalid = rows.filter((row) => row.errors.length).length;
    return {
        rows,
        total: rows.length,
        valid,
        invalid
    };
});
exports.previewBulkEnrollment = previewBulkEnrollment;
const resolvePeriod = (normalized, structures, errors) => {
    const idValue = normalized.schoolPeriodId;
    if (idValue) {
        const period = structures.periodsById.get(Number(idValue));
        if (period)
            return period;
        errors.push(`No existe el periodo con ID ${idValue}.`);
    }
    const name = sanitizeString(normalized.schoolPeriod).toLowerCase();
    if (name) {
        const period = structures.periodsByName.get(name);
        if (period)
            return period;
        errors.push(`No existe el periodo "${normalized.schoolPeriod}".`);
    }
    return undefined;
};
const resolveGrade = (normalized, structures, errors) => {
    const idValue = normalized.gradeId;
    if (idValue) {
        const grade = structures.gradesById.get(Number(idValue));
        if (grade)
            return grade;
        errors.push(`No existe el grado con ID ${idValue}.`);
    }
    const name = sanitizeString(normalized.grade).toLowerCase();
    if (name) {
        const grade = structures.gradesByName.get(name);
        if (grade)
            return grade;
        errors.push(`No existe el grado "${normalized.grade}".`);
    }
    return undefined;
};
const resolveSection = (normalized, structures, errors) => {
    const idValue = normalized.sectionId;
    if (idValue) {
        const section = structures.sectionsById.get(Number(idValue));
        if (section)
            return section;
        errors.push(`No existe la sección con ID ${idValue}.`);
    }
    const name = sanitizeString(normalized.section).toLowerCase();
    if (name) {
        const section = structures.sectionsByName.get(name);
        if (section)
            return section;
        errors.push(`No existe la sección "${normalized.section}".`);
    }
    return undefined;
};
const processBulkEnrollment = (rows) => __awaiter(void 0, void 0, void 0, function* () {
    const results = [];
    for (const row of rows) {
        try {
            const { person, matriculation, reportUuid } = yield (0, studentEnrollmentService_1.registerAndEnrollStudent)(row.payload, {
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
        }
        catch (error) {
            let message = 'Error procesando la fila';
            if (error instanceof sequelize_1.UniqueConstraintError) {
                const fields = error.errors.map((e) => { var _a; return `${(_a = e.path) !== null && _a !== void 0 ? _a : 'campo desconocido'}: ${e.message}`; }).join('; ');
                message = `Registro duplicado — ${fields}`;
            }
            else if (error instanceof sequelize_1.ValidationError) {
                const details = error.errors.map((e) => {
                    var _a;
                    const field = (_a = e.path) !== null && _a !== void 0 ? _a : 'campo desconocido';
                    return `[${field}] ${e.message}`;
                }).join('; ');
                message = `Error de validación — ${details}`;
            }
            else if (error instanceof Error) {
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
});
exports.processBulkEnrollment = processBulkEnrollment;
const generateTemplate = (...args_1) => __awaiter(void 0, [...args_1], void 0, function* (options = {}) {
    const workbook = new exceljs_1.default.Workbook();
    const worksheet = workbook.addWorksheet('Inscripciones');
    // 1. Título de identificación
    const titleRow = worksheet.addRow(['PLANTILLA PARA INSCRIPCIÓN MASIVA DE ESTUDIANTES']);
    titleRow.font = { bold: true, size: 14 };
    titleRow.alignment = { horizontal: 'center' };
    worksheet.mergeCells(1, 1, 1, 10);
    worksheet.addRow([]); // Fila vacía de separación
    // 3. Filtrar columnas: excluir solo las columnas de ID opcionales
    const hiddenKeys = new Set(['schoolPeriodId', 'gradeId', 'sectionId']);
    const visibleColumns = bulkEnrollmentColumns_1.BULK_ENROLLMENT_COLUMNS.filter((col) => !hiddenKeys.has(col.key));
    const headerRow = worksheet.addRow(visibleColumns.map((col) => col.header));
    headerRow.font = { bold: true };
    worksheet.columns = visibleColumns.map((col) => ({ width: Math.min(Math.max(col.header.length + 5, 18), 40) }));
    const catalogRanges = yield createCatalogSheet(workbook);
    const validationConfig = [
        { key: 'schoolPeriod', catalog: 'Periodos', message: 'Seleccione un período válido de la lista.' },
        { key: 'grade', catalog: 'Grados', message: 'Seleccione un grado válido de la lista.' },
        { key: 'section', catalog: 'Secciones', message: 'Seleccione una sección válida de la lista.' },
        { key: 'escolaridad', catalog: 'Escolaridad', message: 'Seleccione una escolaridad válida.' },
        { key: 'documentType', catalog: 'Documentos', message: 'Seleccione un tipo de documento válido.' },
        { key: 'gender', catalog: 'Genero', message: 'Seleccione M o F.' },
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
    applyConditionalDefaultFormulaToColumn(worksheet, getColumnNumberByKeyInColumns('birthState', visibleColumns), firstNameColumnNumber, defaultStudentLocation.state);
    applyConditionalDefaultFormulaToColumn(worksheet, getColumnNumberByKeyInColumns('birthMunicipality', visibleColumns), firstNameColumnNumber, defaultStudentLocation.municipality);
    applyConditionalDefaultFormulaToColumn(worksheet, getColumnNumberByKeyInColumns('birthParish', visibleColumns), firstNameColumnNumber, defaultStudentLocation.parish);
    applyConditionalDefaultFormulaToColumn(worksheet, getColumnNumberByKeyInColumns('residenceState', visibleColumns), firstNameColumnNumber, defaultStudentLocation.state);
    applyConditionalDefaultFormulaToColumn(worksheet, getColumnNumberByKeyInColumns('residenceMunicipality', visibleColumns), firstNameColumnNumber, defaultStudentLocation.municipality);
    applyConditionalDefaultFormulaToColumn(worksheet, getColumnNumberByKeyInColumns('residenceParish', visibleColumns), firstNameColumnNumber, defaultStudentLocation.parish);
    // Autoseleccionar período activo cuando haya nombre de estudiante
    const activePeriod = yield index_1.SchoolPeriod.findOne({ where: { status: 'activo' } });
    if (activePeriod) {
        applyConditionalDefaultFormulaToColumn(worksheet, getColumnNumberByKeyInColumns('schoolPeriod', visibleColumns), firstNameColumnNumber, activePeriod.period);
    }
    // Valores por defecto condicionados para representante
    const representativeFirstNameColumnNumber = getColumnNumberByKeyInColumns('representative.firstName', visibleColumns);
    applyConditionalDefaultFormulaToColumn(worksheet, getColumnNumberByKeyInColumns('representative.residenceState', visibleColumns), representativeFirstNameColumnNumber, defaultStudentLocation.state);
    applyConditionalDefaultFormulaToColumn(worksheet, getColumnNumberByKeyInColumns('representative.residenceMunicipality', visibleColumns), representativeFirstNameColumnNumber, defaultStudentLocation.municipality);
    applyConditionalDefaultFormulaToColumn(worksheet, getColumnNumberByKeyInColumns('representative.residenceParish', visibleColumns), representativeFirstNameColumnNumber, defaultStudentLocation.parish);
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
    yield worksheet.protect('inscripciones2025', {
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
    const timestamp = (0, dayjs_1.default)().format('YYYYMMDD_HHmm');
    const fileName = `plantilla_inscripciones_${timestamp}.xlsx`;
    const dir = yield ensureTmpDir();
    const tempPath = path_1.default.join(dir, fileName);
    yield workbook.xlsx.writeFile(tempPath);
    const buffer = yield promises_1.default.readFile(tempPath);
    yield promises_1.default.unlink(tempPath);
    return { buffer, fileName };
});
exports.generateTemplate = generateTemplate;
