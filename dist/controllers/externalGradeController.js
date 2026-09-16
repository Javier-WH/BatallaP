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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bulkProcessExcel = exports.downloadBulkTemplate = exports.bulkRegister = exports.listGrades = exports.listSubjects = exports.removeGrade = exports.updateGrade = exports.upsertGrade = exports.resolvePlantel = exports.createInscription = exports.getExternalGradesForPerson = void 0;
const exceljs_1 = __importDefault(require("exceljs"));
const sequelize_1 = require("sequelize");
const studentSortService_1 = require("../services/studentSortService.js");
const database_1 = __importDefault(require("../config/database.js"));
const index_1 = require("../models/index.js");
const externalGradeService_1 = require("../services/externalGradeService.js");
const paginationService_1 = require("../services/paginationService.js");
// Helper function to check if user has required role
const hasRole = (user, roles) => {
    if (!user || !user.roles)
        return false;
    const userRoles = user.roles.map((r) => (typeof r === 'string' ? r : r.name));
    return roles.some((role) => userRoles.includes(role));
};
const ALLOWED_ROLES = ['Master', 'Administrador', 'Control de Estudios'];
const requireRole = (req, res) => {
    const sessionUser = req.session.user;
    if (!hasRole(sessionUser, ALLOWED_ROLES)) {
        res.status(403).json({ message: 'Solo Master, Administrador o Control de Estudios pueden gestionar notas externas' });
        return false;
    }
    return true;
};
/**
 * GET /api/external-grades/persons/:personId
 * Returns all external inscriptions + grades for a student.
 */
const getExternalGradesForPerson = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!requireRole(req, res))
            return;
        const personId = parseInt(req.params.personId, 10);
        if (!personId)
            return res.status(400).json({ message: 'personId inválido' });
        const person = yield index_1.Person.findByPk(personId);
        if (!person)
            return res.status(404).json({ message: 'Estudiante no encontrado' });
        const inscriptions = yield (0, externalGradeService_1.listExternalGradesForPerson)(personId);
        return res.json({ person, inscriptions });
    }
    catch (error) {
        console.error('[getExternalGradesForPerson] Error:', error);
        return res.status(500).json({ message: error.message || 'Error al obtener notas externas' });
    }
});
exports.getExternalGradesForPerson = getExternalGradesForPerson;
/**
 * POST /api/external-grades/inscriptions
 * Body: { personId, periodLabel, periodName, startYear?, endYear?, gradeId, plantelId }
 * Creates (or reuses) an external inscription for a student.
 */
const createInscription = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!requireRole(req, res))
            return;
        const t = yield database_1.default.transaction();
        try {
            const inscription = yield (0, externalGradeService_1.createExternalInscription)(req.body, t);
            yield t.commit();
            return res.status(201).json(inscription);
        }
        catch (err) {
            yield t.rollback();
            throw err;
        }
    }
    catch (error) {
        console.error('[createExternalInscription] Error:', error);
        return res.status(500).json({ message: error.message || 'Error al crear inscripción externa' });
    }
});
exports.createInscription = createInscription;
/**
 * POST /api/external-grades/planteles
 * Body: { code?, name, state?, dependency?, municipality?, parish? }
 * Resolve or create an external plantel.
 */
const resolvePlantel = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!requireRole(req, res))
            return;
        const t = yield database_1.default.transaction();
        try {
            const plantel = yield (0, externalGradeService_1.resolveOrCreatePlantel)(req.body, t);
            yield t.commit();
            return res.status(201).json(plantel);
        }
        catch (err) {
            yield t.rollback();
            throw err;
        }
    }
    catch (error) {
        console.error('[resolvePlantel] Error:', error);
        return res.status(500).json({ message: error.message || 'Error al registrar plantel externo' });
    }
});
exports.resolvePlantel = resolvePlantel;
/**
 * POST /api/external-grades/grades
 * Body: { inscriptionId, subjectId, finalScore, status, plantelId, issuedAt, gradeType, observations? }
 * Upsert an external final grade.
 */
