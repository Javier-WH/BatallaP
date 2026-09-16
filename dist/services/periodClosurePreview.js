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
exports.PeriodClosurePreview = void 0;
const index_1 = require("../models/index.js");
const finalGradeCalculator_1 = require("./finalGradeCalculator");
const studentPromotionEngine_1 = require("./studentPromotionEngine");
const periodClosureStudentService_1 = require("./periodClosureStudentService");
class PeriodClosurePreview {
    static calculatePreview(schoolPeriodId) {
        return __awaiter(this, void 0, void 0, function* () {
            const minApprovalSetting = yield index_1.Setting.findByPk('min_approval_grade');
            const minApproval = minApprovalSetting ? Number(minApprovalSetting.value) : 10;
            // Load all active inscriptions and consolidate principal + MP inscriptions
            // by person. `escolaridad` is descriptive, not a selection filter.
            const studentGroups = (0, periodClosureStudentService_1.sortClosureStudentGroups)(yield (0, periodClosureStudentService_1.loadClosureStudentGroups)(schoolPeriodId));
            const previews = [];
            for (const group of studentGroups) {
                const inscription = group.referenceInscription;
                try {
                    // Use the SAME full calculation as the executor (recalculates from
                    // qualifications + council points + repair grades) but with
                    // persist=false so nothing is written. Guarantees the preview shows
                    // exactly what the real closure will compute.
                    const summary = yield finalGradeCalculator_1.FinalGradeCalculator.calculateForInscription(inscription.id, { minApproval, persist: false });
                    // Preview mode: persist=false → no StudentPeriodOutcome is created/updated.
                    const evaluation = yield studentPromotionEngine_1.StudentPromotionEngine.evaluateInscription(inscription.id, summary, { persist: false });
                    const { promotionGrade, approvedPendingSubjectIds, failedPendingSubjectIds, isRezagado, status, graduatedAt, finalAverage, failedSubjects } = evaluation;
                    // Collect the names of failed subjects for the tooltip
                    const failedSubjectNames = summary.subjectResults
                        .filter(r => r.status === 'reprobada')
                        .map(r => r.subjectName || `Materia #${r.subjectId}`);
                    previews.push({
                        inscriptionId: inscription.id,
                        finalAverage,
                        failedSubjects,
                        failedSubjectNames,
                        status,
                        isRezagado,
                        graduatedAt,
                        approvedPendingSubjects: approvedPendingSubjectIds.length,
                        failedPendingSubjects: failedPendingSubjectIds.length,
                        promotionGrade: promotionGrade ? {
                            id: promotionGrade.id,
                            name: promotionGrade.name
                        } : null,
                        inscription: {
                            id: inscription.id,
                            grade: inscription.grade ? {
                                id: inscription.grade.id,
                                name: inscription.grade.name,
                                order: inscription.grade.order,
                            } : undefined,
                            section: inscription.section ? {
                                id: inscription.section.id,
                                name: inscription.section.name
                            } : null,
                            student: inscription.student ? {
                                id: inscription.student.id,
                                firstName: inscription.student.firstName,
                                lastName: inscription.student.lastName,
                                document: inscription.student.document
                            } : undefined
                        }
                    });
                }
                catch (error) {
                    console.error(`Error calculating preview for inscription ${inscription.id}:`, error);
                }
            }
            // Sort by grade order, then section name, then student document (cedula)
            const naturalCollator = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });
            previews.sort((a, b) => {
                var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
                const gradeOrderA = (_b = (_a = a.inscription.grade) === null || _a === void 0 ? void 0 : _a.order) !== null && _b !== void 0 ? _b : Number.MAX_SAFE_INTEGER;
                const gradeOrderB = (_d = (_c = b.inscription.grade) === null || _c === void 0 ? void 0 : _c.order) !== null && _d !== void 0 ? _d : Number.MAX_SAFE_INTEGER;
                if (gradeOrderA !== gradeOrderB)
                    return gradeOrderA - gradeOrderB;
                const sectionA = (_f = (_e = a.inscription.section) === null || _e === void 0 ? void 0 : _e.name) !== null && _f !== void 0 ? _f : '';
                const sectionB = (_h = (_g = b.inscription.section) === null || _g === void 0 ? void 0 : _g.name) !== null && _h !== void 0 ? _h : '';
                const sectionCmp = sectionA.localeCompare(sectionB, 'es', { sensitivity: 'base' });
                if (sectionCmp !== 0)
                    return sectionCmp;
                const docA = (_k = (_j = a.inscription.student) === null || _j === void 0 ? void 0 : _j.document) !== null && _k !== void 0 ? _k : '';
                const docB = (_m = (_l = b.inscription.student) === null || _l === void 0 ? void 0 : _l.document) !== null && _m !== void 0 ? _m : '';
                return docA.localeCompare(docB, 'es', { numeric: true });
            });
            return previews;
        });
    }
}
exports.PeriodClosurePreview = PeriodClosurePreview;
exports.default = PeriodClosurePreview;
