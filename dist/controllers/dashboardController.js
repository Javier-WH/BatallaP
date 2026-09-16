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
exports.getActivityLog = exports.getMasterDashboardMetrics = exports.getControlPanelMetrics = exports.getAdminDashboardStats = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
const SchoolPeriod_1 = __importDefault(require("../models/SchoolPeriod.js"));
const Inscription_1 = __importDefault(require("../models/Inscription.js"));
const Matriculation_1 = __importDefault(require("../models/Matriculation.js"));
const Term_1 = __importDefault(require("../models/Term.js"));
const TeacherAssignment_1 = __importDefault(require("../models/TeacherAssignment.js"));
const PeriodGradeSubject_1 = __importDefault(require("../models/PeriodGradeSubject.js"));
const PeriodGrade_1 = __importDefault(require("../models/PeriodGrade.js"));
const PeriodGradeSection_1 = __importDefault(require("../models/PeriodGradeSection.js"));
const Grade_1 = __importDefault(require("../models/Grade.js"));
const Section_1 = __importDefault(require("../models/Section.js"));
const Person_1 = __importDefault(require("../models/Person.js"));
const Subject_1 = __importDefault(require("../models/Subject.js"));
const EvaluationPlan_1 = __importDefault(require("../models/EvaluationPlan.js"));
const Qualification_1 = __importDefault(require("../models/Qualification.js"));
const ThematicComponent_1 = __importDefault(require("../models/ThematicComponent.js"));
const ThematicContent_1 = __importDefault(require("../models/ThematicContent.js"));
const GradeChangeLog_1 = __importDefault(require("../models/GradeChangeLog.js"));
const Setting_1 = __importDefault(require("../models/Setting.js"));
const User_1 = __importDefault(require("../models/User.js"));
const Role_1 = __importDefault(require("../models/Role.js"));
const StudentGuardian_1 = __importDefault(require("../models/StudentGuardian.js"));
const InscriptionSubject_1 = __importDefault(require("../models/InscriptionSubject.js"));
const PendingSubject_1 = __importDefault(require("../models/PendingSubject.js"));
const PendingSubjectEncounter_1 = __importDefault(require("../models/PendingSubjectEncounter.js"));
const periodClosureService_1 = require("../services/periodClosureService.js");
const assignmentKey = (pgsId, sectionId) => `${pgsId}:${sectionId}`;
const buildAcademicSnapshot = () => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const activePeriod = yield SchoolPeriod_1.default.findOne({ where: { status: 'activo' } });
    if (!activePeriod) {
        return { period: null };
    }
    const [matriculatedCount, pendingMatriculations, terms] = yield Promise.all([
        Inscription_1.default.count({ where: { schoolPeriodId: activePeriod.id } }),
        Matriculation_1.default.count({ where: { schoolPeriodId: activePeriod.id, status: 'pending' } }),
        Term_1.default.findAll({
            where: { schoolPeriodId: activePeriod.id },
            order: [['order', 'ASC']],
            attributes: ['id', 'name', 'order', 'isBlocked', 'isActive', 'openDate', 'closeDate']
        })
    ]);
    const closureStatus = yield periodClosureService_1.PeriodClosureService.getStatus(activePeriod.id);
    const assignments = (yield TeacherAssignment_1.default.findAll({
        include: [
            {
                model: PeriodGradeSubject_1.default,
                as: 'periodGradeSubject',
                required: true,
                include: [
                    {
                        model: PeriodGrade_1.default,
                        as: 'periodGrade',
                        required: true,
                        where: { schoolPeriodId: activePeriod.id },
                        attributes: ['id', 'schoolPeriodId', 'gradeId', 'color'],
                        include: [{ model: Grade_1.default, as: 'grade', attributes: ['id', 'name', 'order'] }]
                    },
                    { model: Subject_1.default, as: 'subject', attributes: ['id', 'name', 'icon', 'color', 'abbreviation'] }
                ]
            },
            { model: Section_1.default, as: 'section', attributes: ['id', 'name'] },
            { model: Person_1.default, as: 'teacher', attributes: ['id', 'firstName', 'lastName'] }
        ]
    }));
    const termIds = terms.map(term => term.id);
    // For the dashboard summary cards (plans, grades, content), only consider the active term
    const activeTerm = terms.find(t => t.isActive);
    const activeTermId = (_a = activeTerm === null || activeTerm === void 0 ? void 0 : activeTerm.id) !== null && _a !== void 0 ? _a : null;
    const periodGradeSubjectIds = assignments.map(a => a.periodGradeSubjectId);
    const sectionIds = assignments.map(a => a.sectionId);
    if (periodGradeSubjectIds.length === 0 || sectionIds.length === 0) {
        return {
            period: { id: activePeriod.id, name: activePeriod.name, period: activePeriod.period },
            students: {
                matriculated: matriculatedCount,
                pending: pendingMatriculations,
                total: matriculatedCount + pendingMatriculations
            },
            lapses: {
                total: terms.length,
                blocked: terms.filter(term => term.isBlocked).length,
                terms
            },
            council: {
                checklist: closureStatus.checklist,
                blockedTerms: closureStatus.blockedTerms,
                totalTerms: closureStatus.totalTerms
            },
            teachers: {
                totalAssignments: assignments.length,
                withoutPlans: 0,
                withoutGrades: 0,
                sampleWithoutPlans: [],
                sampleWithoutGrades: [],
                byGrade: [],
                byGradeContent: []
            }
        };
    }
    const evaluationPlanCountsRaw = yield EvaluationPlan_1.default.findAll({
        attributes: [
            'periodGradeSubjectId',
            'sectionId',
            [(0, sequelize_1.fn)('COUNT', (0, sequelize_1.literal)('*')), 'planCount']
        ],
        where: Object.assign({ periodGradeSubjectId: { [sequelize_1.Op.in]: periodGradeSubjectIds }, sectionId: { [sequelize_1.Op.in]: sectionIds } }, (activeTermId ? { termId: activeTermId } : {})),
        group: ['periodGradeSubjectId', 'sectionId'],
        raw: true
    });
    const evaluationPlanCounts = evaluationPlanCountsRaw;
    const qualificationCountsRaw = yield Qualification_1.default.findAll({
        attributes: [
            [(0, sequelize_1.col)('evaluationPlan.periodGradeSubjectId'), 'periodGradeSubjectId'],
            [(0, sequelize_1.col)('evaluationPlan.sectionId'), 'sectionId'],
            [(0, sequelize_1.fn)('COUNT', (0, sequelize_1.literal)('*')), 'qualificationCount']
        ],
        include: [
            {
                model: EvaluationPlan_1.default,
                as: 'evaluationPlan',
                attributes: [],
                required: true,
                where: activeTermId ? { termId: activeTermId } : {}
            }
        ],
        group: ['evaluationPlan.periodGradeSubjectId', 'evaluationPlan.sectionId'],
        raw: true
    });
    const qualificationCounts = qualificationCountsRaw;
    const planMap = new Map();
    evaluationPlanCounts.forEach(record => {
        const key = assignmentKey(record.periodGradeSubjectId, record.sectionId);
        planMap.set(key, record.planCount);
    });
    const qualificationMap = new Map();
    qualificationCounts.forEach(record => {
        const key = assignmentKey(record.periodGradeSubjectId, record.sectionId);
        qualificationMap.set(key, record.qualificationCount);
    });
    // ── Materia Pendiente: check completion via PendingSubject + encounters ──
    // Rules for a MP subject (assignment in the "MATERIA PENDIENTE" section):
    //   1. No students enrolled in MP for that subject+grade → disabled (not counted)
    //   2. Plan progress → the MP encounters already have dates assigned
    //   3. Grades progress → all students approved (aprobada/convalidada), OR
    //      all encounters exhausted AND all students presented
    //      (even if nobody approved — they ran out of chances)
    //   4. Otherwise → incomplete (still in progress)
    // Key: must group by subjectId + gradeId, because the same subject (e.g. Inglés)
    // can have pending subjects in different grades (3rd year MP vs 4th year MP).
    const mpSection = yield Section_1.default.findOne({ where: { name: 'MATERIA PENDIENTE' } });
    const mpSectionId = (_b = mpSection === null || mpSection === void 0 ? void 0 : mpSection.id) !== null && _b !== void 0 ? _b : null;
    // Map: `${subjectId}:${gradeId}` → { hasStudents, allApproved, allDone, hasEncounterDates }
    const mpCompletionMap = new Map();
    if (mpSectionId) {
        const mpAssignments = assignments.filter(a => a.sectionId === mpSectionId);
        // Collect (subjectId, gradeId) pairs from the assignments
        const mpPairs = new Set();
        mpAssignments.forEach(a => {
            var _a, _b, _c;
            const subjId = (_a = a.periodGradeSubject) === null || _a === void 0 ? void 0 : _a.subjectId;
            const gradeId = (_c = (_b = a.periodGradeSubject) === null || _b === void 0 ? void 0 : _b.periodGrade) === null || _c === void 0 ? void 0 : _c.gradeId;
            if (subjId && gradeId)
                mpPairs.add(`${subjId}:${gradeId}`);
        });
        const mpSubjectIds = [...new Set([...mpPairs].map(p => Number(p.split(':')[0])))];
        if (mpSubjectIds.length > 0) {
            // Get max encounters setting
            const maxEncSetting = yield Setting_1.default.findOne({ where: { key: 'pending_subject_max_encounters' } });
            const maxEnc = maxEncSetting && Number.isFinite(parseInt(maxEncSetting.value, 10))
                ? Math.max(1, parseInt(maxEncSetting.value, 10)) : 4;
            // Locked encounter numbers don't require a date
            const lockedEncSetting = yield Setting_1.default.findOne({ where: { key: 'pending_subject_locked_encounters' } });
            const lockedEncounters = ((lockedEncSetting === null || lockedEncSetting === void 0 ? void 0 : lockedEncSetting.value) || '')
                .split(',')
                .map(s => parseInt(s.trim(), 10))
                .filter(n => Number.isFinite(n));
            // Fetch all PendingSubjects for these subjects, with their encounters + inscription (for gradeId)
            // Only count records whose inscription belongs to the ACTIVE period —
            // older resolved/pending rows from previous periods must not affect progress.
            const mpRecords = yield PendingSubject_1.default.findAll({
                where: { subjectId: { [sequelize_1.Op.in]: mpSubjectIds } },
                include: [
                    { model: PendingSubjectEncounter_1.default, as: 'encounters' },
                    { model: Inscription_1.default, as: 'inscription', attributes: ['gradeId', 'schoolPeriodId'] },
                ],
            });
            // Group by subjectId + gradeId (from the inscription)
            const byPair = new Map();
            mpRecords.forEach(ps => {
                var _a, _b;
                if (((_a = ps.inscription) === null || _a === void 0 ? void 0 : _a.schoolPeriodId) !== activePeriod.id)
                    return;
                const gradeId = (_b = ps.inscription) === null || _b === void 0 ? void 0 : _b.gradeId;
                if (gradeId == null)
                    return;
                const pairKey = `${ps.subjectId}:${gradeId}`;
                const arr = byPair.get(pairKey) || [];
                arr.push(ps);
                byPair.set(pairKey, arr);
            });
            for (const [pairKey, psList] of byPair.entries()) {
                const allApproved = psList.every(ps => ps.status === 'aprobada' || ps.status === 'convalidada');
                // A student "presented all encounters" if their last scored encounter is #maxEnc
                // (i.e., they went through all chances without approving)
                const allDone = psList.every(ps => {
                    if (ps.status === 'aprobada' || ps.status === 'convalidada')
                        return true;
                    const encs = (ps.encounters || []).sort((a, b) => a.encounterNumber - b.encounterNumber);
                    const lastScored = [...encs].reverse().find((e) => e.score !== null || e.isAbsent);
                    return lastScored && lastScored.encounterNumber >= maxEnc;
                });
                // Plan progress for MP = the encounters have dates assigned.
                // Every student's non-locked encounters must exist and be dated.
                const hasEncounterDates = psList.every(ps => {
                    const encs = (ps.encounters || []).filter((e) => !lockedEncounters.includes(e.encounterNumber));
                    return encs.length > 0 && encs.every((e) => e.date != null);
                });
                mpCompletionMap.set(pairKey, { hasStudents: true, allApproved, allDone, hasEncounterDates });
            }
        }
    }
    const assignmentsWithoutPlan = [];
    const assignmentsWithoutGrades = [];
    assignments.forEach(assignment => {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        const key = assignmentKey(assignment.periodGradeSubjectId, assignment.sectionId);
        const baseInfo = {
            teacher: assignment.teacher ? `${assignment.teacher.firstName} ${assignment.teacher.lastName}` : 'Sin asignar',
            subject: ((_b = (_a = assignment.periodGradeSubject) === null || _a === void 0 ? void 0 : _a.subject) === null || _b === void 0 ? void 0 : _b.name) || 'Materia',
            grade: ((_e = (_d = (_c = assignment.periodGradeSubject) === null || _c === void 0 ? void 0 : _c.periodGrade) === null || _d === void 0 ? void 0 : _d.grade) === null || _e === void 0 ? void 0 : _e.name) || 'Grado',
            section: ((_f = assignment.section) === null || _f === void 0 ? void 0 : _f.name) || '—'
        };
        // For Materia Pendiente section, use PendingSubject + encounters logic
        const isMP = mpSectionId && assignment.sectionId === mpSectionId;
        const subjectId = (_g = assignment.periodGradeSubject) === null || _g === void 0 ? void 0 : _g.subjectId;
        const gradeId = (_j = (_h = assignment.periodGradeSubject) === null || _h === void 0 ? void 0 : _h.periodGrade) === null || _j === void 0 ? void 0 : _j.gradeId;
        const mpKey = isMP && subjectId != null && gradeId != null ? `${subjectId}:${gradeId}` : null;
        const mpData = mpKey ? mpCompletionMap.get(mpKey) : null;
        // MP with no students → disabled, skip from "without plan/grades" lists
        const mpDisabled = isMP && !(mpData && mpData.hasStudents);
        if (!mpDisabled) {
            const hasPlan = isMP ? (mpData ? mpData.hasEncounterDates : !!planMap.get(key)) : !!planMap.get(key);
            const hasGrades = isMP
                ? (mpData ? (mpData.hasStudents && (mpData.allApproved || mpData.allDone)) : false)
                : !!qualificationMap.get(key);
            if (!hasPlan) {
                assignmentsWithoutPlan.push(baseInfo);
            }
            if (!hasGrades) {
                assignmentsWithoutGrades.push(baseInfo);
            }
        }
    });
    // Fetch section colors from PeriodGradeSection for all periodGradeId + sectionId pairs
    const periodGradeIds = [...new Set(assignments.map(a => { var _a; return (_a = a.periodGradeSubject) === null || _a === void 0 ? void 0 : _a.periodGradeId; }).filter(Boolean))];
    const sectionColorMap = new Map();
    if (periodGradeIds.length > 0) {
        const pgsRecords = yield PeriodGradeSection_1.default.findAll({
            where: { periodGradeId: { [sequelize_1.Op.in]: periodGradeIds } },
            attributes: ['periodGradeId', 'sectionId', 'color'],
        });
        pgsRecords.forEach(r => {
            sectionColorMap.set(`${r.periodGradeId}:${r.sectionId}`, r.color);
        });
    }
    // Build byGrade structure: group assignments by grade → subject → sections
    const gradeMap = new Map();
    assignments.forEach(assignment => {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
        const periodGrade = (_a = assignment.periodGradeSubject) === null || _a === void 0 ? void 0 : _a.periodGrade;
        const grade = periodGrade === null || periodGrade === void 0 ? void 0 : periodGrade.grade;
        const subject = (_b = assignment.periodGradeSubject) === null || _b === void 0 ? void 0 : _b.subject;
        const pgsOrder = (_d = (_c = assignment.periodGradeSubject) === null || _c === void 0 ? void 0 : _c.order) !== null && _d !== void 0 ? _d : Number.MAX_SAFE_INTEGER;
        if (!grade || !subject)
            return;
        if (!gradeMap.has(grade.id)) {
            gradeMap.set(grade.id, {
                gradeName: grade.name,
                gradeColor: (_e = periodGrade === null || periodGrade === void 0 ? void 0 : periodGrade.color) !== null && _e !== void 0 ? _e : null,
                gradeOrder: (_f = grade.order) !== null && _f !== void 0 ? _f : Number.MAX_SAFE_INTEGER,
                subjects: new Map(),
            });
        }
        const gradeEntry = gradeMap.get(grade.id);
        if (!gradeEntry.subjects.has(subject.id)) {
            gradeEntry.subjects.set(subject.id, {
                subjectId: subject.id,
                subjectName: subject.name,
                subjectIcon: (_g = subject.icon) !== null && _g !== void 0 ? _g : null,
                subjectColor: (_h = subject.color) !== null && _h !== void 0 ? _h : null,
                subjectAbbreviation: (_j = subject.abbreviation) !== null && _j !== void 0 ? _j : null,
                order: pgsOrder,
                totalSections: 0,
                withPlan: 0,
                withoutPlan: 0,
                withGrades: 0,
                withoutGrades: 0,
                sections: [],
            });
        }
        const subjProgress = gradeEntry.subjects.get(subject.id);
        const key = assignmentKey(assignment.periodGradeSubjectId, assignment.sectionId);
        let hasPlan = !!planMap.get(key);
        let hasGrades = !!qualificationMap.get(key);
        // For Materia Pendiente section, use PendingSubject + encounters logic
        let mpDisabled = false;
        if (mpSectionId && assignment.sectionId === mpSectionId) {
            const gradeId = (_l = (_k = assignment.periodGradeSubject) === null || _k === void 0 ? void 0 : _k.periodGrade) === null || _l === void 0 ? void 0 : _l.gradeId;
            const mpKey = gradeId != null ? `${subject.id}:${gradeId}` : null;
            const mpData = mpKey ? mpCompletionMap.get(mpKey) : null;
            if (mpData && mpData.hasStudents) {
                hasPlan = mpData.hasEncounterDates;
                hasGrades = mpData.allApproved || mpData.allDone;
            }
            else {
                // No students enrolled in MP for this subject+grade → disabled
                mpDisabled = true;
                hasPlan = false;
                hasGrades = false;
            }
        }
        const teacherName = assignment.teacher
            ? `${assignment.teacher.firstName} ${assignment.teacher.lastName}`
            : 'Sin asignar';
        const sectionName = ((_m = assignment.section) === null || _m === void 0 ? void 0 : _m.name) || '—';
        const sectionId = assignment.sectionId;
        const sectionColor = sectionColorMap.get(`${periodGrade === null || periodGrade === void 0 ? void 0 : periodGrade.id}:${sectionId}`) || '#cccccc';
        // Disabled sections (MP with no students) don't count in totals
        if (!mpDisabled) {
            subjProgress.totalSections += 1;
            if (hasPlan)
                subjProgress.withPlan += 1;
            else
                subjProgress.withoutPlan += 1;
            if (hasGrades)
                subjProgress.withGrades += 1;
            else
                subjProgress.withoutGrades += 1;
        }
        subjProgress.sections.push({ sectionId, sectionName, sectionColor, teacherName, hasPlan, hasGrades, disabled: mpDisabled });
    });
    // Convert maps to sorted arrays: grades by Grade.order, sections alphabetically
    const byGrade = Array.from(gradeMap.entries())
        .map(([gradeId, entry]) => ({
        gradeId,
        gradeName: entry.gradeName,
        gradeColor: entry.gradeColor,
        gradeOrder: entry.gradeOrder,
        subjects: Array.from(entry.subjects.values())
            .map(s => (Object.assign(Object.assign({}, s), { sections: s.sections.sort((a, b) => a.sectionName.localeCompare(b.sectionName, 'es')) })))
            .sort((a, b) => a.order - b.order),
    }))
        .sort((a, b) => a.gradeOrder - b.gradeOrder);
    // ===== Content progress: check which pgsIds have the full chain Component → Content → Learning =====
    const pgsIdsInPeriod = [...new Set(assignments.map(a => { var _a; return (_a = a.periodGradeSubject) === null || _a === void 0 ? void 0 : _a.id; }).filter(Boolean))];
    const pgsWithContent = new Set();
    if (pgsIdsInPeriod.length > 0) {
        const contentChain = yield ThematicComponent_1.default.findAll({
            attributes: ['id', 'periodGradeSubjectId'],
            where: Object.assign({ periodGradeSubjectId: { [sequelize_1.Op.in]: pgsIdsInPeriod } }, (activeTermId ? { termId: activeTermId } : {})),
            include: [{
                    association: 'contents',
                    attributes: ['id'],
                    required: true,
                    include: [{
                            association: 'learnings',
                            attributes: ['id'],
                            required: true,
                            through: { attributes: [] },
                        }],
                }],
        });
        contentChain.forEach(comp => {
            if (comp.periodGradeSubjectId)
                pgsWithContent.add(comp.periodGradeSubjectId);
        });
    }
    // Build pgsId → grade/subject info map from assignments
    const pgsInfoMap = new Map();
    assignments.forEach(a => {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        const pgs = a.periodGradeSubject;
        const grade = (_a = pgs === null || pgs === void 0 ? void 0 : pgs.periodGrade) === null || _a === void 0 ? void 0 : _a.grade;
        const subject = pgs === null || pgs === void 0 ? void 0 : pgs.subject;
        if (!grade || !subject || !(pgs === null || pgs === void 0 ? void 0 : pgs.id) || pgsInfoMap.has(pgs.id))
            return;
        pgsInfoMap.set(pgs.id, {
            gradeId: grade.id,
            gradeName: grade.name,
            gradeColor: (_c = (_b = pgs.periodGrade) === null || _b === void 0 ? void 0 : _b.color) !== null && _c !== void 0 ? _c : null,
            gradeOrder: (_d = grade.order) !== null && _d !== void 0 ? _d : Number.MAX_SAFE_INTEGER,
            subjectId: subject.id,
            subjectName: subject.name,
            subjectIcon: (_e = subject.icon) !== null && _e !== void 0 ? _e : null,
            subjectColor: (_f = subject.color) !== null && _f !== void 0 ? _f : null,
            subjectAbbreviation: (_g = subject.abbreviation) !== null && _g !== void 0 ? _g : null,
            order: (_j = (_h = a.periodGradeSubject) === null || _h === void 0 ? void 0 : _h.order) !== null && _j !== void 0 ? _j : Number.MAX_SAFE_INTEGER,
        });
    });
    // Group by grade
    const contentGradeMap = new Map();
    pgsInfoMap.forEach((info, pgsId) => {
        if (!contentGradeMap.has(info.gradeId)) {
            contentGradeMap.set(info.gradeId, {
                gradeId: info.gradeId,
                gradeName: info.gradeName,
                gradeColor: info.gradeColor,
                gradeOrder: info.gradeOrder,
                subjects: [],
            });
        }
        contentGradeMap.get(info.gradeId).subjects.push({
            subjectId: info.subjectId,
            subjectName: info.subjectName,
            subjectIcon: info.subjectIcon,
            subjectColor: info.subjectColor,
            subjectAbbreviation: info.subjectAbbreviation,
            order: info.order,
            hasContent: pgsWithContent.has(pgsId),
        });
    });
    const byGradeContent = Array.from(contentGradeMap.values())
        .map(g => (Object.assign(Object.assign({}, g), { subjects: g.subjects.sort((a, b) => a.order - b.order) })))
        .sort((a, b) => a.gradeOrder - b.gradeOrder);
    return {
        period: { id: activePeriod.id, name: activePeriod.name, period: activePeriod.period },
        students: {
            matriculated: matriculatedCount,
            pending: pendingMatriculations,
            total: matriculatedCount + pendingMatriculations
        },
        lapses: {
            total: terms.length,
            blocked: terms.filter(term => term.isBlocked).length,
            terms
        },
        council: {
            checklist: closureStatus.checklist,
            blockedTerms: closureStatus.blockedTerms,
            totalTerms: closureStatus.totalTerms
        },
        teachers: {
            totalAssignments: assignments.length,
            withoutPlans: assignmentsWithoutPlan.length,
            withoutGrades: assignmentsWithoutGrades.length,
            sampleWithoutPlans: assignmentsWithoutPlan.slice(0, 6),
            sampleWithoutGrades: assignmentsWithoutGrades.slice(0, 6),
            byGrade,
            byGradeContent
        }
    };
});
/**
 * GET /api/dashboard/admin-stats
 *
 * Returns the aggregate metrics consumed by the Admin Dashboard
 * (`frontend/src/pages/admin/Dashboard.tsx`) WITHOUT downloading the full
 * inscriptions / matriculations / teachers lists.
 *
 * Replaces the previous flow that did 3 full-table downloads + in-memory
 * aggregation with SQL COUNT / GROUP BY queries. The response shape matches
 * exactly the `AdminOverviewData` interface the frontend already builds, so
 * the only change on the frontend is the data source.
 *
 * Query params:
 *  - schoolPeriodId (optional, defaults to the active period)
 */
