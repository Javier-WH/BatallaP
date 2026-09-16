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
exports.PeriodClosureService = void 0;
const index_1 = require("../models/index.js");
const database_1 = __importDefault(require("../config/database.js"));
const sequelize_1 = require("sequelize");
const termSectionClosureService_1 = require("./termSectionClosureService");
class PeriodClosureService {
    static getStatus(schoolPeriodId) {
        return __awaiter(this, void 0, void 0, function* () {
            const period = yield index_1.SchoolPeriod.findByPk(schoolPeriodId);
            if (!period) {
                throw new Error('Periodo escolar no encontrado');
            }
            const closure = yield index_1.PeriodClosure.findOne({
                where: { schoolPeriodId },
                order: [['createdAt', 'DESC']]
            });
            const [totalChecklist, completedChecklist] = yield Promise.all([
                index_1.CouncilChecklist.count({ where: { schoolPeriodId } }),
                index_1.CouncilChecklist.count({ where: { schoolPeriodId, status: 'done' } })
            ]);
            const checklist = {
                total: totalChecklist,
                done: completedChecklist
            };
            const terms = yield index_1.Term.findAll({
                where: { schoolPeriodId },
                attributes: ['id', 'isBlocked']
            });
            const blockedTerms = terms.filter((termRecord) => termRecord.isBlocked).length;
            const allFullyClosed = yield termSectionClosureService_1.TermSectionClosureService.areAllTermsFullyClosed(schoolPeriodId);
            const nextPeriod = yield index_1.SchoolPeriod.findOne({
                where: {
                    status: { [sequelize_1.Op.ne]: 'externo' },
                    startYear: { [sequelize_1.Op.gt]: period.startYear }
                },
                order: [['startYear', 'ASC'], ['endYear', 'ASC']],
                attributes: ['id', 'name', 'period', 'status']
            });
            return {
                period: {
                    id: period.id,
                    name: period.name,
                    period: period.period,
                    status: period.status,
                    isActive: period.isActive
                },
                nextPeriod: nextPeriod ? {
                    id: nextPeriod.id,
                    name: nextPeriod.name,
                    period: nextPeriod.period,
                    status: nextPeriod.status
                } : null,
                closure,
                checklist,
                blockedTerms,
                totalTerms: terms.length,
                allTermsFullyClosed: allFullyClosed
            };
        });
    }
    static getChecklistEntry(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const entry = yield index_1.CouncilChecklist.findOne({
                where: {
                    schoolPeriodId: params.schoolPeriodId,
                    gradeId: params.gradeId,
                    sectionId: params.sectionId,
                    termId: params.termId,
                },
            });
            return entry;
        });
    }
    /**
     * Returns all council checklist entries for a given school period and term.
     * Used by the section selector to badge sections whose council is already
     * marked as completed without issuing one request per section.
     */
    static listChecklistEntries(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const entries = yield index_1.CouncilChecklist.findAll({
                where: {
                    schoolPeriodId: params.schoolPeriodId,
                    termId: params.termId,
                },
                attributes: ['gradeId', 'sectionId', 'termId', 'status', 'completedAt'],
            });
            return entries;
        });
    }
    static upsertChecklistEntry(params) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const [entry] = yield index_1.CouncilChecklist.findOrCreate({
                where: {
                    schoolPeriodId: params.schoolPeriodId,
                    gradeId: params.gradeId,
                    sectionId: params.sectionId,
                    termId: params.termId
                },
                defaults: params
            });
            yield entry.update({
                status: params.status,
                completedBy: params.status === 'done' ? (_a = params.completedBy) !== null && _a !== void 0 ? _a : null : null,
                completedAt: params.status === 'done' ? new Date() : null
            });
            // Auto-transition: if marking done, check whether all sections of the active term are done
            if (params.status === 'done') {
                yield this.maybeAutoTransitionActiveTerm(params.schoolPeriodId, params.termId);
            }
            return entry;
        });
    }
    /**
     * If the auto_term_transition setting is enabled and the given termId is the
     * currently active term, check whether every grade+section combination in the
     * school period has a 'done' council checklist for that term. If so, activate
     * the next term (by order) and deactivate the current one.
     */
    static maybeAutoTransitionActiveTerm(schoolPeriodId, termId) {
        return __awaiter(this, void 0, void 0, function* () {
            const setting = yield index_1.Setting.findByPk('auto_term_transition');
            if (!setting || setting.value !== 'true')
                return;
            const activeTerm = yield index_1.Term.findOne({
                where: { schoolPeriodId, isActive: true }
            });
            if (!activeTerm || activeTerm.id !== termId)
                return;
            // Count total grade+section combinations for this school period, excluding
            // "MATERIA PENDIENTE" sections (they never have council checklists, matching
            // the frontend behavior in CourseCouncil.tsx).
            const totalSections = yield index_1.PeriodGradeSection.count({
                include: [
                    {
                        model: index_1.PeriodGrade,
                        as: 'periodGrade',
                        attributes: [],
                        where: { schoolPeriodId },
                        required: true
                    },
                    {
                        model: index_1.Section,
                        as: 'section',
                        attributes: [],
                        required: true,
                        where: {
                            name: { [sequelize_1.Op.notLike]: '%materia pendiente%' }
                        }
                    }
                ]
            });
            if (totalSections === 0)
                return;
            // Count done checklists for this term
            const doneChecklists = yield index_1.CouncilChecklist.count({
                where: { schoolPeriodId, termId, status: 'done' }
            });
            if (doneChecklists < totalSections)
                return;
            // All sections done → activate the next term (by order)
            const nextTerm = yield index_1.Term.findOne({
                where: { schoolPeriodId, order: { [sequelize_1.Op.gt]: activeTerm.order } },
                order: [['order', 'ASC']]
            });
            if (nextTerm) {
                const t = yield database_1.default.transaction();
                try {
                    yield index_1.Term.update({ isActive: false }, { where: { id: activeTerm.id }, transaction: t });
                    yield index_1.Term.update({ isActive: true }, { where: { id: nextTerm.id }, transaction: t });
                    yield t.commit();
                }
                catch (error) {
                    yield t.rollback();
                    console.error('[periodClosureService] Auto-transition failed:', error);
                }
            }
        });
    }
}
exports.PeriodClosureService = PeriodClosureService;
