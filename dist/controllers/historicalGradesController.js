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
exports.saveGroupSubjectName = exports.savePersonPlanteles = exports.saveHistoricalGrades = exports.getHistoricalGradesBySection = void 0;
const database_1 = __importDefault(require("../config/database.js"));
const index_1 = require("../models/index.js");
const studentSortService_1 = require("../services/studentSortService.js");
const gradeEvaluationService_1 = require("../services/gradeEvaluationService.js");
const gradeDateResolver_1 = require("../services/gradeDateResolver.js");
const councilDateResolver_1 = require("../services/councilDateResolver.js");
const gradeCalculationService_1 = require("../services/gradeCalculationService.js");
const gradeChangeLogService_1 = require("../services/gradeChangeLogService.js");
/**
 * GET /api/historical-grades/by-section?schoolPeriodId=X&sectionId=Y&gradeId=Z
 * GET /api/historical-grades/by-section?schoolPeriodId=X&personId=P
 *
 * Returns students + ALL years (1ro–5to) with their subjects, plus all known
 * grades from multiple sources (SubjectFinalGrade, SubjectTermGrade fallback,
 * PendingSubject, HistoricalGrade).
 *
 * Years are built from ALL Grade records in the system, not just the ones
 * where the student has inscriptions. This allows the user to manually fill
 * in legacy data for years where the student has no records in the system.
 *
 * Response shape:
 * {
 *   students: [{ id, firstName, lastName, document, documentType }],
 *   years: [{
 *     gradeId, gradeName, gradeOrder,
 *     schoolPeriodId,  // the period used for subject lookup (may be null)
 *     subjects: [{ id, name, abbreviation, subjectGroupId, memberIds }],
 *   }],
 *   grades: [{ personId, schoolPeriodId, gradeId, subjectId, finalScore, status, gradeType, plantelId, ... }],
 *   planteles: [{ id, code, name }],
 * }
 */
