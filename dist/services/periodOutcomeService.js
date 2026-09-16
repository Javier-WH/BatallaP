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
exports.PeriodOutcomeService = void 0;
const index_1 = require("../models/index.js");
class PeriodOutcomeService {
    static getOutcomesForPeriod(periodId_1) {
        return __awaiter(this, arguments, void 0, function* (periodId, filters = {}) {
            const outcomes = yield index_1.StudentPeriodOutcome.findAll({
                where: Object.assign({}, (filters.status ? { status: filters.status } : {})),
                include: [
                    {
                        model: index_1.Inscription,
                        as: 'inscription',
                        where: { schoolPeriodId: periodId },
                        include: [
                            { model: index_1.Person, as: 'student' },
                            { model: index_1.Grade, as: 'grade' },
                            { model: index_1.Section, as: 'section' },
                            {
                                model: index_1.PendingSubject,
                                as: 'pendingSubjects',
                                include: [{ model: index_1.Subject, as: 'subject' }]
                            }
                        ]
                    },
                    { model: index_1.Grade, as: 'promotionGrade' }
                ],
                order: [['failedSubjects', 'DESC']]
            });
            // Pending subjects within each outcome: sort alphabetically by subject.name
            // (cross-grade collection; canonical PeriodGrade order doesn't apply directly).
            outcomes.forEach((o) => {
                var _a;
                if (Array.isArray((_a = o.inscription) === null || _a === void 0 ? void 0 : _a.pendingSubjects)) {
                    o.inscription.pendingSubjects.sort((a, b) => { var _a, _b, _c, _d; return ((_b = (_a = a.subject) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : '').localeCompare((_d = (_c = b.subject) === null || _c === void 0 ? void 0 : _c.name) !== null && _d !== void 0 ? _d : '', 'es', { sensitivity: 'base' }); });
                }
            });
            return outcomes;
        });
    }
    static getPendingSubjectsByPeriod(periodId) {
        return __awaiter(this, void 0, void 0, function* () {
            const pending = yield index_1.PendingSubject.findAll({
                include: [
                    {
                        model: index_1.Inscription,
                        as: 'inscription',
                        where: { schoolPeriodId: periodId },
                        include: [
                            { model: index_1.Person, as: 'student' },
                            { model: index_1.Grade, as: 'grade' },
                            { model: index_1.Section, as: 'section' }
                        ]
                    },
                    { model: index_1.Subject, as: 'subject' }
                ],
                order: [['status', 'ASC'], ['updatedAt', 'DESC']]
            });
            return pending;
        });
    }
}
exports.PeriodOutcomeService = PeriodOutcomeService;
exports.default = PeriodOutcomeService;