const getAdminDashboardStats = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userRoles = ((_a = req.session.user) === null || _a === void 0 ? void 0 : _a.roles) || [];
        const isPrivileged = userRoles.includes('Master') || userRoles.includes('Administrador');
        // Resolve target period: explicit param → active period.
        let schoolPeriodId;
        if (req.query.schoolPeriodId) {
            schoolPeriodId = Number(req.query.schoolPeriodId);
        }
        else {
            const active = yield SchoolPeriod_1.default.findOne({ where: { status: 'activo' } });
            if (!active) {
                return res.json(null);
            }
            schoolPeriodId = active.id;
        }
        // Structure (PeriodGrade → Grade, Sections, Subjects) and grade catalog.
        // These are small and already needed for coverage analysis.
        const [structure, gradeCatalog] = yield Promise.all([
            PeriodGrade_1.default.findAll({
                where: { schoolPeriodId },
                include: [
                    { model: Grade_1.default, as: 'grade' },
                    { model: Section_1.default, as: 'sections' },
                    { model: Subject_1.default, as: 'subjects' },
                ],
            }),
            Grade_1.default.findAll({ order: [['order', 'ASC'], ['name', 'ASC']] }),
        ]);
        // Inscription counts and derived metrics via SQL.
        // Hide hidden students from non-privileged roles (mirrors getInscriptions).
        const inscriptionWhere = { schoolPeriodId };
        if (!isPrivileged) {
            inscriptionWhere[sequelize_1.Op.and] = [
                (0, sequelize_1.literal)('`matriculation`.`hiddenFromControlEstudios` = false'),
            ];
        }
        const [matriculatedCount, pendingMatriculations, studentsWithoutSection, studentsWithoutSubjects, totalTeachers, teachersWithoutAssignments, representativeCount,] = yield Promise.all([
            // matriculated = inscriptions in this period (excluding hidden for non-privileged)
            Inscription_1.default.count({
                where: inscriptionWhere,
                include: [{ model: Matriculation_1.default, as: 'matriculation', required: false }],
            }),
            // pending matriculations
            Matriculation_1.default.count({
                where: { schoolPeriodId, status: 'pending' },
            }),
            // students without section
            Inscription_1.default.count({
                where: Object.assign(Object.assign({}, inscriptionWhere), { sectionId: null }),
                include: [{ model: Matriculation_1.default, as: 'matriculation', required: false }],
            }),
            // students without subjects — raw query (HAVING not supported by Model.count typings)
            database_1.default.query(`SELECT COUNT(*) AS \`cnt\` FROM (
           SELECT i.id
           FROM inscriptions i
           LEFT JOIN matriculations m ON m.inscriptionId = i.id
           LEFT JOIN inscription_subjects ins ON ins.inscriptionId = i.id
           WHERE i.schoolPeriodId = :spId
             ${isPrivileged ? '' : 'AND m.hiddenFromControlEstudios = false'}
           GROUP BY i.id
           HAVING COUNT(ins.id) = 0
         ) AS t`, { replacements: { spId: schoolPeriodId }, type: sequelize_1.QueryTypes.SELECT }).then((r) => { var _a, _b; return Number((_b = (_a = r === null || r === void 0 ? void 0 : r[0]) === null || _a === void 0 ? void 0 : _a.cnt) !== null && _b !== void 0 ? _b : 0); }),
            // total teachers (Person with role Profesor)
            Person_1.default.count({
                include: [{ model: Role_1.default, as: 'roles', where: { name: 'Profesor' }, through: { attributes: [] } }],
            }),
            // teachers without assignments in this period — raw query
            database_1.default.query(`SELECT COUNT(*) AS \`cnt\` FROM (
           SELECT p.id
           FROM people p
           INNER JOIN person_roles pr ON pr.personId = p.id
           INNER JOIN roles r ON r.id = pr.roleId AND r.name = 'Profesor'
           LEFT JOIN teacher_assignments ta ON ta.teacherId = p.id
           LEFT JOIN period_grade_subjects pgs ON pgs.id = ta.periodGradeSubjectId
           LEFT JOIN period_grades pg ON pg.id = pgs.periodGradeId AND pg.schoolPeriodId = :spId
           WHERE pg.id IS NULL
           GROUP BY p.id
         ) AS t`, { replacements: { spId: schoolPeriodId }, type: sequelize_1.QueryTypes.SELECT }).then((r) => { var _a, _b; return Number((_b = (_a = r === null || r === void 0 ? void 0 : r[0]) === null || _a === void 0 ? void 0 : _a.cnt) !== null && _b !== void 0 ? _b : 0); }),
            // distinct representatives (GuardianProfile) referenced by inscriptions
            // in this period with isRepresentative=true on StudentGuardian.
            StudentGuardian_1.default.count({
                distinct: true,
                col: 'guardianId',
                where: { isRepresentative: true },
                include: [{
                        model: Person_1.default,
                        as: 'student',
                        required: true,
                        include: [{
                                model: Inscription_1.default,
                                as: 'inscriptions',
                                required: true,
                                where: { schoolPeriodId },
                            }],
                    }],
            }),
        ]);
        // Coverage analysis (mirrors the in-memory logic exactly).
        const configuredGradeIds = new Set(structure.map((pg) => { var _a; return (_a = pg.grade) === null || _a === void 0 ? void 0 : _a.id; }).filter((id) => typeof id === 'number'));
        const totalGrades = gradeCatalog.length;
        const missingGrades = gradeCatalog
            .filter((g) => !configuredGradeIds.has(g.id))
            .map((g) => g.name);
        const gradesWithoutSections = structure
            .filter((pg) => pg.grade && (!pg.sections || pg.sections.length === 0))
            .map((pg) => { var _a, _b; return (_b = (_a = pg.grade) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : `ID ${pg.id}`; });
        const gradesWithoutSubjects = structure
            .filter((pg) => pg.grade && (!pg.subjects || pg.subjects.length === 0))
            .map((pg) => { var _a, _b; return (_b = (_a = pg.grade) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : `ID ${pg.id}`; });
        const coveragePercentage = totalGrades === 0 ? 0 : (configuredGradeIds.size / totalGrades) * 100;
        const alerts = [];
        if (missingGrades.length)
            alerts.push(`Faltan ${missingGrades.length} grados por configurar: ${missingGrades.join(', ')}`);
        if (gradesWithoutSections.length)
            alerts.push(`Hay ${gradesWithoutSections.length} grados sin secciones asignadas.`);
        if (gradesWithoutSubjects.length)
            alerts.push(`Hay ${gradesWithoutSubjects.length} grados sin materias configuradas.`);
        if (studentsWithoutSection > 0)
            alerts.push(`${studentsWithoutSection} alumnos inscritos no tienen sección definida.`);
        if (studentsWithoutSubjects > 0)
            alerts.push(`${studentsWithoutSubjects} alumnos están inscritos sin materias asociadas.`);
        const period = yield SchoolPeriod_1.default.findByPk(schoolPeriodId);
        return res.json({
            period,
            counts: {
                representatives: representativeCount,
                totalTeachers,
                teachersWithoutAssignments,
                studentsWithoutSection,
                studentsWithoutSubjects,
            },
            students: {
                total: matriculatedCount + pendingMatriculations,
                matriculated: matriculatedCount,
                pending: pendingMatriculations,
            },
            coverage: {
                percentage: Number(coveragePercentage.toFixed(1)),
                configuredGrades: configuredGradeIds.size,
                totalGrades,
                missingGrades,
                gradesWithoutSections,
                gradesWithoutSubjects,
            },
            alerts,
        });
    }
    catch (error) {
        console.error('[getAdminDashboardStats] Error:', error);
        return res.status(500).json({ message: 'Error obteniendo métricas del panel administrativo' });
    }
});
exports.getAdminDashboardStats = getAdminDashboardStats;
const getControlPanelMetrics = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const snapshot = yield buildAcademicSnapshot();
        return res.json(snapshot);
    }
    catch (error) {
        console.error('Error fetching control panel metrics:', error);
        return res.status(500).json({ message: 'Error obteniendo métricas del panel de control' });
    }
});
exports.getControlPanelMetrics = getControlPanelMetrics;
const getMasterDashboardMetrics = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const [academic, totalUsers, settingsList] = yield Promise.all([
            buildAcademicSnapshot(),
            User_1.default.count(),
            Setting_1.default.findAll({
                where: { key: { [sequelize_1.Op.in]: ['institution_name', 'institution_logo_shape', 'institution_motto', 'institution_code'] } }
            })
        ]);
        const settingsMap = settingsList.reduce((acc, curr) => {
            acc[curr.key] = curr.value;
            return acc;
        }, {});
        const institution = {
            name: settingsMap.institution_name || 'Institución Educativa',
            logoShape: settingsMap.institution_logo_shape || 'square',
            logoUrl: `/api/upload/logo?t=${Date.now()}`,
            motto: settingsMap.institution_motto || '',
            code: settingsMap.institution_code || ''
        };
        return res.json({
            academic,
            users: { total: totalUsers },
            institution
        });
    }
    catch (error) {
        console.error('Error fetching master dashboard metrics:', error);
        return res.status(500).json({ message: 'Error obteniendo métricas del panel maestro' });
    }
});
exports.getMasterDashboardMetrics = getMasterDashboardMetrics;
const ACTION_COLORS = {
    plan_created: '#2563eb',
    plan_updated: '#2563eb',
    grade_entered: '#16a34a',
    grade_updated: '#16a34a',
    content_added: '#f59e0b',
    content_updated: '#f59e0b',
    grade_edited_audit: '#9333ea',
};
const isCreate = (createdAt, updatedAt) => {
    return Math.abs(new Date(createdAt).getTime() - new Date(updatedAt).getTime()) < 2000;
};
const shortName = (firstName, lastName) => {
    if (!firstName && !lastName)
        return 'Usuario';
    return `${firstName || ''} ${lastName || ''}`.trim();
};
const getActivityLog = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
    try {
        const activePeriod = yield SchoolPeriod_1.default.findOne({ where: { status: 'activo' } });
        if (!activePeriod) {
            return res.json([]);
        }
        const periodId = activePeriod.id;
        const entries = [];
        /* ---------- 1. EvaluationPlan ---------- */
        const plans = yield EvaluationPlan_1.default.findAll({
            where: {},
            include: [
                {
                    model: PeriodGradeSubject_1.default,
                    as: 'periodGradeSubject',
                    required: true,
                    include: [
                        {
                            model: PeriodGrade_1.default,
                            as: 'periodGrade',
                            required: true,
                            where: { schoolPeriodId: periodId },
                            include: [{ model: Grade_1.default, as: 'grade', attributes: ['id', 'name'] }],
                        },
                        { model: Subject_1.default, as: 'subject', attributes: ['id', 'name'] },
                    ],
                },
                { model: Term_1.default, as: 'term', attributes: ['id', 'name'] },
            ],
            order: [['updatedAt', 'DESC']],
            limit: 50,
        });
        /* ---------- 2. Qualification ---------- */
        const qualifications = yield Qualification_1.default.findAll({
            where: { schoolPeriodId: periodId },
            include: [
                {
                    model: EvaluationPlan_1.default,
                    as: 'evaluationPlan',
                    required: true,
                    include: [
                        {
                            model: PeriodGradeSubject_1.default,
                            as: 'periodGradeSubject',
                            include: [
                                {
                                    model: PeriodGrade_1.default,
                                    as: 'periodGrade',
                                    include: [{ model: Grade_1.default, as: 'grade', attributes: ['id', 'name'] }],
                                },
                                { model: Subject_1.default, as: 'subject', attributes: ['id', 'name'] },
                            ],
                        },
                    ],
                },
                {
                    model: InscriptionSubject_1.default,
                    as: 'inscriptionSubject',
                    required: false,
                    include: [
                        {
                            model: Inscription_1.default,
                            as: 'inscription',
                            required: false,
                            include: [{ model: Person_1.default, as: 'student', attributes: ['id', 'firstName', 'lastName'] }],
                        },
                    ],
                },
            ],
            order: [['updatedAt', 'DESC']],
            limit: 50,
        });
        /* ---------- 3. ThematicContent ---------- */
        const contents = yield ThematicContent_1.default.findAll({
            include: [
                {
                    model: ThematicComponent_1.default,
                    as: 'thematicComponent',
                    required: true,
                    include: [
                        {
                            model: PeriodGradeSubject_1.default,
                            as: 'periodGradeSubject',
                            required: true,
                            include: [
                                {
                                    model: PeriodGrade_1.default,
                                    as: 'periodGrade',
                                    required: true,
                                    where: { schoolPeriodId: periodId },
                                    include: [{ model: Grade_1.default, as: 'grade', attributes: ['id', 'name'] }],
                                },
                                { model: Subject_1.default, as: 'subject', attributes: ['id', 'name'] },
                            ],
                        },
                    ],
                },
            ],
            order: [['updatedAt', 'DESC']],
            limit: 50,
        });
        /* ---------- 4. GradeChangeLog ---------- */
        const audits = yield GradeChangeLog_1.default.findAll({
            include: [
                { model: User_1.default, as: 'editor', include: [{ model: Person_1.default, as: 'person', attributes: ['id', 'firstName', 'lastName'] }] },
            ],
            order: [['editedAt', 'DESC']],
            limit: 50,
        });
        /* ---------- Batch-resolve teachers ---------- */
        const pgsIds = new Set();
        const sectionIds = new Set();
        plans.forEach((p) => {
            const pgs = p.periodGradeSubject;
            if (pgs)
                pgsIds.add(pgs.id);
            if (p.sectionId)
                sectionIds.add(p.sectionId);
        });
        qualifications.forEach((q) => {
            var _a, _b;
            const pgs = (_a = q.evaluationPlan) === null || _a === void 0 ? void 0 : _a.periodGradeSubject;
            if (pgs)
                pgsIds.add(pgs.id);
            if (q.sectionId)
                sectionIds.add(q.sectionId);
            if ((_b = q.evaluationPlan) === null || _b === void 0 ? void 0 : _b.sectionId)
                sectionIds.add(q.evaluationPlan.sectionId);
        });
        contents.forEach((c) => {
            var _a;
            const pgs = (_a = c.thematicComponent) === null || _a === void 0 ? void 0 : _a.periodGradeSubject;
            if (pgs)
                pgsIds.add(pgs.id);
        });
        const teacherMap = new Map();
        if (pgsIds.size > 0) {
            const teachers = yield TeacherAssignment_1.default.findAll({
                where: Object.assign({ periodGradeSubjectId: { [sequelize_1.Op.in]: [...pgsIds] } }, (sectionIds.size > 0 ? { sectionId: { [sequelize_1.Op.in]: [...sectionIds] } } : {})),
                include: [{ model: Person_1.default, as: 'teacher', attributes: ['id', 'firstName', 'lastName'] }],
            });
            teachers.forEach((t) => {
                var _a, _b;
                teacherMap.set(`${t.periodGradeSubjectId}:${t.sectionId}`, {
                    firstName: ((_a = t.teacher) === null || _a === void 0 ? void 0 : _a.firstName) || '',
                    lastName: ((_b = t.teacher) === null || _b === void 0 ? void 0 : _b.lastName) || '',
                });
            });
        }
        /* ---------- Batch-resolve sections ---------- */
        const sectionMap = new Map();
        if (sectionIds.size > 0) {
            const sections = yield Section_1.default.findAll({
                where: { id: { [sequelize_1.Op.in]: [...sectionIds] } },
                attributes: ['id', 'name'],
            });
            sections.forEach((s) => sectionMap.set(s.id, s.name));
        }
        /* ---------- Build entries: EvaluationPlan ---------- */
        for (const p of plans) {
            const pgs = p.periodGradeSubject;
            const subjectName = ((_a = pgs === null || pgs === void 0 ? void 0 : pgs.subject) === null || _a === void 0 ? void 0 : _a.name) || null;
            const gradeName = ((_c = (_b = pgs === null || pgs === void 0 ? void 0 : pgs.periodGrade) === null || _b === void 0 ? void 0 : _b.grade) === null || _c === void 0 ? void 0 : _c.name) || null;
            const sectionId = p.sectionId;
            const sectionName = sectionId ? sectionMap.get(sectionId) || null : null;
            const teacherKey = `${pgs === null || pgs === void 0 ? void 0 : pgs.id}:${sectionId}`;
            const teacher = teacherMap.get(teacherKey);
            const actorFirstName = (teacher === null || teacher === void 0 ? void 0 : teacher.firstName) || '';
            const actorLastName = (teacher === null || teacher === void 0 ? void 0 : teacher.lastName) || '';
            const actorName = shortName(actorFirstName, actorLastName) || 'Profesor';
            const created = isCreate(p.createdAt, p.updatedAt);
            const action = created ? 'plan_created' : 'plan_updated';
            const verb = created ? 'agregó' : 'actualizó';
            const desc = ((_d = pgs === null || pgs === void 0 ? void 0 : pgs.subject) === null || _d === void 0 ? void 0 : _d.name)
                ? `${verb} evaluación "${p.description}" al plan de ${subjectName}${gradeName ? ` (${gradeName}${sectionName ? ' - ' + sectionName : ''})` : ''}`
                : `${verb} evaluación "${p.description}" al plan`;
            entries.push({
                id: `plan-${p.id}-${created ? 'c' : 'u'}`,
                timestamp: p.updatedAt.toISOString(),
                action,
                actorName,
                actorFirstName,
                actorLastName,
                actorRole: 'Profesor',
                description: desc,
                subjectName,
                gradeName,
                sectionName,
            });
        }
        /* ---------- Build entries: Qualification ---------- */
        for (const q of qualifications) {
            const ep = q.evaluationPlan;
            const pgs = ep === null || ep === void 0 ? void 0 : ep.periodGradeSubject;
            const subjectName = ((_e = pgs === null || pgs === void 0 ? void 0 : pgs.subject) === null || _e === void 0 ? void 0 : _e.name) || null;
            const gradeName = ((_g = (_f = pgs === null || pgs === void 0 ? void 0 : pgs.periodGrade) === null || _f === void 0 ? void 0 : _f.grade) === null || _g === void 0 ? void 0 : _g.name) || null;
            const sectionId = q.sectionId || (ep === null || ep === void 0 ? void 0 : ep.sectionId);
            const sectionName = sectionId ? sectionMap.get(sectionId) || null : null;
            const teacherKey = `${pgs === null || pgs === void 0 ? void 0 : pgs.id}:${sectionId}`;
            const teacher = teacherMap.get(teacherKey);
            const actorFirstName = (teacher === null || teacher === void 0 ? void 0 : teacher.firstName) || '';
            const actorLastName = (teacher === null || teacher === void 0 ? void 0 : teacher.lastName) || '';
            const actorName = shortName(actorFirstName, actorLastName) || 'Profesor';
            const student = (_j = (_h = q.inscriptionSubject) === null || _h === void 0 ? void 0 : _h.inscription) === null || _j === void 0 ? void 0 : _j.student;
            const studentName = student ? shortName(student.firstName, student.lastName) : null;
            const created = isCreate(q.createdAt, q.updatedAt);
            const action = created ? 'grade_entered' : 'grade_updated';
            const verb = created ? 'registró' : 'actualizó';
            const score = q.score != null ? Number(q.score) : null;
            const desc = studentName
                ? `${verb} nota${score != null ? ` ${score}` : ''} para ${studentName} en ${subjectName || 'materia'}${gradeName ? ` (${gradeName}${sectionName ? ' - ' + sectionName : ''})` : ''}`
                : `${verb} nota${score != null ? ` ${score}` : ''} en ${subjectName || 'materia'}${gradeName ? ` (${gradeName})` : ''}`;
            entries.push({
                id: `qual-${q.id}-${created ? 'c' : 'u'}`,
                timestamp: q.updatedAt.toISOString(),
                action,
                actorName,
                actorFirstName,
                actorLastName,
                actorRole: 'Profesor',
                description: desc,
                subjectName,
                gradeName,
                sectionName,
            });
        }
        /* ---------- Build entries: ThematicContent ---------- */
        for (const c of contents) {
            const tc = c.thematicComponent;
            const pgs = tc === null || tc === void 0 ? void 0 : tc.periodGradeSubject;
            const subjectName = ((_k = pgs === null || pgs === void 0 ? void 0 : pgs.subject) === null || _k === void 0 ? void 0 : _k.name) || null;
            const gradeName = ((_m = (_l = pgs === null || pgs === void 0 ? void 0 : pgs.periodGrade) === null || _l === void 0 ? void 0 : _l.grade) === null || _m === void 0 ? void 0 : _m.name) || null;
            // ThematicContent doesn't have sectionId — find teacher by pgsId only
            let actorFirstName = '';
            let actorLastName = '';
            for (const [key, t] of teacherMap.entries()) {
                if (key.startsWith(`${pgs === null || pgs === void 0 ? void 0 : pgs.id}:`)) {
                    actorFirstName = t.firstName;
                    actorLastName = t.lastName;
                    break;
                }
            }
            const actorName = shortName(actorFirstName, actorLastName) || 'Profesor';
            const created = isCreate(c.createdAt, c.updatedAt);
            const action = created ? 'content_added' : 'content_updated';
            const verb = created ? 'agregó' : 'actualizó';
            const desc = `${verb} contenido "${c.title}" a ${subjectName || 'materia'}${gradeName ? ` (${gradeName})` : ''}`;
            entries.push({
                id: `content-${c.id}-${created ? 'c' : 'u'}`,
                timestamp: c.updatedAt.toISOString(),
                action,
                actorName,
                actorFirstName,
                actorLastName,
                actorRole: 'Profesor',
                description: desc,
                subjectName,
                gradeName,
                sectionName: null,
            });
        }
        /* ---------- Build entries: GradeChangeLog ---------- */
        for (const a of audits) {
            const editor = a.editor;
            const editorPerson = editor === null || editor === void 0 ? void 0 : editor.person;
            const actorFirstName = (editorPerson === null || editorPerson === void 0 ? void 0 : editorPerson.firstName) || '';
            const actorLastName = (editorPerson === null || editorPerson === void 0 ? void 0 : editorPerson.lastName) || '';
            const actorName = editorPerson ? shortName(actorFirstName, actorLastName) : 'Usuario';
            const meta = a.metadata || {};
            const subjectName = meta.subjectName || null;
            const gradeName = meta.gradeName || null;
            const sectionName = meta.sectionName || null;
            const prevScore = a.previousScore != null ? Number(a.previousScore) : null;
            const newScore = a.newScore != null ? Number(a.newScore) : null;
            const desc = `editó nota${prevScore != null ? ` de ${prevScore}` : ''}${newScore != null ? ` a ${newScore}` : ''} en ${subjectName || 'materia'}${a.gradeType ? ` (${a.gradeType})` : ''}`;
            entries.push({
                id: `audit-${a.id}`,
                timestamp: a.editedAt.toISOString(),
                action: 'grade_edited_audit',
                actorName,
                actorFirstName,
                actorLastName,
                actorRole: a.editorRole || 'Control de Estudios',
                description: desc,
                subjectName,
                gradeName,
                sectionName,
            });
        }
        /* ---------- Sort + limit 50 ---------- */
        entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        const result = entries.slice(0, 50);
        return res.json(result);
    }
    catch (error) {
        console.error('Error fetching activity log:', error);
        return res.status(500).json({ message: 'Error obteniendo el log de actividad' });
    }
});
exports.getActivityLog = getActivityLog;
