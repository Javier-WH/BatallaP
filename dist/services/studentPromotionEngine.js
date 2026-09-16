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
exports.StudentPromotionEngine = void 0;
const sequelize_1 = require("sequelize");
const index_1 = require("../models/index.js");
const subjectOrderService_1 = require("./subjectOrderService");
class StudentPromotionEngine {
    static evaluateInscription(inscriptionId_1, summary_1) {
        return __awaiter(this, arguments, void 0, function* (inscriptionId, summary, options = {}) {
            var _a, _b, _c, _d, _e, _f, _g, _h;
            const persist = (_a = options.persist) !== null && _a !== void 0 ? _a : true;
            const inscription = (yield index_1.Inscription.findByPk(inscriptionId, {
                include: [{ model: index_1.StudentPeriodOutcome, as: 'periodOutcome' }],
                transaction: options.transaction
            }));
            if (!inscription) {
                throw new Error('Inscripción no encontrada');
            }
            const rule = yield index_1.SchoolPeriodTransitionRule.findOne({
                where: { gradeFromId: inscription.gradeId },
                transaction: options.transaction
            });
            const maxFailedSetting = yield index_1.Setting.findByPk('max_failed_subjects', { transaction: options.transaction });
            const maxFailedSubjects = maxFailedSetting ? parseInt(maxFailedSetting.value, 10) : 3;
            let status = StudentPromotionEngine.determineStatus(summary, maxFailedSubjects, rule);
            let promotionGradeId = yield StudentPromotionEngine.getPromotionGradeId(inscription.gradeId, status, rule, options);
            // --- Pending subjects evaluation (R5, R6, R7) ---
            // Discover MP records across the student's inscriptions in this period.
            // In production, pending subjects live in a SEPARATE materia_pendiente
            // inscription, not the regular/repeater one being evaluated here.
            const studentInscriptions = yield index_1.Inscription.findAll({
                where: {
                    schoolPeriodId: inscription.schoolPeriodId,
                    personId: inscription.personId,
                    withdrawnAt: null,
                },
                transaction: options.transaction,
            });
            // Pending subjects may be attached to any inscription for the student;
            // escolaridad is descriptive and must not restrict this lookup.
            const allInscriptionIds = Array.from(new Set([
                ...studentInscriptions.map(i => i.id),
                inscription.id,
            ]));
            const pendingSubjectsRecords = (yield index_1.PendingSubject.findAll({
                where: {
                    newInscriptionId: { [sequelize_1.Op.in]: allInscriptionIds },
                },
                include: [
                    {
                        model: index_1.Inscription,
                        as: 'inscription',
                        attributes: ['id', 'gradeId'],
                    },
                ],
                transaction: options.transaction,
            }));
            // Collect approved and failed pending subject IDs.
            // Per the documented rules:
            //   - status='aprobada' or 'convalidada' → resolved successfully
            //   - status='pendiente' at closure → FAILED (user clarification:
            //     an unresolved MP without a definitive result is considered failed)
            const approvedPendingSubjectIds = [];
            const failedPendingSubjectIds = [];
            const unresolvedPendingSubjects = [];
            for (const ps of pendingSubjectsRecords) {
                if (ps.status === 'aprobada' || ps.status === 'convalidada') {
                    approvedPendingSubjectIds.push(ps.subjectId);
                }
                else if (ps.status === 'pendiente') {
                    failedPendingSubjectIds.push(ps.subjectId);
                    unresolvedPendingSubjects.push({
                        subjectId: ps.subjectId,
                        gradeId: (_c = (_b = ps.inscription) === null || _b === void 0 ? void 0 : _b.gradeId) !== null && _c !== void 0 ? _c : inscription.gradeId,
                        originPeriodId: ps.originPeriodId,
                    });
                }
            }
            // R5: If the student fails any pending subject → rezagado (repeats current grade)
            let isRezagado = false;
            if (failedPendingSubjectIds.length > 0) {
                status = 'reprobado';
                promotionGradeId = inscription.gradeId; // repeat CURRENT grade, not the origin grade
                isRezagado = true;
            }
            // R9: Last grade — if no promotion grade exists and student failed anything → repeat
            if (promotionGradeId === null && summary.failedSubjects > 0) {
                status = 'reprobado';
                promotionGradeId = inscription.gradeId;
            }
            const graduatedAt = status === 'aprobado' && ((rule === null || rule === void 0 ? void 0 : rule.autoGraduate) || !promotionGradeId)
                ? (_d = options.now) !== null && _d !== void 0 ? _d : new Date()
                : null;
            const payload = {
                inscriptionId: inscription.id,
                finalAverage: summary.finalAverage,
                failedSubjects: summary.failedSubjects,
                status,
                promotionGradeId,
                graduatedAt,
                metadata: {
                    ruleId: (_e = rule === null || rule === void 0 ? void 0 : rule.id) !== null && _e !== void 0 ? _e : null,
                    maxPendingSubjects: (_f = rule === null || rule === void 0 ? void 0 : rule.maxPendingSubjects) !== null && _f !== void 0 ? _f : null,
                    evaluatedAt: ((_g = options.now) !== null && _g !== void 0 ? _g : new Date()).toISOString(),
                    isRezagado
                }
            };
            let outcome = null;
            if (persist) {
                outcome = (_h = inscription.periodOutcome) !== null && _h !== void 0 ? _h : null;
                if (outcome) {
                    yield outcome.update(payload, { transaction: options.transaction });
                }
                else {
                    outcome = yield index_1.StudentPeriodOutcome.create(payload, {
                        transaction: options.transaction
                    });
                }
            }
            // Exclude subjects flagged as "No Reparable" from pending subjects — they
            // cannot go to Materia Pendiente (Opción A: filtrar, no borrar).
            const notRepairableMap = yield (0, subjectOrderService_1.getSubjectNotRepairableMapByGradeAndPeriod)(inscription.gradeId, inscription.schoolPeriodId, options.transaction);
            const notRepairableSubjectIds = new Set();
            for (const [subjectId, notRepairable] of notRepairableMap.entries()) {
                if (notRepairable)
                    notRepairableSubjectIds.add(subjectId);
            }
            const pendingSubjects = summary.subjectResults.filter((subject) => subject.status === 'reprobada' && !notRepairableSubjectIds.has(subject.subjectId));
            const promotionGrade = promotionGradeId
                ? yield index_1.Grade.findByPk(promotionGradeId, { transaction: options.transaction })
                : null;
            return {
                outcome,
                pendingSubjects,
                promotionGrade,
                approvedPendingSubjectIds,
                failedPendingSubjectIds,
                unresolvedPendingSubjects,
                isRezagado,
                status,
                promotionGradeId,
                graduatedAt,
                finalAverage: summary.finalAverage,
                failedSubjects: summary.failedSubjects,
            };
        });
    }
    static determineStatus(summary, maxFailedSubjects, rule) {
        var _a, _b;
        const finalAverage = (_a = summary.finalAverage) !== null && _a !== void 0 ? _a : 0;
        const minAverage = Number((_b = rule === null || rule === void 0 ? void 0 : rule.minAverage) !== null && _b !== void 0 ? _b : 10);
        if (summary.failedSubjects === 0 && finalAverage >= minAverage) {
            return 'aprobado';
        }
        if (summary.failedSubjects > maxFailedSubjects) {
            return 'reprobado';
        }
        return 'materias_pendientes';
    }
    static getPromotionGradeId(currentGradeId_1, status_1, rule_1) {
        return __awaiter(this, arguments, void 0, function* (currentGradeId, status, rule, options = {}) {
            if (status === 'reprobado') {
                return currentGradeId;
            }
            if (rule === null || rule === void 0 ? void 0 : rule.gradeToId) {
                return rule.gradeToId;
            }
            // Fallback: try to find next grade by order
            const currentGrade = yield index_1.Grade.findByPk(currentGradeId, {
                transaction: options.transaction
            });
            if (currentGrade && typeof currentGrade.order === 'number') {
                const nextGrade = yield index_1.Grade.findOne({
                    where: { order: currentGrade.order + 1 },
                    transaction: options.transaction
                });
                if (nextGrade) {
                    return nextGrade.id;
                }
            }
            return null;
        });
    }
}
exports.StudentPromotionEngine = StudentPromotionEngine;
exports.default = StudentPromotionEngine;