const upsertGrade = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        if (!requireRole(req, res))
            return;
        const { inscriptionId, subjectId, finalScore, status, plantelId, issuedAt, gradeType, observations, } = req.body;
        if (!inscriptionId || !subjectId || finalScore == null || !plantelId || !issuedAt || !gradeType) {
            return res.status(400).json({ message: 'Faltan campos obligatorios' });
        }
        if (!['transferencia', 'equivalencia'].includes(gradeType)) {
            return res.status(400).json({ message: 'gradeType debe ser transferencia o equivalencia' });
        }
        if (!['aprobada', 'reprobada'].includes(status)) {
            return res.status(400).json({ message: 'status debe ser aprobada o reprobada' });
        }
        const t = yield database_1.default.transaction();
        try {
            const grade = yield (0, externalGradeService_1.upsertExternalGrade)({
                inscriptionId,
                subjectId,
                finalScore: Number(finalScore),
                status,
                plantelId,
                issuedAt: new Date(issuedAt),
                gradeType,
                observations: observations !== null && observations !== void 0 ? observations : null,
                editedBy: (_b = (_a = req.session) === null || _a === void 0 ? void 0 : _a.user) === null || _b === void 0 ? void 0 : _b.id,
            }, t);
            yield t.commit();
            return res.status(201).json(grade);
        }
        catch (err) {
            yield t.rollback();
            throw err;
        }
    }
    catch (error) {
        console.error('[upsertExternalGrade] Error:', error);
        return res.status(500).json({ message: error.message || 'Error al guardar nota externa' });
    }
});
exports.upsertGrade = upsertGrade;
/**
 * PUT /api/external-grades/grades/:id
 * Update an existing external final grade.
 */
const updateGrade = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!requireRole(req, res))
            return;
        const id = parseInt(req.params.id, 10);
        const { finalScore, status, plantelId, issuedAt, gradeType } = req.body;
        const existing = yield index_1.SubjectFinalGrade.findByPk(id);
        if (!existing)
            return res.status(404).json({ message: 'Nota no encontrada' });
        if (existing.gradeType !== 'transferencia' && existing.gradeType !== 'equivalencia') {
            return res.status(400).json({ message: 'Solo se pueden editar notas externas' });
        }
        const patch = {};
        if (finalScore != null)
            patch.finalScore = Number(finalScore);
        if (status) {
            if (!['aprobada', 'reprobada'].includes(status)) {
                return res.status(400).json({ message: 'status debe ser aprobada o reprobada' });
            }
            patch.status = status;
        }
        if (plantelId)
            patch.plantelId = plantelId;
        if (issuedAt)
            patch.calculatedAt = new Date(issuedAt);
        if (gradeType) {
            if (!['transferencia', 'equivalencia'].includes(gradeType)) {
                return res.status(400).json({ message: 'gradeType debe ser transferencia o equivalencia' });
            }
            patch.gradeType = gradeType;
        }
        yield existing.update(patch);
        return res.json(existing);
    }
    catch (error) {
        console.error('[updateExternalGrade] Error:', error);
        return res.status(500).json({ message: error.message || 'Error al actualizar nota externa' });
    }
});
exports.updateGrade = updateGrade;
/**
 * DELETE /api/external-grades/grades/:id
 * Delete an external final grade.
 */
const removeGrade = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!requireRole(req, res))
            return;
        const id = parseInt(req.params.id, 10);
        const t = yield database_1.default.transaction();
        try {
            yield (0, externalGradeService_1.deleteExternalGrade)(id, t);
            yield t.commit();
            return res.status(204).send();
        }
        catch (err) {
            yield t.rollback();
            throw err;
        }
    }
    catch (error) {
        console.error('[removeExternalGrade] Error:', error);
        return res.status(500).json({ message: error.message || 'Error al eliminar nota externa' });
    }
});
exports.removeGrade = removeGrade;
/**
 * GET /api/external-grades/subjects
 * Returns the subject catalog (for selectors in the UI).
 */
const listSubjects = (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const subjects = yield index_1.Subject.findAll({ order: [['name', 'ASC']] });
        return res.json(subjects);
    }
    catch (error) {
        console.error('[listSubjects] Error:', error);
        return res.status(500).json({ message: 'Error al listar materias' });
    }
});
exports.listSubjects = listSubjects;
/**
 * GET /api/external-grades/grades
 * Returns external grades with optional filters (personId, plantelId).
 * Supports opt-in pagination via page/pageSize query params.
 */
