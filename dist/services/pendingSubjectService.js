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
exports.PendingSubjectService = void 0;
const index_1 = require("../models/index.js");
const subjectOrderService_1 = require("./subjectOrderService");
class PendingSubjectService {
    static syncPendingSubjects(newInscriptionId_1, originPeriodId_1, subjects_1) {
        return __awaiter(this, arguments, void 0, function* (newInscriptionId, originPeriodId, subjects, options = {}) {
            // Exclude subjects flagged as "No Reparable" — they cannot go to Materia Pendiente.
            let notRepairableSubjectIds = new Set();
            if (options.gradeId && options.schoolPeriodId) {
                const map = yield (0, subjectOrderService_1.getSubjectNotRepairableMapByGradeAndPeriod)(options.gradeId, options.schoolPeriodId, options.transaction);
                for (const [subjectId, notRepairable] of map.entries()) {
                    if (notRepairable)
                        notRepairableSubjectIds.add(subjectId);
                }
            }
            const pending = subjects.filter((s) => s.status === 'reprobada' && !notRepairableSubjectIds.has(s.subjectId));
            for (const subject of pending) {
                yield index_1.PendingSubject.upsert({
                    newInscriptionId,
                    originPeriodId,
                    subjectId: subject.subjectId,
                    status: 'pendiente',
                    resolvedAt: null
                }, {
                    transaction: options.transaction,
                    conflictFields: ['newInscriptionId', 'subjectId']
                } // conflictFields supported on mysql? fallback
                );
            }
            if (pending.length === 0) {
                yield index_1.PendingSubject.destroy({
                    where: { newInscriptionId },
                    transaction: options.transaction
                });
            }
            return pending.length;
        });
    }
    static resolvePendingSubject(pendingSubjectId, status) {
        return __awaiter(this, void 0, void 0, function* () {
            const pending = yield index_1.PendingSubject.findByPk(pendingSubjectId);
            if (!pending) {
                throw new Error('Materia pendiente no encontrada');
            }
            yield pending.update({
                status,
                resolvedAt: new Date()
            });
            return pending;
        });
    }
}
exports.PendingSubjectService = PendingSubjectService;
exports.default = PendingSubjectService;
