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
exports.loadClosureStudentGroups = loadClosureStudentGroups;
exports.sortClosureStudentGroups = sortClosureStudentGroups;
const index_1 = require("../models/index.js");
/**
 * Loads every non-withdrawn inscription in a school period and consolidates
 * multiple inscriptions belonging to the same person into one closure unit.
 * `escolaridad` is descriptive here; it is intentionally not used as a
 * selection filter.
 */
function loadClosureStudentGroups(schoolPeriodId_1) {
    return __awaiter(this, arguments, void 0, function* (schoolPeriodId, options = {}) {
        var _a;
        const inscriptions = (yield index_1.Inscription.findAll({
            where: {
                schoolPeriodId,
                withdrawnAt: null,
            },
            include: [
                { model: index_1.Person, as: 'student' },
                { model: index_1.Grade, as: 'grade' },
                { model: index_1.Section, as: 'section' },
                {
                    model: index_1.InscriptionSubject,
                    as: 'inscriptionSubjects',
                    required: false,
                },
            ],
            order: [['personId', 'ASC'], ['id', 'ASC']],
            transaction: options.transaction,
        }));
        const groups = new Map();
        for (const inscription of inscriptions) {
            const existing = (_a = groups.get(inscription.personId)) !== null && _a !== void 0 ? _a : [];
            existing.push(inscription);
            groups.set(inscription.personId, existing);
        }
        const isPendingSection = (inscription) => {
            var _a, _b;
            const sectionName = (_b = (_a = inscription.section) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : '';
            return sectionName
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toLowerCase()
                .replace(/\s+/g, ' ')
                .trim() === 'materia pendiente';
        };
        return Array.from(groups.entries()).map(([personId, groupedInscriptions]) => {
            const referenceInscription = [...groupedInscriptions].sort((a, b) => {
                var _a, _b, _c, _d;
                const aGradeOrder = (_b = (_a = a.grade) === null || _a === void 0 ? void 0 : _a.order) !== null && _b !== void 0 ? _b : Number.MIN_SAFE_INTEGER;
                const bGradeOrder = (_d = (_c = b.grade) === null || _c === void 0 ? void 0 : _c.order) !== null && _d !== void 0 ? _d : Number.MIN_SAFE_INTEGER;
                const gradeResult = bGradeOrder - aGradeOrder;
                if (gradeResult !== 0)
                    return gradeResult;
                const aIsMp = isPendingSection(a) ? 1 : 0;
                const bIsMp = isPendingSection(b) ? 1 : 0;
                return aIsMp - bIsMp || a.id - b.id;
            })[0];
            return {
                personId,
                inscriptions: groupedInscriptions,
                referenceInscription,
                isPendingOnly: groupedInscriptions.every(inscription => isPendingSection(inscription)),
            };
        });
    });
}
function sortClosureStudentGroups(groups) {
    return [...groups].sort((a, b) => {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
        const aGradeOrder = (_b = (_a = a.referenceInscription.grade) === null || _a === void 0 ? void 0 : _a.order) !== null && _b !== void 0 ? _b : Number.MAX_SAFE_INTEGER;
        const bGradeOrder = (_d = (_c = b.referenceInscription.grade) === null || _c === void 0 ? void 0 : _c.order) !== null && _d !== void 0 ? _d : Number.MAX_SAFE_INTEGER;
        if (aGradeOrder !== bGradeOrder)
            return aGradeOrder - bGradeOrder;
        const aSection = (_f = (_e = a.referenceInscription.section) === null || _e === void 0 ? void 0 : _e.name) !== null && _f !== void 0 ? _f : '';
        const bSection = (_h = (_g = b.referenceInscription.section) === null || _g === void 0 ? void 0 : _g.name) !== null && _h !== void 0 ? _h : '';
        const sectionResult = aSection.localeCompare(bSection, 'es', { sensitivity: 'base' });
        if (sectionResult !== 0)
            return sectionResult;
        const aDocument = (_k = (_j = a.referenceInscription.student) === null || _j === void 0 ? void 0 : _j.document) !== null && _k !== void 0 ? _k : '';
        const bDocument = (_m = (_l = b.referenceInscription.student) === null || _l === void 0 ? void 0 : _l.document) !== null && _m !== void 0 ? _m : '';
        return aDocument.localeCompare(bDocument, 'es', { numeric: true });
    });
}