const listGrades = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!requireRole(req, res))
            return;
        const { personId, plantelId } = req.query;
        const where = { gradeType: ['transferencia', 'equivalencia'] };
        if (plantelId)
            where.plantelId = Number(plantelId);
        const pagination = (0, paginationService_1.parsePagination)(req.query);
        // Shared include tree for both ID query and hydration.
        const inscriptionWhere = personId ? { personId: Number(personId) } : undefined;
        const baseInclude = [
            {
                model: index_1.InscriptionSubject,
                as: 'inscriptionSubject',
                include: [
                    {
                        model: index_1.Inscription,
                        as: 'inscription',
                        where: inscriptionWhere,
                        required: !!personId, // INNER JOIN when filtering by person
                        include: [
                            { model: index_1.Person, as: 'student' },
                            { model: index_1.SchoolPeriod, as: 'period' },
                            { model: index_1.Grade, as: 'grade' },
                        ],
                    },
                    { model: index_1.Subject, as: 'subject' },
                ],
            },
            { model: index_1.Plantel, as: 'plantel' },
        ];
        if (!pagination.isPaginated) {
            // Legacy: return flat array, no limit.
            const fullGrades = yield index_1.SubjectFinalGrade.findAll({
                where,
                include: baseInclude,
                order: [['calculatedAt', 'DESC']],
            });
            return res.json(fullGrades);
        }
        // Paginated: IDs first, then hydrate.
        const idRows = yield index_1.SubjectFinalGrade.findAll({
            where,
            include: baseInclude,
            attributes: ['id'],
            order: [['calculatedAt', 'DESC']],
            limit: pagination.limit,
            offset: pagination.offset,
            subQuery: false,
            raw: true,
        });
        const ids = idRows.map((r) => r.id);
        const total = yield index_1.SubjectFinalGrade.count({
            where,
            include: baseInclude,
            distinct: true,
            col: 'id',
        });
        let fullGrades = [];
        if (ids.length > 0) {
            fullGrades = yield index_1.SubjectFinalGrade.findAll({
                where: { id: { [sequelize_1.Op.in]: ids } },
                include: baseInclude,
                order: [(0, sequelize_1.literal)((0, studentSortService_1.fieldExpr)((0, studentSortService_1.quoteQualified)('SubjectFinalGrade', 'id'), ids.map(String)))],
            });
        }
        return res.json((0, paginationService_1.buildPaginatedResponse)(fullGrades, total, pagination));
    }
    catch (error) {
        console.error('[listExternalGrades] Error:', error);
        return res.status(500).json({ message: error.message || 'Error al listar notas externas' });
    }
});
exports.listGrades = listGrades;
/**
 * POST /api/external-grades/bulk
 * Body: Array of entries (see registerExternalGradesBatch signature).
 * Processes a batch of external grade registrations in a single transaction.
 */
const bulkRegister = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!requireRole(req, res))
            return;
        const entries = req.body;
        if (!Array.isArray(entries) || entries.length === 0) {
            return res.status(400).json({ message: 'Se requiere un arreglo de entradas' });
        }
        const result = yield (0, externalGradeService_1.registerExternalGradesBatch)(entries);
        return res.status(201).json(result);
    }
    catch (error) {
        console.error('[bulkRegister] Error:', error);
        return res.status(500).json({ message: error.message || 'Error en carga masiva' });
    }
});
exports.bulkRegister = bulkRegister;
/**
 * GET /api/external-grades/bulk/template
 * Downloads an Excel template for bulk external grade import.
 */