const getHistoricalGradesBySection = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5;
    try {
        const sessionUser = (_a = req.session) === null || _a === void 0 ? void 0 : _a.user;
        if (!sessionUser) {
            return res.status(401).json({ message: 'No autorizado' });
        }
        const { schoolPeriodId, sectionId, gradeId, personId, gradeTypeFilter, consolidated } = req.query;
        if (!schoolPeriodId) {
            return res.status(400).json({ message: 'schoolPeriodId es requerido' });
        }
        const periodId = Number(schoolPeriodId);
        const secId = sectionId ? Number(sectionId) : null;
        const grdId = gradeId ? Number(gradeId) : null;
        const individualPersonId = personId ? Number(personId) : null;
        // gradeTypeFilter: 'final' (default) | 'revision' | 'materia_pendiente'
        const typeFilter = gradeTypeFilter || 'final';
        // consolidated: when true, show all note types with priority (MP > revision > regular)
        const isConsolidated = consolidated === 'true';
        // 1. Get the active period
        const activePeriod = yield index_1.SchoolPeriod.findByPk(periodId);
        if (!activePeriod) {
            return res.status(404).json({ message: 'Período escolar no encontrado' });
        }
        // 2. Get students — either by section or individual
        let personIds = [];
        let students = [];
        if (individualPersonId) {
            // Individual student mode
            const person = yield index_1.Person.findByPk(individualPersonId, {
                attributes: ['id', 'firstName', 'lastName', 'document', 'documentType'],
            });
            if (!person) {
                return res.json({ students: [], years: [], grades: [], planteles: [] });
            }
            personIds = [person.id];
            students = [{
                    id: person.id,
                    firstName: person.firstName,
                    lastName: person.lastName,
                    document: person.document,
                    documentType: person.documentType,
                }];
        }
        else {
            if (!secId) {
                return res.status(400).json({ message: 'sectionId o personId es requerido' });
            }
            // Section mode
            const inscriptionWhere = { schoolPeriodId: periodId, sectionId: secId };
            if (grdId)
                inscriptionWhere.gradeId = grdId;
            const inscriptions = yield index_1.Inscription.findAll({
                where: inscriptionWhere,
                include: [
                    {
                        model: index_1.Person,
                        as: 'student',
                        attributes: ['id', 'firstName', 'lastName', 'document', 'documentType'],
                    },
                    { model: index_1.Grade, as: 'grade', attributes: ['id', 'name', 'order'] },
                    { model: index_1.Section, as: 'section', attributes: ['id', 'name'] },
                ],
            });
            if (inscriptions.length === 0) {
                return res.json({ students: [], years: [], grades: [], planteles: [] });
            }
            // Filter out MATERIA PENDIENTE section inscriptions — those are not regular students
            const regularInscriptions = inscriptions.filter((ins) => { var _a; return (((_a = ins.section) === null || _a === void 0 ? void 0 : _a.name) || '').toUpperCase() !== 'MATERIA PENDIENTE'; });
            // If all were MP, use original list
            const inscriptionsToUse = regularInscriptions.length > 0 ? regularInscriptions : inscriptions;
            (0, studentSortService_1.sortInscriptions)(inscriptionsToUse);
            personIds = inscriptionsToUse.map(i => i.personId);
            students = inscriptionsToUse.map(ins => {
                var _a, _b, _c, _d;
                return ({
                    id: ins.personId,
                    firstName: (_a = ins.student) === null || _a === void 0 ? void 0 : _a.firstName,
                    lastName: (_b = ins.student) === null || _b === void 0 ? void 0 : _b.lastName,
                    document: (_c = ins.student) === null || _c === void 0 ? void 0 : _c.document,
                    documentType: (_d = ins.student) === null || _d === void 0 ? void 0 : _d.documentType,
                });
            });
        }
        if (personIds.length === 0) {
            return res.json({ students: [], years: [], grades: [], planteles: [] });
        }
        // 3. Get ALL Grade records from the system — these define the year columns.
        //    Every grade is shown regardless of whether the student has inscriptions.
        const allGrades = yield index_1.Grade.findAll({
            attributes: ['id', 'name', 'order'],
            order: [['order', 'ASC']],
        });
        // 3b. Batch-fetch all SchoolPeriods to build a short period label (e.g. "25/26")
        const allPeriods = yield index_1.SchoolPeriod.findAll({
            attributes: ['id', 'startYear', 'endYear', 'period', 'name', 'status'],
            order: [['startYear', 'ASC']],
        });
        const periodShortMap = new Map();
        for (const p of allPeriods) {
            const s = String(p.startYear).slice(-2);
            const e = String(p.endYear).slice(-2);
            periodShortMap.set(p.id, `${s}/${e}`);
        }
        // 4. For each grade, find the PeriodGrade to get subjects.
        //    Try the active period first; if not found, try any period that has
        //    a PeriodGrade for this grade.
        const years = [];
        for (const gr of allGrades) {
            // Try active period first
            let pg = yield index_1.PeriodGrade.findOne({
                where: { schoolPeriodId: periodId, gradeId: gr.id },
                attributes: ['id', 'schoolPeriodId', 'gradeId', 'color'],
            });
            let pgPeriodId = periodId;
            // If not found, try any period with a PeriodGrade for this grade
            if (!pg) {
                pg = yield index_1.PeriodGrade.findOne({
                    where: { gradeId: gr.id },
                    attributes: ['id', 'schoolPeriodId', 'gradeId', 'color'],
                    order: [['id', 'DESC']], // most recent
                });
                if (pg) {
                    pgPeriodId = pg.schoolPeriodId;
                }
            }
            // Get subjects for this period grade
            let subjects = [];
            if (pg) {
                const pgs = yield index_1.PeriodGradeSubject.findAll({
                    where: { periodGradeId: pg.id },
                    include: [{
                            model: index_1.Subject,
                            as: 'subject',
                            attributes: ['id', 'name', 'abbreviation', 'subjectGroupId'],
                            include: [{ model: index_1.SubjectGroup, as: 'subjectGroup', attributes: ['id', 'name'] }],
                        }],
                    order: [['order', 'ASC']],
                });
                // Collapse subjects sharing a subjectGroupId
                const seenGroupIds = new Set();
                for (const p of pgs) {
                    const subj = p.subject;
                    if (!subj)
                        continue;
                    const groupId = (_b = subj.subjectGroupId) !== null && _b !== void 0 ? _b : null;
                    if (groupId !== null) {
                        if (seenGroupIds.has(groupId)) {
                            const existing = subjects.find(s => s.subjectGroupId === groupId);
                            if (existing)
                                existing.memberIds.push(subj.id);
                            continue;
                        }
                        seenGroupIds.add(groupId);
                        subjects.push({
                            id: subj.id,
                            name: ((_c = subj.subjectGroup) === null || _c === void 0 ? void 0 : _c.name) || subj.name,
                            abbreviation: subj.abbreviation,
                            subjectGroupId: groupId,
                            memberIds: [subj.id],
                        });
                    }
                    else {
                        subjects.push({
                            id: subj.id,
                            name: subj.name,
                            abbreviation: subj.abbreviation,
                            subjectGroupId: null,
                            memberIds: [subj.id],
                        });
                    }
                }
            }
            years.push({
                gradeId: gr.id,
                gradeName: gr.name,
                gradeOrder: gr.order,
                schoolPeriodId: pgPeriodId,
                periodShort: pgPeriodId ? ((_d = periodShortMap.get(pgPeriodId)) !== null && _d !== void 0 ? _d : null) : null,
                gradeColor: (_e = pg === null || pg === void 0 ? void 0 : pg.color) !== null && _e !== void 0 ? _e : null,
                subjects,
            });
        }
        // 5. Get all inscriptions for these students (across all periods).
        //    Auxiliary MP inscriptions are identified by their SECTION name, not by
        //    escolaridad — registering a student in Materia Pendiente also flips the
        //    escolaridad of their REGULAR inscription to 'materia_pendiente', so
        //    filtering by escolaridad would wrongly drop all their regular grades.
        //    For materia_pendiente filter, we DO need the auxiliary MP inscriptions
        //    because that's where the MP SubjectFinalGrades live.
        const allInscriptionsRaw = yield index_1.Inscription.findAll({
            where: { personId: personIds },
            include: [
                { model: index_1.SchoolPeriod, as: 'period', attributes: ['id', 'period', 'name', 'startYear', 'endYear', 'status'] },
                { model: index_1.Grade, as: 'grade', attributes: ['id', 'name', 'order'] },
                { model: index_1.Section, as: 'section', attributes: ['id', 'name'] },
            ],
        });
        // 5b. Compute the current grade order for each student based on their
        //     regular (non-MP) inscription in the active period. This is used by
        //     the frontend to hide and lock grade columns that are beyond the
        //     student's current grade.
        const currentGradeOrderMap = new Map();
        for (const ins of allInscriptionsRaw) {
            if (ins.schoolPeriodId !== periodId)
                continue;
            const secName = (((_f = ins.section) === null || _f === void 0 ? void 0 : _f.name) || '').toUpperCase();
            if (secName === 'MATERIA PENDIENTE')
                continue;
            const order = (_h = (_g = ins.grade) === null || _g === void 0 ? void 0 : _g.order) !== null && _h !== void 0 ? _h : 0;
            const pid = ins.personId;
            if (!currentGradeOrderMap.has(pid) || order > currentGradeOrderMap.get(pid)) {
                currentGradeOrderMap.set(pid, order);
            }
        }
        const allInscriptionsForStudents = (typeFilter === 'materia_pendiente' || isConsolidated)
            ? allInscriptionsRaw // include MP inscriptions when filtering by materia_pendiente or consolidated
            : allInscriptionsRaw.filter((ins) => { var _a; return (((_a = ins.section) === null || _a === void 0 ? void 0 : _a.name) || '').toUpperCase() !== 'MATERIA PENDIENTE'; });
        const allInsIds = allInscriptionsForStudents.map(i => i.id);
        // 6. Get InscriptionSubjects + SubjectFinalGrades + SubjectTermGrades
        // Map typeFilter to the gradeType(s) we want to load from SubjectFinalGrade
        // 'materia_pendiente' loads both MP types (P and M — Revisión de Materia Pendiente).
        const gradeTypeForFilter = isConsolidated
            ? null // load all grade types in consolidated mode
            : (typeFilter === 'final'
                ? 'regular'
                : typeFilter === 'revision'
                    ? 'revision'
                    : ['materia_pendiente', 'revision_materia_pendiente']);
        const finalGradeInclude = {
            model: index_1.SubjectFinalGrade,
            as: 'finalGrade',
            include: [{ model: index_1.Plantel, as: 'plantel', attributes: ['id', 'code', 'name'] }],
        };
        if (gradeTypeForFilter) {
            finalGradeInclude.where = { gradeType: gradeTypeForFilter };
            finalGradeInclude.required = false;
        }
        const insSubjects = yield index_1.InscriptionSubject.findAll({
            where: { inscriptionId: allInsIds },
            include: [
                { model: index_1.Subject, as: 'subject', attributes: ['id', 'name', 'abbreviation', 'subjectGroupId'] },
                {
                    model: index_1.Inscription,
                    as: 'inscription',
                    attributes: ['id', 'personId', 'schoolPeriodId', 'gradeId'],
                },
                finalGradeInclude,
                { model: index_1.SubjectTermGrade, as: 'termGrades', include: [{ model: index_1.Term, as: 'term' }] },
            ],
        });
        // Resolve the student's last-lapso group choice so the historical view
        // does not select an older member subject merely because it appears first.
        const latestGroupChoiceByInscription = new Map();
        const latestChoices = yield index_1.InscriptionGroupTermChoice.findAll({
            where: { inscriptionId: allInsIds },
            include: [{ model: index_1.Term, as: 'term', attributes: ['id', 'order'] }],
            attributes: ['inscriptionId', 'subjectGroupId', 'subjectId', 'termId'],
        });
        const latestChoiceOrder = new Map();
        for (const choice of latestChoices) {
            const key = `${choice.inscriptionId}__${choice.subjectGroupId}`;
            const order = Number(((_j = choice.term) === null || _j === void 0 ? void 0 : _j.order) || 0);
            if (!latestChoiceOrder.has(key) || order > latestChoiceOrder.get(key)) {
                latestChoiceOrder.set(key, order);
                latestGroupChoiceByInscription.set(key, choice.subjectId);
            }
        }
        // Build grades map from InscriptionSubjects
        const gradesMap = [];
        for (const is of insSubjects) {
            const ins = is.inscription;
            const subj = is.subject;
            const fg = is.finalGrade;
            const termGrades = is.termGrades || [];
            if (!ins || !subj)
                continue;
            let finalScore = (fg === null || fg === void 0 ? void 0 : fg.finalScore) != null ? (0, gradeEvaluationService_1.roundGrade)(Number(fg.finalScore)) : null;
            let status = (_k = fg === null || fg === void 0 ? void 0 : fg.status) !== null && _k !== void 0 ? _k : null;
            let gradeType = (_l = fg === null || fg === void 0 ? void 0 : fg.gradeType) !== null && _l !== void 0 ? _l : null;
            let date = (fg === null || fg === void 0 ? void 0 : fg.calculatedAt) ? (0, councilDateResolver_1.formatDateInCaracas)(fg.calculatedAt) : null;
            // For revision / materia_pendiente, resolve date from opportunity dates / encounter dates
            if (fg && gradeType && (gradeType === 'revision' || gradeType === 'materia_pendiente' || gradeType === 'revision_materia_pendiente')) {
                const resolvedDate = yield (0, gradeDateResolver_1.resolveGradeDate)(is.id, gradeType, (_m = is.sectionId) !== null && _m !== void 0 ? _m : null, subj.id, (_o = ins.gradeId) !== null && _o !== void 0 ? _o : null, (_p = ins.schoolPeriodId) !== null && _p !== void 0 ? _p : null);
                if (resolvedDate)
                    date = resolvedDate;
            }
            // Fallback: compute from term grades if no SubjectFinalGrade exists
            if (!fg && termGrades.length > 0) {
                const sum = termGrades.reduce((acc, tg) => acc + Number(tg.score || 0), 0);
                const avg = sum / termGrades.length;
                finalScore = (0, gradeEvaluationService_1.roundFinalGrade)(avg);
                status = (0, gradeEvaluationService_1.isPassingGrade)(avg, 10) ? 'aprobada' : 'reprobada';
                gradeType = 'regular';
                const latestCalculated = termGrades
                    .map(tg => tg.calculatedAt)
                    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
                date = latestCalculated ? (0, councilDateResolver_1.formatDateInCaracas)(latestCalculated) : null;
            }
            // Filter by gradeTypeFilter (skip when consolidated — show all types):
            // - 'final': only regular + transferencia + equivalencia (exclude revision, materia_pendiente, revision_materia_pendiente)
            // - 'revision': only revision (show repair score, not original)
            // - 'materia_pendiente': only materia_pendiente + revision_materia_pendiente
            if (!isConsolidated) {
                if (typeFilter === 'final') {
                    if (gradeType === 'materia_pendiente' || gradeType === 'revision_materia_pendiente' || gradeType === 'revision')
                        continue;
                }
                else if (typeFilter === 'revision') {
                    if (gradeType !== 'revision')
                        continue;
                    // Show the repair score (finalScore already has it), keep gradeType as revision
                }
                else if (typeFilter === 'materia_pendiente') {
                    if (gradeType !== 'materia_pendiente' && gradeType !== 'revision_materia_pendiente')
                        continue;
                }
            }
            gradesMap.push({
                personId: ins.personId,
                schoolPeriodId: ins.schoolPeriodId,
                periodShort: ins.schoolPeriodId != null ? ((_q = periodShortMap.get(ins.schoolPeriodId)) !== null && _q !== void 0 ? _q : null) : null,
                gradeId: (_r = ins.gradeId) !== null && _r !== void 0 ? _r : null,
                subjectId: subj.id,
                subjectGroupId: (_s = subj.subjectGroupId) !== null && _s !== void 0 ? _s : null,
                subjectName: (_t = subj.name) !== null && _t !== void 0 ? _t : null,
                finalScore,
                status,
                gradeType,
                plantelId: (_u = fg === null || fg === void 0 ? void 0 : fg.plantelId) !== null && _u !== void 0 ? _u : null,
                plantelName: (_w = (_v = fg === null || fg === void 0 ? void 0 : fg.plantel) === null || _v === void 0 ? void 0 : _v.name) !== null && _w !== void 0 ? _w : null,
                finalGradeId: (_x = fg === null || fg === void 0 ? void 0 : fg.id) !== null && _x !== void 0 ? _x : null,
                inscriptionSubjectId: is.id,
                date,
                source: 'system',
            });
        }
        // 7. PendingSubject grades are NOT shown in this view — only final grades
        //    from the conventional evaluation process (lapsos, evaluaciones, consejos)
        //    and manually-entered historical grades are displayed.
        // 8. Get HistoricalGrade records (legacy data entered manually)
        const historicalGrades = yield index_1.HistoricalGrade.findAll({
            where: { personId: personIds },
            include: [
                { model: index_1.Subject, as: 'subject', attributes: ['id', 'name', 'abbreviation', 'subjectGroupId'] },
                { model: index_1.Plantel, as: 'plantel', attributes: ['id', 'code', 'name'] },
            ],
        });
        for (const hg of historicalGrades) {
            const subj = hg.subject;
            const hgGradeType = hg.gradeType;
            // Filter HistoricalGrade by typeFilter (skip when consolidated)
            if (!isConsolidated) {
                if (typeFilter === 'final') {
                    if (hgGradeType === 'revision' || hgGradeType === 'materia_pendiente')
                        continue;
                }
                else if (typeFilter === 'revision') {
                    if (hgGradeType !== 'revision')
                        continue;
                }
                else if (typeFilter === 'materia_pendiente') {
                    if (hgGradeType !== 'materia_pendiente')
                        continue;
                }
            }
            gradesMap.push({
                personId: hg.personId,
                schoolPeriodId: (_y = hg.schoolPeriodId) !== null && _y !== void 0 ? _y : null,
                periodShort: hg.schoolPeriodId != null ? ((_z = periodShortMap.get(hg.schoolPeriodId)) !== null && _z !== void 0 ? _z : null) : null,
                gradeId: hg.gradeId,
                subjectId: hg.subjectId,
                subjectGroupId: (_0 = subj === null || subj === void 0 ? void 0 : subj.subjectGroupId) !== null && _0 !== void 0 ? _0 : null,
                subjectName: hg.subjectName || ((_1 = subj === null || subj === void 0 ? void 0 : subj.name) !== null && _1 !== void 0 ? _1 : null),
                finalScore: hg.finalScore != null ? (0, gradeEvaluationService_1.roundGrade)(Number(hg.finalScore)) : null,
                status: hg.status,
                gradeType: hg.gradeType,
                plantelId: (_2 = hg.plantelId) !== null && _2 !== void 0 ? _2 : null,
                plantelName: (_4 = (_3 = hg.plantel) === null || _3 === void 0 ? void 0 : _3.name) !== null && _4 !== void 0 ? _4 : null,
                finalGradeId: null,
                inscriptionSubjectId: null,
                historicalGradeId: hg.id,
                date: hg.date ? (0, councilDateResolver_1.formatDateInCaracas)(hg.date) : null,
                source: 'historical',
            });
        }
        // 8b. Consolidated mode: deduplicate grades by (personId, gradeId, subjectId)
        //     Priority: 1) materia_pendiente / revision_materia_pendiente, 2) revision, 3) regular/transferencia/equivalencia
        if (isConsolidated) {
            const priority = (gt) => {
                if (!gt)
                    return 3;
                if (gt === 'materia_pendiente' || gt === 'revision_materia_pendiente')
                    return 1;
                if (gt === 'revision')
                    return 2;
                return 3;
            };
            const gradeByKey = new Map();
            for (const g of gradesMap) {
                const key = `${g.personId}__${g.gradeId}__${g.subjectId}`;
                const existing = gradeByKey.get(key);
                if (!existing) {
                    gradeByKey.set(key, g);
                }
                else {
                    // Keep the one with higher priority (lower number)
                    const existingPri = priority(existing.gradeType);
                    const newPri = priority(g.gradeType);
                    if (newPri < existingPri) {
                        gradeByKey.set(key, g);
                    }
                }
            }
            gradesMap.length = 0;
            gradesMap.push(...gradeByKey.values());
        }
        // Group columns represent one active subject. Keep the final grade for
        // the subject selected in the last lapso; historical member rows remain in
        // the database but must not win the UI lookup for the group cell.
        const inscriptionIdByScope = new Map();
        for (const inscription of allInscriptionsForStudents) {
            inscriptionIdByScope.set(`${inscription.personId}__${inscription.schoolPeriodId}__${inscription.gradeId}`, inscription.id);
        }
        // Rebuild each group definitive through the shared calculation service,
        // feeding it the SubjectTermGrade belonging to the selected subject for
        // each term. This is selection/orchestration only; the formula remains in
        // GradeCalculationService.
        const termsByPeriod = new Map();
        const periodIdsForGroups = [...new Set(allInscriptionsForStudents.map(ins => ins.schoolPeriodId))];
        for (const groupPeriodId of periodIdsForGroups) {
            termsByPeriod.set(groupPeriodId, yield index_1.Term.findAll({
                where: { schoolPeriodId: groupPeriodId },
                order: [['order', 'ASC']],
            }));
        }
        for (const inscription of allInscriptionsForStudents) {
            const subjectsByGroup = new Map();
            for (const insSubject of insSubjects.filter(item => item.inscriptionId === inscription.id)) {
                const groupId = (_5 = insSubject.subject) === null || _5 === void 0 ? void 0 : _5.subjectGroupId;
                if (groupId != null) {
                    subjectsByGroup.set(groupId, [...(subjectsByGroup.get(groupId) || []), insSubject]);
                }
            }
            const periodTerms = termsByPeriod.get(inscription.schoolPeriodId) || [];
            for (const [groupId, groupSubjects] of subjectsByGroup) {
                const choicesForGroup = latestChoices
                    .filter(choice => choice.inscriptionId === inscription.id && choice.subjectGroupId === groupId);
                if (choicesForGroup.length === 0)
                    continue;
                const lapsos = periodTerms.map(term => {
                    var _a;
                    const choice = choicesForGroup.find(item => item.termId === term.id);
                    const selectedSubject = groupSubjects.find(item => item.subjectId === (choice === null || choice === void 0 ? void 0 : choice.subjectId));
                    const termGrade = (_a = selectedSubject === null || selectedSubject === void 0 ? void 0 : selectedSubject.termGrades) === null || _a === void 0 ? void 0 : _a.find((grade) => grade.termId === term.id);
                    return {
                        termId: term.id,
                        finalScore: (termGrade === null || termGrade === void 0 ? void 0 : termGrade.score) != null ? Number(termGrade.score) : null,
                    };
                });
                const definitive = gradeCalculationService_1.GradeCalculationService.calculateFinalScore(lapsos, null);
                const lastChoice = [...choicesForGroup].sort((a, b) => { var _a, _b; return Number(((_a = b.term) === null || _a === void 0 ? void 0 : _a.order) || 0) - Number(((_b = a.term) === null || _b === void 0 ? void 0 : _b.order) || 0); })[0];
                const selectedLatestGrade = gradesMap.find((grade) => grade.personId === inscription.personId
                    && grade.schoolPeriodId === inscription.schoolPeriodId
                    && grade.gradeId === inscription.gradeId
                    && grade.subjectGroupId === groupId
                    && grade.subjectId === lastChoice.subjectId);
                if (selectedLatestGrade && definitive != null) {
                    selectedLatestGrade.finalScore = definitive;
                    selectedLatestGrade.status = (0, gradeEvaluationService_1.isPassingGrade)(definitive, 10) ? 'aprobada' : 'reprobada';
                }
            }
        }
        const visibleGrades = gradesMap.filter((grade) => {
            if (grade.subjectGroupId == null)
                return true;
            const inscriptionId = inscriptionIdByScope.get(`${grade.personId}__${grade.schoolPeriodId}__${grade.gradeId}`);
            const selectedSubjectId = inscriptionId != null
                ? latestGroupChoiceByInscription.get(`${inscriptionId}__${grade.subjectGroupId}`)
                : undefined;
            return selectedSubjectId == null || selectedSubjectId === grade.subjectId;
        });
        gradesMap.length = 0;
        gradesMap.push(...visibleGrades);
        // 9. Get all planteles
        const planteles = yield index_1.Plantel.findAll({
            attributes: ['id', 'code', 'name', 'state'],
            order: [['name', 'ASC']],
        });
        // 10. Get saved person-planteles (ordered list per student)
        const personPlanteles = yield index_1.PersonPlantel.findAll({
            where: { personId: personIds },
            order: [['order', 'ASC']],
        });
        // Group by personId: { [personId]: [{ plantelId, order, isSystem }] }
        const personPlantelesMap = {};
        for (const pp of personPlanteles) {
            if (!personPlantelesMap[pp.personId])
                personPlantelesMap[pp.personId] = [];
            personPlantelesMap[pp.personId].push({ plantelId: pp.plantelId, order: pp.order, isSystem: pp.isSystem });
        }
        return res.json({
            students,
            years,
            grades: gradesMap,
            planteles: planteles.map((p) => ({ id: p.id, code: p.code, name: p.name })),
            personPlanteles: personPlantelesMap,
            currentGradeOrder: Object.fromEntries(currentGradeOrderMap),
            allPeriods: allPeriods.map((p) => {
                var _a;
                return ({
                    id: p.id,
                    periodShort: (_a = periodShortMap.get(p.id)) !== null && _a !== void 0 ? _a : null,
                    period: p.period,
                    name: p.name,
                    status: p.status,
                });
            }),
        });
    }
    catch (error) {
        console.error('[getHistoricalGradesBySection] Error:', error);
        return res.status(500).json({ message: error.message || 'Error al cargar notas históricas' });
    }
});
exports.getHistoricalGradesBySection = getHistoricalGradesBySection;
/**
 * Resolve a period label (e.g. "03/04" or "2003-2004") to a SchoolPeriod id.
 * If the period doesn't exist AND is in the past, create it with status 'historico'.
 * Rejects the active period or future periods.
 * Returns null if the label is empty or invalid.
 */
