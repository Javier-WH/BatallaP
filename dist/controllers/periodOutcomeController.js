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
exports.resolvePendingSubject = exports.getPendingSubjects = exports.getPeriodOutcomes = void 0;
const periodOutcomeService_1 = __importDefault(require("../services/periodOutcomeService.js"));
const pendingSubjectService_1 = __importDefault(require("../services/pendingSubjectService.js"));
const VALID_OUTCOME_STATUS = ['aprobado', 'materias_pendientes', 'reprobado'];
const VALID_PENDING_STATUS = ['aprobada', 'convalidada'];
const getPeriodOutcomes = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const periodId = Number(req.params.periodId);
        if (!Number.isFinite(periodId)) {
            return res.status(400).json({ message: 'periodId inválido' });
        }
        const status = req.query.status;
        if (status && !VALID_OUTCOME_STATUS.includes(status)) {
            return res.status(400).json({ message: 'status inválido' });
        }
        const data = yield periodOutcomeService_1.default.getOutcomesForPeriod(periodId, { status });
        return res.json(data);
    }
    catch (error) {
        console.error('Error fetching period outcomes', error);
        return res.status(500).json({ message: 'Error al obtener resultados del periodo' });
    }
});
exports.getPeriodOutcomes = getPeriodOutcomes;
const getPendingSubjects = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const periodId = Number(req.params.periodId);
        if (!Number.isFinite(periodId)) {
            return res.status(400).json({ message: 'periodId inválido' });
        }
        const pending = yield periodOutcomeService_1.default.getPendingSubjectsByPeriod(periodId);
        return res.json(pending);
    }
    catch (error) {
        console.error('Error fetching pending subjects', error);
        return res.status(500).json({ message: 'Error al obtener materias pendientes' });
    }
});
exports.getPendingSubjects = getPendingSubjects;
const resolvePendingSubject = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const pendingSubjectId = Number(req.params.pendingSubjectId);
        if (!Number.isFinite(pendingSubjectId)) {
            return res.status(400).json({ message: 'pendingSubjectId inválido' });
        }
        const { status } = req.body;
        if (!status || !VALID_PENDING_STATUS.includes(status)) {
            return res.status(400).json({ message: 'status inválido' });
        }
        const pending = yield pendingSubjectService_1.default.resolvePendingSubject(pendingSubjectId, status);
        return res.json(pending);
    }
    catch (error) {
        console.error('Error resolving pending subject', error);
        return res.status(500).json({ message: 'Error al actualizar materia pendiente' });
    }
});
exports.resolvePendingSubject = resolvePendingSubject;