const downloadBulkTemplate = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    try {
        if (!requireRole(req, res))
            return;
        const subjects = yield index_1.Subject.findAll({ order: [['name', 'ASC']] });
        const grades = yield index_1.Grade.findAll({ order: [['order', 'ASC'], ['name', 'ASC']] });
        const workbook = new exceljs_1.default.Workbook();
        const sheet = workbook.addWorksheet('Notas Externas');
        sheet.columns = [
            { header: 'Cédula Estudiante', key: 'document', width: 20 },
            { header: 'Código DEA Plantel', key: 'plantelCode', width: 18 },
            { header: 'Nombre Plantel', key: 'plantelName', width: 35 },
            { header: 'Estado Plantel', key: 'plantelState', width: 18 },
            { header: 'Período', key: 'periodLabel', width: 12 },
            { header: 'Nombre Período', key: 'periodName', width: 30 },
            { header: 'Grado (nombre)', key: 'gradeName', width: 20 },
            { header: 'Materia (nombre)', key: 'subjectName', width: 30 },
            { header: 'Nota (0-20)', key: 'finalScore', width: 12 },
            { header: 'Estado (aprobada/reprobada)', key: 'status', width: 22 },
            { header: 'Tipo (transferencia/equivalencia)', key: 'gradeType', width: 28 },
            { header: 'Fecha Documento (YYYY-MM-DD)', key: 'issuedAt', width: 24 },
        ];
        // Style header row
        sheet.getRow(1).font = { bold: true };
        sheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4472C4' },
        };
        sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        // Add a sample row
        sheet.addRow({
            document: '12345678',
            plantelCode: '090123',
            plantelName: 'U.E. Colegio Example',
            plantelState: 'Aragua',
            periodLabel: '2024-2025',
            periodName: '2024-2025 - Colegio Example',
            gradeName: '1er Año',
            subjectName: 'Matemática',
            finalScore: 14,
            status: 'aprobada',
            gradeType: 'transferencia',
            issuedAt: '2025-07-15',
        });
        // Reference sheet with available subjects and grades
        const refSheet = workbook.addWorksheet('Referencias');
        refSheet.columns = [
            { header: 'Materias disponibles', key: 'subject', width: 40 },
            { header: 'Grados disponibles', key: 'grade', width: 30 },
        ];
        refSheet.getRow(1).font = { bold: true };
        const maxRows = Math.max(subjects.length, grades.length);
        for (let i = 0; i < maxRows; i++) {
            refSheet.addRow({
                subject: (_b = (_a = subjects[i]) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : '',
                grade: (_d = (_c = grades[i]) === null || _c === void 0 ? void 0 : _c.name) !== null && _d !== void 0 ? _d : '',
            });
        }
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="plantilla_notas_externas.xlsx"');
        yield workbook.xlsx.write(res);
        res.end();
    }
    catch (error) {
        console.error('[downloadBulkTemplate] Error:', error);
        return res.status(500).json({ message: error.message || 'Error al generar plantilla' });
    }
});
exports.downloadBulkTemplate = downloadBulkTemplate;
/**
 * POST /api/external-grades/bulk/process
 * Processes an uploaded Excel file with external grades.
 * Expects multipart/form-data with field "file".
 */