function resolveOrCreatePeriod(periodLabel, transaction) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!periodLabel || typeof periodLabel !== 'string')
            return null;
        const label = periodLabel.trim();
        if (!label)
            return null;
        // Load all periods to match and to find the active one
        const allPeriods = yield index_1.SchoolPeriod.findAll({
            attributes: ['id', 'startYear', 'endYear', 'period', 'status'],
            transaction,
        });
        // Helper: reject active or future periods
        const rejectIfNotHistorical = (p) => {
            if (p.status === 'activo' || p.status === 'preinscripcion') {
                throw new Error(`No se puede usar el periodo "${p.period}" en notas históricas. ` +
                    `Solo se permiten periodos anteriores al actual.`);
            }
        };
        // Try to match by periodShort (YY/YY format, e.g. "03/04")
        for (const p of allPeriods) {
            const s = String(p.startYear).slice(-2);
            const e = String(p.endYear).slice(-2);
            if (`${s}/${e}` === label) {
                rejectIfNotHistorical(p);
                return p.id;
            }
        }
        // Try to match by period string (YYYY-YYYY format, e.g. "2003-2004")
        const byPeriod = allPeriods.find(p => p.period === label);
        if (byPeriod) {
            rejectIfNotHistorical(byPeriod);
            return byPeriod.id;
        }
        // Validate YYYY-YYYY format
        const match = /^(\d{4})-(\d{4})$/.exec(label);
        if (!match) {
            throw new Error(`Formato de periodo inválido: "${label}". Use AAAA-AAAA (ej. 2003-2004)`);
        }
        const startYear = parseInt(match[1], 10);
        const endYear = parseInt(match[2], 10);
        if (!(endYear > startYear)) {
            throw new Error(`Periodo inválido: "${label}". El año final debe ser mayor al inicial`);
        }
        // Reject the active period or any period that starts in the same year or after
        const activePeriod = allPeriods.find(p => p.status === 'activo');
        if (activePeriod && startYear >= activePeriod.startYear) {
            throw new Error(`No se puede usar el periodo "${label}" en notas históricas. ` +
                `Solo se permiten periodos anteriores al actual (${activePeriod.period}).`);
        }
        const created = yield index_1.SchoolPeriod.create({
            period: label,
            name: `Año Escolar ${label}`,
            startYear,
            endYear,
            status: 'historico',
        }, { transaction });
        return created.id;
    });
}
/**
 * POST /api/historical-grades/save
 *
 * Body: {
 *   changes: [{
 *     personId, periodLabel, gradeId, subjectId,
 *     finalScore, gradeType, plantelId, date,
 *     finalGradeId?, inscriptionSubjectId?, historicalGradeId?,
 *   }]
 * }
 *
 * For each change:
 * - If historicalGradeId exists → update HistoricalGrade
 * - Else if inscriptionSubjectId exists → update/create SubjectFinalGrade
 * - Else if there's an inscription for (personId, schoolPeriodId) → use SubjectFinalGrade
 * - Else → create/update HistoricalGrade (no inscription needed)
 */
