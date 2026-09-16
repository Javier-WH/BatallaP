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
exports.RevisionPeriodService = void 0;
exports.getPersonIdsWithUnresolvedPending = getPersonIdsWithUnresolvedPending;
const sequelize_1 = require("sequelize");
const index_1 = require("../models/index.js");
const gradeEvaluationService_1 = require("./gradeEvaluationService");
const termSectionClosureService_1 = require("./termSectionClosureService");
const subjectOrderService_1 = require("./subjectOrderService");
/**
 * Collect the personIds of students who still have unresolved pending
 * subjects (PendingSubject.status='pendiente') in the given school period.
 * PendingSubject links to the MP inscription, so we match through all
 * inscriptions of the period and exclude by student (personId).
 */
function getPersonIdsWithUnresolvedPending(schoolPeriodId, inscriptionIds, transaction) {
    return __awaiter(this, void 0, void 0, function* () {
        if (inscriptionIds.length === 0)
            return new Set();
        const pendingRows = yield index_1.PendingSubject.findAll({
            where: { newInscriptionId: { [sequelize_1.Op.in]: inscriptionIds }, status: 'pendiente' },
            attributes: ['newInscriptionId'],
            transaction,
        });
        if (pendingRows.length === 0)
            return new Set();
        const pendingInscriptionIds = new Set(pendingRows.map(p => p.newInscriptionId));
        const inscriptions = yield index_1.Inscription.findAll({
            where: { id: { [sequelize_1.Op.in]: Array.from(pendingInscriptionIds) } },
            attributes: ['id', 'personId'],
            transaction,
        });
        return new Set(inscriptions.map(i => i.personId));
    });
}
class RevisionPeriodService {
    static getOrCreate(schoolPeriodId, transaction) {
        return __awaiter(this, void 0, void 0, function* () {
            const [revisionPeriod] = yield index_1.RevisionPeriod.findOrCreate({
                where: { schoolPeriodId },
                defaults: { schoolPeriodId },
                transaction,
            });
            return revisionPeriod;
        });
    }
    static getSummary(schoolPeriodId, transaction) {
        return __awaiter(this, void 0, void 0, function* () {
            const revisionPeriod = yield index_1.RevisionPeriod.findOne({
                where: { schoolPeriodId },
                transaction,
            });
            const councilChecklists = yield index_1.CouncilChecklist.findAll({
                where: { schoolPeriodId },
                transaction,
            });
            const totalChecklists = councilChecklists.length;
            const doneChecklists = councilChecklists.filter(c => c.status === 'done').length;
            const allTerms = yield index_1.Term.findAll({
                where: { schoolPeriodId },
                transaction,
            });
            const totalTerms = allTerms.length;
            const blockedTerms = allTerms.filter(t => t.isBlocked).length;
            // Check if all terms are fully closed (globally blocked or all sections closed)
            const allFullyClosed = yield termSectionClosureService_1.TermSectionClosureService.areAllTermsFullyClosed(schoolPeriodId, transaction);
            let stats;
            if (revisionPeriod) {
                const revisions = yield index_1.InscriptionSubjectRevision.findAll({
                    where: { revisionPeriodId: revisionPeriod.id },
                    transaction,
                });
                const inscriptionSubjectIds = new Set(revisions.map(r => r.inscriptionSubjectId));
                stats = {
                    totalSubjects: inscriptionSubjectIds.size,
                    approvedCount: revisions.filter(r => r.status === 'approved').length,
                    failedCount: revisions.filter(r => r.status === 'failed').length,
                    pendingCount: revisions.filter(r => r.status === 'pending').length,
                    totalStudents: 0,
                };
                if (inscriptionSubjectIds.size > 0) {
                    const insSubjects = yield index_1.InscriptionSubject.findAll({
                        where: { id: Array.from(inscriptionSubjectIds) },
                        attributes: ['id', 'inscriptionId'],
                        transaction,
                    });
                    const studentIds = new Set(insSubjects.map(s => s.inscriptionId));
                    stats.totalStudents = studentIds.size;
                }
            }
            return {
                revisionPeriod,
                councilStatus: { totalChecklists, doneChecklists, allDone: totalChecklists > 0 && totalChecklists === doneChecklists },
                termsStatus: { totalTerms, blockedTerms, allBlocked: totalTerms > 0 && allFullyClosed },
                stats,
            };
        });
    }
    static openRevisionPeriod(schoolPeriodId, transaction) {
        return __awaiter(this, void 0, void 0, function* () {
            const period = yield index_1.SchoolPeriod.findByPk(schoolPeriodId, { transaction });
            if (!period)
                throw new Error('Período escolar no encontrado');
            if (period.status !== 'activo')
                throw new Error('El período escolar no está activo');
            const terms = yield index_1.Term.findAll({
                where: { schoolPeriodId },
                transaction,
            });
            const allFullyClosed = yield termSectionClosureService_1.TermSectionClosureService.areAllTermsFullyClosed(schoolPeriodId, transaction);
            if (!allFullyClosed) {
                throw new Error('Todos los lapsos deben tener todas sus secciones cerradas antes de abrir el período de revisión');
            }
            const councilChecklists = yield index_1.CouncilChecklist.findAll({
                where: { schoolPeriodId },
                transaction,
            });
            if (councilChecklists.length === 0) {
                throw new Error('No hay consejos de curso registrados para este período');
            }
            const allDone = councilChecklists.every(c => c.status === 'done');
            if (!allDone) {
                throw new Error('Todos los consejos de curso deben estar completos (status=done)');
            }
            const passingGradeSetting = yield index_1.Setting.findOne({
                where: { key: 'passing_grade' },
                transaction,
            });
            const passingGrade = Number(passingGradeSetting === null || passingGradeSetting === void 0 ? void 0 : passingGradeSetting.value) || 10;
            const maxOppSetting = yield index_1.Setting.findOne({
                where: { key: 'revision_max_opportunities' },
                transaction,
            });
            const maxOpportunities = Number(maxOppSetting === null || maxOppSetting === void 0 ? void 0 : maxOppSetting.value) || 3;
            const [revisionPeriod] = yield index_1.RevisionPeriod.findOrCreate({
                where: { schoolPeriodId },
                defaults: { schoolPeriodId },
                transaction,
            });
            if (revisionPeriod.status === 'open') {
                throw new Error('El período de revisión ya está abierto');
            }
            if (revisionPeriod.status === 'closed') {
                throw new Error('El período de revisión ya fue cerrado');
            }
            yield revisionPeriod.update({
                status: 'open',
                maxOpportunities,
                passingGrade,
                currentOpportunity: 1,
                openedAt: new Date(),
            }, { transaction });
            // Calculate failed subjects from SubjectTermGrade (single source of truth,
            // already rounded and synced by TermGradeSyncService).
            const allInscriptions = yield index_1.Inscription.findAll({
                where: { schoolPeriodId },
                include: [
                    {
                        model: index_1.InscriptionSubject,
                        as: 'inscriptionSubjects',
                        include: [
                            { model: index_1.SubjectTermGrade, as: 'termGrades' },
                        ],
                    },
                ],
                transaction,
            });
            // Cache of notRepairable subject IDs per gradeId, so we can skip subjects
            // flagged as "No Reparable" when collecting failed subjects.
            const notRepairableCache = new Map();
            const resolveNotRepairable = (gradeId) => __awaiter(this, void 0, void 0, function* () {
                if (!gradeId)
                    return new Set();
                if (notRepairableCache.has(gradeId))
                    return notRepairableCache.get(gradeId);
                const map = yield (0, subjectOrderService_1.getSubjectNotRepairableMapByGradeAndPeriod)(gradeId, schoolPeriodId, transaction);
                const set = new Set();
                for (const [subjectId, notRepairable] of map.entries()) {
                    if (notRepairable)
                        set.add(subjectId);
                }
                notRepairableCache.set(gradeId, set);
                return set;
            });
            const termIds = terms.map(t => t.id);
            const termCount = terms.length || 1;
            // Students with unresolved pending subjects (Materia Pendiente) are
            // excluded from the revision process entirely — they will repeat the
            // grade at closure if they fail their pending subjects, so repairing
            // regular subjects would be meaningless.
            const inscriptionIdList = allInscriptions.map(i => i.id);
            const excludedPersonIds = yield getPersonIdsWithUnresolvedPending(schoolPeriodId, inscriptionIdList, transaction);
            // Pending subjects (any status) never go to revision — their grades
            // live in the Materia Pendiente flow, not the repair nomina.
            const pendingSubjectRows = yield index_1.PendingSubject.findAll({
                where: { newInscriptionId: { [sequelize_1.Op.in]: inscriptionIdList } },
                attributes: ['newInscriptionId', 'subjectId'],
                transaction,
            });
            const pendingSubjectSet = new Set(pendingSubjectRows.map(p => `${p.newInscriptionId}-${p.subjectId}`));
            const failedSubjects = [];
            const uniqueSet = new Set();
            for (const ins of allInscriptions) {
                // Skip students who still owe pending subjects — they cannot go to revision.
                if (excludedPersonIds.has(ins.personId))
                    continue;
                const insSubjects = ins.inscriptionSubjects || [];
                const notRepairableSet = yield resolveNotRepairable(ins.gradeId);
                for (const insSub of insSubjects) {
                    if (uniqueSet.has(insSub.id))
                        continue;
                    uniqueSet.add(insSub.id);
                    // Skip pending subjects — their grades belong to the MP flow, never to revision.
                    if (pendingSubjectSet.has(`${ins.id}-${insSub.subjectId}`))
                        continue;
                    // Use SubjectTermGrade (already rounded per-lapso) and average them
                    const termGrades = insSub.termGrades || [];
                    const scoresByTerm = {};
                    termIds.forEach(tid => { scoresByTerm[tid] = 0; });
                    let foundAny = false;
                    for (const tg of termGrades) {
                        if (termIds.includes(tg.termId)) {
                            scoresByTerm[tg.termId] = Number(tg.score) || 0;
                            foundAny = true;
                        }
                    }
                    if (!foundAny)
                        continue;
                    let totalAccumulated = 0;
                    Object.values(scoresByTerm).forEach(v => { totalAccumulated += v; });
                    const finalScore = totalAccumulated / termCount;
                    if (!(0, gradeEvaluationService_1.isPassingGrade)(finalScore, passingGrade)) {
                        failedSubjects.push({ inscriptionSubjectId: insSub.id });
                    }
                }
            }
            let revisionsCreated = 0;
            for (const fs of failedSubjects) {
                yield index_1.InscriptionSubjectRevision.create({
                    revisionPeriodId: revisionPeriod.id,
                    inscriptionSubjectId: fs.inscriptionSubjectId,
                    opportunity: 1,
                    status: 'pending',
                }, { transaction });
                revisionsCreated++;
            }
            return { revisionPeriod, revisionsCreated };
        });
    }
    /**
     * Lock the revision period (status='closed').
     *
     * This is set by periodClosureExecutor after the school year closure, or
     * can be called manually to prevent further edits. It does NOT trigger
     * grade calculation — that happens at 'completed'.
     *
     * Can be called from any non-pending status (open or completed) to allow
     * Control de Estudios to block the period at will.
     */
    static lockRevisionPeriod(schoolPeriodId, transaction) {
        return __awaiter(this, void 0, void 0, function* () {
            const revisionPeriod = yield index_1.RevisionPeriod.findOne({
                where: { schoolPeriodId },
                transaction,
            });
            if (!revisionPeriod)
                throw new Error('No existe un período de revisión para este período escolar');
            if (revisionPeriod.status === 'closed') {
                return revisionPeriod; // already locked, idempotent
            }
            if (revisionPeriod.status === 'pending') {
                throw new Error('El período de revisión no ha sido abierto');
            }
            yield revisionPeriod.update({
                status: 'closed',
                closedAt: new Date(),
            }, { transaction });
            return revisionPeriod;
        });
    }
    /**
     * Reopen a completed or closed revision period back to 'open' so that
     * professors can continue editing grades. Does NOT recreate revisions.
     */
    static reopenRevisionPeriod(schoolPeriodId, transaction) {
        return __awaiter(this, void 0, void 0, function* () {
            const revisionPeriod = yield index_1.RevisionPeriod.findOne({
                where: { schoolPeriodId },
                transaction,
            });
            if (!revisionPeriod)
                throw new Error('No existe un período de revisión para este período escolar');
            if (revisionPeriod.status === 'open') {
                return revisionPeriod; // already open, idempotent
            }
            if (revisionPeriod.status === 'pending') {
                throw new Error('El período de revisión no ha sido abierto todavía');
            }
            yield revisionPeriod.update({
                status: 'open',
                closedAt: null,
            }, { transaction });
            // When reopening, reset auto-marked NP entries (gradedBy=null, isAbsent=true)
            // at the current opportunity back to pending — they were auto-failed
            // but the opportunity hasn't been formally passed.
            // Only reset entries at the current opportunity; entries from earlier
            // opportunities (opportunity < currentOpportunity) were genuinely passed
            // and should remain as NP.
            yield index_1.InscriptionSubjectRevision.update({ score: null, status: 'pending', isAbsent: false, gradedAt: null }, {
                where: {
                    revisionPeriodId: revisionPeriod.id,
                    opportunity: revisionPeriod.currentOpportunity,
                    isAbsent: true,
                    gradedBy: null,
                },
                transaction,
            });
            return revisionPeriod;
        });
    }
    /**
     * Update the maxOpportunities of a revision period. Allowed from any
     * non-pending status except 'closed' (locked).
     */
    static updateMaxOpportunities(schoolPeriodId, maxOpportunities, transaction) {
        return __awaiter(this, void 0, void 0, function* () {
            const revisionPeriod = yield index_1.RevisionPeriod.findOne({
                where: { schoolPeriodId },
                transaction,
            });
            if (!revisionPeriod)
                throw new Error('No existe un período de revisión para este período escolar');
            if (revisionPeriod.status === 'closed') {
                throw new Error('El período de revisión está bloqueado y no puede modificarse');
            }
            if (revisionPeriod.status === 'pending') {
                throw new Error('El período de revisión no ha sido abierto');
            }
            if (!Number.isInteger(maxOpportunities) || maxOpportunities < 1) {
                throw new Error('El número de intentos debe ser un entero mayor o igual a 1');
            }
            const oldMax = revisionPeriod.maxOpportunities;
            yield revisionPeriod.update({ maxOpportunities }, { transaction });
            // If the new max is lower than the old max, delete revisions with
            // opportunity > new maxOpportunities (excess opportunities).
            if (maxOpportunities < oldMax) {
                yield index_1.InscriptionSubjectRevision.destroy({
                    where: {
                        revisionPeriodId: revisionPeriod.id,
                        opportunity: { [sequelize_1.Op.gt]: maxOpportunities },
                    },
                    transaction,
                });
            }
            return revisionPeriod;
        });
    }
    /**
     * Recalculate failed subjects based on current grades.
     * - Keeps revisions that already have a grade (approved/failed) intact.
     * - Deletes pending revisions for subjects that are now passing.
     * - Creates pending revisions for newly-failed subjects (that don't already have one).
     * Only works when the revision period is 'open'.
     */
    static recalculateRevisionPeriod(schoolPeriodId, transaction) {
        return __awaiter(this, void 0, void 0, function* () {
            const revisionPeriod = yield index_1.RevisionPeriod.findOne({
                where: { schoolPeriodId },
                transaction,
            });
            if (!revisionPeriod)
                throw new Error('No existe un período de revisión para este período escolar');
            if (revisionPeriod.status !== 'open') {
                throw new Error('El período de revisión debe estar abierto para recalcular');
            }
            const terms = yield index_1.Term.findAll({ where: { schoolPeriodId }, transaction });
            const termIds = terms.map(t => t.id);
            const termCount = terms.length || 1;
            const passingGrade = revisionPeriod.passingGrade || 10;
            // Recalculate final scores from SubjectTermGrade (single source of truth)
            const allInscriptions = yield index_1.Inscription.findAll({
                where: { schoolPeriodId },
                include: [
                    {
                        model: index_1.InscriptionSubject,
                        as: 'inscriptionSubjects',
                        include: [
                            { model: index_1.SubjectTermGrade, as: 'termGrades' },
                        ],
                    },
                ],
                transaction,
            });
            // Build set of currently-failed inscriptionSubjectIds.
            // Students with unresolved pending subjects are excluded — no new
            // revisions are created for them (existing ones are hidden by the
            // students endpoint).
            const inscriptionIdList = allInscriptions.map(i => i.id);
            const excludedPersonIds = yield getPersonIdsWithUnresolvedPending(schoolPeriodId, inscriptionIdList, transaction);
            // Pending subjects (any status) never go to revision — their grades
            // live in the Materia Pendiente flow, not the repair nomina.
            const pendingSubjectRows = yield index_1.PendingSubject.findAll({
                where: { newInscriptionId: { [sequelize_1.Op.in]: inscriptionIdList } },
                attributes: ['newInscriptionId', 'subjectId'],
                transaction,
            });
            const pendingSubjectSet = new Set(pendingSubjectRows.map(p => `${p.newInscriptionId}-${p.subjectId}`));
            const failedSubjectIds = new Set();
            for (const ins of allInscriptions) {
                if (excludedPersonIds.has(ins.personId))
                    continue;
                const insSubjects = ins.inscriptionSubjects || [];
                for (const insSub of insSubjects) {
                    // Skip pending subjects — their grades belong to the MP flow, never to revision.
                    if (pendingSubjectSet.has(`${ins.id}-${insSub.subjectId}`))
                        continue;
                    const termGrades = insSub.termGrades || [];
                    const scoresByTerm = {};
                    termIds.forEach(tid => { scoresByTerm[tid] = 0; });
                    let foundAny = false;
                    for (const tg of termGrades) {
                        if (termIds.includes(tg.termId)) {
                            scoresByTerm[tg.termId] = Number(tg.score) || 0;
                            foundAny = true;
                        }
                    }
                    if (!foundAny)
                        continue;
                    let totalAccumulated = 0;
                    Object.values(scoresByTerm).forEach(v => { totalAccumulated += v; });
                    const finalScore = totalAccumulated / termCount;
                    if (!(0, gradeEvaluationService_1.isPassingGrade)(finalScore, passingGrade)) {
                        failedSubjectIds.add(insSub.id);
                    }
                }
            }
            // Get all existing revisions for this period
            const existingRevisions = yield index_1.InscriptionSubjectRevision.findAll({
                where: { revisionPeriodId: revisionPeriod.id },
                transaction,
            });
            // Group by inscriptionSubjectId
            const revisionsBySubject = new Map();
            for (const rev of existingRevisions) {
                if (!revisionsBySubject.has(rev.inscriptionSubjectId)) {
                    revisionsBySubject.set(rev.inscriptionSubjectId, []);
                }
                revisionsBySubject.get(rev.inscriptionSubjectId).push(rev);
            }
            let created = 0;
            let removed = 0;
            // Remove pending revisions for subjects that are now passing
            for (const rev of existingRevisions) {
                if (rev.status === 'pending' && !failedSubjectIds.has(rev.inscriptionSubjectId)) {
                    yield rev.destroy({ transaction });
                    removed++;
                }
            }
            // Create pending revisions (opportunity 1) for newly-failed subjects
            // that don't already have any revision
            for (const subjId of failedSubjectIds) {
                const existing = revisionsBySubject.get(subjId);
                if (!existing || existing.length === 0) {
                    yield index_1.InscriptionSubjectRevision.create({
                        revisionPeriodId: revisionPeriod.id,
                        inscriptionSubjectId: subjId,
                        opportunity: 1,
                        status: 'pending',
                    }, { transaction });
                    created++;
                }
            }
            return { revisionPeriod, created, removed };
        });
    }
    /**
     * Reset the revision period back to 'pending' state.
     * Deletes ALL revision records and resets the period as if it was never opened.
     * Only Master role can call this (enforced in the controller).
     */
    static resetRevisionPeriod(schoolPeriodId, transaction) {
        return __awaiter(this, void 0, void 0, function* () {
            const revisionPeriod = yield index_1.RevisionPeriod.findOne({
                where: { schoolPeriodId },
                transaction,
            });
            if (!revisionPeriod)
                throw new Error('No existe un período de revisión para este período escolar');
            // Delete all revision records
            const deleted = yield index_1.InscriptionSubjectRevision.destroy({
                where: { revisionPeriodId: revisionPeriod.id },
                transaction,
            });
            // Reset the period to pending
            yield revisionPeriod.update({
                status: 'pending',
                currentOpportunity: 1,
                openedAt: null,
                completedAt: null,
                completedBy: null,
                closedAt: null,
            }, { transaction });
            return { revisionPeriod, deleted };
        });
    }
    /**
     * Advance the currentOpportunity counter by 1. Only allowed when the
     * revision period is 'open' and currentOpportunity < maxOpportunities.
     */
    static advanceOpportunity(schoolPeriodId, transaction) {
        return __awaiter(this, void 0, void 0, function* () {
            const revisionPeriod = yield index_1.RevisionPeriod.findOne({
                where: { schoolPeriodId },
                transaction,
            });
            if (!revisionPeriod)
                throw new Error('No existe un período de revisión para este período escolar');
            if (revisionPeriod.status !== 'open') {
                throw new Error('El período de revisión no está abierto');
            }
            if (revisionPeriod.currentOpportunity >= revisionPeriod.maxOpportunities) {
                throw new Error('Ya está en la última oportunidad, no se puede avanzar más');
            }
            // Closing an opportunity without a grade means the student was absent.
            yield index_1.InscriptionSubjectRevision.update({ score: 0, status: 'failed', isAbsent: true }, {
                where: {
                    revisionPeriodId: revisionPeriod.id,
                    opportunity: revisionPeriod.currentOpportunity,
                    status: 'pending',
                    score: null,
                },
                transaction,
            });
            yield revisionPeriod.update({
                currentOpportunity: revisionPeriod.currentOpportunity + 1,
            }, { transaction });
            return revisionPeriod;
        });
    }
    /**
     * Set the currentOpportunity to a specific value. Only allowed when the
     * revision period is 'open'. The target must be between 1 and maxOpportunities.
     */
    static setOpportunity(schoolPeriodId, opportunity, transaction) {
        return __awaiter(this, void 0, void 0, function* () {
            const revisionPeriod = yield index_1.RevisionPeriod.findOne({
                where: { schoolPeriodId },
                transaction,
            });
            if (!revisionPeriod)
                throw new Error('No existe un período de revisión para este período escolar');
            if (revisionPeriod.status !== 'open') {
                throw new Error('El período de revisión no está abierto');
            }
            if (!Number.isInteger(opportunity) || opportunity < 1 || opportunity > revisionPeriod.maxOpportunities) {
                throw new Error(`La oportunidad debe estar entre 1 y ${revisionPeriod.maxOpportunities}`);
            }
            // Any skipped opportunity is closed. Pending entries without a grade are
            // recorded as absences; the selected opportunity remains editable.
            yield index_1.InscriptionSubjectRevision.update({ score: 0, status: 'failed', isAbsent: true }, {
                where: {
                    revisionPeriodId: revisionPeriod.id,
                    opportunity: { [sequelize_1.Op.lt]: opportunity },
                    status: 'pending',
                    score: null,
                },
                transaction,
            });
            yield revisionPeriod.update({
                currentOpportunity: opportunity,
            }, { transaction });
            return revisionPeriod;
        });
    }
}
exports.RevisionPeriodService = RevisionPeriodService;