const bulkProcessExcel = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!requireRole(req, res))
            return;
        if (!req.file) {
            return res.status(400).json({ message: 'No se cargó ningún archivo' });
        }
        const workbook = new exceljs_1.default.Workbook();
        yield workbook.xlsx.readFile(req.file.path);
        const sheet = workbook.getWorksheet('Notas Externas') || workbook.worksheets[0];
        if (!sheet) {
            return res.status(400).json({ message: 'La hoja "Notas Externas" no existe en el archivo' });
        }
        // Preload catalogs for name -> id resolution
        const subjects = yield index_1.Subject.findAll();
        const subjectByName = new Map(subjects.map((s) => [s.name.toLowerCase().trim(), s]));
        const grades = yield index_1.Grade.findAll();
        const gradeByName = new Map(grades.map((g) => [g.name.toLowerCase().trim(), g]));
        const persons = yield index_1.Person.findAll();
        const personByDocument = new Map(persons.map((p) => [String(p.document).trim(), p]));
        const entries = [];
        const errors = [];
        // Skip header row
        sheet.eachRow((row, rowNumber) => {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
            if (rowNumber === 1)
                return;
            const values = row.values;
            // values[0] is undefined in exceljs; columns start at 1
            const document = String((_a = values[1]) !== null && _a !== void 0 ? _a : '').trim();
            const plantelCode = String((_b = values[2]) !== null && _b !== void 0 ? _b : '').trim();
            const plantelName = String((_c = values[3]) !== null && _c !== void 0 ? _c : '').trim();
            const plantelState = String((_d = values[4]) !== null && _d !== void 0 ? _d : '').trim();
            const periodLabel = String((_e = values[5]) !== null && _e !== void 0 ? _e : '').trim();
            const periodName = String((_f = values[6]) !== null && _f !== void 0 ? _f : '').trim();
            const gradeName = String((_g = values[7]) !== null && _g !== void 0 ? _g : '').trim();
            const subjectName = String((_h = values[8]) !== null && _h !== void 0 ? _h : '').trim();
            const finalScoreRaw = values[9];
            const status = String((_j = values[10]) !== null && _j !== void 0 ? _j : '').trim().toLowerCase();
            const gradeType = String((_k = values[11]) !== null && _k !== void 0 ? _k : '').trim().toLowerCase();
            const issuedAt = String((_l = values[12]) !== null && _l !== void 0 ? _l : '').trim();
            if (!document && !subjectName)
                return; // skip empty rows
            // Validate
            const person = personByDocument.get(document);
            if (!person) {
                errors.push({ row: rowNumber, message: `Estudiante con cédula "${document}" no encontrado` });
                return;
            }
            const subject = subjectByName.get(subjectName.toLowerCase());
            if (!subject) {
                errors.push({ row: rowNumber, message: `Materia "${subjectName}" no encontrada` });
                return;
            }
            const grade = gradeByName.get(gradeName.toLowerCase());
            if (!grade) {
                errors.push({ row: rowNumber, message: `Grado "${gradeName}" no encontrado` });
                return;
            }
            const finalScore = Number(finalScoreRaw);
            if (isNaN(finalScore)) {
                errors.push({ row: rowNumber, message: `Nota inválida: ${finalScoreRaw}` });
                return;
            }
            if (!['aprobada', 'reprobada'].includes(status)) {
                errors.push({ row: rowNumber, message: `Estado inválido: ${status}` });
                return;
            }
            if (!['transferencia', 'equivalencia'].includes(gradeType)) {
                errors.push({ row: rowNumber, message: `Tipo inválido: ${gradeType}` });
                return;
            }
            const issuedDate = new Date(issuedAt);
            if (isNaN(issuedDate.getTime())) {
                errors.push({ row: rowNumber, message: `Fecha inválida: ${issuedAt}` });
                return;
            }
            // Group by person + period + plantel
            const groupKey = `${person.id}|${periodLabel}|${plantelCode || plantelName}`;
            let entry = entries.find((e) => e._key === groupKey);
            if (!entry) {
                entry = {
                    _key: groupKey,
                    personId: person.id,
                    periodLabel,
                    periodName: periodName || periodLabel,
                    gradeId: grade.id,
                    plantel: {
                        code: plantelCode || undefined,
                        name: plantelName,
                        state: plantelState || undefined,
                    },
                    grades: [],
                };
                entries.push(entry);
            }
            entry.grades.push({
                subjectId: subject.id,
                finalScore,
                status: status,
                issuedAt: issuedDate,
                gradeType: gradeType,
            });
        });
        if (errors.length > 0) {
            return res.status(400).json({
                message: 'Se encontraron errores en el archivo',
                errors: errors.slice(0, 50),
                totalErrors: errors.length,
            });
        }
        // Strip internal _key before sending to service
        const cleanEntries = entries.map((_a) => {
            var { _key } = _a, rest = __rest(_a, ["_key"]);
            return rest;
        });
        const result = yield (0, externalGradeService_1.registerExternalGradesBatch)(cleanEntries);
        return res.status(201).json(result);
    }
    catch (error) {
        console.error('[bulkProcessExcel] Error:', error);
        return res.status(500).json({ message: error.message || 'Error al procesar archivo' });
    }
    finally {
        // Clean up uploaded file
        if (req.file) {
            try {
                yield Promise.resolve().then(() => __importStar(require('fs/promises'))).then((fs) => fs.unlink(req.file.path));
            }
            catch (_a) { }
        }
    }
});
exports.bulkProcessExcel = bulkProcessExcel;