const saveHistoricalGrades = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const t = yield database_1.default.transaction();
    try {
        const sessionUser = (_a = req.session) === null || _a === void 0 ? void 0 : _a.user;
        if (!sessionUser) {
            return res.status(401).json({ message: 'No autorizado' });
        }
        const userId = sessionUser.id;
        const { changes } = req.body;
        if (!Array.isArray(changes) || changes.length === 0) {
            return res.status(400).json({ message: 'changes es requerido y debe ser un array' });
        }
        const passingGradeSetting = yield database_1.default.query("SELECT value FROM settings WHERE `key` = 'passing_grade' LIMIT 1", { type: 'SELECT' });
        const passingGrade = Number((_b = passingGradeSetting[0]) === null || _b === void 0 ? void 0 : _b.value) || 10;
        let saved = 0;
        const errors = [];
        for (const change of changes) {
            try {
                const { personId, periodLabel, gradeId, subjectId, finalScore, gradeType, plantelId, finalGradeId, inscriptionSubjectId, historicalGradeId, date, subjectName, } = change;
                if (!personId || !gradeId || !subjectId) {
                    errors.push(`Faltan datos: personId, gradeId o subjectId`);
                    continue;
                }
                // Resolve periodLabel → schoolPeriodId (creates SchoolPeriod if needed)
                let schoolPeriodId = null;
                try {
                    schoolPeriodId = yield resolveOrCreatePeriod(periodLabel, t);
                }
                catch (periodErr) {
                    errors.push(periodErr.message);
                    continue;
                }
                const rawScore = finalScore !== null && finalScore !== undefined ? Number(finalScore) : null;
                // Use roundGrade (not roundFinalGrade) for historical grades — they can be 0.
                // roundFinalGrade enforces MIN_FINAL_GRADE=1 which is for system-calculated grades only.
                const score = rawScore !== null ? (0, gradeEvaluationService_1.roundGrade)(rawScore) : null;
                // Validate score range (0 is treated as "no grade" → null)
                if (score !== null && (score < 0 || score > 20)) {
                    errors.push(`Nota inválida: ${score}. Debe estar entre 1 y 20.`);
                    continue;
                }
                const normalizedScore = score === 0 ? null : score;
                const status = normalizedScore !== null ? ((0, gradeEvaluationService_1.isPassingGrade)(rawScore, passingGrade) ? 'aprobada' : 'reprobada') : 'reprobada';
                const parsedDate = date ? new Date(`${date}T12:00:00`) : new Date();
                const dateOnly = date ? (0, councilDateResolver_1.formatDateInCaracas)(date) : null;
                // ── Case 1: Update existing HistoricalGrade ──
                if (historicalGradeId) {
                    // If score is null (empty or 0), the user wants to delete the note
                    if (normalizedScore === null) {
                        yield index_1.HistoricalGrade.destroy({
                            where: { id: historicalGradeId },
                            transaction: t,
                        });
                        saved++;
                        continue;
                    }
                    yield index_1.HistoricalGrade.update({
                        schoolPeriodId: schoolPeriodId || null,
                        finalScore: normalizedScore,
                        status,
                        gradeType: gradeType || 'regular',
                        plantelId: plantelId || null,
                        date: dateOnly,
                        subjectName: subjectName || null,
                    }, {
                        where: { id: historicalGradeId },
                        transaction: t,
                    });
                    yield (0, gradeChangeLogService_1.logGradeChange)({
                        entityType: 'historical_grade',
                        entityId: historicalGradeId,
                        previousScore: null,
                        newScore: normalizedScore,
                        previousStatus: null,
                        newStatus: status,
                        gradeType: gradeType || 'regular',
                        editedBy: userId,
                        editorRole: 'control_estudios',
                        metadata: { personId, gradeId, subjectId, schoolPeriodId, subjectName },
                    }, t);
                    saved++;
                    continue;
                }
                // ── Case 2: Update existing SubjectFinalGrade ──
                if (finalGradeId) {
                    const prevFg = yield index_1.SubjectFinalGrade.findByPk(finalGradeId, { transaction: t });
                    yield index_1.SubjectFinalGrade.update({
                        finalScore: normalizedScore,
                        status,
                        gradeType: gradeType || 'regular',
                        plantelId: plantelId || null,
                        calculatedAt: parsedDate,
                    }, {
                        where: { id: finalGradeId },
                        transaction: t,
                    });
                    yield (0, gradeChangeLogService_1.logGradeChange)({
                        entityType: 'subject_final_grade',
                        entityId: finalGradeId,
                        previousScore: (prevFg === null || prevFg === void 0 ? void 0 : prevFg.finalScore) != null ? Number(prevFg.finalScore) : null,
                        newScore: normalizedScore,
                        previousStatus: (prevFg === null || prevFg === void 0 ? void 0 : prevFg.status) || null,
                        newStatus: status,
                        gradeType: gradeType || 'regular',
                        editedBy: userId,
                        editorRole: 'control_estudios',
                        metadata: { personId, gradeId, subjectId, schoolPeriodId, subjectName, historicalEdit: true },
                    }, t);
                    saved++;
                    continue;
                }
                // ── Case 3: Have inscriptionSubjectId → use SubjectFinalGrade ──
                if (inscriptionSubjectId) {
                    // Load InscriptionSubject with Inscription to denormalize context
                    const ctxInsSub = yield index_1.InscriptionSubject.findByPk(inscriptionSubjectId, {
                        include: [{ model: index_1.Inscription, as: 'inscription', attributes: ['id', 'schoolPeriodId', 'gradeId'] }],
                        transaction: t,
                    });
                    const ctxIns = ctxInsSub === null || ctxInsSub === void 0 ? void 0 : ctxInsSub.inscription;
                    const effectiveGradeType = gradeType || 'regular';
                    const existing = yield index_1.SubjectFinalGrade.findOne({
                        where: { inscriptionSubjectId, gradeType: effectiveGradeType },
                        transaction: t,
                    });
                    if (existing) {
                        yield index_1.SubjectFinalGrade.update({
                            finalScore: normalizedScore,
                            status,
                            gradeType: effectiveGradeType,
                            plantelId: plantelId || null,
                            calculatedAt: parsedDate,
                            schoolPeriodId: (_c = ctxIns === null || ctxIns === void 0 ? void 0 : ctxIns.schoolPeriodId) !== null && _c !== void 0 ? _c : null,
                            subjectId: (_d = ctxInsSub === null || ctxInsSub === void 0 ? void 0 : ctxInsSub.subjectId) !== null && _d !== void 0 ? _d : null,
                            gradeId: (_e = ctxIns === null || ctxIns === void 0 ? void 0 : ctxIns.gradeId) !== null && _e !== void 0 ? _e : null,
                        }, {
                            where: { id: existing.id },
                            transaction: t,
                        });
                        yield (0, gradeChangeLogService_1.logGradeChange)({
                            entityType: 'subject_final_grade',
                            entityId: existing.id,
                            previousScore: existing.finalScore != null ? Number(existing.finalScore) : null,
                            newScore: normalizedScore,
                            previousStatus: existing.status || null,
                            newStatus: status,
                            gradeType: effectiveGradeType,
                            editedBy: userId,
                            editorRole: 'control_estudios',
                            metadata: { personId, gradeId, subjectId, schoolPeriodId, subjectName, inscriptionSubjectId, historicalEdit: true },
                        }, t);
                    }
                    else {
                        const newFg = yield index_1.SubjectFinalGrade.create({
                            inscriptionSubjectId,
                            finalScore: normalizedScore,
                            status,
                            gradeType: effectiveGradeType,
                            plantelId: plantelId || null,
                            calculatedAt: parsedDate,
                            schoolPeriodId: (_f = ctxIns === null || ctxIns === void 0 ? void 0 : ctxIns.schoolPeriodId) !== null && _f !== void 0 ? _f : null,
                            subjectId: (_g = ctxInsSub === null || ctxInsSub === void 0 ? void 0 : ctxInsSub.subjectId) !== null && _g !== void 0 ? _g : null,
                            gradeId: (_h = ctxIns === null || ctxIns === void 0 ? void 0 : ctxIns.gradeId) !== null && _h !== void 0 ? _h : null,
                        }, { transaction: t });
                        yield (0, gradeChangeLogService_1.logGradeChange)({
                            entityType: 'subject_final_grade',
                            entityId: newFg.id,
                            previousScore: null,
                            newScore: normalizedScore,
                            previousStatus: null,
                            newStatus: status,
                            gradeType: effectiveGradeType,
                            editedBy: userId,
                            editorRole: 'control_estudios',
                            metadata: { personId, gradeId, subjectId, schoolPeriodId, subjectName, inscriptionSubjectId, historicalEdit: true },
                        }, t);
                    }
                    saved++;
                    continue;
                }
                // ── Case 4: Try to find an inscription for (personId, schoolPeriodId, gradeId) ──
                if (schoolPeriodId) {
                    const inscWhere = { personId, schoolPeriodId };
                    if (gradeId)
                        inscWhere.gradeId = gradeId;
                    const inscription = yield index_1.Inscription.findOne({
                        where: inscWhere,
                        transaction: t,
                    });
                    if (inscription) {
                        // Find or create InscriptionSubject
                        let insSub = yield index_1.InscriptionSubject.findOne({
                            where: { inscriptionId: inscription.id, subjectId },
                            transaction: t,
                        });
                        if (!insSub) {
                            insSub = yield index_1.InscriptionSubject.create({
                                inscriptionId: inscription.id,
                                subjectId,
                                schoolPeriodId: inscription.schoolPeriodId,
                                gradeId: inscription.gradeId,
                                sectionId: inscription.sectionId,
                            }, { transaction: t });
                        }
                        const effectiveGradeType = gradeType || 'regular';
                        const existing = yield index_1.SubjectFinalGrade.findOne({
                            where: { inscriptionSubjectId: insSub.id, gradeType: effectiveGradeType },
                            transaction: t,
                        });
                        if (existing) {
                            yield index_1.SubjectFinalGrade.update({
                                finalScore: normalizedScore,
                                status,
                                gradeType: effectiveGradeType,
                                plantelId: plantelId || null,
                                calculatedAt: parsedDate,
                                schoolPeriodId: inscription.schoolPeriodId,
                                subjectId: insSub.subjectId,
                                gradeId: inscription.gradeId,
                            }, {
                                where: { id: existing.id },
                                transaction: t,
                            });
                            yield (0, gradeChangeLogService_1.logGradeChange)({
                                entityType: 'subject_final_grade',
                                entityId: existing.id,
                                previousScore: existing.finalScore != null ? Number(existing.finalScore) : null,
                                newScore: normalizedScore,
                                previousStatus: existing.status || null,
                                newStatus: status,
                                gradeType: effectiveGradeType,
                                editedBy: userId,
                                editorRole: 'control_estudios',
                                metadata: { personId, gradeId, subjectId, schoolPeriodId, subjectName, inscriptionSubjectId: insSub.id, historicalEdit: true },
                            }, t);
                        }
                        else {
                            const newFg = yield index_1.SubjectFinalGrade.create({
                                inscriptionSubjectId: insSub.id,
                                finalScore: normalizedScore,
                                status,
                                gradeType: effectiveGradeType,
                                plantelId: plantelId || null,
                                calculatedAt: parsedDate,
                                schoolPeriodId: inscription.schoolPeriodId,
                                subjectId: insSub.subjectId,
                                gradeId: inscription.gradeId,
                            }, { transaction: t });
                            yield (0, gradeChangeLogService_1.logGradeChange)({
                                entityType: 'subject_final_grade',
                                entityId: newFg.id,
                                previousScore: null,
                                newScore: normalizedScore,
                                previousStatus: null,
                                newStatus: status,
                                gradeType: effectiveGradeType,
                                editedBy: userId,
                                editorRole: 'control_estudios',
                                metadata: { personId, gradeId, subjectId, schoolPeriodId, subjectName, inscriptionSubjectId: insSub.id, historicalEdit: true },
                            }, t);
                        }
                        saved++;
                        continue;
                    }
                }
                // ── Case 5: No inscription → use HistoricalGrade ──
                // Don't create empty historical grades — if score is null, skip
                if (normalizedScore === null) {
                    // Check if there's an existing one to delete
                    const existingHist = yield index_1.HistoricalGrade.findOne({
                        where: { personId, gradeId, subjectId },
                        transaction: t,
                    });
                    if (existingHist) {
                        yield index_1.HistoricalGrade.destroy({
                            where: { id: existingHist.id },
                            transaction: t,
                        });
                        saved++;
                    }
                    continue;
                }
                const existingHist = yield index_1.HistoricalGrade.findOne({
                    where: { personId, gradeId, subjectId },
                    transaction: t,
                });
                if (existingHist) {
                    yield index_1.HistoricalGrade.update({
                        schoolPeriodId: schoolPeriodId || null,
                        finalScore: normalizedScore,
                        status,
                        gradeType: gradeType || 'regular',
                        plantelId: plantelId || null,
                        date: dateOnly,
                        subjectName: subjectName || null,
                    }, {
                        where: { id: existingHist.id },
                        transaction: t,
                    });
                    yield (0, gradeChangeLogService_1.logGradeChange)({
                        entityType: 'historical_grade',
                        entityId: existingHist.id,
                        previousScore: existingHist.finalScore != null ? Number(existingHist.finalScore) : null,
                        newScore: normalizedScore,
                        previousStatus: existingHist.status || null,
                        newStatus: status,
                        gradeType: gradeType || 'regular',
                        editedBy: userId,
                        editorRole: 'control_estudios',
                        metadata: { personId, gradeId, subjectId, schoolPeriodId, subjectName },
                    }, t);
                }
                else {
                    const newHist = yield index_1.HistoricalGrade.create({
                        personId,
                        gradeId,
                        subjectId,
                        schoolPeriodId: schoolPeriodId || null,
                        finalScore: normalizedScore,
                        status,
                        gradeType: gradeType || 'regular',
                        plantelId: plantelId || null,
                        date: dateOnly,
                        subjectName: subjectName || null,
                        createdBy: userId,
                    }, { transaction: t });
                    yield (0, gradeChangeLogService_1.logGradeChange)({
                        entityType: 'historical_grade',
                        entityId: newHist.id,
                        previousScore: null,
                        newScore: normalizedScore,
                        previousStatus: null,
                        newStatus: status,
                        gradeType: gradeType || 'regular',
                        editedBy: userId,
                        editorRole: 'control_estudios',
                        metadata: { personId, gradeId, subjectId, schoolPeriodId, subjectName },
                    }, t);
                }
                saved++;
            }
            catch (err) {
                errors.push(`Error: ${err.message}`);
            }
        }
        yield t.commit();
        return res.json({ saved, errors });
    }
    catch (error) {
        yield t.rollback();
        console.error('[saveHistoricalGrades] Error:', error);
        return res.status(500).json({ message: error.message || 'Error al guardar notas históricas' });
    }
});
exports.saveHistoricalGrades = saveHistoricalGrades;
/**
 * Save the ordered list of planteles for a student.
 * Body: { personId, planteles: [{ plantelId, isSystem }] }
 * The order is determined by the array order.
 * Uses SYSTEM_PLANTEL_ID = -1 to represent the institution's own plantel (stored as isSystem=true, plantelId=null).
 */
