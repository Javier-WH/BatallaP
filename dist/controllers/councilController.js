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
exports.bulkSaveCouncilPoints = exports.saveCouncilPoint = exports.getCouncilData = void 0;
const database_1 = __importDefault(require("../config/database.js"));
const index_1 = require("../models/index.js");
const termGradeSyncService_1 = require("../services/termGradeSyncService.js");
const gradeEvaluationService_1 = require("../services/gradeEvaluationService.js");
const subjectOrderService_1 = require("../services/subjectOrderService.js");
const subjectGroupService_1 = require("../services/subjectGroupService.js");
const termSectionClosureService_1 = require("../services/termSectionClosureService.js");
const studentSortService_1 = require("../services/studentSortService.js");
const getCouncilData = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { sectionId, termId, gradeId } = req.query;
        if (!sectionId || !termId || !gradeId) {
            return res.status(400).json({ message: 'sectionId, termId y gradeId son requeridos' });
        }
        const term = yield index_1.Term.findByPk(Number(termId));
        if (!term) {
            return res.status(404).json({ message: 'Lapso no encontrado' });
        }
        // First find the periodGrade associated with this section and term
        // We can get schoolPeriodId from the term
        const inscriptions = yield index_1.Inscription.findAll({
            where: {
                sectionId: Number(sectionId),
                gradeId: Number(gradeId),
                schoolPeriodId: term.schoolPeriodId
            },
            include: [
                { model: index_1.Person, as: 'student' },
                {
                    model: index_1.InscriptionSubject,
                    as: 'inscriptionSubjects',
                    include: [
                        {
                            model: index_1.Subject,
                            as: 'subject',
                            include: [{ model: index_1.SubjectGroup, as: 'subjectGroup', attributes: ['id', 'name'] }]
                        },
                        {
                            model: index_1.CouncilPoint,
                            as: 'councilPoints',
                            include: [{ model: index_1.Term, as: 'term', attributes: ['name'] }],
                            required: false
                        },
                        {
                            model: index_1.Qualification,
                            as: 'qualifications',
                            include: [
                                {
                                    model: index_1.EvaluationPlan,
                                    as: 'evaluationPlan'
                                }
                            ],
                            required: false
                        }
                    ]
                }
            ]
        });
        // Sort students canonically: document type → document number → lastName → firstName
        (0, studentSortService_1.sortInscriptions)(inscriptions);
        // To order subjects correctly, we need the order from PeriodGradeSubject
        // Since all students in this query belong to the same Grade/Period, we can just fetch the order once
        const firstInscription = inscriptions[0];
        if (!firstInscription) {
            return res.json([]);
        }
        const pg = yield index_1.PeriodGrade.findOne({
            where: {
                schoolPeriodId: term.schoolPeriodId,
                gradeId: firstInscription.gradeId
            }
        });
        if (!pg)
            return res.json(inscriptions);
        const subjectOrderMap = yield (0, subjectOrderService_1.getSubjectOrderMap)(pg.id);
        const includeInAverageMap = yield (0, subjectOrderService_1.getSubjectIncludeInAverageMap)(pg.id);
        // Fetch all terms for this school period, sorted by order
        const allTerms = yield index_1.Term.findAll({
            where: { schoolPeriodId: term.schoolPeriodId },
            order: [['order', 'ASC']],
            raw: true
        });
        // Terms before the selected one (previous terms)
        const previousTerms = allTerms.filter((t) => t.order < term.order);
        // Map data for frontend.
        // Council is per-term, so we resolve the active group subject for THIS term.
        const result = yield Promise.all(inscriptions.map((ins) => __awaiter(void 0, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            const insAny = ins;
            const activeSubjects = yield (0, subjectGroupService_1.filterActiveGroupSubjectsForTerm)(insAny.inscriptionSubjects || [], term.id);
            const sortedSubjects = (0, subjectOrderService_1.sortSubjectsByOrder)(activeSubjects, (is) => is.subjectId, (is) => { var _a; return (_a = is.subject) === null || _a === void 0 ? void 0 : _a.name; }, subjectOrderMap);
            const subjects = yield Promise.all(sortedSubjects.map((is) => __awaiter(void 0, void 0, void 0, function* () {
                var _a, _b, _c, _d, _e;
                const allQualifications = is.qualifications || [];
                const allCouncilPoints = is.councilPoints || [];
                // Calculate a base grade from one specific InscriptionSubject and term.
                const calculateTermBaseGrade = (subject, termId) => {
                    return ((subject === null || subject === void 0 ? void 0 : subject.qualifications) || [])
                        .filter((q) => { var _a; return ((_a = q.evaluationPlan) === null || _a === void 0 ? void 0 : _a.termId) === termId; })
                        .reduce((acc, q) => {
                        var _a;
                        if (q.isAbsent)
                            return acc;
                        const score = q.remedialScore != null && Number(q.remedialScore) > 0
                            ? Number(q.remedialScore)
                            : Number(q.score) || 0;
                        const percentage = Number((_a = q.evaluationPlan) === null || _a === void 0 ? void 0 : _a.percentage) || 0;
                        return acc + (score * (percentage / 100));
                    }, 0);
                };
                const currentTermGrade = calculateTermBaseGrade(is, Number(termId));
                const currentTermPoints = allCouncilPoints.find((cp) => cp.termId === Number(termId));
                const otherTermsPoints = allCouncilPoints.filter((cp) => cp.termId !== Number(termId) && cp.points > 0);
                // Resolve the active subject independently for every previous term.
                // This is essential when a student switches group subjects between lapsos.
                const previousTermsData = yield Promise.all(previousTerms.map((pt) => __awaiter(void 0, void 0, void 0, function* () {
                    var _a;
                    const subjectsForTerm = yield (0, subjectGroupService_1.filterActiveGroupSubjectsForTerm)(insAny.inscriptionSubjects || [], pt.id);
                    const previousSubject = ((_a = is.subject) === null || _a === void 0 ? void 0 : _a.subjectGroupId) != null
                        ? subjectsForTerm.find((candidate) => { var _a; return ((_a = candidate.subject) === null || _a === void 0 ? void 0 : _a.subjectGroupId) === is.subject.subjectGroupId; })
                        : subjectsForTerm.find((candidate) => candidate.subjectId === is.subjectId);
                    const subjectForTerm = previousSubject || is;
                    const ptBaseGrade = calculateTermBaseGrade(subjectForTerm, pt.id);
                    const ptCouncilPoint = (subjectForTerm.councilPoints || []).find((cp) => cp.termId === pt.id);
                    const ptPoints = (ptCouncilPoint === null || ptCouncilPoint === void 0 ? void 0 : ptCouncilPoint.points) || 0;
                    const ptFinalGrade = Math.max(gradeEvaluationService_1.MIN_FINAL_GRADE, Math.round((ptBaseGrade + ptPoints) * 100) / 100);
                    return {
                        termId: pt.id,
                        termName: pt.name,
                        baseGrade: Math.max(gradeEvaluationService_1.MIN_FINAL_GRADE, Math.round(ptBaseGrade * 100) / 100),
                        councilPoints: ptPoints,
                        finalGrade: ptFinalGrade
                    };
                })));
                return {
                    id: is.subjectId,
                    name: (_a = is.subject) === null || _a === void 0 ? void 0 : _a.name,
                    groupId: (_b = is.subject) === null || _b === void 0 ? void 0 : _b.subjectGroupId,
                    groupName: (_d = (_c = is.subject) === null || _c === void 0 ? void 0 : _c.subjectGroup) === null || _d === void 0 ? void 0 : _d.name,
                    inscriptionSubjectId: is.id,
                    points: (currentTermPoints === null || currentTermPoints === void 0 ? void 0 : currentTermPoints.points) || 0,
                    councilPointId: currentTermPoints === null || currentTermPoints === void 0 ? void 0 : currentTermPoints.id,
                    grade: Math.max(gradeEvaluationService_1.MIN_FINAL_GRADE, Math.round(currentTermGrade * 100) / 100),
                    includeInAverage: (_e = includeInAverageMap.get(is.subjectId)) !== null && _e !== void 0 ? _e : true,
                    hasOtherTermsPoints: otherTermsPoints.length > 0,
                    otherTermsInfo: otherTermsPoints.map((cp) => {
                        var _a;
                        return ({
                            termName: (_a = cp.term) === null || _a === void 0 ? void 0 : _a.name,
                            points: cp.points
                        });
                    }),
                    previousTermsData
                };
            })));
            return {
                id: ins.id,
                studentName: `${(_a = insAny.student) === null || _a === void 0 ? void 0 : _a.lastName} ${(_b = insAny.student) === null || _b === void 0 ? void 0 : _b.firstName}`,
                studentDni: (_c = insAny.student) === null || _c === void 0 ? void 0 : _c.document,
                documentType: (_d = insAny.student) === null || _d === void 0 ? void 0 : _d.documentType,
                subjects
            };
        })));
        res.json(result);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener datos del consejo' });
    }
});
exports.getCouncilData = getCouncilData;
const saveCouncilPoint = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const t = yield database_1.default.transaction();
    try {
        const { inscriptionSubjectId, termId, points } = req.body;
        const term = yield index_1.Term.findByPk(termId);
        if (!term) {
            yield t.rollback();
            return res.status(404).json({ message: 'Lapso no encontrado' });
        }
        // Derive sectionId + gradeId from InscriptionSubject → Inscription for section-aware check
        const insSub = yield index_1.InscriptionSubject.findByPk(inscriptionSubjectId, {
            include: [{ model: index_1.Inscription, as: 'inscription', attributes: ['id', 'sectionId', 'gradeId'] }],
        });
        const sectionId = (_a = insSub === null || insSub === void 0 ? void 0 : insSub.inscription) === null || _a === void 0 ? void 0 : _a.sectionId;
        const gradeId = (_b = insSub === null || insSub === void 0 ? void 0 : insSub.inscription) === null || _b === void 0 ? void 0 : _b.gradeId;
        const sectionClosed = sectionId && gradeId
            ? yield termSectionClosureService_1.TermSectionClosureService.isSectionClosed(termId, sectionId, gradeId)
            : term.isBlocked;
        if (sectionClosed) {
            yield t.rollback();
            return res.status(403).json({ message: 'El lapso está cerrado para esta sección' });
        }
        // Check if the council is marked as done for this section+term
        if (sectionId && gradeId) {
            const checklist = yield index_1.CouncilChecklist.findOne({
                where: {
                    schoolPeriodId: term.schoolPeriodId,
                    gradeId,
                    sectionId,
                    termId,
                    status: 'done',
                },
            });
            if (checklist) {
                yield t.rollback();
                return res.status(403).json({ message: 'El consejo de curso está marcado como completado. Desmárcalo primero para editar.' });
            }
        }
        const [point, created] = yield index_1.CouncilPoint.findOrCreate({
            where: { inscriptionSubjectId, termId },
            defaults: { inscriptionSubjectId, termId, points },
            transaction: t,
        });
        if (!created) {
            yield point.update({ points }, { transaction: t });
        }
        // Sync term grades so that boletines and planillas stay consistent
        yield termGradeSyncService_1.TermGradeSyncService.syncForInscriptionSubject(inscriptionSubjectId, { transaction: t });
        yield t.commit();
        res.json(point);
    }
    catch (error) {
        yield t.rollback();
        console.error(error);
        res.status(500).json({ message: 'Error al guardar puntos de consejo' });
    }
});
exports.saveCouncilPoint = saveCouncilPoint;
const bulkSaveCouncilPoints = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const t = yield database_1.default.transaction();
    try {
        const { updates } = req.body; // Array of { inscriptionSubjectId, termId, points }
        // Fetch limits from settings
        const [totalLimitSetting, perSubjectLimitSetting] = yield Promise.all([
            index_1.Setting.findOne({ where: { key: 'council_points_limit' } }),
            index_1.Setting.findOne({ where: { key: 'council_points_per_subject_limit' } })
        ]);
        const totalLimit = totalLimitSetting ? Number(totalLimitSetting.value) : 2;
        const perSubjectLimit = perSubjectLimitSetting ? Number(perSubjectLimitSetting.value) : 2;
        // Validate per-subject limit
        for (const update of updates) {
            if (Number(update.points) > perSubjectLimit) {
                yield t.rollback();
                return res.status(400).json({
                    message: `El límite de puntos por materia es de ${perSubjectLimit}. Se intentó asignar ${update.points}.`
                });
            }
        }
        // Validate total limit per student (group by inscriptionSubjectId's parent inscription)
        // Group updates by inscription via InscriptionSubject
        const inscriptionSubjectIds = updates.map((u) => u.inscriptionSubjectId);
        const insSubs = yield index_1.InscriptionSubject.findAll({
            where: { id: inscriptionSubjectIds },
            attributes: ['id', 'inscriptionId', 'schoolPeriodId', 'gradeId', 'sectionId']
        });
        // Validate that all InscriptionSubjects belong to the active period
        const activePeriod = yield index_1.SchoolPeriod.findOne({ where: { status: 'activo' } });
        if (activePeriod) {
            const outOfPeriod = insSubs.filter((s) => s.schoolPeriodId && s.schoolPeriodId !== activePeriod.id);
            if (outOfPeriod.length > 0) {
                yield t.rollback();
                return res.status(400).json({
                    message: 'Algunas materias no pertenecen al período escolar activo',
                    count: outOfPeriod.length,
                });
            }
        }
        const inscriptionMap = new Map();
        insSubs.forEach((is) => {
            const arr = inscriptionMap.get(is.inscriptionId) || [];
            arr.push(is.id);
            inscriptionMap.set(is.inscriptionId, arr);
        });
        // Check if any section+term has the council marked as done — if so, reject the save
        const inscriptions = yield index_1.Inscription.findAll({
            where: { id: [...inscriptionMap.keys()] },
            attributes: ['id', 'sectionId', 'gradeId', 'schoolPeriodId'],
        });
        // Build unique (schoolPeriodId, gradeId, sectionId, termId) keys to check
        const checkKeys = new Set();
        const termIds = [...new Set(updates.map((u) => u.termId))];
        for (const ins of inscriptions) {
            for (const termId of termIds) {
                checkKeys.add(`${ins.schoolPeriodId}:${ins.gradeId}:${ins.sectionId}:${termId}`);
            }
        }
        const checkLookups = [];
        for (const key of checkKeys) {
            const [spId, gId, sId, tId] = key.split(':').map(Number);
            checkLookups.push((() => __awaiter(void 0, void 0, void 0, function* () {
                const checklist = yield index_1.CouncilChecklist.findOne({
                    where: {
                        schoolPeriodId: spId,
                        gradeId: gId,
                        sectionId: sId,
                        termId: tId,
                        status: 'done',
                    },
                });
                if (checklist) {
                    throw new Error('COUNCIL_DONE');
                }
            }))());
        }
        try {
            yield Promise.all(checkLookups);
        }
        catch (err) {
            if (err.message === 'COUNCIL_DONE') {
                yield t.rollback();
                return res.status(403).json({ message: 'El consejo de curso está marcado como completado. Desmárcalo primero para editar.' });
            }
            throw err;
        }
        for (const [inscriptionId, subIds] of inscriptionMap) {
            // Sum points from updates for this inscription
            const totalFromUpdates = updates
                .filter((u) => subIds.includes(u.inscriptionSubjectId))
                .reduce((sum, u) => sum + Number(u.points || 0), 0);
            if (totalFromUpdates > totalLimit) {
                yield t.rollback();
                return res.status(400).json({
                    message: `El límite total de puntos por alumno es de ${totalLimit}. Se intentó asignar ${totalFromUpdates}.`
                });
            }
        }
        for (const update of updates) {
            const [point, created] = yield index_1.CouncilPoint.findOrCreate({
                where: {
                    inscriptionSubjectId: update.inscriptionSubjectId,
                    termId: update.termId
                },
                defaults: {
                    inscriptionSubjectId: update.inscriptionSubjectId,
                    termId: update.termId,
                    points: update.points
                },
                transaction: t,
            });
            if (!created) {
                yield point.update({ points: update.points }, { transaction: t });
            }
        }
        // Sync term grades for all affected inscription subjects
        const affectedSubjectIds = updates.map((u) => Number(u.inscriptionSubjectId));
        const uniqueSubjectIds = Array.from(new Set(affectedSubjectIds));
        for (const subjectId of uniqueSubjectIds) {
            yield termGradeSyncService_1.TermGradeSyncService.syncForInscriptionSubject(subjectId, { transaction: t });
        }
        yield t.commit();
        res.json({ message: 'Puntos actualizados correctamente' });
    }
    catch (error) {
        yield t.rollback();
        console.error(error);
        res.status(500).json({ message: 'Error al guardar puntos en lote' });
    }
});
exports.bulkSaveCouncilPoints = bulkSaveCouncilPoints;
