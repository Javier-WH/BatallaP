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
exports.unfinalizeRevisionGrades = exports.finalizeRevisionGrades = exports.exportRevisionNominaExcel = exports.getRevisionGradeAudits = exports.overrideRevisionGrade = exports.updateMaxOpportunities = exports.reopenRevisionPeriod = exports.advanceOpportunity = exports.resetRevisionPeriod = exports.recalculateRevisionPeriod = exports.bulkSaveRevisionGrades = exports.saveRevisionGrade = exports.getRevisionGrades = exports.getRevisionStudents = exports.lockRevisionPeriod = exports.openRevisionPeriod = exports.getRevisionPeriod = void 0;
const sequelize_1 = require("sequelize");
const exceljs_1 = __importDefault(require("exceljs"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const database_1 = __importDefault(require("../config/database.js"));
const revisionPeriodService_1 = require("../services/revisionPeriodService.js");
const studentSortService_1 = require("../services/studentSortService.js");
const gradeChangeLogService_1 = require("../services/gradeChangeLogService.js");
const subjectOrderService_1 = require("../services/subjectOrderService.js");
const index_1 = require("../models/index.js");
/** Resolve the configured max grade (setting `max_grade`, default 20). */
function getMaxGrade() {
    return __awaiter(this, void 0, void 0, function* () {
        const setting = yield index_1.Setting.findOne({ where: { key: 'max_grade' } });
        const n = Number(setting === null || setting === void 0 ? void 0 : setting.getDataValue('value'));
        return Number.isFinite(n) && n > 0 ? n : 20;
    });
}
const getRevisionPeriod = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const schoolPeriodId = parseInt(req.params.schoolPeriodId, 10);
        if (!schoolPeriodId) {
            return res.status(400).json({ message: 'schoolPeriodId es obligatorio' });
        }
        const summary = yield revisionPeriodService_1.RevisionPeriodService.getSummary(schoolPeriodId);
        return res.json(summary);
    }
    catch (error) {
        console.error('[getRevisionPeriod] Error:', error);
        return res.status(500).json({ message: error.message || 'Error al obtener período de revisión' });
    }
});
exports.getRevisionPeriod = getRevisionPeriod;
const openRevisionPeriod = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const t = yield database_1.default.transaction();
    try {
        const schoolPeriodId = parseInt(req.params.schoolPeriodId, 10);
        if (!schoolPeriodId) {
            return res.status(400).json({ message: 'schoolPeriodId es obligatorio' });
        }
        const result = yield revisionPeriodService_1.RevisionPeriodService.openRevisionPeriod(schoolPeriodId, t);
        yield t.commit();
        return res.json({
            message: 'Período de revisión abierto correctamente',
            revisionPeriod: result.revisionPeriod,
            revisionsCreated: result.revisionsCreated,
        });
    }
    catch (error) {
        yield t.rollback();
        console.error('[openRevisionPeriod] Error:', error);
        return res.status(500).json({ message: error.message || 'Error al abrir período de revisión' });
    }
});
exports.openRevisionPeriod = openRevisionPeriod;
const lockRevisionPeriod = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const t = yield database_1.default.transaction();
    try {
        const schoolPeriodId = parseInt(req.params.schoolPeriodId, 10);
        if (!schoolPeriodId) {
            return res.status(400).json({ message: 'schoolPeriodId es obligatorio' });
        }
        const revisionPeriod = yield revisionPeriodService_1.RevisionPeriodService.lockRevisionPeriod(schoolPeriodId, t);
        yield t.commit();
        return res.json({
            message: 'Período de revisión bloqueado correctamente',
            revisionPeriod,
        });
    }
    catch (error) {
        yield t.rollback();
        console.error('[lockRevisionPeriod] Error:', error);
        return res.status(500).json({ message: error.message || 'Error al bloquear período de revisión' });
    }
});
exports.lockRevisionPeriod = lockRevisionPeriod;
const getRevisionStudents = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x;
    try {
        const schoolPeriodId = parseInt(req.params.schoolPeriodId, 10);
        if (!schoolPeriodId) {
            return res.status(400).json({ message: 'schoolPeriodId es obligatorio' });
        }
        const revisionPeriod = yield index_1.RevisionPeriod.findOne({
            where: { schoolPeriodId },
        });
        // If period is open, completed, or closed, return actual revision records
        if (revisionPeriod && revisionPeriod.status !== 'pending') {
            const revisions = yield index_1.InscriptionSubjectRevision.findAll({
                where: { revisionPeriodId: revisionPeriod.id },
                include: [
                    {
                        model: index_1.InscriptionSubject,
                        as: 'inscriptionSubject',
                        include: [
                            {
                                model: index_1.Inscription,
                                as: 'inscription',
                                include: [
                                    { association: 'student' },
                                    { association: 'grade' },
                                    { association: 'section' },
                                ],
                            },
                            { association: 'subject' },
                        ],
                    },
                    { model: index_1.Person, as: 'grader' },
                ],
                order: [['inscriptionSubjectId', 'ASC'], ['opportunity', 'ASC']],
            });
            const studentMap = new Map();
            const subjectRevisionsMap = new Map();
            // Cache subject order maps by gradeId for canonical subject ordering
            const orderMapCache = new Map();
            const resolveOrderMap = (gradeId) => __awaiter(void 0, void 0, void 0, function* () {
                if (!gradeId)
                    return new Map();
                if (orderMapCache.has(gradeId))
                    return orderMapCache.get(gradeId);
                const m = yield (0, subjectOrderService_1.getSubjectOrderMapByGradeAndPeriod)(gradeId, schoolPeriodId);
                orderMapCache.set(gradeId, m);
                return m;
            });
            // Cache of notRepairable subject IDs per gradeId, so we can skip
            // subjects flagged as "No Reparable" even if revisions already exist.
            const notRepairableCache = new Map();
            const resolveNotRepairable = (gradeId) => __awaiter(void 0, void 0, void 0, function* () {
                if (!gradeId)
                    return new Set();
                if (notRepairableCache.has(gradeId))
                    return notRepairableCache.get(gradeId);
                const map = yield (0, subjectOrderService_1.getSubjectNotRepairableMapByGradeAndPeriod)(gradeId, schoolPeriodId);
                const set = new Set();
                for (const [subjectId, notRepairable] of map.entries()) {
                    if (notRepairable)
                        set.add(subjectId);
                }
                notRepairableCache.set(gradeId, set);
                return set;
            });
            // Cache full subject lists by gradeId (all active subjects of the grade)
            const gradeSubjectsCache = new Map();
            const resolveGradeSubjects = (gradeId) => __awaiter(void 0, void 0, void 0, function* () {
                if (!gradeId)
                    return [];
                if (gradeSubjectsCache.has(gradeId))
                    return gradeSubjectsCache.get(gradeId);
                const pg = yield index_1.PeriodGrade.findOne({
                    where: { gradeId, schoolPeriodId },
                    include: [{
                            model: index_1.Subject,
                            as: 'subjects',
                            through: { where: { active: true } },
                        }],
                });
                const orderMap = yield resolveOrderMap(gradeId);
                const notRepairableSet = yield resolveNotRepairable(gradeId);
                const rawSubjects = ((pg === null || pg === void 0 ? void 0 : pg.subjects) || []).filter((s) => !notRepairableSet.has(s.id));
                const sorted = (0, subjectOrderService_1.sortSubjectsByOrder)(rawSubjects, (s) => s.id, (s) => s.name, orderMap).map((s) => {
                    var _a, _b, _c;
                    return ({
                        subjectId: s.id,
                        subjectName: s.name || '',
                        abbreviation: s.abbreviation || s.name || '',
                        subjectOrder: (_a = orderMap.get(s.id)) !== null && _a !== void 0 ? _a : 999,
                        periodGradeSubjectId: (_c = (_b = s.PeriodGradeSubject) === null || _b === void 0 ? void 0 : _b.id) !== null && _c !== void 0 ? _c : null,
                    });
                });
                gradeSubjectsCache.set(gradeId, sorted);
                return sorted;
            });
            for (const rev of revisions) {
                if (!subjectRevisionsMap.has(rev.inscriptionSubjectId)) {
                    subjectRevisionsMap.set(rev.inscriptionSubjectId, []);
                }
                subjectRevisionsMap.get(rev.inscriptionSubjectId).push({
                    id: rev.id,
                    opportunity: rev.opportunity,
                    score: rev.score,
                    status: rev.status,
                    isAbsent: rev.isAbsent || false,
                    gradedBy: rev.gradedBy,
                    graderName: rev.grader
                        ? `${rev.grader.firstName || ''} ${rev.grader.lastName || ''}`.trim()
                        : null,
                    gradedAt: rev.gradedAt,
                });
            }
            // Students with unresolved pending subjects (Materia Pendiente) are
            // excluded — hide their existing revisions from the UI without
            // deleting them (Opción A: filtrar, no borrar).
            const periodInscriptionIds = (yield index_1.Inscription.findAll({
                where: { schoolPeriodId },
                attributes: ['id'],
            })).map(i => i.id);
            const excludedPersonIds = yield (0, revisionPeriodService_1.getPersonIdsWithUnresolvedPending)(schoolPeriodId, periodInscriptionIds);
            // Pending subjects (any status) never go to revision — their grades
            // live in the Materia Pendiente flow, not the repair nomina.
            const pendingSubjectRows = yield index_1.PendingSubject.findAll({
                where: { newInscriptionId: { [sequelize_1.Op.in]: periodInscriptionIds } },
                attributes: ['newInscriptionId', 'subjectId'],
            });
            const pendingSubjectSet = new Set(pendingSubjectRows.map(p => `${p.newInscriptionId}-${p.subjectId}`));
            for (const rev of revisions) {
                const insSub = rev.inscriptionSubject;
                if (!insSub)
                    continue;
                const ins = insSub.inscription;
                if (!ins)
                    continue;
                // Skip pending subjects — their grades belong to the MP flow, never to revision.
                if (pendingSubjectSet.has(`${ins.id}-${insSub.subjectId}`))
                    continue;
                // Skip students who still owe pending subjects — they cannot go to revision.
                if (excludedPersonIds.has(ins.personId))
                    continue;
                // Skip subjects flagged as "No Reparable" — hide existing revisions
                // from the UI without deleting them (Opción A: filtrar, no borrar).
                const notRepairableSet = yield resolveNotRepairable(ins.gradeId);
                if (notRepairableSet.has(insSub.subjectId))
                    continue;
                const studentId = ins.personId;
                if (!studentMap.has(studentId)) {
                    studentMap.set(studentId, {
                        studentId,
                        inscriptionId: ins.id,
                        studentName: `${((_a = ins.student) === null || _a === void 0 ? void 0 : _a.lastName) || ''} ${((_b = ins.student) === null || _b === void 0 ? void 0 : _b.firstName) || ''}`.trim(),
                        document: ((_c = ins.student) === null || _c === void 0 ? void 0 : _c.document) || '',
                        documentType: ((_d = ins.student) === null || _d === void 0 ? void 0 : _d.documentType) || '',
                        grade: ((_e = ins.grade) === null || _e === void 0 ? void 0 : _e.name) || '',
                        gradeId: ins.gradeId,
                        gradeOrder: (_g = (_f = ins.grade) === null || _f === void 0 ? void 0 : _f.order) !== null && _g !== void 0 ? _g : 999,
                        section: ((_h = ins.section) === null || _h === void 0 ? void 0 : _h.name) || '',
                        subjects: [],
                    });
                }
                const entry = studentMap.get(studentId);
                const alreadyAdded = entry.subjects.some((s) => s.inscriptionSubjectId === insSub.id);
                if (alreadyAdded)
                    continue;
                entry.subjects.push({
                    inscriptionSubjectId: insSub.id,
                    subjectId: insSub.subjectId,
                    subjectName: ((_j = insSub.subject) === null || _j === void 0 ? void 0 : _j.name) || '',
                    abbreviation: ((_k = insSub.subject) === null || _k === void 0 ? void 0 : _k.abbreviation) || ((_l = insSub.subject) === null || _l === void 0 ? void 0 : _l.name) || '',
                    originalScore: null,
                    originalStatus: null,
                    maxOpportunities: revisionPeriod.maxOpportunities,
                    revisions: subjectRevisionsMap.get(insSub.id) || [],
                    passed: false,
                });
            }
            // Apply canonical subject order per student
            const studentsList = Array.from(studentMap.values());
            const gradeSubjectsMap = {};
            for (const student of studentsList) {
                const orderMap = yield resolveOrderMap(student.gradeId);
                student.subjects = (0, subjectOrderService_1.sortSubjectsByOrder)(student.subjects, (s) => s.subjectId, (s) => s.subjectName, orderMap);
                // Attach subjectOrder for frontend, remove internal subjectId
                for (const subj of student.subjects) {
                    const sid = subj.subjectId;
                    subj.subjectOrder = (sid != null && orderMap.has(sid)) ? orderMap.get(sid) : 999;
                    delete subj.subjectId;
                }
                // Build gradeSubjects map
                if (student.gradeId && !gradeSubjectsMap[student.gradeId]) {
                    gradeSubjectsMap[student.gradeId] = yield resolveGradeSubjects(student.gradeId);
                }
            }
            return res.json({ students: studentsList, isPreview: false, gradeSubjects: gradeSubjectsMap });
        }
        // Preview mode: calculate failed subjects from qualifications & council points
        const passingGradeSetting = yield index_1.Setting.findByPk('passing_grade');
        const passingGrade = Number(passingGradeSetting === null || passingGradeSetting === void 0 ? void 0 : passingGradeSetting.value) || 10;
        const terms = yield index_1.Term.findAll({ where: { schoolPeriodId } });
        const termIds = terms.map(t => t.id);
        const termCount = terms.length || 1;
        const allInscriptions = yield index_1.Inscription.findAll({
            where: { schoolPeriodId },
            include: [
                { association: 'student' },
                { association: 'grade' },
                { association: 'section' },
                {
                    model: index_1.InscriptionSubject,
                    as: 'inscriptionSubjects',
                    include: [
                        { association: 'subject' },
                        {
                            model: index_1.Qualification,
                            as: 'qualifications',
                            include: [{ model: index_1.EvaluationPlan, as: 'evaluationPlan' }],
                        },
                        { model: index_1.CouncilPoint, as: 'councilPoints' },
                    ],
                },
            ],
        });
        // Sort students canonically: document type → document number → lastName → firstName → grade → section
        (0, studentSortService_1.sortInscriptions)(allInscriptions);
        // Cache of notRepairable subject IDs per gradeId, so we can skip subjects
        // flagged as "No Reparable" when previewing failed subjects.
        const notRepairableCache = new Map();
        const resolveNotRepairable = (gradeId) => __awaiter(void 0, void 0, void 0, function* () {
            if (!gradeId)
                return new Set();
            if (notRepairableCache.has(gradeId))
                return notRepairableCache.get(gradeId);
            const map = yield (0, subjectOrderService_1.getSubjectNotRepairableMapByGradeAndPeriod)(gradeId, schoolPeriodId);
            const set = new Set();
            for (const [subjectId, notRepairable] of map.entries()) {
                if (notRepairable)
                    set.add(subjectId);
            }
            notRepairableCache.set(gradeId, set);
            return set;
        });
        const studentMap = new Map();
        const processedSubjects = new Set();
        // Students with unresolved pending subjects (Materia Pendiente) are
        // excluded from the revision preview entirely.
        const excludedPersonIds = yield (0, revisionPeriodService_1.getPersonIdsWithUnresolvedPending)(schoolPeriodId, allInscriptions.map(i => i.id));
        // Cache subject order maps by gradeId for canonical subject ordering
        const orderMapCache = new Map();
        const resolveOrderMap = (gradeId) => __awaiter(void 0, void 0, void 0, function* () {
            if (!gradeId)
                return new Map();
            if (orderMapCache.has(gradeId))
                return orderMapCache.get(gradeId);
            const m = yield (0, subjectOrderService_1.getSubjectOrderMapByGradeAndPeriod)(gradeId, schoolPeriodId);
            orderMapCache.set(gradeId, m);
            return m;
        });
        // Cache full subject lists by gradeId (all active subjects of the grade)
        const gradeSubjectsCache = new Map();
        const resolveGradeSubjects = (gradeId) => __awaiter(void 0, void 0, void 0, function* () {
            if (!gradeId)
                return [];
            if (gradeSubjectsCache.has(gradeId))
                return gradeSubjectsCache.get(gradeId);
            const pg = yield index_1.PeriodGrade.findOne({
                where: { gradeId, schoolPeriodId },
                include: [{
                        model: index_1.Subject,
                        as: 'subjects',
                        through: { where: { active: true } },
                    }],
            });
            const orderMap = yield resolveOrderMap(gradeId);
            const notRepairableSet = yield resolveNotRepairable(gradeId);
            const rawSubjects = ((pg === null || pg === void 0 ? void 0 : pg.subjects) || []).filter((s) => !notRepairableSet.has(s.id));
            const sorted = (0, subjectOrderService_1.sortSubjectsByOrder)(rawSubjects, (s) => s.id, (s) => s.name, orderMap).map((s) => {
                var _a, _b, _c;
                return ({
                    subjectId: s.id,
                    subjectName: s.name || '',
                    abbreviation: s.abbreviation || s.name || '',
                    subjectOrder: (_a = orderMap.get(s.id)) !== null && _a !== void 0 ? _a : 999,
                    periodGradeSubjectId: (_c = (_b = s.PeriodGradeSubject) === null || _b === void 0 ? void 0 : _b.id) !== null && _c !== void 0 ? _c : null,
                });
            });
            gradeSubjectsCache.set(gradeId, sorted);
            return sorted;
        });
        // Pending subjects (any status) never go to revision — their grades
        // live in the Materia Pendiente flow, not the repair nomina.
        const pendingSubjectRows = yield index_1.PendingSubject.findAll({
            where: { newInscriptionId: { [sequelize_1.Op.in]: allInscriptions.map(i => i.id) } },
            attributes: ['newInscriptionId', 'subjectId'],
        });
        const pendingSubjectSet = new Set(pendingSubjectRows.map(p => `${p.newInscriptionId}-${p.subjectId}`));
        for (const ins of allInscriptions) {
            // Skip students who still owe pending subjects — they cannot go to revision.
            if (excludedPersonIds.has(ins.personId))
                continue;
            const insAny = ins;
            const insSubjects = insAny.inscriptionSubjects || [];
            const subjects = [];
            const notRepairableSet = yield resolveNotRepairable(insAny.gradeId);
            for (const insSub of insSubjects) {
                if (processedSubjects.has(insSub.id))
                    continue;
                processedSubjects.add(insSub.id);
                // Skip pending subjects — their grades belong to the MP flow, never to revision.
                if (pendingSubjectSet.has(`${insAny.id}-${insSub.subjectId}`))
                    continue;
                // Skip subjects flagged as "No Reparable" — they cannot go to revision.
                if (notRepairableSet.has(insSub.subjectId))
                    continue;
                const termScores = {};
                termIds.forEach(tid => { termScores[tid] = 0; });
                (insSub.qualifications || []).forEach((q) => {
                    var _a, _b;
                    if (q.isAbsent)
                        return;
                    const score = q.remedialScore != null && Number(q.remedialScore) > 0
                        ? Number(q.remedialScore) : Number(q.score) || 0;
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
                let totalAccumulated = 0;
                Object.values(termScores).forEach(v => { totalAccumulated += v; });
                const finalScore = totalAccumulated / termCount;
                if (finalScore < passingGrade) {
                    subjects.push({
                        inscriptionSubjectId: insSub.id,
                        subjectId: insSub.subjectId,
                        subjectName: ((_m = insSub.subject) === null || _m === void 0 ? void 0 : _m.name) || '',
                        abbreviation: ((_o = insSub.subject) === null || _o === void 0 ? void 0 : _o.abbreviation) || ((_p = insSub.subject) === null || _p === void 0 ? void 0 : _p.name) || '',
                        originalScore: finalScore,
                        originalStatus: 'reprobada',
                        maxOpportunities: 3,
                        revisions: [],
                        passed: false,
                    });
                }
            }
            if (subjects.length > 0) {
                studentMap.set(insAny.personId, {
                    studentId: insAny.personId,
                    inscriptionId: insAny.id,
                    studentName: `${((_q = insAny.student) === null || _q === void 0 ? void 0 : _q.lastName) || ''} ${((_r = insAny.student) === null || _r === void 0 ? void 0 : _r.firstName) || ''}`.trim(),
                    document: ((_s = insAny.student) === null || _s === void 0 ? void 0 : _s.document) || '',
                    documentType: ((_t = insAny.student) === null || _t === void 0 ? void 0 : _t.documentType) || '',
                    grade: ((_u = insAny.grade) === null || _u === void 0 ? void 0 : _u.name) || '',
                    gradeId: insAny.gradeId,
                    gradeOrder: (_w = (_v = insAny.grade) === null || _v === void 0 ? void 0 : _v.order) !== null && _w !== void 0 ? _w : 999,
                    section: ((_x = insAny.section) === null || _x === void 0 ? void 0 : _x.name) || '',
                    subjects,
                });
            }
        }
        // Apply canonical subject order per student
        const studentsList = Array.from(studentMap.values());
        const gradeSubjectsMap = {};
        for (const student of studentsList) {
            const orderMap = yield resolveOrderMap(student.gradeId);
            student.subjects = (0, subjectOrderService_1.sortSubjectsByOrder)(student.subjects, (s) => s.subjectId, (s) => s.subjectName, orderMap);
            // Attach subjectOrder for frontend, remove internal subjectId
            for (const subj of student.subjects) {
                const sid = subj.subjectId;
                subj.subjectOrder = (sid != null && orderMap.has(sid)) ? orderMap.get(sid) : 999;
                delete subj.subjectId;
            }
            // Build gradeSubjects map
            if (student.gradeId && !gradeSubjectsMap[student.gradeId]) {
                gradeSubjectsMap[student.gradeId] = yield resolveGradeSubjects(student.gradeId);
            }
        }
        return res.json({ students: studentsList, isPreview: true, gradeSubjects: gradeSubjectsMap });
    }
    catch (error) {
        console.error('[getRevisionStudents] Error:', error);
        return res.status(500).json({ message: error.message || 'Error al listar estudiantes' });
    }
});
exports.getRevisionStudents = getRevisionStudents;
const getRevisionGrades = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const schoolPeriodId = parseInt(req.params.schoolPeriodId, 10);
        if (!schoolPeriodId) {
            return res.status(400).json({ message: 'schoolPeriodId es obligatorio' });
        }
        const revisionPeriod = yield index_1.RevisionPeriod.findOne({
            where: { schoolPeriodId },
        });
        if (!revisionPeriod) {
            return res.json({ grades: [] });
        }
        const revisions = yield index_1.InscriptionSubjectRevision.findAll({
            where: { revisionPeriodId: revisionPeriod.id },
            include: [
                {
                    model: index_1.InscriptionSubject,
                    as: 'inscriptionSubject',
                    include: [
                        {
                            model: index_1.Inscription,
                            as: 'inscription',
                            include: [{ association: 'student' }],
                        },
                        { association: 'subject' },
                    ],
                },
                { model: index_1.Person, as: 'grader' },
            ],
        });
        const grades = revisions.map(rev => {
            var _a, _b;
            const insSub = rev.inscriptionSubject;
            return {
                id: rev.id,
                inscriptionSubjectId: rev.inscriptionSubjectId,
                subjectName: ((_a = insSub === null || insSub === void 0 ? void 0 : insSub.subject) === null || _a === void 0 ? void 0 : _a.name) || '',
                studentName: ((_b = insSub === null || insSub === void 0 ? void 0 : insSub.inscription) === null || _b === void 0 ? void 0 : _b.student)
                    ? `${insSub.inscription.student.lastName || ''} ${insSub.inscription.student.firstName || ''}`.trim()
                    : '',
                opportunity: rev.opportunity,
                score: rev.score,
                status: rev.status,
                isAbsent: rev.isAbsent || false,
                gradedBy: rev.gradedBy,
                graderName: rev.grader
                    ? `${rev.grader.firstName || ''} ${rev.grader.lastName || ''}`.trim()
                    : null,
                gradedAt: rev.gradedAt,
            };
        });
        return res.json({ grades });
    }
    catch (error) {
        console.error('[getRevisionGrades] Error:', error);
        return res.status(500).json({ message: error.message || 'Error al obtener notas' });
    }
});
exports.getRevisionGrades = getRevisionGrades;
const saveRevisionGrade = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    const t = yield database_1.default.transaction();
    try {
        const revisionId = parseInt(req.params.revisionId, 10);
        const schoolPeriodId = parseInt(req.params.schoolPeriodId, 10);
        const { score, isAbsent } = req.body;
        const revisionPeriod = yield index_1.RevisionPeriod.findOne({
            where: { schoolPeriodId },
            transaction: t,
        });
        if (!revisionPeriod) {
            yield t.rollback();
            return res.status(404).json({ message: 'Período de revisión no encontrado' });
        }
        if (revisionPeriod.status !== 'open') {
            yield t.rollback();
            return res.status(400).json({ message: 'El período de revisión no está abierto' });
        }
        const revision = yield index_1.InscriptionSubjectRevision.findByPk(revisionId, { transaction: t });
        if (!revision || revision.revisionPeriodId !== revisionPeriod.id) {
            yield t.rollback();
            return res.status(404).json({ message: 'Revisión no encontrada' });
        }
        // Only allow saving grades for the currently active opportunity
        if (revision.opportunity !== revisionPeriod.currentOpportunity) {
            yield t.rollback();
            return res.status(400).json({
                message: `Solo se puede editar la Oportunidad ${revisionPeriod.currentOpportunity}. La Oportunidad ${revision.opportunity} no está activa.`,
            });
        }
        // If the student already approved in a previous opportunity, do not allow
        // saving grades in this or any subsequent opportunity.
        const earlierApproval = yield index_1.InscriptionSubjectRevision.findOne({
            where: {
                revisionPeriodId: revisionPeriod.id,
                inscriptionSubjectId: revision.inscriptionSubjectId,
                opportunity: { [sequelize_1.Op.lt]: revision.opportunity },
                status: 'approved',
            },
            transaction: t,
        });
        if (earlierApproval) {
            yield t.rollback();
            return res.status(400).json({
                message: `El estudiante ya aprobó en la Oportunidad ${earlierApproval.opportunity}. No se pueden registrar notas en oportunidades posteriores.`,
            });
        }
        const userId = (_b = (_a = req.session) === null || _a === void 0 ? void 0 : _a.user) === null || _b === void 0 ? void 0 : _b.personId;
        const submittedScore = score != null ? Number(score) : null;
        if (submittedScore !== null && (!Number.isFinite(submittedScore) || !Number.isInteger(submittedScore))) {
            yield t.rollback();
            return res.status(400).json({ message: 'La nota de revisión debe ser un número entero' });
        }
        // Validate the score range against the configured max grade
        const maxGrade = yield getMaxGrade();
        if (submittedScore !== null && (submittedScore < 0 || submittedScore > maxGrade)) {
            yield t.rollback();
            return res.status(400).json({ message: `La nota de revisión debe estar entre 0 y ${maxGrade}` });
        }
        // A score of zero is always an absence, regardless of the input method.
        const absentFlag = !!isAbsent || submittedScore === 0;
        // When absent: score = 0, status = failed (matches evaluation plan logic)
        const numericScore = absentFlag ? 0 : submittedScore;
        const isApproved = numericScore != null && numericScore >= revisionPeriod.passingGrade;
        const previousRevScore = revision.score;
        const previousRevStatus = revision.status;
        yield revision.update({
            score: numericScore,
            status: numericScore != null ? (isApproved ? 'approved' : 'failed') : 'pending',
            isAbsent: absentFlag,
            gradedBy: userId,
            gradedAt: new Date(),
        }, { transaction: t });
        yield (0, gradeChangeLogService_1.logGradeChange)({
            entityType: 'inscription_subject_revision',
            entityId: revision.id,
            previousScore: previousRevScore != null ? Number(previousRevScore) : null,
            newScore: numericScore,
            previousStatus: previousRevStatus || null,
            newStatus: revision.status,
            gradeType: 'revision',
            editedBy: (_d = (_c = req.session) === null || _c === void 0 ? void 0 : _c.user) === null || _d === void 0 ? void 0 : _d.id,
            editorRole: 'teacher',
            metadata: { revisionPeriodId: revisionPeriod.id, inscriptionSubjectId: revision.inscriptionSubjectId, opportunity: revision.opportunity, gradedByPersonId: userId },
        }, t);
        // Re-grading an opportunity invalidates every later attempt, so all
        // subsequent opportunities are cleared back to pending.
        if (numericScore != null) {
            yield index_1.InscriptionSubjectRevision.update({ score: null, status: 'pending', isAbsent: false, gradedBy: null, gradedAt: null }, {
                where: {
                    revisionPeriodId: revisionPeriod.id,
                    inscriptionSubjectId: revision.inscriptionSubjectId,
                    opportunity: { [sequelize_1.Op.gt]: revision.opportunity },
                },
                transaction: t,
            });
        }
        // If failed and more opportunities available, create the next one
        if (numericScore != null && !isApproved) {
            const failedCount = yield index_1.InscriptionSubjectRevision.count({
                where: {
                    revisionPeriodId: revisionPeriod.id,
                    inscriptionSubjectId: revision.inscriptionSubjectId,
                    status: 'failed',
                },
                transaction: t,
            });
            if (failedCount < revisionPeriod.maxOpportunities) {
                const nextOpp = revision.opportunity + 1;
                const exists = yield index_1.InscriptionSubjectRevision.findOne({
                    where: {
                        revisionPeriodId: revisionPeriod.id,
                        inscriptionSubjectId: revision.inscriptionSubjectId,
                        opportunity: nextOpp,
                    },
                    transaction: t,
                });
                if (!exists) {
                    yield index_1.InscriptionSubjectRevision.create({
                        revisionPeriodId: revisionPeriod.id,
                        inscriptionSubjectId: revision.inscriptionSubjectId,
                        opportunity: nextOpp,
                        status: 'pending',
                    }, { transaction: t });
                }
            }
        }
        yield t.commit();
        return res.json({ message: 'Nota guardada correctamente', revision });
    }
    catch (error) {
        yield t.rollback();
        console.error('[saveRevisionGrade] Error:', error);
        return res.status(500).json({ message: error.message || 'Error al guardar nota' });
    }
});
exports.saveRevisionGrade = saveRevisionGrade;
const bulkSaveRevisionGrades = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e;
    const t = yield database_1.default.transaction();
    try {
        const schoolPeriodId = parseInt(req.params.schoolPeriodId, 10);
        const { grades } = req.body;
        if (!schoolPeriodId || !grades || !Array.isArray(grades)) {
            yield t.rollback();
            return res.status(400).json({ message: 'Datos inválidos' });
        }
        const revisionPeriod = yield index_1.RevisionPeriod.findOne({
            where: { schoolPeriodId },
            transaction: t,
        });
        if (!revisionPeriod || revisionPeriod.status !== 'open') {
            yield t.rollback();
            return res.status(400).json({ message: 'El período de revisión no está abierto' });
        }
        const userId = (_b = (_a = req.session) === null || _a === void 0 ? void 0 : _a.user) === null || _b === void 0 ? void 0 : _b.personId;
        let saved = 0;
        const skipped = [];
        for (const { revisionId, score, isAbsent } of grades) {
            const revision = yield index_1.InscriptionSubjectRevision.findByPk(revisionId, { transaction: t });
            if (!revision || revision.revisionPeriodId !== revisionPeriod.id)
                continue;
            // Only allow saving grades for the currently active opportunity
            if (revision.opportunity !== revisionPeriod.currentOpportunity) {
                yield t.rollback();
                return res.status(400).json({
                    message: `Solo se puede editar la Oportunidad ${revisionPeriod.currentOpportunity}. La Oportunidad ${revision.opportunity} no está activa.`,
                });
            }
            // If the student already approved in a previous opportunity, skip this
            // student instead of blocking the entire save.
            const earlierApproval = yield index_1.InscriptionSubjectRevision.findOne({
                where: {
                    revisionPeriodId: revisionPeriod.id,
                    inscriptionSubjectId: revision.inscriptionSubjectId,
                    opportunity: { [sequelize_1.Op.lt]: revision.opportunity },
                    status: 'approved',
                },
                transaction: t,
            });
            if (earlierApproval) {
                // Get student name for the warning message
                const insSub = yield index_1.InscriptionSubject.findByPk(revision.inscriptionSubjectId, {
                    include: [{ association: 'inscription', include: [{ association: 'student' }] }],
                    transaction: t,
                });
                const studentName = ((_c = insSub === null || insSub === void 0 ? void 0 : insSub.inscription) === null || _c === void 0 ? void 0 : _c.student)
                    ? `${insSub.inscription.student.lastName || ''} ${insSub.inscription.student.firstName || ''}`.trim()
                    : `Inscripción ${revision.inscriptionSubjectId}`;
                skipped.push({
                    revisionId,
                    reason: `${studentName} ya aprobó en la Oportunidad ${earlierApproval.opportunity}`,
                });
                continue;
            }
            const submittedScore = score != null ? Number(score) : null;
            if (submittedScore !== null && (!Number.isFinite(submittedScore) || !Number.isInteger(submittedScore))) {
                yield t.rollback();
                return res.status(400).json({ message: 'La nota de revisión debe ser un número entero' });
            }
            // Validate the score range against the configured max grade
            const maxGrade = yield getMaxGrade();
            if (submittedScore !== null && (submittedScore < 0 || submittedScore > maxGrade)) {
                yield t.rollback();
                return res.status(400).json({ message: `La nota de revisión debe estar entre 0 y ${maxGrade}` });
            }
            // A score of zero is always an absence, regardless of the input method.
            const absentFlag = !!isAbsent || submittedScore === 0;
            // When absent: score = 0, status = failed (matches evaluation plan logic)
            const numericScore = absentFlag ? 0 : submittedScore;
            const isApproved = numericScore != null && numericScore >= revisionPeriod.passingGrade;
            const previousBulkScore = revision.score;
            const previousBulkStatus = revision.status;
            yield revision.update({
                score: numericScore,
                status: numericScore != null ? (isApproved ? 'approved' : 'failed') : 'pending',
                isAbsent: absentFlag,
                gradedBy: userId,
                gradedAt: new Date(),
            }, { transaction: t });
            yield (0, gradeChangeLogService_1.logGradeChange)({
                entityType: 'inscription_subject_revision',
                entityId: revision.id,
                previousScore: previousBulkScore != null ? Number(previousBulkScore) : null,
                newScore: numericScore,
                previousStatus: previousBulkStatus || null,
                newStatus: revision.status,
                gradeType: 'revision',
                editedBy: (_e = (_d = req.session) === null || _d === void 0 ? void 0 : _d.user) === null || _e === void 0 ? void 0 : _e.id,
                editorRole: 'teacher',
                metadata: { revisionPeriodId: revisionPeriod.id, inscriptionSubjectId: revision.inscriptionSubjectId, opportunity: revision.opportunity, gradedByPersonId: userId, bulk: true },
            }, t);
            // Re-grading an opportunity invalidates every later attempt, so all
            // subsequent opportunities are cleared back to pending.
            if (numericScore != null) {
                yield index_1.InscriptionSubjectRevision.update({ score: null, status: 'pending', isAbsent: false, gradedBy: null, gradedAt: null }, {
                    where: {
                        revisionPeriodId: revisionPeriod.id,
                        inscriptionSubjectId: revision.inscriptionSubjectId,
                        opportunity: { [sequelize_1.Op.gt]: revision.opportunity },
                    },
                    transaction: t,
                });
            }
            if (numericScore != null && !isApproved) {
                const failedCount = yield index_1.InscriptionSubjectRevision.count({
                    where: {
                        revisionPeriodId: revisionPeriod.id,
                        inscriptionSubjectId: revision.inscriptionSubjectId,
                        status: 'failed',
                    },
                    transaction: t,
                });
                if (failedCount < revisionPeriod.maxOpportunities) {
                    const nextOpp = revision.opportunity + 1;
                    const exists = yield index_1.InscriptionSubjectRevision.findOne({
                        where: {
                            revisionPeriodId: revisionPeriod.id,
                            inscriptionSubjectId: revision.inscriptionSubjectId,
                            opportunity: nextOpp,
                        },
                        transaction: t,
                    });
                    if (!exists) {
                        yield index_1.InscriptionSubjectRevision.create({
                            revisionPeriodId: revisionPeriod.id,
                            inscriptionSubjectId: revision.inscriptionSubjectId,
                            opportunity: nextOpp,
                            status: 'pending',
                        }, { transaction: t });
                    }
                }
            }
            saved++;
        }
        yield t.commit();
        if (skipped.length > 0) {
            return res.json({
                message: `${saved} notas guardadas. ${skipped.length} estudiante(s) omitido(s) por tener aprobación previa.`,
                saved,
                skipped,
            });
        }
        return res.json({ message: `${saved} notas guardadas correctamente`, saved });
    }
    catch (error) {
        yield t.rollback();
        console.error('[bulkSaveRevisionGrades] Error:', error);
        return res.status(500).json({ message: error.message || 'Error al guardar notas' });
    }
});
exports.bulkSaveRevisionGrades = bulkSaveRevisionGrades;
const recalculateRevisionPeriod = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const t = yield database_1.default.transaction();
    try {
        const schoolPeriodId = parseInt(req.params.schoolPeriodId, 10);
        if (!schoolPeriodId) {
            return res.status(400).json({ message: 'schoolPeriodId es obligatorio' });
        }
        const result = yield revisionPeriodService_1.RevisionPeriodService.recalculateRevisionPeriod(schoolPeriodId, t);
        yield t.commit();
        return res.json({
            message: `Recálculo completado: ${result.created} nuevas reparaciones, ${result.removed} reparaciones eliminadas`,
            revisionPeriod: result.revisionPeriod,
            created: result.created,
            removed: result.removed,
        });
    }
    catch (error) {
        yield t.rollback();
        console.error('[recalculateRevisionPeriod] Error:', error);
        return res.status(500).json({ message: error.message || 'Error al recalcular período de revisión' });
    }
});
exports.recalculateRevisionPeriod = recalculateRevisionPeriod;
const resetRevisionPeriod = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const t = yield database_1.default.transaction();
    try {
        const schoolPeriodId = parseInt(req.params.schoolPeriodId, 10);
        if (!schoolPeriodId) {
            return res.status(400).json({ message: 'schoolPeriodId es obligatorio' });
        }
        // Only Master can reset
        const userRoles = ((_b = (_a = req.session) === null || _a === void 0 ? void 0 : _a.user) === null || _b === void 0 ? void 0 : _b.roles) || [];
        if (!userRoles.includes('Master')) {
            yield t.rollback();
            return res.status(403).json({ message: 'Solo el rol Master puede reiniciar el período de revisión' });
        }
        const result = yield revisionPeriodService_1.RevisionPeriodService.resetRevisionPeriod(schoolPeriodId, t);
        yield t.commit();
        return res.json({
            message: `Período de revisión reiniciado. ${result.deleted} registros eliminados.`,
            revisionPeriod: result.revisionPeriod,
            deleted: result.deleted,
        });
    }
    catch (error) {
        yield t.rollback();
        console.error('[resetRevisionPeriod] Error:', error);
        return res.status(500).json({ message: error.message || 'Error al reiniciar período de revisión' });
    }
});
exports.resetRevisionPeriod = resetRevisionPeriod;
const advanceOpportunity = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const t = yield database_1.default.transaction();
    try {
        const schoolPeriodId = parseInt(req.params.schoolPeriodId, 10);
        if (!schoolPeriodId) {
            yield t.rollback();
            return res.status(400).json({ message: 'schoolPeriodId es obligatorio' });
        }
        const requestedOpportunity = ((_a = req.body) === null || _a === void 0 ? void 0 : _a.opportunity) ? parseInt(req.body.opportunity, 10) : null;
        const revisionPeriod = requestedOpportunity
            ? yield revisionPeriodService_1.RevisionPeriodService.setOpportunity(schoolPeriodId, requestedOpportunity, t)
            : yield revisionPeriodService_1.RevisionPeriodService.advanceOpportunity(schoolPeriodId, t);
        yield t.commit();
        return res.json({
            message: `Oportunidad ${revisionPeriod.currentOpportunity} habilitada`,
            currentOpportunity: revisionPeriod.currentOpportunity,
        });
    }
    catch (error) {
        yield t.rollback();
        console.error('[advanceOpportunity] Error:', error);
        return res.status(400).json({ message: error.message || 'Error al avanzar oportunidad' });
    }
});
exports.advanceOpportunity = advanceOpportunity;
const reopenRevisionPeriod = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const t = yield database_1.default.transaction();
    try {
        const schoolPeriodId = parseInt(req.params.schoolPeriodId, 10);
        if (!schoolPeriodId) {
            return res.status(400).json({ message: 'schoolPeriodId es obligatorio' });
        }
        const revisionPeriod = yield revisionPeriodService_1.RevisionPeriodService.reopenRevisionPeriod(schoolPeriodId, t);
        yield t.commit();
        return res.json({
            message: 'Período de revisión reabierto correctamente',
            revisionPeriod,
        });
    }
    catch (error) {
        yield t.rollback();
        console.error('[reopenRevisionPeriod] Error:', error);
        return res.status(500).json({ message: error.message || 'Error al reabrir período de revisión' });
    }
});
exports.reopenRevisionPeriod = reopenRevisionPeriod;
const updateMaxOpportunities = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const t = yield database_1.default.transaction();
    try {
        const schoolPeriodId = parseInt(req.params.schoolPeriodId, 10);
        const { maxOpportunities } = req.body;
        if (!schoolPeriodId) {
            yield t.rollback();
            return res.status(400).json({ message: 'schoolPeriodId es obligatorio' });
        }
        if (maxOpportunities == null) {
            yield t.rollback();
            return res.status(400).json({ message: 'maxOpportunities es obligatorio' });
        }
        const revisionPeriod = yield revisionPeriodService_1.RevisionPeriodService.updateMaxOpportunities(schoolPeriodId, Number(maxOpportunities), t);
        yield t.commit();
        return res.json({
            message: 'Número de intentos actualizado',
            revisionPeriod,
        });
    }
    catch (error) {
        yield t.rollback();
        console.error('[updateMaxOpportunities] Error:', error);
        return res.status(500).json({ message: error.message || 'Error al actualizar intentos' });
    }
});
exports.updateMaxOpportunities = updateMaxOpportunities;
// Extraordinary grade override by Control de Estudios (or Master).
// Allows editing any opportunity (not just the active one) and records
// a full audit trail in revision_grade_edit_audits.
const overrideRevisionGrade = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f;
    const t = yield database_1.default.transaction();
    try {
        const revisionId = parseInt(req.params.revisionId, 10);
        const schoolPeriodId = parseInt(req.params.schoolPeriodId, 10);
        const { score, isAbsent, reason } = req.body;
        // Only Control de Estudios and Master can override revision grades
        const userRoles = ((_b = (_a = req.session) === null || _a === void 0 ? void 0 : _a.user) === null || _b === void 0 ? void 0 : _b.roles) || [];
        if (!userRoles.includes('Control de Estudios') && !userRoles.includes('Master')) {
            yield t.rollback();
            return res.status(403).json({ message: 'Solo Control de Estudios o Master pueden modificar notas de revisión extraordinariamente' });
        }
        const userId = (_d = (_c = req.session) === null || _c === void 0 ? void 0 : _c.user) === null || _d === void 0 ? void 0 : _d.personId;
        if (!userId) {
            yield t.rollback();
            return res.status(401).json({ message: 'No autorizado' });
        }
        const revisionPeriod = yield index_1.RevisionPeriod.findOne({
            where: { schoolPeriodId },
            transaction: t,
        });
        if (!revisionPeriod) {
            yield t.rollback();
            return res.status(404).json({ message: 'Período de revisión no encontrado' });
        }
        // Allow override when open or completed (not closed/pending)
        if (revisionPeriod.status === 'pending' || revisionPeriod.status === 'closed') {
            yield t.rollback();
            return res.status(400).json({ message: 'El período de revisión no permite ediciones en su estado actual' });
        }
        const revision = yield index_1.InscriptionSubjectRevision.findByPk(revisionId, { transaction: t });
        if (!revision || revision.revisionPeriodId !== revisionPeriod.id) {
            yield t.rollback();
            return res.status(404).json({ message: 'Revisión no encontrada' });
        }
        // Prevent editing future opportunities (opportunity > currentOpportunity)
        if (revision.opportunity > revisionPeriod.currentOpportunity) {
            yield t.rollback();
            return res.status(400).json({
                message: `No se puede editar la Oportunidad ${revision.opportunity} porque aún no ha sido alcanzada (oportunidad activa: ${revisionPeriod.currentOpportunity}).`,
            });
        }
        // Validate integer score
        const submittedScore = score != null ? Number(score) : null;
        if (submittedScore !== null && (!Number.isFinite(submittedScore) || !Number.isInteger(submittedScore))) {
            yield t.rollback();
            return res.status(400).json({ message: 'La nota de revisión debe ser un número entero' });
        }
        // Validate the score range against the configured max grade
        const maxGrade = yield getMaxGrade();
        if (submittedScore !== null && (submittedScore < 0 || submittedScore > maxGrade)) {
            yield t.rollback();
            return res.status(400).json({ message: `La nota de revisión debe estar entre 0 y ${maxGrade}` });
        }
        const absentFlag = !!isAbsent || submittedScore === 0;
        const numericScore = absentFlag ? 0 : submittedScore;
        const isApproved = numericScore != null && numericScore >= revisionPeriod.passingGrade;
        const newStatus = numericScore != null ? (isApproved ? 'approved' : 'failed') : 'pending';
        // Snapshot previous values for audit
        const previousScore = revision.score;
        const previousStatus = revision.status;
        const previousIsAbsent = revision.isAbsent;
        // Update the revision
        yield revision.update({
            score: numericScore,
            status: newStatus,
            isAbsent: absentFlag,
            gradedBy: userId,
            gradedAt: new Date(),
        }, { transaction: t });
        // Re-grading an opportunity invalidates every later attempt, so all
        // subsequent opportunities are cleared back to pending (same as saveRevisionGrade).
        if (numericScore != null) {
            yield index_1.InscriptionSubjectRevision.update({ score: null, status: 'pending', isAbsent: false, gradedBy: null, gradedAt: null }, {
                where: {
                    revisionPeriodId: revisionPeriod.id,
                    inscriptionSubjectId: revision.inscriptionSubjectId,
                    opportunity: { [sequelize_1.Op.gt]: revision.opportunity },
                },
                transaction: t,
            });
        }
        // If failed and more opportunities available, create the next one
        if (numericScore != null && !isApproved) {
            const failedCount = yield index_1.InscriptionSubjectRevision.count({
                where: {
                    revisionPeriodId: revisionPeriod.id,
                    inscriptionSubjectId: revision.inscriptionSubjectId,
                    status: 'failed',
                },
                transaction: t,
            });
            if (failedCount < revisionPeriod.maxOpportunities) {
                const nextOpp = revision.opportunity + 1;
                const exists = yield index_1.InscriptionSubjectRevision.findOne({
                    where: {
                        revisionPeriodId: revisionPeriod.id,
                        inscriptionSubjectId: revision.inscriptionSubjectId,
                        opportunity: nextOpp,
                    },
                    transaction: t,
                });
                if (!exists) {
                    yield index_1.InscriptionSubjectRevision.create({
                        revisionPeriodId: revisionPeriod.id,
                        inscriptionSubjectId: revision.inscriptionSubjectId,
                        opportunity: nextOpp,
                        status: 'pending',
                    }, { transaction: t });
                }
            }
        }
        // Record the audit trail
        yield (0, gradeChangeLogService_1.logGradeChange)({
            entityType: 'inscription_subject_revision',
            entityId: revision.id,
            previousScore: previousScore != null ? Number(previousScore) : null,
            newScore: numericScore,
            previousStatus: previousStatus || null,
            newStatus: newStatus,
            gradeType: 'revision',
            editedBy: (_f = (_e = req.session) === null || _e === void 0 ? void 0 : _e.user) === null || _f === void 0 ? void 0 : _f.id,
            editorRole: 'control_estudios',
            reason: (reason === null || reason === void 0 ? void 0 : reason.trim()) || null,
            metadata: { revisionPeriodId: revisionPeriod.id, inscriptionSubjectId: revision.inscriptionSubjectId, opportunity: revision.opportunity, gradedByPersonId: userId, previousIsAbsent: !!previousIsAbsent, newIsAbsent: absentFlag, extraordinary: true },
        }, t);
        yield t.commit();
        return res.json({ message: 'Nota modificada correctamente', revision });
    }
    catch (error) {
        yield t.rollback();
        console.error('[overrideRevisionGrade] Error:', error);
        return res.status(500).json({ message: error.message || 'Error al modificar nota' });
    }
});
exports.overrideRevisionGrade = overrideRevisionGrade;
// Get audit history for a specific revision (or all revisions in a period)
const getRevisionGradeAudits = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const schoolPeriodId = parseInt(req.params.schoolPeriodId, 10);
        if (!schoolPeriodId) {
            return res.status(400).json({ message: 'schoolPeriodId es obligatorio' });
        }
        const revisionPeriod = yield index_1.RevisionPeriod.findOne({
            where: { schoolPeriodId },
        });
        if (!revisionPeriod) {
            return res.json({ audits: [] });
        }
        const revisionId = req.params.revisionId ? parseInt(req.params.revisionId, 10) : null;
        const where = {};
        if (revisionId) {
            where.revisionId = revisionId;
        }
        const audits = yield index_1.RevisionGradeEditAudit.findAll({
            where,
            include: [
                {
                    model: index_1.InscriptionSubjectRevision,
                    as: 'revision',
                    where: { revisionPeriodId: revisionPeriod.id },
                    include: [
                        {
                            model: index_1.InscriptionSubject,
                            as: 'inscriptionSubject',
                            include: [
                                { association: 'subject' },
                                {
                                    model: index_1.Inscription,
                                    as: 'inscription',
                                    include: [{ association: 'student' }],
                                },
                            ],
                        },
                    ],
                },
                { model: index_1.Person, as: 'editor' },
            ],
            order: [['editedAt', 'DESC']],
        });
        const result = audits.map((audit) => {
            var _a, _b, _c;
            const rev = audit.revision;
            const insSub = rev === null || rev === void 0 ? void 0 : rev.inscriptionSubject;
            return {
                id: audit.id,
                revisionId: audit.revisionId,
                opportunity: rev === null || rev === void 0 ? void 0 : rev.opportunity,
                studentName: ((_a = insSub === null || insSub === void 0 ? void 0 : insSub.inscription) === null || _a === void 0 ? void 0 : _a.student)
                    ? `${insSub.inscription.student.lastName || ''} ${insSub.inscription.student.firstName || ''}`.trim()
                    : '',
                subjectName: ((_b = insSub === null || insSub === void 0 ? void 0 : insSub.subject) === null || _b === void 0 ? void 0 : _b.name) || '',
                subjectAbbreviation: ((_c = insSub === null || insSub === void 0 ? void 0 : insSub.subject) === null || _c === void 0 ? void 0 : _c.abbreviation) || '',
                editedBy: audit.editedBy,
                editorName: audit.editor
                    ? `${audit.editor.firstName || ''} ${audit.editor.lastName || ''}`.trim()
                    : '',
                previousScore: audit.previousScore != null ? Number(audit.previousScore) : null,
                newScore: audit.newScore != null ? Number(audit.newScore) : null,
                previousStatus: audit.previousStatus,
                newStatus: audit.newStatus,
                previousIsAbsent: audit.previousIsAbsent,
                newIsAbsent: audit.newIsAbsent,
                reason: audit.reason,
                editedAt: audit.editedAt,
            };
        });
        return res.json({ audits: result });
    }
    catch (error) {
        console.error('[getRevisionGradeAudits] Error:', error);
        return res.status(500).json({ message: error.message || 'Error al obtener auditoría' });
    }
});
exports.getRevisionGradeAudits = getRevisionGradeAudits;
/**
 * Export a printable Excel nomina for the revision period.
 * Format matches RevisiónMockup.xlsx:
 *  - Single sheet with all grades stacked vertically
 *  - Header: school name | "REVISIÓN" | school year
 *  - Per grade: GRADO (merged) | # | CÉDULA | APELLIDOS Y NOMBRES | Sec | subject abbreviations
 *  - Subject cells filled with revision grades (score or 'I' for absent)
 *  - Non-revision subjects shown as solid gray cells
 */
