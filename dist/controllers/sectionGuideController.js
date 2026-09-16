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
exports.getMyGuideSections = exports.getAllGuidesForPeriod = exports.getSectionGuide = exports.setSectionGuide = exports.getTeachersForSection = void 0;
const index_1 = require("../models/index.js");
// GET /api/section-guides/teachers?schoolPeriodId=&gradeId=&sectionId=
// Returns all teachers assigned to that grade+section in the period, plus the current guide (if any)
const getTeachersForSection = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const { schoolPeriodId, gradeId, sectionId } = req.query;
        if (!schoolPeriodId || !gradeId || !sectionId) {
            return res.status(400).json({ message: 'Se requieren schoolPeriodId, gradeId y sectionId' });
        }
        // Find all TeacherAssignments for this period+grade+section
        const assignments = yield index_1.TeacherAssignment.findAll({
            where: { sectionId: Number(sectionId) },
            include: [
                {
                    model: index_1.PeriodGradeSubject,
                    as: 'periodGradeSubject',
                    required: true,
                    include: [
                        {
                            model: index_1.PeriodGrade,
                            as: 'periodGrade',
                            required: true,
                            where: {
                                schoolPeriodId: Number(schoolPeriodId),
                                gradeId: Number(gradeId),
                            },
                            include: [{ model: index_1.Grade, as: 'grade' }],
                        },
                        { model: index_1.Subject, as: 'subject' },
                    ],
                },
                {
                    model: index_1.Person,
                    as: 'teacher',
                    attributes: ['id', 'firstName', 'lastName', 'documentType', 'document'],
                },
            ],
        });
        // Deduplicate teachers (a teacher may teach multiple subjects in the same section)
        const teacherMap = new Map();
        for (const a of assignments) {
            const t = a.teacher;
            const subjName = ((_b = (_a = a.periodGradeSubject) === null || _a === void 0 ? void 0 : _a.subject) === null || _b === void 0 ? void 0 : _b.name) || '';
            if (!t)
                continue;
            const existing = teacherMap.get(t.id);
            if (existing) {
                if (subjName && !existing.subjects.includes(subjName)) {
                    existing.subjects.push(subjName);
                }
            }
            else {
                teacherMap.set(t.id, {
                    id: t.id,
                    firstName: t.firstName,
                    lastName: t.lastName,
                    documentType: t.documentType,
                    document: t.document,
                    subjects: subjName ? [subjName] : [],
                });
            }
        }
        // Find current guide
        const guide = yield index_1.SectionGuide.findOne({
            where: {
                schoolPeriodId: Number(schoolPeriodId),
                gradeId: Number(gradeId),
                sectionId: Number(sectionId),
            },
        });
        const teachers = Array.from(teacherMap.values()).map(t => (Object.assign(Object.assign({}, t), { isGuide: guide ? guide.teacherId === t.id : false })));
        // Sort: guide first, then by lastName
        teachers.sort((a, b) => {
            if (a.isGuide !== b.isGuide)
                return a.isGuide ? -1 : 1;
            return `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`);
        });
        res.json({ teachers, guideTeacherId: (guide === null || guide === void 0 ? void 0 : guide.teacherId) || null });
    }
    catch (error) {
        console.error('[getTeachersForSection] Error:', error);
        res.status(500).json({ message: 'Error al obtener profesores de la sección' });
    }
});
exports.getTeachersForSection = getTeachersForSection;
// POST /api/section-guides
// Body: { teacherId, gradeId, sectionId, schoolPeriodId }
// Upserts the guide for that grade+section+period (only one allowed)
const setSectionGuide = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { teacherId, gradeId, sectionId, schoolPeriodId } = req.body;
        if (!teacherId || !gradeId || !sectionId || !schoolPeriodId) {
            return res.status(400).json({ message: 'Se requieren teacherId, gradeId, sectionId y schoolPeriodId' });
        }
        // Verify the teacher has the Profesor role
        const teacher = yield index_1.Person.findByPk(teacherId, {
            include: [{ model: index_1.Role, as: 'roles', where: { name: 'Profesor' }, through: { attributes: [] }, required: true }],
        });
        if (!teacher) {
            return res.status(404).json({ message: 'El profesor no existe o no tiene el rol Profesor' });
        }
        // Verify the teacher is assigned to this grade+section in the period
        const isAssigned = yield index_1.TeacherAssignment.findOne({
            where: { teacherId: Number(teacherId), sectionId: Number(sectionId) },
            include: [
                {
                    model: index_1.PeriodGradeSubject,
                    as: 'periodGradeSubject',
                    required: true,
                    include: [
                        {
                            model: index_1.PeriodGrade,
                            as: 'periodGrade',
                            required: true,
                            where: { schoolPeriodId: Number(schoolPeriodId), gradeId: Number(gradeId) },
                        },
                    ],
                },
            ],
        });
        if (!isAssigned) {
            return res.status(400).json({ message: 'El profesor no está asignado a esta sección en el período indicado' });
        }
        // Upsert: if a guide already exists for this grade+section+period, update the teacherId
        const [guide, created] = yield index_1.SectionGuide.findOrCreate({
            where: { gradeId: Number(gradeId), sectionId: Number(sectionId), schoolPeriodId: Number(schoolPeriodId) },
            defaults: { teacherId: Number(teacherId), gradeId: Number(gradeId), sectionId: Number(sectionId), schoolPeriodId: Number(schoolPeriodId) },
        });
        if (!created && guide.teacherId !== Number(teacherId)) {
            yield guide.update({ teacherId: Number(teacherId) });
        }
        res.json({ message: 'Profesor guía asignado correctamente', guide });
    }
    catch (error) {
        console.error('[setSectionGuide] Error:', error);
        res.status(500).json({ message: 'Error al asignar profesor guía' });
    }
});
exports.setSectionGuide = setSectionGuide;
// GET /api/section-guides?schoolPeriodId=&gradeId=&sectionId=
// Returns the current guide for that grade+section+period (with teacher info)
const getSectionGuide = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { schoolPeriodId, gradeId, sectionId } = req.query;
        if (!schoolPeriodId || !gradeId || !sectionId) {
            return res.status(400).json({ message: 'Se requieren schoolPeriodId, gradeId y sectionId' });
        }
        const guide = yield index_1.SectionGuide.findOne({
            where: {
                schoolPeriodId: Number(schoolPeriodId),
                gradeId: Number(gradeId),
                sectionId: Number(sectionId),
            },
            include: [
                { model: index_1.Person, as: 'guideTeacher', attributes: ['id', 'firstName', 'lastName', 'documentType', 'document'] },
                { model: index_1.Grade, as: 'grade' },
                { model: index_1.Section, as: 'section' },
                { model: index_1.SchoolPeriod, as: 'schoolPeriod' },
            ],
        });
        res.json(guide);
    }
    catch (error) {
        console.error('[getSectionGuide] Error:', error);
        res.status(500).json({ message: 'Error al obtener profesor guía' });
    }
});
exports.getSectionGuide = getSectionGuide;
// GET /api/section-guides/all?schoolPeriodId=
// Returns all sections across all grades for the period, each with its teachers and current guide
const getAllGuidesForPeriod = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const { schoolPeriodId } = req.query;
        if (!schoolPeriodId) {
            return res.status(400).json({ message: 'Se requiere schoolPeriodId' });
        }
        const periodId = Number(schoolPeriodId);
        // 1. Get all PeriodGrade records for this period (gives us grades)
        const periodGrades = yield index_1.PeriodGrade.findAll({
            where: { schoolPeriodId: periodId },
            include: [{ model: index_1.Grade, as: 'grade' }],
        });
        // Sort by grade.order in JS (Sequelize nested order can be tricky)
        periodGrades.sort((a, b) => { var _a, _b; return (((_a = a.grade) === null || _a === void 0 ? void 0 : _a.order) || 0) - (((_b = b.grade) === null || _b === void 0 ? void 0 : _b.order) || 0); });
        // 2. Get all sections for these PeriodGrades
        const periodGradeIds = periodGrades.map(pg => pg.id);
        const pgsRecords = yield index_1.PeriodGradeSection.findAll({
            where: { periodGradeId: periodGradeIds },
            include: [{ model: index_1.Section, as: 'section' }],
        });
        // 3. Get all TeacherAssignments for this period
        const assignments = yield index_1.TeacherAssignment.findAll({
            where: { sectionId: pgsRecords.map(r => r.sectionId) },
            include: [
                {
                    model: index_1.PeriodGradeSubject,
                    as: 'periodGradeSubject',
                    required: true,
                    include: [
                        {
                            model: index_1.PeriodGrade,
                            as: 'periodGrade',
                            required: true,
                            where: { schoolPeriodId: periodId },
                        },
                        { model: index_1.Subject, as: 'subject' },
                    ],
                },
                {
                    model: index_1.Person,
                    as: 'teacher',
                    attributes: ['id', 'firstName', 'lastName', 'documentType', 'document'],
                },
            ],
        });
        // 4. Get all SectionGuides for this period
        const guides = yield index_1.SectionGuide.findAll({
            where: { schoolPeriodId: periodId },
        });
        const guideMap = new Map();
        for (const g of guides) {
            guideMap.set(`${g.gradeId}-${g.sectionId}`, g.teacherId);
        }
        // 5. Build teacher map per section
        const sectionTeacherMap = new Map();
        for (const a of assignments) {
            const t = a.teacher;
            const subjName = ((_b = (_a = a.periodGradeSubject) === null || _a === void 0 ? void 0 : _a.subject) === null || _b === void 0 ? void 0 : _b.name) || '';
            const sectionId = a.sectionId;
            if (!t)
                continue;
            if (!sectionTeacherMap.has(sectionId))
                sectionTeacherMap.set(sectionId, new Map());
            const inner = sectionTeacherMap.get(sectionId);
            const existing = inner.get(t.id);
            if (existing) {
                if (subjName && !existing.subjects.includes(subjName))
                    existing.subjects.push(subjName);
            }
            else {
                inner.set(t.id, {
                    id: t.id,
                    firstName: t.firstName,
                    lastName: t.lastName,
                    documentType: t.documentType,
                    document: t.document,
                    subjects: subjName ? [subjName] : [],
                });
            }
        }
        // 6. Build response grouped by grade
        const result = periodGrades.map(pg => {
            var _a;
            const gradeId = pg.gradeId;
            const gradeName = ((_a = pg.grade) === null || _a === void 0 ? void 0 : _a.name) || '';
            const sectionsForGrade = pgsRecords.filter(r => r.periodGradeId === pg.id);
            const sections = sectionsForGrade.map(pgs => {
                var _a;
                const sectionId = pgs.sectionId;
                const sectionName = ((_a = pgs.section) === null || _a === void 0 ? void 0 : _a.name) || '';
                const teacherMap = sectionTeacherMap.get(sectionId);
                const teachers = teacherMap ? Array.from(teacherMap.values()) : [];
                teachers.sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`));
                const guideTeacherId = guideMap.get(`${gradeId}-${sectionId}`) || null;
                return { sectionId, sectionName, teachers, guideTeacherId };
            }).sort((a, b) => a.sectionName.localeCompare(b.sectionName));
            return { gradeId, gradeName, sections };
        });
        res.json(result);
    }
    catch (error) {
        console.error('[getAllGuidesForPeriod] Error:', error);
        res.status(500).json({ message: 'Error al obtener profesores guías' });
    }
});
exports.getAllGuidesForPeriod = getAllGuidesForPeriod;
// GET /api/section-guides/my-sections
// Returns the sections where the logged-in teacher is guide, for the active period,
// along with the terms and their council completion status.
const getMyGuideSections = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const personId = (_a = req.session.user) === null || _a === void 0 ? void 0 : _a.personId;
        if (!personId) {
            return res.status(403).json({ message: 'No autorizado' });
        }
        // Find the active period
        const activePeriod = yield index_1.SchoolPeriod.findOne({
            where: { status: 'activo' },
        });
        if (!activePeriod) {
            return res.json({ sections: [], terms: [] });
        }
        // Find sections where this teacher is guide
        const guides = yield index_1.SectionGuide.findAll({
            where: {
                teacherId: personId,
                schoolPeriodId: activePeriod.id,
            },
            include: [
                { model: index_1.Grade, as: 'grade' },
                { model: index_1.Section, as: 'section' },
            ],
        });
        if (guides.length === 0) {
            return res.json({ sections: [], terms: [] });
        }
        // Get terms for this period
        const terms = yield index_1.Term.findAll({
            where: { schoolPeriodId: activePeriod.id },
            order: [['order', 'ASC']],
        });
        // Check council completion for each grade+section+term
        const sections = yield Promise.all(guides.map((g) => __awaiter(void 0, void 0, void 0, function* () {
            var _a, _b;
            const gradeId = g.gradeId;
            const sectionId = g.sectionId;
            const termStatuses = yield Promise.all(terms.map((t) => __awaiter(void 0, void 0, void 0, function* () {
                const checklist = yield index_1.CouncilChecklist.findOne({
                    where: { schoolPeriodId: activePeriod.id, gradeId, sectionId, termId: t.id, status: 'done' },
                });
                return { termId: t.id, termName: t.name, councilDone: !!checklist };
            })));
            return {
                gradeId,
                gradeName: ((_a = g.grade) === null || _a === void 0 ? void 0 : _a.name) || '',
                sectionId,
                sectionName: ((_b = g.section) === null || _b === void 0 ? void 0 : _b.name) || '',
                termStatuses,
            };
        })));
        res.json({
            sections,
            terms: terms.map((t) => ({ id: t.id, name: t.name, order: t.order })),
        });
    }
    catch (error) {
        console.error('[getMyGuideSections] Error:', error);
        res.status(500).json({ message: error.message || 'Error al obtener secciones guía' });
    }
});
exports.getMyGuideSections = getMyGuideSections;
