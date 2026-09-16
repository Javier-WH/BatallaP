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
exports.TermGradeSyncService = void 0;
const index_1 = require("../models/index.js");
const gradeEvaluationService_1 = require("./gradeEvaluationService");
/**
 * TermGradeSyncService
 *
 * Single source of truth for per-lapso (term) grades.
 * Calculates the score for each term from qualifications + council points
 * and upserts the result into `subject_term_grades`.
 *
 * All views that need per-lapso grades (boletines, planillas, certified grades)
 * read from `SubjectTermGrade` to ensure consistency.
 */
class TermGradeSyncService {
    /**
     * Recalculates and persists term grades for a single InscriptionSubject.
     * Call this whenever a qualification or council point changes for that subject.
     */
    static syncForInscriptionSubject(inscriptionSubjectId_1) {
        return __awaiter(this, arguments, void 0, function* (inscriptionSubjectId, options = {}) {
            const insSub = yield index_1.InscriptionSubject.findByPk(inscriptionSubjectId, {
                include: [
                    {
                        model: index_1.Qualification,
                        as: 'qualifications',
                        include: [{ model: index_1.EvaluationPlan, as: 'evaluationPlan' }],
                    },
                    { model: index_1.CouncilPoint, as: 'councilPoints' },
                    { model: index_1.Inscription, as: 'inscription' },
                ],
                transaction: options.transaction,
            });
            if (!insSub)
                return;
            // Get the school period's terms
            const inscription = insSub.inscription;
            if (!inscription)
                return;
            const terms = yield index_1.Term.findAll({
                where: { schoolPeriodId: inscription.schoolPeriodId },
                transaction: options.transaction,
            });
            // Calculate score per term
            const termScores = {};
            terms.forEach((t) => { termScores[t.id] = 0; });
            (insSub.qualifications || []).forEach((q) => {
                var _a, _b;
                if (q.isAbsent)
                    return;
                const score = q.remedialScore != null && Number(q.remedialScore) > 0
                    ? Number(q.remedialScore)
                    : Number(q.score) || 0;
                const percentage = Number((_a = q.evaluationPlan) === null || _a === void 0 ? void 0 : _a.percentage) || 0;
                const termId = (_b = q.evaluationPlan) === null || _b === void 0 ? void 0 : _b.termId;
                if (termId && termScores[termId] !== undefined) {
                    termScores[termId] += score * (percentage / 100);
                }
            });
            (insSub.councilPoints || []).forEach((cp) => {
                const pVal = Number(cp.points) || 0;
                if (cp.termId && termScores[cp.termId] !== undefined) {
                    termScores[cp.termId] += pVal;
                }
            });
            // Upsert each term grade (rounded to integer)
            const now = new Date();
            for (const term of terms) {
                const rawScore = termScores[term.id] || 0;
                const roundedScore = (0, gradeEvaluationService_1.roundFinalGrade)(rawScore);
                yield index_1.SubjectTermGrade.upsert({
                    inscriptionSubjectId: insSub.id,
                    termId: term.id,
                    score: roundedScore,
                    calculatedAt: now,
                }, { transaction: options.transaction });
            }
        });
    }
    /**
     * Recalculates term grades for all subjects of an inscription.
     * Useful when multiple subjects are affected (e.g. bulk operations).
     */
    static syncForInscription(inscriptionId_1) {
        return __awaiter(this, arguments, void 0, function* (inscriptionId, options = {}) {
            const insSubs = yield index_1.InscriptionSubject.findAll({
                where: { inscriptionId },
                attributes: ['id', 'inscriptionId', 'schoolPeriodId', 'gradeId', 'subjectId', 'sectionId'],
                transaction: options.transaction,
            });
            for (const insSub of insSubs) {
                yield this.syncForInscriptionSubject(insSub.id, options);
            }
        });
    }
}
exports.TermGradeSyncService = TermGradeSyncService;
exports.default = TermGradeSyncService;