const savePersonPlanteles = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const t = yield database_1.default.transaction();
    try {
        const sessionUser = (_a = req.session) === null || _a === void 0 ? void 0 : _a.user;
        if (!sessionUser) {
            return res.status(401).json({ message: 'No autorizado' });
        }
        const { personId, planteles } = req.body;
        if (!personId) {
            return res.status(400).json({ message: 'personId es requerido' });
        }
        if (!Array.isArray(planteles)) {
            return res.status(400).json({ message: 'planteles debe ser un array' });
        }
        // Delete existing entries for this person
        yield index_1.PersonPlantel.destroy({
            where: { personId },
            transaction: t,
        });
        // Insert new entries with order
        for (let i = 0; i < planteles.length; i++) {
            const p = planteles[i];
            // Skip the system plantel (id -1) — it's virtual, stored as isSystem=true with a null plantelId
            if (p.plantelId === -1 || p.isSystem) {
                yield index_1.PersonPlantel.create({
                    personId,
                    plantelId: null,
                    order: i,
                    isSystem: true,
                }, { transaction: t });
            }
            else {
                yield index_1.PersonPlantel.create({
                    personId,
                    plantelId: p.plantelId,
                    order: i,
                    isSystem: false,
                }, { transaction: t });
            }
        }
        yield t.commit();
        return res.json({ saved: planteles.length });
    }
    catch (error) {
        yield t.rollback();
        console.error('[savePersonPlanteles] Error:', error);
        return res.status(500).json({ message: error.message || 'Error al guardar planteles' });
    }
});
exports.savePersonPlanteles = savePersonPlanteles;
/**
 * Save the group subject name for a student's grade.
 * Updates all HistoricalGrade records for (personId, gradeId) with the new subjectName.
 * Body: { personId, gradeId, subjectName }
 */
const saveGroupSubjectName = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const sessionUser = (_a = req.session) === null || _a === void 0 ? void 0 : _a.user;
        if (!sessionUser) {
            return res.status(401).json({ message: 'No autorizado' });
        }
        const { personId, gradeId, subjectName } = req.body;
        if (!personId || !gradeId) {
            return res.status(400).json({ message: 'personId y gradeId son requeridos' });
        }
        const [updated] = yield index_1.HistoricalGrade.update({ subjectName: subjectName || null }, { where: { personId, gradeId } });
        return res.json({ updated });
    }
    catch (error) {
        console.error('[saveGroupSubjectName] Error:', error);
        return res.status(500).json({ message: error.message || 'Error al guardar nombre de materia' });
    }
});
exports.saveGroupSubjectName = saveGroupSubjectName;
