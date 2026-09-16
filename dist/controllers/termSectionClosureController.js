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
exports.reopenSection = exports.closeSection = exports.getClosureStatus = exports.getClosedSections = void 0;
const termSectionClosureService_1 = require("../services/termSectionClosureService.js");
const index_1 = require("../models/index.js");
const getClosedSections = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { termId } = req.params;
        const parsedTermId = Number(termId);
        if (!parsedTermId || Number.isNaN(parsedTermId)) {
            return res.status(400).json({ message: 'termId inválido' });
        }
        const term = yield index_1.Term.findByPk(parsedTermId, { attributes: ['id', 'isBlocked', 'schoolPeriodId'] });
        if (!term) {
            return res.status(404).json({ message: 'Lapso no encontrado' });
        }
        const closedSections = yield termSectionClosureService_1.TermSectionClosureService.getClosedSections(parsedTermId);
        return res.json({
            termId: parsedTermId,
            termGloballyBlocked: term.isBlocked,
            closedSections, // null = all closed, array of { sectionId, gradeId } = specific
        });
    }
    catch (error) {
        console.error('[getClosedSections] Error:', error);
        return res.status(500).json({ message: 'Error al obtener secciones cerradas' });
    }
});
exports.getClosedSections = getClosedSections;
const getClosureStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { termId } = req.params;
        const parsedTermId = Number(termId);
        if (!parsedTermId || Number.isNaN(parsedTermId)) {
            return res.status(400).json({ message: 'termId inválido' });
        }
        const { schoolPeriodId } = req.query;
        if (!schoolPeriodId) {
            return res.status(400).json({ message: 'schoolPeriodId es requerido' });
        }
        const status = yield termSectionClosureService_1.TermSectionClosureService.getClosureStatus(parsedTermId, Number(schoolPeriodId));
        return res.json(status);
    }
    catch (error) {
        console.error('[getClosureStatus] Error:', error);
        return res.status(500).json({ message: 'Error al obtener estado de cierre' });
    }
});
exports.getClosureStatus = getClosureStatus;
const closeSection = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const { termId } = req.params;
        const parsedTermId = Number(termId);
        if (!parsedTermId || Number.isNaN(parsedTermId)) {
            return res.status(400).json({ message: 'termId inválido' });
        }
        const { sectionId, gradeId } = req.body;
        if (!sectionId || !gradeId) {
            return res.status(400).json({ message: 'sectionId y gradeId son requeridos' });
        }
        const sessionUserId = (_b = (_a = req.session) === null || _a === void 0 ? void 0 : _a.user) === null || _b === void 0 ? void 0 : _b.id;
        const closure = yield termSectionClosureService_1.TermSectionClosureService.closeSection({
            termId: parsedTermId,
            sectionId,
            gradeId,
            closedBy: sessionUserId,
        });
        return res.json(closure);
    }
    catch (error) {
        console.error('[closeSection] Error:', error);
        return res.status(500).json({ message: 'Error al cerrar sección' });
    }
});
exports.closeSection = closeSection;
const reopenSection = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { termId, sectionId, gradeId } = req.params;
        const parsedTermId = Number(termId);
        const parsedSectionId = Number(sectionId);
        const parsedGradeId = Number(gradeId);
        if (!parsedTermId || Number.isNaN(parsedTermId)) {
            return res.status(400).json({ message: 'termId inválido' });
        }
        if (!parsedSectionId || Number.isNaN(parsedSectionId)) {
            return res.status(400).json({ message: 'sectionId inválido' });
        }
        if (!parsedGradeId || Number.isNaN(parsedGradeId)) {
            return res.status(400).json({ message: 'gradeId inválido' });
        }
        yield termSectionClosureService_1.TermSectionClosureService.reopenSection(parsedTermId, parsedSectionId, parsedGradeId);
        return res.json({ message: 'Sección reabierta correctamente' });
    }
    catch (error) {
        console.error('[reopenSection] Error:', error);
        return res.status(500).json({ message: 'Error al reabrir sección' });
    }
});
exports.reopenSection = reopenSection;
