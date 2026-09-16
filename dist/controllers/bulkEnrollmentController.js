"use strict";
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
exports.retrySingleRow = exports.processBulk = exports.previewBulk = exports.downloadTemplate = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
const bulkEnrollmentService_1 = require("../services/bulkEnrollmentService.js");
const studentEnrollmentService_1 = require("../services/studentEnrollmentService.js");
const enrollmentReportService_1 = require("../services/enrollmentReportService.js");
const index_1 = require("../models/index.js");
const downloadTemplate = (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { buffer, fileName } = yield (0, bulkEnrollmentService_1.generateTemplate)();
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
        res.send(buffer);
    }
    catch (error) {
        console.error('[downloadTemplate] Error:', error);
        res.status(500).json({ error: 'No se pudo generar la plantilla' });
    }
});
exports.downloadTemplate = downloadTemplate;
const previewBulk = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Debe subir un archivo Excel (.xlsx)' });
        }
        const result = yield (0, bulkEnrollmentService_1.previewBulkEnrollment)(req.file.path);
        res.json(result);
    }
    catch (error) {
        console.error('[previewBulk] Error:', error);
        res.status(500).json({ error: 'No se pudo procesar el archivo', details: error.message });
    }
});
exports.previewBulk = previewBulk;
const processBulk = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { rows } = req.body;
        if (!Array.isArray(rows)) {
            return res.status(400).json({ error: 'Debe enviar el arreglo de filas a procesar' });
        }
        const validRows = rows
            .filter((row) => { var _a; return row.payload && !((_a = row.errors) === null || _a === void 0 ? void 0 : _a.length); })
            .map((row) => ({ rowNumber: row.rowNumber, payload: row.payload }));
        if (!validRows.length) {
            return res.status(400).json({ error: 'No hay filas válidas para procesar' });
        }
        const results = yield (0, bulkEnrollmentService_1.processBulkEnrollment)(validRows);
        res.json({ total: rows.length, processed: validRows.length, results });
    }
    catch (error) {
        console.error('[processBulk] Error:', error);
        res.status(500).json({ error: 'Error procesando la carga masiva', details: error.message });
    }
});
exports.processBulk = processBulk;
const retrySingleRow = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { payload, updateExistingName } = req.body;
        if (!payload) {
            return res.status(400).json({ success: false, message: 'Payload es requerido' });
        }
        const doc = typeof payload.document === 'string' ? payload.document.trim() : '';
        if (doc) {
            const existingPerson = yield index_1.Person.findOne({ where: { document: doc } });
            if (existingPerson) {
                const newFirst = (payload.firstName || '').trim().toLowerCase();
                const newLast = (payload.lastName || '').trim().toLowerCase();
                const existFirst = existingPerson.firstName.trim().toLowerCase();
                const existLast = existingPerson.lastName.trim().toLowerCase();
                const nameChanged = newFirst !== existFirst || newLast !== existLast;
                if (nameChanged && !updateExistingName) {
                    return res.json({
                        success: false,
                        nameConflict: true,
                        existingPerson: {
                            id: existingPerson.id,
                            firstName: existingPerson.firstName,
                            lastName: existingPerson.lastName,
                            document: existingPerson.document
                        },
                        message: `Ya existe "${existingPerson.firstName} ${existingPerson.lastName}" con documento ${doc}. El registro indica "${payload.firstName} ${payload.lastName}". ¿Desea actualizar el nombre?`
                    });
                }
                const t = yield database_1.default.transaction();
                try {
                    if (nameChanged && updateExistingName) {
                        yield existingPerson.update({ firstName: payload.firstName, lastName: payload.lastName }, { transaction: t });
                    }
                    const matriculation = yield index_1.Matriculation.create({
                        schoolPeriodId: payload.schoolPeriodId,
                        gradeId: payload.gradeId,
                        sectionId: payload.sectionId || null,
                        personId: existingPerson.id,
                        status: 'pending',
                        escolaridad: (0, studentEnrollmentService_1.normalizeEscolaridad)(payload.escolaridad)
                    }, { transaction: t });
                    let reportUuid;
                    try {
                        const report = yield (0, enrollmentReportService_1.generateEnrollmentReport)(matriculation.id, t);
                        reportUuid = report.uuid;
                    }
                    catch (reportError) {
                        console.warn('[retrySingleRow] No se pudo generar reporte:', reportError);
                    }
                    yield t.commit();
                    return res.json({
                        success: true,
                        message: nameChanged
                            ? 'Nombre actualizado e inscripción registrada'
                            : 'Inscripción registrada (estudiante existente)',
                        personId: existingPerson.id,
                        matriculationId: matriculation.id,
                        reportUuid
                    });
                }
                catch (innerError) {
                    yield t.rollback();
                    throw innerError;
                }
            }
        }
        const { person, matriculation, reportUuid } = yield (0, studentEnrollmentService_1.registerAndEnrollStudent)(payload, {
            relaxGuardianContactFields: true
        });
        res.json({
            success: true,
            message: 'Inscripción registrada',
            personId: person.id,
            matriculationId: matriculation.id,
            reportUuid
        });
    }
    catch (error) {
        let msg = 'Error procesando el registro';
        if (error instanceof sequelize_1.UniqueConstraintError) {
            const fields = error.errors
                .map((e) => { var _a; return `${(_a = e.path) !== null && _a !== void 0 ? _a : 'campo desconocido'}: ${e.message}`; })
                .join('; ');
            msg = `Registro duplicado — ${fields}`;
        }
        else if (error instanceof sequelize_1.ValidationError) {
            const details = error.errors
                .map((e) => { var _a; return `[${(_a = e.path) !== null && _a !== void 0 ? _a : 'campo desconocido'}] ${e.message}`; })
                .join('; ');
            msg = `Error de validación — ${details}`;
        }
        else if (error instanceof Error) {
            msg = error.message;
        }
        console.error('[retrySingleRow] Error:', msg);
        res.json({ success: false, message: msg });
    }
});
exports.retrySingleRow = retrySingleRow;
