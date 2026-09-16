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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getByUuid = exports.listByPerson = exports.generate = void 0;
const enrollmentReportService_1 = require("../services/enrollmentReportService.js");
const generate = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { matriculationId } = req.params;
        const report = yield (0, enrollmentReportService_1.generateEnrollmentReport)(Number(matriculationId));
        res.status(201).json(report);
    }
    catch (error) {
        const err = error;
        console.error('[enrollmentReportController.generate] Error:', err.message);
        res.status(500).json({ error: err.message || 'Error al generar reporte de inscripción' });
    }
});
exports.generate = generate;
const listByPerson = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { personId } = req.params;
        const reports = yield (0, enrollmentReportService_1.getReportsByPerson)(Number(personId));
        res.json(reports);
    }
    catch (error) {
        const err = error;
        console.error('[enrollmentReportController.listByPerson] Error:', err.message);
        res.status(500).json({ error: 'Error al obtener reportes de inscripción' });
    }
});
exports.listByPerson = listByPerson;
const getByUuid = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { uuid } = req.params;
        const report = yield (0, enrollmentReportService_1.getReportByUuid)(uuid);
        if (!report) {
            return res.status(404).json({ error: 'Reporte no encontrado' });
        }
        res.json(report);
    }
    catch (error) {
        const err = error;
        console.error('[enrollmentReportController.getByUuid] Error:', err.message);
        res.status(500).json({ error: 'Error al obtener reporte de inscripción' });
    }
});
exports.getByUuid = getByUuid;
