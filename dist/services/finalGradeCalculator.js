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
exports.FinalGradeCalculator = void 0;
const sequelize_1 = require("sequelize");
const index_1 = require("../models/index.js");
const subjectOrderService_1 = require("./subjectOrderService");
const subjectGroupService_1 = require("./subjectGroupService");
const gradeEvaluationService_1 = require("./gradeEvaluationService");
const termGradeSyncService_1 = require("./termGradeSyncService");
const gradeCalculationService_1 = require("./gradeCalculationService");
const resolveInstitutionPlantelId = (transaction) => __awaiter(void 0, void 0, void 0, function* () {
    const setting = yield index_1.Setting.findOne({ where: { key: 'institution_dea_code' }, transaction });
    const deaCode = setting === null || setting === void 0 ? void 0 : setting.getDataValue('value');
    if (!deaCode)
        return null;
    const plantel = yield index_1.Plantel.findOne({ where: { code: deaCode }, transaction });
    if (!plantel) {
        console.warn(`[FinalGradeCalculator] Plantel con código DEA "${deaCode}" no encontrado en la base de datos`);
        return null;
    }
    return plantel.id;
});
class FinalGradeCalculator {
    static calculateForInscription(inscriptionId_1) {
        return __awaiter(this, arguments, void 0, function* (inscriptionId, options = {}) {
            var _a, _b, _c, _d, _e, _f, _g;
            const persist = (_a = options.persist) !== null && _a !== void 0 ? _a : true;
            const inscription = yield index_1.Inscription.findByPk(inscriptionId, {
                include: [
                    {
                        model: index_1.InscriptionSubject,
                        as: 'inscriptionSubjects',
                        include: [
                            {
                                model: index_1.Qualification,
                                as: 'qualifications',
                                include: [{ model: index_1.EvaluationPlan, as: 'evaluationPlan' }]
                            },
                            { model: index_1.CouncilPoint, as: 'councilPoints' },
                            { model: index_1.Subject, as: 'subject' }
                        ]
                    },
                ],
                transaction: options.transaction
            });
            // Correct way to get period ID
            const inscriptionSimple = yield index_1.Inscription.findByPk(inscriptionId, {
                attributes: ['schoolPeriodId', 'gradeId'],
                transaction: options.transaction
            });
            if (!inscriptionSimple)
                throw new Error('Inscripción no encontrada');
            // Fetch terms to know the divisor
            const terms = yield index_1.Term.findAll({
                where: { schoolPeriodId: inscriptionSimple.schoolPeriodId },
                transaction: options.transaction
            });
            const termCount = terms.length || 1;
            // Re-fetch full inscription (using existing logic but simpler query structure if needed, keeping original works)
            const inscriptionRecord = yield index_1.Inscription.findByPk(inscriptionId, {
                include: [
                    {
                        model: index_1.InscriptionSubject,
                        as: 'inscriptionSubjects',
                        include: [
                            {
                                model: index_1.Qualification,
                                as: 'qualifications',
                                include: [{ model: index_1.EvaluationPlan, as: 'evaluationPlan' }]
                            },
                            { model: index_1.CouncilPoint, as: 'councilPoints' },
                            { model: index_1.Subject, as: 'subject' },
                            { model: index_1.SubjectTermGrade, as: 'termGrades' }
                        ]
                    }
                ],
                transaction: options.transaction
            });
            if (!inscriptionRecord || !inscriptionRecord.inscriptionSubjects) {
                throw new Error('Inscripción no encontrada o sin materias asociadas');
            }
            // Apply canonical subject order before iterating
            const orderMap = yield (0, subjectOrderService_1.getSubjectOrderMapByGradeAndPeriod)(inscriptionSimple.gradeId, inscriptionSimple.schoolPeriodId, options.transaction);
            // Load includeInAverage map so the final average only counts eligible subjects
            const includeInAverageMap = yield (0, subjectOrderService_1.getSubjectIncludeInAverageMapByGradeAndPeriod)(inscriptionSimple.gradeId, inscriptionSimple.schoolPeriodId, options.transaction);
            // Load notRepairable map so subjects flagged with BOTH notRepairable=true
            // AND includeInAverage=false can be excluded from the closure entirely
            // (not counted as failed, not in average, no pending subject).
            const notRepairableMap = yield (0, subjectOrderService_1.getSubjectNotRepairableMapByGradeAndPeriod)(inscriptionSimple.gradeId, inscriptionSimple.schoolPeriodId, options.transaction);
            // Resolve group subjects per term before calculating the annual final.
            // A student may switch subjects inside the same SubjectGroup between
            // lapsos; using one historical InscriptionSubject for every term would
            // calculate the wrong final grade.
            const orderedSubjects = (0, subjectOrderService_1.sortSubjectsByOrder)(inscriptionRecord.inscriptionSubjects, (is) => is.subjectId, (is) => { var _a; return (_a = is.subject) === null || _a === void 0 ? void 0 : _a.name; }, orderMap);
            const latestTerm = [...terms].sort((a, b) => b.order - a.order)[0];
            const groupAwareSubjects = [];
            const seenGroupIds = new Set();
            for (const subject of orderedSubjects) {
                const groupId = (_b = subject.subject) === null || _b === void 0 ? void 0 : _b.subjectGroupId;
                if (groupId == null) {
                    groupAwareSubjects.push(subject);
                    continue;
                }
                if (seenGroupIds.has(groupId))
                    continue;
                seenGroupIds.add(groupId);
                const latestForGroup = latestTerm
                    ? (yield (0, subjectGroupService_1.filterActiveGroupSubjectsForTerm)(orderedSubjects, latestTerm.id))
                        .find((candidate) => { var _a; return ((_a = candidate.subject) === null || _a === void 0 ? void 0 : _a.subjectGroupId) === groupId; })
                    : subject;
                const representative = latestForGroup || subject;
                const proxy = Object.assign(Object.assign({}, representative), { id: representative.id, inscriptionId: representative.inscriptionId, subjectId: representative.subjectId, schoolPeriodId: representative.schoolPeriodId, gradeId: representative.gradeId, sectionId: representative.sectionId, subject: representative.subject, __groupAware: true, qualifications: [], termGrades: [], councilPoints: [] });
                for (const currentTerm of terms) {
                    const selectedForTerm = (yield (0, subjectGroupService_1.filterActiveGroupSubjectsForTerm)(orderedSubjects, currentTerm.id))
                        .find((candidate) => { var _a; return ((_a = candidate.subject) === null || _a === void 0 ? void 0 : _a.subjectGroupId) === groupId; });
                    if (!selectedForTerm)
                        continue;
                    yield termGradeSyncService_1.TermGradeSyncService.syncForInscriptionSubject(selectedForTerm.id, { transaction: options.transaction });
                    const syncedTermGrades = yield index_1.SubjectTermGrade.findAll({
                        where: { inscriptionSubjectId: selectedForTerm.id, termId: currentTerm.id },
                        transaction: options.transaction,
                    });
                    proxy.termGrades.push(...syncedTermGrades);
                    proxy.qualifications.push(...(selectedForTerm.qualifications || []).filter((qualification) => { var _a; return ((_a = qualification.evaluationPlan) === null || _a === void 0 ? void 0 : _a.termId) === currentTerm.id; }));
                    proxy.councilPoints.push(...(selectedForTerm.councilPoints || []).filter((point) => point.termId === currentTerm.id));
                }
                groupAwareSubjects.push(proxy);
            }
            inscriptionRecord.inscriptionSubjects = groupAwareSubjects;
            const minApproval = (_c = options.minApproval) !== null && _c !== void 0 ? _c : 10;
            const institutionPlantelId = yield resolveInstitutionPlantelId(options.transaction);
            // Fetch revision period and repair grades if the revision period is closed
            const revisionPeriod = yield index_1.RevisionPeriod.findOne({
                where: { schoolPeriodId: inscriptionSimple.schoolPeriodId },
                transaction: options.transaction,
            });
            let repairPassingGrade = null;
            let repairScoresBySubject = new Map();
            if (revisionPeriod && (revisionPeriod.status === 'completed' || revisionPeriod.status === 'closed')) {
                repairPassingGrade = revisionPeriod.passingGrade;
                const revisions = yield index_1.InscriptionSubjectRevision.findAll({
                    where: { revisionPeriodId: revisionPeriod.id },
                    transaction: options.transaction,
                });
                // Use the LAST MANUALLY ENTERED grade (highest opportunity with
                // gradedBy != null), not MAX(score). Automatic NP markers
                // (gradedBy == null) do not replace a manual grade.
                const lastManualBySubject = new Map();
                for (const rev of revisions) {
                    if (rev.score == null)
                        continue;
                    if (rev.gradedBy == null)
                        continue; // skip automatic NP
                    const current = lastManualBySubject.get(rev.inscriptionSubjectId);
                    if (current == null || rev.opportunity > current.opportunity) {
                        lastManualBySubject.set(rev.inscriptionSubjectId, {
                            opportunity: rev.opportunity,
                            score: Number(rev.score),
                        });
                    }
                }
                for (const [insSubId, entry] of lastManualBySubject) {
                    repairScoresBySubject.set(insSubId, entry.score);
                }
            }
            const subjectResults = [];
            let failedSubjects = 0;
            let sumFinalScores = 0;
            let subjectCount = 0;
            for (const insSub of inscriptionRecord.inscriptionSubjects) {
                // Skip subjects excluded from closure: notRepairable=true AND
                // includeInAverage=false. These subjects don't count as failed, don't
                // affect the average, and don't generate pending subjects.
                if (notRepairableMap.get(insSub.subjectId) === true &&
                    includeInAverageMap.get(insSub.subjectId) === false) {
                    continue;
                }
                // SubjectTermGrade is the single source of truth. Group proxies already
                // contain the selected subject's term rows assembled above; regular
                // subjects continue through the existing sync path.
                let syncedTermGrades;
                if (insSub.__groupAware) {
                    syncedTermGrades = insSub.termGrades || [];
                }
                else if (persist) {
                    yield termGradeSyncService_1.TermGradeSyncService.syncForInscriptionSubject(insSub.id, { transaction: options.transaction });
                    syncedTermGrades = yield index_1.SubjectTermGrade.findAll({
                        where: { inscriptionSubjectId: insSub.id },
                        transaction: options.transaction,
                    });
                }
                else {
                    // Preview mode: compute term grades in-memory from qualifications +
                    // council points. Mirrors TermGradeSyncService exactly (same rounding)
                    // without writing to subject_term_grades.
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
                    syncedTermGrades = terms.map((t) => ({
                        termId: t.id,
                        score: (0, gradeEvaluationService_1.roundFinalGrade)(termScores[t.id] || 0),
                    }));
                }
                const termGradesArr = syncedTermGrades.map((tg) => ({
                    termId: tg.termId,
                    score: Number(tg.score),
                }));
                // Build lapsos — during period closure, all councils are done,
                // so all lapsos have finalScore (not null)
                const lapsos = terms.map((t) => {
                    const accumulatedScore = gradeCalculationService_1.GradeCalculationService.calculateAccumulatedTermScore(t.id, termGradesArr);
                    return { termId: t.id, finalScore: accumulatedScore };
                });
                // Calculate finalScore using the service
                // During closure, isClosedPeriod=true so it uses SubjectFinalGrade if available
                // or averages all lapsos (which are all done)
                const existingFinalGrade = yield index_1.SubjectFinalGrade.findOne({
                    where: { inscriptionSubjectId: insSub.id, gradeType: 'regular' },
                    transaction: options.transaction,
                });
                const finalGradeForCalculation = insSub.__groupAware
                    ? null
                    : (existingFinalGrade ? { finalScore: existingFinalGrade.finalScore, gradeType: existingFinalGrade.gradeType } : null);
                const finalScore = gradeCalculationService_1.GradeCalculationService.calculateFinalScore(lapsos, finalGradeForCalculation, { isClosedPeriod: true }) || (0, gradeEvaluationService_1.roundFinalGrade)(lapsos.reduce((sum, l) => sum + l.finalScore, 0) / (lapsos.length || 1));
                // Raw Score (sum of non-council points) calculation for display/statistics
                // Still calculated from qualifications for detailed breakdown
                const termScores = {};
                terms.forEach((t) => { termScores[t.id] = 0; });
                (insSub.qualifications || []).forEach((qualification) => {
                    var _a, _b;
                    if (qualification.isAbsent)
                        return;
                    const score = qualification.remedialScore != null && Number(qualification.remedialScore) > 0
                        ? Number(qualification.remedialScore)
                        : Number(qualification.score) || 0;
                    const percentage = Number((_a = qualification.evaluationPlan) === null || _a === void 0 ? void 0 : _a.percentage) || 0;
                    const termId = (_b = qualification.evaluationPlan) === null || _b === void 0 ? void 0 : _b.termId;
                    if (termId && termScores[termId] !== undefined) {
                        termScores[termId] += score * (percentage / 100);
                    }
                });
                let totalRaw = 0;
                let totalCouncil = 0;
                (insSub.qualifications || []).forEach((q) => {
                    var _a;
                    if (q.isAbsent)
                        return;
                    const s = q.remedialScore != null && Number(q.remedialScore) > 0
                        ? Number(q.remedialScore)
                        : Number(q.score) || 0;
                    const p = Number((_a = q.evaluationPlan) === null || _a === void 0 ? void 0 : _a.percentage) || 0;
                    totalRaw += s * (p / 100);
                });
                (insSub.councilPoints || []).forEach(p => totalCouncil += (Number(p.points) || 0));
                // Check if there's a repair grade for this subject
                const repairScore = repairScoresBySubject.get(insSub.id);
                const hasRepair = repairScore != null;
                let effectiveFinalScore;
                let effectiveStatus;
                let gradeType = 'regular';
                let originalScore = null;
                let originalStatus = null;
                if (hasRepair) {
                    // Repair grade replaces the original completely
                    effectiveFinalScore = (0, gradeEvaluationService_1.roundFinalGrade)(repairScore);
                    effectiveStatus = (0, gradeEvaluationService_1.resolveGradeStatus)(repairScore, repairPassingGrade !== null && repairPassingGrade !== void 0 ? repairPassingGrade : minApproval);
                    gradeType = 'revision';
                    originalScore = finalScore;
                    originalStatus = (0, gradeEvaluationService_1.resolveGradeStatus)(finalScore, minApproval);
                }
                else {
                    effectiveFinalScore = finalScore;
                    effectiveStatus = (0, gradeEvaluationService_1.resolveGradeStatus)(finalScore, minApproval);
                }
                if (effectiveStatus === 'reprobada') {
                    failedSubjects += 1;
                }
                // Only count subjects flagged includeInAverage (default true) toward the average
                const countsForAverage = includeInAverageMap.get(insSub.subjectId) !== false;
                if (countsForAverage) {
                    subjectCount += 1;
                    sumFinalScores += effectiveFinalScore;
                }
                const summary = {
                    inscriptionSubjectId: insSub.id,
                    subjectId: insSub.subjectId,
                    subjectName: (_d = insSub.subject) === null || _d === void 0 ? void 0 : _d.name,
                    rawScore: (0, gradeEvaluationService_1.roundGrade)(totalRaw / termCount),
                    councilPoints: (0, gradeEvaluationService_1.roundGrade)(totalCouncil / termCount),
                    finalScore: effectiveFinalScore,
                    status: effectiveStatus
                };
                subjectResults.push(summary);
                if (!persist) {
                    // Preview mode: calculate identical results without writing
                    // SubjectFinalGrade records to the database.
                    continue;
                }
                const existingGrade = yield index_1.SubjectFinalGrade.findOne({
                    where: { inscriptionSubjectId: insSub.id, gradeType },
                    transaction: options.transaction
                });
                // External grades (transferencia/equivalencia) are not recalculated by this engine.
                if ((existingGrade === null || existingGrade === void 0 ? void 0 : existingGrade.gradeType) === 'transferencia' || (existingGrade === null || existingGrade === void 0 ? void 0 : existingGrade.gradeType) === 'equivalencia') {
                    continue;
                }
                // Use findOne + update/create instead of upsert, since the unique index is now
                // (inscriptionSubjectId, gradeType) and we want to preserve other gradeType records.
                if (existingGrade) {
                    yield existingGrade.update({
                        rawScore: summary.rawScore,
                        councilPoints: summary.councilPoints,
                        finalScore: summary.finalScore,
                        status: summary.status,
                        calculatedAt: new Date(),
                        plantelId: (_e = existingGrade.plantelId) !== null && _e !== void 0 ? _e : institutionPlantelId,
                        gradeType,
                        originalScore: hasRepair ? originalScore : ((_f = existingGrade.originalScore) !== null && _f !== void 0 ? _f : null),
                        originalStatus: hasRepair ? originalStatus : ((_g = existingGrade.originalStatus) !== null && _g !== void 0 ? _g : null),
                        schoolPeriodId: inscriptionSimple.schoolPeriodId,
                        subjectId: insSub.subjectId,
                        gradeId: inscriptionSimple.gradeId,
                    }, { transaction: options.transaction });
                }
                else {
                    yield index_1.SubjectFinalGrade.create({
                        inscriptionSubjectId: insSub.id,
                        rawScore: summary.rawScore,
                        councilPoints: summary.councilPoints,
                        finalScore: summary.finalScore,
                        status: summary.status,
                        calculatedAt: new Date(),
                        plantelId: institutionPlantelId,
                        gradeType,
                        originalScore: hasRepair ? originalScore : null,
                        originalStatus: hasRepair ? originalStatus : null,
                        schoolPeriodId: inscriptionSimple.schoolPeriodId,
                        subjectId: insSub.subjectId,
                        gradeId: inscriptionSimple.gradeId,
                    }, { transaction: options.transaction });
                }
            }
            const finalAverage = subjectCount > 0 ? Number((sumFinalScores / subjectCount).toFixed(2)) : null; // averages keep 2 decimals
            return {
                finalAverage,
                failedSubjects,
                subjectResults
            };
        });
    }
    /**
     * Fast read-only calculation for previews. Uses pre-existing SubjectFinalGrade
     * records directly when available; subjects without one fall back to computing
     * from SubjectTermGrade (same fallback as the certified grades Excel), so the
     * closure preview stays consistent with that report before the closure runs.
     * Does not sync term grades or persist anything.
     *
     * The full `calculateForInscription` is still used by the executor to
     * recalculate and persist final grades.
     */
    static calculateForInscriptionFast(inscriptionId_1) {
        return __awaiter(this, arguments, void 0, function* (inscriptionId, options = {}) {
            var _a, _b;
            const inscription = yield index_1.Inscription.findByPk(inscriptionId, {
                attributes: ['id', 'schoolPeriodId', 'gradeId'],
                transaction: options.transaction,
            });
            if (!inscription)
                throw new Error('Inscripción no encontrada');
            // Fetch all InscriptionSubjects for this inscription in one query
            const inscriptionSubjects = yield index_1.InscriptionSubject.findAll({
                where: { inscriptionId },
                include: [{ model: index_1.Subject, as: 'subject' }],
                transaction: options.transaction,
            });
            if (inscriptionSubjects.length === 0) {
                return { finalAverage: null, failedSubjects: 0, subjectResults: [] };
            }
            // Fetch all SubjectFinalGrade records for these InscriptionSubjects in one query
            const insSubIds = inscriptionSubjects.map(is => is.id);
            const finalGrades = yield index_1.SubjectFinalGrade.findAll({
                where: {
                    inscriptionSubjectId: { [sequelize_1.Op.in]: insSubIds },
                    gradeType: 'regular',
                },
                transaction: options.transaction,
            });
            // Build a map: inscriptionSubjectId -> SubjectFinalGrade
            const fgMap = new Map();
            for (const fg of finalGrades) {
                fgMap.set(fg.inscriptionSubjectId, fg);
            }
            // Bulk-load term grades so subjects without a stored SubjectFinalGrade can
            // fall back to computing from SubjectTermGrade (same fallback the certified
            // grades Excel uses). Keeps the preview consistent with that report.
            const termGradeRows = yield index_1.SubjectTermGrade.findAll({
                where: { inscriptionSubjectId: { [sequelize_1.Op.in]: insSubIds } },
                transaction: options.transaction,
            });
            const termGradesByInsSub = new Map();
            for (const tg of termGradeRows) {
                const list = termGradesByInsSub.get(tg.inscriptionSubjectId) || [];
                list.push({ termId: tg.termId, score: Number(tg.score) || 0 });
                termGradesByInsSub.set(tg.inscriptionSubjectId, list);
            }
            // Fetch includeInAverage map once
            const includeInAverageMap = yield (0, subjectOrderService_1.getSubjectIncludeInAverageMapByGradeAndPeriod)(inscription.gradeId, inscription.schoolPeriodId, options.transaction);
            // Fetch notRepairable map so subjects flagged with BOTH notRepairable=true
            // AND includeInAverage=false can be excluded from the closure entirely.
            const notRepairableMap = yield (0, subjectOrderService_1.getSubjectNotRepairableMapByGradeAndPeriod)(inscription.gradeId, inscription.schoolPeriodId, options.transaction);
            // Fetch revision period + repair grades in bulk (if revision is completed/closed)
            const revisionPeriod = yield index_1.RevisionPeriod.findOne({
                where: { schoolPeriodId: inscription.schoolPeriodId },
                transaction: options.transaction,
            });
            let repairScoresBySubject = new Map();
            let repairPassingGrade = null;
            if (revisionPeriod && (revisionPeriod.status === 'completed' || revisionPeriod.status === 'closed')) {
                repairPassingGrade = revisionPeriod.passingGrade;
                const revisions = yield index_1.InscriptionSubjectRevision.findAll({
                    where: {
                        revisionPeriodId: revisionPeriod.id,
                        inscriptionSubjectId: { [sequelize_1.Op.in]: insSubIds },
                    },
                    transaction: options.transaction,
                });
                // Use the LAST MANUALLY ENTERED grade (highest opportunity with
                // gradedBy != null), not MAX(score). Automatic NP markers
                // (gradedBy == null) do not replace a manual grade.
                const lastManualBySubject = new Map();
                for (const rev of revisions) {
                    if (rev.score == null)
                        continue;
                    if (rev.gradedBy == null)
                        continue; // skip automatic NP
                    const current = lastManualBySubject.get(rev.inscriptionSubjectId);
                    if (current == null || rev.opportunity > current.opportunity) {
                        lastManualBySubject.set(rev.inscriptionSubjectId, {
                            opportunity: rev.opportunity,
                            score: Number(rev.score),
                        });
                    }
                }
                for (const [insSubId, entry] of lastManualBySubject) {
                    repairScoresBySubject.set(insSubId, entry.score);
                }
            }
            // Apply canonical subject order
            const orderMap = yield (0, subjectOrderService_1.getSubjectOrderMapByGradeAndPeriod)(inscription.gradeId, inscription.schoolPeriodId, options.transaction);
            const orderedSubjects = (0, subjectGroupService_1.filterActiveGroupSubjects)((0, subjectOrderService_1.sortSubjectsByOrder)(inscriptionSubjects, (is) => is.subjectId, (is) => { var _a; return (_a = is.subject) === null || _a === void 0 ? void 0 : _a.name; }, orderMap));
            const minApproval = (_a = options.minApproval) !== null && _a !== void 0 ? _a : 10;
            const subjectResults = [];
            let failedSubjects = 0;
            let sumFinalScores = 0;
            let subjectCount = 0;
            for (const insSub of orderedSubjects) {
                // Skip subjects excluded from closure: notRepairable=true AND
                // includeInAverage=false. These subjects don't count as failed, don't
                // affect the average, and don't generate pending subjects.
                if (notRepairableMap.get(insSub.subjectId) === true &&
                    includeInAverageMap.get(insSub.subjectId) === false) {
                    continue;
                }
                const fg = fgMap.get(insSub.id);
                const repairScore = repairScoresBySubject.get(insSub.id);
                const hasRepair = repairScore != null;
                let effectiveFinalScore;
                let effectiveStatus;
                let rawScore = 0;
                let councilPoints = 0;
                if (hasRepair) {
                    // Repair grade replaces the original completely — applies whether
                    // or not a regular SubjectFinalGrade exists (term-grade fallback).
                    effectiveFinalScore = (0, gradeEvaluationService_1.roundFinalGrade)(repairScore);
                    effectiveStatus = (0, gradeEvaluationService_1.resolveGradeStatus)(repairScore, repairPassingGrade !== null && repairPassingGrade !== void 0 ? repairPassingGrade : minApproval);
                    if (fg) {
                        rawScore = Number(fg.rawScore) || 0;
                        councilPoints = Number(fg.councilPoints) || 0;
                    }
                }
                else if (fg) {
                    effectiveFinalScore = Number(fg.finalScore) || 0;
                    effectiveStatus = fg.status;
                    rawScore = Number(fg.rawScore) || 0;
                    councilPoints = Number(fg.councilPoints) || 0;
                }
                else {
                    // No pre-existing final grade and no repair — fall back to computing
                    // from term grades (mirrors the certified grades Excel fallback so
                    // the closure preview stays consistent with that report before the
                    // closure executes).
                    const tgList = termGradesByInsSub.get(insSub.id) || [];
                    if (tgList.length === 0) {
                        continue;
                    }
                    const sum = tgList.reduce((acc, tg) => acc + Number(tg.score || 0), 0);
                    const avg = sum / tgList.length;
                    effectiveFinalScore = (0, gradeEvaluationService_1.roundFinalGrade)(avg);
                    effectiveStatus = (0, gradeEvaluationService_1.isPassingGrade)(avg, minApproval) ? 'aprobada' : 'reprobada';
                }
                if (effectiveStatus === 'reprobada') {
                    failedSubjects += 1;
                }
                const countsForAverage = includeInAverageMap.get(insSub.subjectId) !== false;
                if (countsForAverage) {
                    subjectCount += 1;
                    sumFinalScores += effectiveFinalScore;
                }
                subjectResults.push({
                    inscriptionSubjectId: insSub.id,
                    subjectId: insSub.subjectId,
                    subjectName: (_b = insSub.subject) === null || _b === void 0 ? void 0 : _b.name,
                    rawScore,
                    councilPoints,
                    finalScore: effectiveFinalScore,
                    status: effectiveStatus,
                });
            }
            const finalAverage = subjectCount > 0 ? Number((sumFinalScores / subjectCount).toFixed(2)) : null;
            return {
                finalAverage,
                failedSubjects,
                subjectResults,
            };
        });
    }
}
exports.FinalGradeCalculator = FinalGradeCalculator;
exports.default = FinalGradeCalculator;
