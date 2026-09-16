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
exports.TermSectionClosureService = void 0;
const index_1 = require("../models/index.js");
class TermSectionClosureService {
    /**
     * Returns true if the given (termId, sectionId, gradeId) combination is closed.
     * A section is closed if either:
     *  - the term is globally blocked (term.isBlocked === true), OR
     *  - a TermSectionClosure record exists for this (termId, sectionId, gradeId).
     */
    static isSectionClosed(termId, sectionId, gradeId, transaction) {
        return __awaiter(this, void 0, void 0, function* () {
            const term = yield index_1.Term.findByPk(termId, { attributes: ['id', 'isBlocked'], transaction });
            if (!term)
                return false;
            if (term.isBlocked)
                return true;
            if (!gradeId)
                return false;
            const closure = yield index_1.TermSectionClosure.findOne({
                where: { termId, sectionId, gradeId },
                transaction,
            });
            return !!closure;
        });
    }
    /**
     * Returns true if grades for the given (termId, sectionId, gradeId) must be
     * read-only. A section is read-only if ANY of:
     *  - the term is globally blocked (term.isBlocked === true), OR
     *  - a TermSectionClosure record exists for this (termId, sectionId, gradeId), OR
     *  - the course council checklist for this (termId, sectionId, gradeId) is
     *    marked as 'done' (the council already took place — grades are final).
     *
     * The check is dynamic: unmarking the council (status back to 'open') makes
     * the grades editable again, unless the term/section is still closed.
     */
    static isSectionReadOnly(termId, sectionId, gradeId, transaction) {
        return __awaiter(this, void 0, void 0, function* () {
            const term = yield index_1.Term.findByPk(termId, { attributes: ['id', 'isBlocked'], transaction });
            if (!term)
                return false;
            if (term.isBlocked)
                return true;
            if (!gradeId)
                return false;
            // The council scope is (term, grade, section): the same section row is
            // shared across grades, so gradeId MUST be part of the council check —
            // a done council for Sección B/5to año must not lock Sección B/1er año.
            const [closure, doneChecklist] = yield Promise.all([
                index_1.TermSectionClosure.findOne({
                    where: { termId, sectionId, gradeId },
                    transaction,
                }),
                index_1.CouncilChecklist.findOne({
                    where: { termId, sectionId, gradeId, status: 'done' },
                    attributes: ['id'],
                    transaction,
                }),
            ]);
            return !!closure || !!doneChecklist;
        });
    }
    /**
     * Returns the list of closed section-grade pairs for the given term.
     * Returns null if the term is globally blocked (meaning ALL sections are closed).
     */
    static getClosedSections(termId, transaction) {
        return __awaiter(this, void 0, void 0, function* () {
            const term = yield index_1.Term.findByPk(termId, { attributes: ['id', 'isBlocked'], transaction });
            if (!term)
                return [];
            if (term.isBlocked)
                return null; // null = all closed
            const closures = yield index_1.TermSectionClosure.findAll({
                where: { termId },
                attributes: ['sectionId', 'gradeId'],
                transaction,
            });
            return closures.map(c => ({ sectionId: c.sectionId, gradeId: c.gradeId }));
        });
    }
    /**
     * Close a single section for a term (scoped by grade).
     */
    static closeSection(params, transaction) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const [closure] = yield index_1.TermSectionClosure.findOrCreate({
                where: { termId: params.termId, sectionId: params.sectionId, gradeId: params.gradeId },
                defaults: {
                    termId: params.termId,
                    sectionId: params.sectionId,
                    gradeId: params.gradeId,
                    closedAt: new Date(),
                    closedBy: (_a = params.closedBy) !== null && _a !== void 0 ? _a : null,
                },
                transaction,
            });
            return closure;
        });
    }
    /**
     * Reopen a single section for a term (scoped by grade).
     */
    static reopenSection(termId, sectionId, gradeId, transaction) {
        return __awaiter(this, void 0, void 0, function* () {
            yield index_1.TermSectionClosure.destroy({
                where: { termId, sectionId, gradeId },
                transaction,
            });
        });
    }
    /**
     * Returns the total number of sections (across all grades) for a school period.
     */
    static getTotalSectionsForPeriod(schoolPeriodId, transaction) {
        return __awaiter(this, void 0, void 0, function* () {
            const periodGrades = yield index_1.PeriodGrade.findAll({
                where: { schoolPeriodId },
                attributes: ['id'],
                transaction,
            });
            const periodGradeIds = periodGrades.map(pg => pg.id);
            if (periodGradeIds.length === 0)
                return 0;
            const count = yield index_1.PeriodGradeSection.count({
                where: { periodGradeId: periodGradeIds },
                transaction,
            });
            return count;
        });
    }
    /**
     * Returns true if ALL sections of the school period are closed for the given term.
     */
    static areAllSectionsClosed(termId, schoolPeriodId, transaction) {
        return __awaiter(this, void 0, void 0, function* () {
            const term = yield index_1.Term.findByPk(termId, { attributes: ['id', 'isBlocked'], transaction });
            if (!term)
                return false;
            if (term.isBlocked)
                return true;
            const [closedSections, totalSections] = yield Promise.all([
                this.getClosedSections(termId, transaction),
                this.getTotalSectionsForPeriod(schoolPeriodId, transaction),
            ]);
            if (!closedSections)
                return true; // all closed (term globally blocked)
            if (totalSections === 0)
                return true; // no sections = vacuously true
            return closedSections.length >= totalSections;
        });
    }
    /**
     * Returns true if ALL terms of the school period have all their sections closed.
     */
    static areAllTermsFullyClosed(schoolPeriodId, transaction) {
        return __awaiter(this, void 0, void 0, function* () {
            const terms = yield index_1.Term.findAll({
                where: { schoolPeriodId },
                attributes: ['id', 'isBlocked'],
                transaction,
            });
            if (terms.length === 0)
                return true;
            for (const term of terms) {
                if (term.isBlocked)
                    continue;
                const allClosed = yield this.areAllSectionsClosed(term.id, schoolPeriodId, transaction);
                if (!allClosed)
                    return false;
            }
            return true;
        });
    }
    /**
     * Returns a summary of closure status for a term.
     */
    static getClosureStatus(termId, schoolPeriodId, transaction) {
        return __awaiter(this, void 0, void 0, function* () {
            const term = yield index_1.Term.findByPk(termId, { attributes: ['id', 'isBlocked'], transaction });
            if (!term) {
                return { closedSections: [], totalSections: 0, allClosed: false, termGloballyBlocked: false };
            }
            const [closedSections, totalSections] = yield Promise.all([
                this.getClosedSections(termId, transaction),
                this.getTotalSectionsForPeriod(schoolPeriodId, transaction),
            ]);
            const allClosed = closedSections === null || (totalSections > 0 && closedSections.length >= totalSections);
            return {
                closedSections,
                totalSections,
                allClosed,
                termGloballyBlocked: term.isBlocked,
            };
        });
    }
}
exports.TermSectionClosureService = TermSectionClosureService;