const exportRevisionNominaExcel = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
    try {
        const schoolPeriodId = parseInt(req.params.schoolPeriodId, 10);
        if (!schoolPeriodId) {
            return res.status(400).json({ message: 'schoolPeriodId es obligatorio' });
        }
        const schoolPeriod = yield index_1.SchoolPeriod.findByPk(schoolPeriodId);
        if (!schoolPeriod) {
            return res.status(404).json({ message: 'Período escolar no encontrado' });
        }
        const institutionNameSetting = yield index_1.Setting.findOne({ where: { key: 'institution_name' } });
        const institutionName = (institutionNameSetting === null || institutionNameSetting === void 0 ? void 0 : institutionNameSetting.getDataValue('value')) || 'Institución Educativa';
        // Zero-pad scores to the same digit count as the configured max grade
        // (e.g. max_grade=20 -> "03", "11").
        const maxGradeSetting = yield index_1.Setting.findOne({ where: { key: 'max_grade' } });
        const maxGrade = Number(maxGradeSetting === null || maxGradeSetting === void 0 ? void 0 : maxGradeSetting.getDataValue('value')) || 20;
        const gradeDigits = Math.max(2, String(maxGrade).length);
        const revisionPeriod = yield index_1.RevisionPeriod.findOne({ where: { schoolPeriodId } });
        // Load all revisions for this period (if it exists)
        const revisionMap = new Map(); // inscriptionSubjectId -> opportunity -> revision
        // Cache of notRepairable subject IDs per gradeId, so we can skip
        // subjects flagged as "No Reparable" even if revisions already exist.
        const exportNotRepairableCache = new Map();
        const resolveExportNotRepairable = (gradeId) => __awaiter(void 0, void 0, void 0, function* () {
            if (!gradeId)
                return new Set();
            if (exportNotRepairableCache.has(gradeId))
                return exportNotRepairableCache.get(gradeId);
            const map = yield (0, subjectOrderService_1.getSubjectNotRepairableMapByGradeAndPeriod)(gradeId, schoolPeriodId);
            const set = new Set();
            for (const [subjectId, notRepairable] of map.entries()) {
                if (notRepairable)
                    set.add(subjectId);
            }
            exportNotRepairableCache.set(gradeId, set);
            return set;
        });
        if (revisionPeriod) {
            const revisions = yield index_1.InscriptionSubjectRevision.findAll({
                where: { revisionPeriodId: revisionPeriod.id },
                include: [
                    {
                        model: index_1.InscriptionSubject,
                        as: 'inscriptionSubject',
                        required: true,
                        include: [
                            {
                                model: index_1.Inscription,
                                as: 'inscription',
                                where: { schoolPeriodId },
                                include: [{ association: 'student' }, { association: 'grade' }, { association: 'section' }],
                            },
                            { association: 'subject' },
                        ],
                    },
                ],
                order: [['inscriptionSubjectId', 'ASC'], ['opportunity', 'ASC']],
            });
            for (const rev of revisions) {
                const insSub = rev.inscriptionSubject;
                // Skip revisions for subjects flagged as "No Reparable" (Opción A: filtrar, no borrar).
                if ((insSub === null || insSub === void 0 ? void 0 : insSub.subjectId) && ((_a = insSub === null || insSub === void 0 ? void 0 : insSub.inscription) === null || _a === void 0 ? void 0 : _a.gradeId)) {
                    const notRepairableSet = yield resolveExportNotRepairable(insSub.inscription.gradeId);
                    if (notRepairableSet.has(insSub.subjectId))
                        continue;
                }
                const insSubId = rev.inscriptionSubjectId;
                if (!revisionMap.has(insSubId))
                    revisionMap.set(insSubId, new Map());
                revisionMap.get(insSubId).set(rev.opportunity, {
                    score: rev.score,
                    status: rev.status,
                    isAbsent: rev.isAbsent || false,
                    gradedBy: rev.gradedBy,
                    opportunity: rev.opportunity,
                });
            }
        }
        // Load all inscriptions with their subjects for this period
        const allInscriptions = yield index_1.Inscription.findAll({
            where: { schoolPeriodId },
            include: [
                { association: 'student' },
                { association: 'grade' },
                { association: 'section' },
                {
                    model: index_1.InscriptionSubject,
                    as: 'inscriptionSubjects',
                    include: [{ association: 'subject' }],
                },
            ],
        });
        // Sort students canonically
        (0, studentSortService_1.sortInscriptions)(allInscriptions);
        // Load pending subjects for this period's inscriptions so we can exclude
        // them from the revision nomina. PendingSubject links a subject from a
        // previous period to the current inscription (newInscriptionId).
        const inscriptionIds = allInscriptions.map((ins) => ins.id);
        const pendingSubjects = inscriptionIds.length > 0
            ? yield index_1.PendingSubject.findAll({
                where: { newInscriptionId: { [sequelize_1.Op.in]: inscriptionIds } },
                transaction: undefined,
            })
            : [];
        // Build a set of "inscriptionId-subjectId" pairs that are pending subjects
        const pendingSet = new Set();
        for (const ps of pendingSubjects) {
            pendingSet.add(`${ps.newInscriptionId}-${ps.subjectId}`);
        }
        // Also collect InscriptionSubject IDs that correspond to pending subjects
        // so we can exclude their revisions from the revisionMap.
        const pendingInsSubIds = new Set();
        for (const ins of allInscriptions) {
            for (const insSub of (ins.inscriptionSubjects || [])) {
                if (pendingSet.has(`${ins.id}-${insSub.subjectId}`)) {
                    pendingInsSubIds.add(insSub.id);
                }
            }
        }
        // Remove pending subject revisions from the revisionMap
        for (const insSubId of pendingInsSubIds) {
            revisionMap.delete(insSubId);
        }
        // Students with unresolved pending subjects (Materia Pendiente) are
        // excluded from the revision nomina entirely.
        const excludedPersonIds = yield (0, revisionPeriodService_1.getPersonIdsWithUnresolvedPending)(schoolPeriodId, inscriptionIds);
        // Build grade groups: gradeId -> { gradeName, gradeOrder, subjects (canonical), students }
        const gradeGroupsMap = new Map();
        // Cache for grade subject lists
        const gradeSubjectsCache = new Map();
        const notRepairableCache = new Map();
        const resolveNotRepairable = (gradeId) => __awaiter(void 0, void 0, void 0, function* () {
            if (notRepairableCache.has(gradeId))
                return notRepairableCache.get(gradeId);
            const map = yield (0, subjectOrderService_1.getSubjectNotRepairableMapByGradeAndPeriod)(gradeId, schoolPeriodId);
            const set = new Set();
            for (const [subjectId, notRepairable] of map.entries()) {
                if (notRepairable)
                    set.add(subjectId);
            }
            notRepairableCache.set(gradeId, set);
            return set;
        });
        const resolveGradeSubjects = (gradeId) => __awaiter(void 0, void 0, void 0, function* () {
            if (gradeSubjectsCache.has(gradeId))
                return gradeSubjectsCache.get(gradeId);
            const pg = yield index_1.PeriodGrade.findOne({
                where: { gradeId, schoolPeriodId },
                include: [{
                        model: index_1.Subject,
                        as: 'subjects',
                        through: { where: { active: true } },
                    }],
            });
            const orderMap = yield (0, subjectOrderService_1.getSubjectOrderMapByGradeAndPeriod)(gradeId, schoolPeriodId);
            const notRepairableSet = yield resolveNotRepairable(gradeId);
            const rawSubjects = ((pg === null || pg === void 0 ? void 0 : pg.subjects) || []).filter((s) => !notRepairableSet.has(s.id));
            const sorted = (0, subjectOrderService_1.sortSubjectsByOrder)(rawSubjects, (s) => s.id, (s) => s.name, orderMap).map((s) => {
                var _a;
                return ({
                    subjectId: s.id,
                    name: s.name || '',
                    abbreviation: s.abbreviation || s.name || '',
                    order: (_a = orderMap.get(s.id)) !== null && _a !== void 0 ? _a : 999,
                });
            });
            gradeSubjectsCache.set(gradeId, sorted);
            return sorted;
        });
        for (const ins of allInscriptions) {
            const insAny = ins;
            // Skip students who still owe pending subjects — they cannot go to revision.
            if (excludedPersonIds.has(insAny.personId))
                continue;
            const gradeId = insAny.gradeId;
            if (!gradeId)
                continue;
            const gradeName = ((_b = insAny.grade) === null || _b === void 0 ? void 0 : _b.name) || '';
            const gradeOrder = (_d = (_c = insAny.grade) === null || _c === void 0 ? void 0 : _c.order) !== null && _d !== void 0 ? _d : 999;
            if (!gradeGroupsMap.has(gradeId)) {
                const subjects = yield resolveGradeSubjects(gradeId);
                gradeGroupsMap.set(gradeId, {
                    gradeName,
                    gradeOrder,
                    subjects,
                    students: [],
                });
            }
            const group = gradeGroupsMap.get(gradeId);
            const subjectsBySubjectId = new Map();
            for (const insSub of (insAny.inscriptionSubjects || [])) {
                // Skip pending subjects (from previous periods)
                if (pendingSet.has(`${ins.id}-${insSub.subjectId}`))
                    continue;
                if (insSub.subjectId) {
                    subjectsBySubjectId.set(insSub.subjectId, { inscriptionSubjectId: insSub.id });
                }
            }
            group.students.push({
                studentId: insAny.personId,
                studentName: `${((_e = insAny.student) === null || _e === void 0 ? void 0 : _e.lastName) || ''} ${((_f = insAny.student) === null || _f === void 0 ? void 0 : _f.firstName) || ''}`.trim(),
                document: ((_g = insAny.student) === null || _g === void 0 ? void 0 : _g.document) || '',
                documentType: ((_h = insAny.student) === null || _h === void 0 ? void 0 : _h.documentType) || '',
                section: ((_j = insAny.section) === null || _j === void 0 ? void 0 : _j.name) || '',
                subjectsBySubjectId,
            });
        }
        // Only include students that have at least one subject in revision,
        // and only grades that have at least one such student.
        const gradeGroups = Array.from(gradeGroupsMap.values())
            .map(g => (Object.assign(Object.assign({}, g), { students: g.students
                .filter(s => Array.from(s.subjectsBySubjectId.values()).some(subj => revisionMap.has(subj.inscriptionSubjectId)))
                // Within each grade: group by section (A first, then B...) and
                // order by document number inside each section.
                .sort((a, b) => {
                const secCmp = (a.section || '').localeCompare(b.section || '', 'es', { numeric: true });
                if (secCmp !== 0)
                    return secCmp;
                const docA = parseInt(a.document, 10);
                const docB = parseInt(b.document, 10);
                if (Number.isFinite(docA) && Number.isFinite(docB) && docA !== docB)
                    return docA - docB;
                return (a.document || '').localeCompare(b.document || '', 'es', { numeric: true });
            }) })))
            .filter(g => g.students.length > 0)
            .sort((a, b) => {
            if (a.gradeOrder !== b.gradeOrder)
                return b.gradeOrder - a.gradeOrder;
            return b.gradeName.localeCompare(a.gradeName, 'es', { numeric: true });
        });
        if (gradeGroups.length === 0) {
            return res.status(404).json({ message: 'No hay estudiantes en revisión' });
        }
        // Determine the max number of subjects across all grades (for column count)
        const maxSubjects = Math.max(...gradeGroups.map(g => g.subjects.length));
        // Build workbook
        const workbook = new exceljs_1.default.Workbook();
        const sheet = workbook.addWorksheet('Revisión');
        // Logo
        const logoPath = path_1.default.resolve(process.cwd(), 'public', 'uploads', 'images', 'Logo_ME_Batalla_H.png');
        const logoId = fs_1.default.existsSync(logoPath)
            ? workbook.addImage({ filename: logoPath, extension: 'png' })
            : null;
        const thinBorder = { style: 'thin', color: { argb: 'FF000000' } };
        const mediumBorder = { style: 'medium', color: { argb: 'FF000000' } };
        const cellFillGray = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFAFA' } };
        const cellFillDisabled = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB0B0B0' } };
        // Column widths (matching mockup)
        sheet.getColumn(1).width = 6.86; // GRADO
        sheet.getColumn(2).width = 3.43; // #
        sheet.getColumn(3).width = 18; // CÉDULA
        sheet.getColumn(4).width = 45; // APELLIDOS Y NOMBRES
        sheet.getColumn(5).width = 5.71; // Sec
        for (let i = 6; i < 6 + maxSubjects; i++) {
            sheet.getColumn(i).width = 5.71; // Subject columns
        }
        const totalCols = 5 + maxSubjects;
        // Compute column letter
        const colLetter = (col) => {
            let result = '';
            while (col > 0) {
                const rem = (col - 1) % 26;
                result = String.fromCharCode(65 + rem) + result;
                col = Math.floor((col - 1) / 26);
            }
            return result;
        };
        const lastCol = colLetter(totalCols);
        // Row 1: Header — school name | REVISIÓN | school year
        sheet.getRow(1).height = 21;
        sheet.mergeCells('A1:D1');
        sheet.getCell('A1').value = institutionName;
        sheet.getCell('A1').font = { bold: true, size: 14, name: 'Calibri' };
        sheet.getCell('A1').alignment = { horizontal: 'left', vertical: 'middle' };
        const revisionTitleEnd = Math.min(5 + Math.floor(maxSubjects / 2), totalCols);
        sheet.mergeCells(`E1:${colLetter(revisionTitleEnd)}1`);
        sheet.getCell('E1').value = 'REVISIÓN';
        sheet.getCell('E1').font = { bold: true, size: 14, name: 'Calibri' };
        sheet.getCell('E1').alignment = { horizontal: 'center', vertical: 'middle' };
        sheet.mergeCells(`${colLetter(revisionTitleEnd + 1)}1:${lastCol}1`);
        const periodName = String(schoolPeriod.name || '');
        const schoolYear = ((_k = periodName.match(/\d{4}\s*-\s*\d{4}/)) === null || _k === void 0 ? void 0 : _k[0]) || periodName;
        sheet.getCell(`${colLetter(revisionTitleEnd + 1)}1`).value = `Año Escolar ${schoolYear}`;
        sheet.getCell(`${colLetter(revisionTitleEnd + 1)}1`).font = { bold: true, size: 12, name: 'Calibri' };
        sheet.getCell(`${colLetter(revisionTitleEnd + 1)}1`).alignment = { horizontal: 'right', vertical: 'middle' };
        // Row 2: spacer
        sheet.getRow(2).height = 15.75;
        // Data starts at row 3
        let currentRow = 3;
        for (const group of gradeGroups) {
            const gradeName = group.gradeName.toUpperCase();
            const numStudents = group.students.length;
            const numSubjects = group.subjects.length;
            // Header row
            const headerRow = sheet.getRow(currentRow);
            headerRow.height = 18;
            // Col 1: GRADO (will be merged vertically including header row, text vertical)
            headerRow.getCell(1).value = gradeName;
            headerRow.getCell(1).font = { bold: true, size: 18, name: 'Calibri' };
            headerRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle', textRotation: 90, shrinkToFit: true };
            // Col 2-5: #, CÉDULA, APELLIDOS Y NOMBRES, Sec
            const fixedHeaders = ['#', 'CÉDULA', 'APELLIDOS Y NOMBRES', 'Sec'];
            for (let i = 0; i < fixedHeaders.length; i++) {
                const cell = headerRow.getCell(2 + i);
                cell.value = fixedHeaders[i];
                cell.font = { bold: true, size: 11, name: 'Calibri' };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            }
            // Subject columns
            for (let i = 0; i < numSubjects; i++) {
                const cell = headerRow.getCell(6 + i);
                cell.value = group.subjects[i].abbreviation;
                cell.font = { bold: true, size: 8, name: 'Arial' };
                cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            }
            // Apply borders to header row
            for (let c = 1; c <= 5 + numSubjects; c++) {
                const cell = headerRow.getCell(c);
                cell.border = {
                    top: mediumBorder,
                    bottom: thinBorder,
                    left: c === 1 ? mediumBorder : thinBorder,
                    right: (c === 5 || c === 5 + numSubjects) ? mediumBorder : thinBorder,
                };
            }
            currentRow++;
            // Data rows
            for (let si = 0; si < numStudents; si++) {
                const student = group.students[si];
                const row = sheet.getRow(currentRow);
                row.height = 18;
                // Col 1: Grade name (merged with header, no need to repeat value)
                row.getCell(1).font = { bold: true, size: 18, name: 'Calibri' };
                row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle', textRotation: 90 };
                // Col 2: #
                row.getCell(2).value = si + 1;
                row.getCell(2).font = { bold: true, size: 10, name: 'Calibri' };
                row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
                // Col 3: CÉDULA — derive the letter prefix from documentType and
                // strip any prefix baked into the stored value.
                const bareDoc = String(student.document || '').replace(/^(V|E|P|CE)\s*[-.]?\s*/i, '');
                const docPrefix = student.documentType === 'Venezolano' ? 'V'
                    : student.documentType === 'Extranjero' ? 'E'
                        : student.documentType === 'Pasaporte' ? 'P' : '';
                row.getCell(3).value = docPrefix ? `${docPrefix}-${bareDoc}` : bareDoc;
                row.getCell(3).font = { size: 10, name: 'Calibri' };
                row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
                // Col 4: APELLIDOS Y NOMBRES
                row.getCell(4).value = student.studentName;
                row.getCell(4).font = { size: 10, name: 'Calibri' };
                row.getCell(4).alignment = { horizontal: 'left', vertical: 'middle' };
                // Col 5: Sec
                const sectionName = student.section.replace(/^Secci[oó]n\s*/i, '');
                row.getCell(5).value = sectionName;
                row.getCell(5).font = { size: 10, name: 'Calibri' };
                row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
                // Subject columns
                for (let i = 0; i < numSubjects; i++) {
                    const subj = group.subjects[i];
                    const cell = row.getCell(6 + i);
                    const studentSubj = student.subjectsBySubjectId.get(subj.subjectId);
                    if (!studentSubj) {
                        // Student doesn't have this subject — disabled cell
                        cell.fill = cellFillDisabled;
                    }
                    else {
                        const revMap = revisionMap.get(studentSubj.inscriptionSubjectId);
                        if (revMap && revMap.size > 0) {
                            const currentOpp = (_l = revisionPeriod === null || revisionPeriod === void 0 ? void 0 : revisionPeriod.currentOpportunity) !== null && _l !== void 0 ? _l : 1;
                            const gradesFinalized = (revisionPeriod === null || revisionPeriod === void 0 ? void 0 : revisionPeriod.gradesFinalized) === true;
                            const allRevs = Array.from(revMap.entries())
                                .filter(([opp]) => opp <= currentOpp)
                                .sort((a, b) => a[0] - b[0]);
                            let finalRev = null;
                            for (let r = allRevs.length - 1; r >= 0; r--) {
                                const rev = allRevs[r][1];
                                if (rev.score !== null && rev.score !== undefined) {
                                    finalRev = rev;
                                    break;
                                }
                                if (rev.isAbsent === true && rev.gradedBy == null && allRevs[r][0] < currentOpp) {
                                    finalRev = rev;
                                    break;
                                }
                            }
                            if (finalRev && finalRev.score != null && Number(finalRev.score) > 0) {
                                // Has a real score (>0) — show it, zero-padded to the max grade digits
                                cell.value = String(Number(finalRev.score)).padStart(gradeDigits, '0');
                                const isApproved = finalRev.status === 'approved';
                                cell.font = isApproved
                                    ? { bold: true, size: 8, color: { argb: 'FF22A547' }, name: 'Arial' }
                                    : { bold: true, size: 8, color: { argb: 'FFDC2626' }, name: 'Arial' };
                            }
                            else if (gradesFinalized) {
                                // No real score and grades are finalized → NP
                                cell.value = 'NP';
                                cell.font = { bold: true, size: 8, color: { argb: 'FFDC2626' }, name: 'Arial' };
                            }
                            else {
                                // Not finalized → empty cell
                                cell.value = '';
                                cell.font = { bold: true, size: 8, name: 'Arial' };
                            }
                            cell.fill = cellFillGray;
                        }
                        else {
                            // Student has this subject but no revisions (not in revision for this subject)
                            cell.fill = cellFillDisabled;
                        }
                    }
                    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                }
                // Borders: outer perimeter = medium, inner = thin
                const isLastRow = si === numStudents - 1;
                for (let c = 1; c <= 5 + numSubjects; c++) {
                    const cell = row.getCell(c);
                    cell.border = {
                        top: thinBorder,
                        bottom: isLastRow ? mediumBorder : thinBorder,
                        left: c === 1 ? mediumBorder : thinBorder,
                        right: (c === 5 || c === 5 + numSubjects) ? mediumBorder : thinBorder,
                    };
                }
                currentRow++;
            }
            // Merge grade name column vertically (from header row to last student row)
            if (numStudents > 0) {
                const startMerge = currentRow - numStudents - 1; // include header row
                const endMerge = currentRow - 1;
                sheet.mergeCells(startMerge, 1, endMerge, 1);
                // Re-apply border + vertical text after merge.
                // For merged cells, ExcelJS needs the border set on every individual
                // cell within the merge — the outer perimeter must be mediumBorder.
                for (let r = startMerge; r <= endMerge; r++) {
                    const cell = sheet.getCell(r, 1);
                    cell.border = {
                        top: r === startMerge ? mediumBorder : thinBorder,
                        bottom: r === endMerge ? mediumBorder : thinBorder,
                        left: mediumBorder,
                        right: mediumBorder,
                    };
                    cell.alignment = { horizontal: 'center', vertical: 'middle', textRotation: 90, shrinkToFit: true };
                }
                // Ensure the top border of the first row of the merge is medium
                // (sometimes overwritten by the header border loop above)
                sheet.getCell(startMerge, 1).border = Object.assign(Object.assign({}, sheet.getCell(startMerge, 1).border), { top: mediumBorder });
            }
        }
        // Page setup
        sheet.pageSetup = {
            orientation: 'portrait',
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
        };
        sheet.pageSetup.margins = {
            left: 0.7, right: 0.7, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3,
        };
        const buffer = yield workbook.xlsx.writeBuffer();
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="revision-nomina-${schoolYear}.xlsx"`);
        res.send(buffer);
    }
    catch (error) {
        console.error('[exportRevisionNominaExcel] Error:', error);
        return res.status(500).json({ message: error.message || 'Error al generar Excel de revisión' });
    }
});
exports.exportRevisionNominaExcel = exportRevisionNominaExcel;
/**
 * POST /revision-periods/:schoolPeriodId/finalize-revision-grades
 *
 * Reads all InscriptionSubjectRevision for the active revision period,
 * applies the "Nota Final" logic (findFinalRevision), and creates/updates
 * SubjectFinalGrade records with gradeType='revision'.
 *
 * This makes revision grades available in the historical grades view
 * (/notas-historicas) before the school period is closed.
 *
 * Can be re-run safely: if revision grades change after finalizing,
 * pressing the button again will update the SubjectFinalGrade records.
 */
const finalizeRevisionGrades = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
    const t = yield database_1.default.transaction();
    try {
        const schoolPeriodId = parseInt(req.params.schoolPeriodId, 10);
        if (!schoolPeriodId) {
            yield t.rollback();
            return res.status(400).json({ message: 'schoolPeriodId es obligatorio' });
        }
        const revisionPeriod = yield index_1.RevisionPeriod.findOne({
            where: { schoolPeriodId },
            transaction: t,
        });
        if (!revisionPeriod) {
            yield t.rollback();
            return res.status(404).json({ message: 'No hay período de revisión' });
        }
        // Load all revisions for this period
        const revisions = yield index_1.InscriptionSubjectRevision.findAll({
            where: { revisionPeriodId: revisionPeriod.id },
            include: [
                {
                    model: index_1.InscriptionSubject,
                    as: 'inscriptionSubject',
                    required: true,
                    include: [
                        {
                            model: index_1.Inscription,
                            as: 'inscription',
                            required: true,
                            include: [{ association: 'student' }, { association: 'grade' }],
                        },
                        { association: 'subject' },
                        {
                            model: index_1.SubjectFinalGrade,
                            as: 'finalGrade',
                            required: false,
                            where: { gradeType: 'revision' },
                        },
                    ],
                },
            ],
            transaction: t,
            order: [['inscriptionSubjectId', 'ASC'], ['opportunity', 'ASC']],
        });
        // Group revisions by inscriptionSubjectId
        const revisionsByInsSubId = new Map();
        for (const rev of revisions) {
            const insSubId = rev.inscriptionSubjectId;
            if (!revisionsByInsSubId.has(insSubId))
                revisionsByInsSubId.set(insSubId, []);
            revisionsByInsSubId.get(insSubId).push({
                opportunity: rev.opportunity,
                score: rev.score,
                status: rev.status,
                isAbsent: rev.isAbsent || false,
                gradedBy: rev.gradedBy,
            });
        }
        const currentOpp = (_a = revisionPeriod.currentOpportunity) !== null && _a !== void 0 ? _a : 1;
        const passingGrade = (_b = revisionPeriod.passingGrade) !== null && _b !== void 0 ? _b : 10;
        let created = 0;
        let updated = 0;
        let skipped = 0;
        for (const [insSubId, revs] of revisionsByInsSubId) {
            // findFinalRevision: last revision (highest opportunity) with a
            // human-entered score. Auto-NP markers (opportunity closed without a
            // grade, gradedBy=null) are not real grades and must never be
            // recorded as final revision grades.
            let finalRev = null;
            const sortedRevs = [...revs].sort((a, b) => a.opportunity - b.opportunity);
            for (let i = sortedRevs.length - 1; i >= 0; i--) {
                const rev = sortedRevs[i];
                if (rev.score !== null && rev.score !== undefined && rev.gradedBy != null) {
                    finalRev = rev;
                    break;
                }
            }
            if (!finalRev) {
                skipped++;
                continue;
            }
            // Score 0 = inasistente (NP). Any other score = the actual grade.
            const finalScore = Number(finalRev.score);
            const isApproved = finalScore >= passingGrade;
            const status = isApproved ? 'aprobada' : 'reprobada';
            // Find the InscriptionSubject to get denormalized fields
            const rev0 = revisions.find(r => r.inscriptionSubjectId === insSubId);
            const insSub = rev0 === null || rev0 === void 0 ? void 0 : rev0.inscriptionSubject;
            if (!insSub) {
                skipped++;
                continue;
            }
            const ins = insSub.inscription;
            const existingRevisionGrade = insSub.finalGrade;
            // Get the regular grade to preserve original score/status
            const regularGrade = yield index_1.SubjectFinalGrade.findOne({
                where: { inscriptionSubjectId: insSubId, gradeType: 'regular' },
                transaction: t,
            });
            const originalScore = (regularGrade === null || regularGrade === void 0 ? void 0 : regularGrade.finalScore) != null
                ? Number(regularGrade.finalScore)
                : null;
            const originalStatus = (_c = regularGrade === null || regularGrade === void 0 ? void 0 : regularGrade.status) !== null && _c !== void 0 ? _c : null;
            const plantelId = (_e = (_d = regularGrade === null || regularGrade === void 0 ? void 0 : regularGrade.plantelId) !== null && _d !== void 0 ? _d : existingRevisionGrade === null || existingRevisionGrade === void 0 ? void 0 : existingRevisionGrade.plantelId) !== null && _e !== void 0 ? _e : null;
            if (existingRevisionGrade) {
                // Update existing revision record
                yield index_1.SubjectFinalGrade.update({
                    finalScore,
                    status,
                    gradeType: 'revision',
                    originalScore: originalScore != null ? originalScore : ((_f = existingRevisionGrade === null || existingRevisionGrade === void 0 ? void 0 : existingRevisionGrade.originalScore) !== null && _f !== void 0 ? _f : null),
                    originalStatus: originalStatus !== null && originalStatus !== void 0 ? originalStatus : ((_g = existingRevisionGrade === null || existingRevisionGrade === void 0 ? void 0 : existingRevisionGrade.originalStatus) !== null && _g !== void 0 ? _g : null),
                    calculatedAt: new Date(),
                    schoolPeriodId: (_h = ins === null || ins === void 0 ? void 0 : ins.schoolPeriodId) !== null && _h !== void 0 ? _h : null,
                    subjectId: insSub.subjectId,
                    gradeId: (_j = ins === null || ins === void 0 ? void 0 : ins.gradeId) !== null && _j !== void 0 ? _j : null,
                }, { where: { id: existingRevisionGrade.id }, transaction: t });
                updated++;
            }
            else {
                // Create new revision record
                yield index_1.SubjectFinalGrade.create({
                    inscriptionSubjectId: insSubId,
                    finalScore,
                    status,
                    gradeType: 'revision',
                    originalScore,
                    originalStatus,
                    calculatedAt: new Date(),
                    plantelId,
                    schoolPeriodId: (_k = ins === null || ins === void 0 ? void 0 : ins.schoolPeriodId) !== null && _k !== void 0 ? _k : null,
                    subjectId: insSub.subjectId,
                    gradeId: (_l = ins === null || ins === void 0 ? void 0 : ins.gradeId) !== null && _l !== void 0 ? _l : null,
                }, { transaction: t });
                created++;
            }
        }
        // Mark grades as finalized
        const userId = (_o = (_m = req.session) === null || _m === void 0 ? void 0 : _m.user) === null || _o === void 0 ? void 0 : _o.id;
        yield revisionPeriod.update({
            gradesFinalized: true,
            gradesFinalizedAt: new Date(),
            gradesFinalizedBy: userId !== null && userId !== void 0 ? userId : null,
        }, { transaction: t });
        yield t.commit();
        return res.json({
            message: `Notas de revisión finalizadas: ${created} creadas, ${updated} actualizadas, ${skipped} omitidas`,
            summary: { created, updated, skipped, total: revisionsByInsSubId.size },
            gradesFinalized: true,
        });
    }
    catch (error) {
        yield t.rollback();
        console.error('[finalizeRevisionGrades] Error:', error);
        return res.status(500).json({ message: error.message || 'Error al finalizar notas de revisión' });
    }
});
exports.finalizeRevisionGrades = finalizeRevisionGrades;
/**
 * Unmark grades as finalized (toggle off the "Revisión Completada" checkbox).
 * Does NOT delete the SubjectFinalGrade records — only flips the flag so the
 * Excel export shows empty cells instead of NP for ungraded revisions.
 */
const unfinalizeRevisionGrades = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const schoolPeriodId = parseInt(req.params.schoolPeriodId, 10);
        if (!schoolPeriodId) {
            return res.status(400).json({ message: 'schoolPeriodId es requerido' });
        }
        const revisionPeriod = yield index_1.RevisionPeriod.findOne({ where: { schoolPeriodId } });
        if (!revisionPeriod) {
            return res.status(404).json({ message: 'Período de revisión no encontrado' });
        }
        yield revisionPeriod.update({
            gradesFinalized: false,
            gradesFinalizedAt: null,
            gradesFinalizedBy: null,
        });
        return res.json({ message: 'Revisión marcada como no completada', gradesFinalized: false });
    }
    catch (error) {
        console.error('[unfinalizeRevisionGrades] Error:', error);
        return res.status(500).json({ message: error.message || 'Error al desmarcar revisión' });
    }
});
exports.unfinalizeRevisionGrades = unfinalizeRevisionGrades;
