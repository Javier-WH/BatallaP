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
exports.updateMpContent = exports.getMpContent = exports.updateMpLockedEncounters = exports.getMpLockedEncounters = exports.getMpNominaFinal = exports.getMpNominaByEncounter = exports.saveMpEncounterScore = exports.updateMpEncounterDatesByPgs = exports.getMpEncounterDatesByPgs = exports.updateMpEncounterDates = exports.getMpEncounters = exports.saveMpQualification = exports.deleteMpEvaluationItem = exports.updateMpEvaluationItem = exports.createMpEvaluationItem = exports.saveMpFinalGrade = exports.getMpAssignmentEncounters = exports.getMpAssignmentDetail = exports.getMpTeacherAssignments = exports.getMpNomina = exports.removeStudentFromMp = exports.registerStudentsInMp = exports.getStudentsForMpRegistration = exports.getMpStructure = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
const index_1 = require("../models/index.js");
const studentSortService_1 = require("../services/studentSortService.js");
const subjectOrderService_1 = require("../services/subjectOrderService.js");
const gradeEvaluationService_1 = require("../services/gradeEvaluationService.js");
const academicContextService_1 = require("../services/academicContextService.js");
const gradeChangeLogService_1 = require("../services/gradeChangeLogService.js");
/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
// Stored uppercase by the Section beforeCreate hook — use the canonical
// stored form so lookups match under case-sensitive collations too.
const MP_SECTION_NAME = 'MATERIA PENDIENTE';
/** Find or create the "Materia Pendiente" section. */
function findOrCreateMpSection(t) {
    return __awaiter(this, void 0, void 0, function* () {
        const [section] = yield index_1.Section.findOrCreate({
            where: { name: MP_SECTION_NAME },
            defaults: { name: MP_SECTION_NAME },
            transaction: t,
        });
        return section;
    });
}
/** Find or create the PeriodGrade for a grade in the active period. */
function findOrCreateMpPeriodGrade(schoolPeriodId, gradeId, t) {
    return __awaiter(this, void 0, void 0, function* () {
        const [pg] = yield index_1.PeriodGrade.findOrCreate({
            where: { schoolPeriodId, gradeId },
            defaults: { schoolPeriodId, gradeId },
            transaction: t,
        });
        return pg;
    });
}
/** Link the MP section to a PeriodGrade. */
function linkMpSection(pgId, sectionId, t) {
    return __awaiter(this, void 0, void 0, function* () {
        yield index_1.PeriodGradeSection.findOrCreate({
            where: { periodGradeId: pgId, sectionId },
            defaults: { periodGradeId: pgId, sectionId },
            transaction: t,
        });
    });
}
/* ------------------------------------------------------------------ */
/* GET /pending-subjects/structure                                     */
/* ------------------------------------------------------------------ */
const getMpStructure = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const activePeriod = yield index_1.SchoolPeriod.findOne({ where: { status: 'activo' } });
        if (!activePeriod) {
            return res.json({ period: null, grades: [] });
        }
        // Get all grades ordered by `order`
        const allGrades = yield index_1.Grade.findAll({ order: [['order', 'ASC'], ['name', 'ASC']] });
        // Exclude the last grade (highest order) — MP only goes up to penultimate
        if (allGrades.length <= 1) {
            return res.json({ period: activePeriod, grades: [] });
        }
        const mpGrades = allGrades.slice(0, -1);
        // Get the PeriodGrade for each grade in the active period
        const result = [];
        for (const grade of mpGrades) {
            const pg = yield index_1.PeriodGrade.findOne({
                where: { schoolPeriodId: activePeriod.id, gradeId: grade.id },
                include: [
                    {
                        model: index_1.Subject,
                        as: 'subjects',
                        through: { attributes: ['id', 'order', 'active', 'includeInAverage', 'notRepairable'], where: { active: true } },
                    },
                ],
            });
            if (!pg) {
                result.push({
                    grade,
                    periodGrade: null,
                    subjects: [],
                    mpSection: null,
                });
                continue;
            }
            // Ensure MP section exists and is linked
            const mpSection = yield findOrCreateMpSection();
            yield linkMpSection(pg.id, mpSection.id);
            // Get subjects in canonical order, excluding "No Reparable" subjects
            const subjectOrderMap = yield (0, subjectOrderService_1.getSubjectOrderMap)(pg.id);
            const subjects = (pg.subjects || []).filter((s) => { var _a; return ((_a = s.PeriodGradeSubject) === null || _a === void 0 ? void 0 : _a.notRepairable) !== true; });
            const sortedSubjects = subjects.sort((a, b) => {
                var _a, _b;
                const oa = (_a = subjectOrderMap.get(a.id)) !== null && _a !== void 0 ? _a : 99;
                const ob = (_b = subjectOrderMap.get(b.id)) !== null && _b !== void 0 ? _b : 99;
                return oa - ob;
            });
            // For each subject, count how many students are registered
            const subjectsWithCount = [];
            for (const subj of sortedSubjects) {
                // Find MP inscriptions for this grade in the active period
                const mpInscriptions = yield index_1.Inscription.findAll({
                    where: {
                        schoolPeriodId: activePeriod.id,
                        gradeId: grade.id,
                        sectionId: mpSection.id,
                    },
                    include: [
                        {
                            model: index_1.InscriptionSubject,
                            as: 'inscriptionSubjects',
                            where: { subjectId: subj.id },
                            required: true,
                        },
                    ],
                });
                subjectsWithCount.push(Object.assign(Object.assign({}, subj.toJSON()), { studentCount: mpInscriptions.length, periodGradeSubjectId: (_a = subj.PeriodGradeSubject) === null || _a === void 0 ? void 0 : _a.id }));
            }
            result.push({
                grade,
                periodGrade: pg,
                subjects: subjectsWithCount,
                mpSection,
            });
        }
        return res.json({ period: activePeriod, grades: result });
    }
    catch (error) {
        console.error('[getMpStructure] Error:', error);
        return res.status(500).json({ message: 'Error al obtener estructura de materia pendiente' });
    }
});
exports.getMpStructure = getMpStructure;
/* ------------------------------------------------------------------ */
/* GET /pending-subjects/students/:gradeId                             */
/* List students from the NEXT grade (year+1) for registration        */
/* ------------------------------------------------------------------ */
const getStudentsForMpRegistration = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { gradeId } = req.params;
        const gradeIdNum = Number(gradeId);
        if (!Number.isFinite(gradeIdNum)) {
            return res.status(400).json({ message: 'gradeId inválido' });
        }
        const activePeriod = yield index_1.SchoolPeriod.findOne({ where: { status: 'activo' } });
        if (!activePeriod) {
            return res.json({ students: [] });
        }
        // Find the next grade (order + 1)
        const currentGrade = yield index_1.Grade.findByPk(gradeIdNum);
        if (!currentGrade) {
            return res.status(404).json({ message: 'Grado no encontrado' });
        }
        const allGrades = yield index_1.Grade.findAll({ order: [['order', 'ASC'], ['name', 'ASC']] });
        const currentIdx = allGrades.findIndex(g => g.id === gradeIdNum);
        if (currentIdx === -1 || currentIdx >= allGrades.length - 1) {
            return res.json({ students: [] });
        }
        const nextGrade = allGrades[currentIdx + 1];
        // Get all inscriptions for the next grade in the active period (all sections, excluding MP section)
        const mpSection = yield index_1.Section.findOne({ where: { name: MP_SECTION_NAME } });
        const whereClause = {
            schoolPeriodId: activePeriod.id,
            gradeId: nextGrade.id,
        };
        if (mpSection) {
            whereClause.sectionId = { [sequelize_1.Op.ne]: mpSection.id };
        }
        const inscriptions = yield index_1.Inscription.findAll({
            where: whereClause,
            include: [
                { model: index_1.Person, as: 'student' },
                { model: index_1.Section, as: 'section' },
            ],
        });
        // Sort canonically, but put materia_pendiente students first
        const mpStudents = inscriptions.filter(i => i.escolaridad === 'materia_pendiente');
        const otherStudents = inscriptions.filter(i => i.escolaridad !== 'materia_pendiente');
        (0, studentSortService_1.sortInscriptions)(mpStudents);
        (0, studentSortService_1.sortInscriptions)(otherStudents);
        const students = [...mpStudents, ...otherStudents].map((ins) => {
            var _a, _b, _c, _d, _e;
            return ({
                inscriptionId: ins.id,
                personId: ins.personId,
                studentName: `${(_a = ins.student) === null || _a === void 0 ? void 0 : _a.lastName} ${(_b = ins.student) === null || _b === void 0 ? void 0 : _b.firstName}`,
                studentDni: (_c = ins.student) === null || _c === void 0 ? void 0 : _c.document,
                documentType: (_d = ins.student) === null || _d === void 0 ? void 0 : _d.documentType,
                escolaridad: ins.escolaridad,
                sectionName: (_e = ins.section) === null || _e === void 0 ? void 0 : _e.name,
                gradeName: nextGrade.name,
            });
        });
        return res.json({ students, nextGrade });
    }
    catch (error) {
        console.error('[getStudentsForMpRegistration] Error:', error);
        return res.status(500).json({ message: 'Error al obtener estudiantes' });
    }
});
exports.getStudentsForMpRegistration = getStudentsForMpRegistration;
/* ------------------------------------------------------------------ */
/* POST /pending-subjects/register                                     */
/* Register students in a pending subject (creates MP inscription)     */
/* ------------------------------------------------------------------ */
const registerStudentsInMp = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const t = yield database_1.default.transaction();
    try {
        const { gradeId, subjectId, inscriptionIds } = req.body;
        if (!Number.isFinite(gradeId) || !Number.isFinite(subjectId) || !Array.isArray(inscriptionIds)) {
            return res.status(400).json({ message: 'gradeId, subjectId e inscriptionIds son requeridos' });
        }
        const activePeriod = yield index_1.SchoolPeriod.findOne({ where: { status: 'activo' } });
        if (!activePeriod) {
            return res.status(400).json({ message: 'No hay un período activo' });
        }
        // Ensure MP section and PeriodGrade exist
        const mpSection = yield findOrCreateMpSection(t);
        const mpPeriodGrade = yield findOrCreateMpPeriodGrade(activePeriod.id, gradeId, t);
        yield linkMpSection(mpPeriodGrade.id, mpSection.id, t);
        // Ensure PeriodGradeSubject exists for this subject in the MP PeriodGrade
        let pgs = yield index_1.PeriodGradeSubject.findOne({
            where: { periodGradeId: mpPeriodGrade.id, subjectId },
            transaction: t,
        });
        if (!pgs) {
            pgs = yield index_1.PeriodGradeSubject.create({
                periodGradeId: mpPeriodGrade.id,
                subjectId,
                active: true,
                includeInAverage: false,
            }, { transaction: t });
        }
        let registered = 0;
        for (const sourceInscriptionId of inscriptionIds) {
            const sourceInscription = yield index_1.Inscription.findByPk(sourceInscriptionId, { transaction: t });
            if (!sourceInscription)
                continue;
            // Reject manual registration if the subject is flagged as "No Reparable"
            // in the source grade+period (Opción A: filtrar, no borrar).
            const notRepairableMap = yield (0, subjectOrderService_1.getSubjectNotRepairableMapByGradeAndPeriod)(sourceInscription.gradeId, sourceInscription.schoolPeriodId, t);
            if (notRepairableMap.get(subjectId) === true) {
                yield t.rollback();
                return res.status(400).json({
                    message: 'Esta materia está marcada como "No Reparable" y no puede registrarse en Materia Pendiente'
                });
            }
            // Find or create the MP inscription for this student (same grade, MP section, active period)
            let mpInscription = yield index_1.Inscription.findOne({
                where: {
                    schoolPeriodId: activePeriod.id,
                    gradeId,
                    sectionId: mpSection.id,
                    personId: sourceInscription.personId,
                },
                transaction: t,
            });
            if (!mpInscription) {
                mpInscription = yield index_1.Inscription.create({
                    schoolPeriodId: activePeriod.id,
                    gradeId,
                    sectionId: mpSection.id,
                    personId: sourceInscription.personId,
                    escolaridad: 'materia_pendiente',
                    originPeriodId: sourceInscription.originPeriodId || sourceInscription.schoolPeriodId,
                    isRepeater: false,
                }, { transaction: t });
            }
            // Create InscriptionSubject if not exists
            const existingInsSubj = yield index_1.InscriptionSubject.findOne({
                where: { inscriptionId: mpInscription.id, subjectId },
                transaction: t,
            });
            if (!existingInsSubj) {
                yield index_1.InscriptionSubject.create({
                    inscriptionId: mpInscription.id,
                    subjectId,
                    schoolPeriodId: mpInscription.schoolPeriodId,
                    gradeId: mpInscription.gradeId,
                    sectionId: mpInscription.sectionId,
                }, { transaction: t });
            }
            // Create PendingSubject record if not exists
            const existingPending = yield index_1.PendingSubject.findOne({
                where: { newInscriptionId: mpInscription.id, subjectId },
                transaction: t,
            });
            if (!existingPending) {
                yield index_1.PendingSubject.create({
                    newInscriptionId: mpInscription.id,
                    subjectId,
                    originPeriodId: sourceInscription.schoolPeriodId,
                    status: 'pendiente',
                }, { transaction: t });
            }
            // Change escolaridad of the SOURCE inscription to materia_pendiente
            if (sourceInscription.escolaridad !== 'materia_pendiente') {
                yield sourceInscription.update({ escolaridad: 'materia_pendiente' }, { transaction: t });
            }
            registered++;
        }
        yield t.commit();
        return res.json({ message: `${registered} estudiante(s) registrado(s) en materia pendiente`, registered });
    }
    catch (error) {
        yield t.rollback();
        console.error('[registerStudentsInMp] Error:', error);
        return res.status(500).json({ message: 'Error al registrar estudiantes en materia pendiente' });
    }
});
exports.registerStudentsInMp = registerStudentsInMp;
/* ------------------------------------------------------------------ */
/* DELETE /pending-subjects/remove/:inscriptionSubjectId               */
/* Remove a student from a pending subject                             */
/* ------------------------------------------------------------------ */
const removeStudentFromMp = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const t = yield database_1.default.transaction();
    try {
        const inscriptionSubjectId = Number(req.params.inscriptionSubjectId);
        if (!Number.isFinite(inscriptionSubjectId)) {
            return res.status(400).json({ message: 'inscriptionSubjectId inválido' });
        }
        const insSubj = yield index_1.InscriptionSubject.findByPk(inscriptionSubjectId, { transaction: t });
        if (!insSubj) {
            return res.status(404).json({ message: 'Registro no encontrado' });
        }
        // Delete PendingSubject record
        yield index_1.PendingSubject.destroy({
            where: { newInscriptionId: insSubj.inscriptionId, subjectId: insSubj.subjectId },
            transaction: t,
        });
        // Delete SubjectFinalGrade if exists (only the MP records — both P and M types)
        yield index_1.SubjectFinalGrade.destroy({
            where: {
                inscriptionSubjectId: insSubj.id,
                gradeType: { [sequelize_1.Op.in]: ['materia_pendiente', 'revision_materia_pendiente'] },
            },
            transaction: t,
        });
        // Delete the InscriptionSubject
        yield insSubj.destroy({ transaction: t });
        // Check if the MP inscription has no more subjects → delete it
        const remaining = yield index_1.InscriptionSubject.count({
            where: { inscriptionId: insSubj.inscriptionId },
            transaction: t,
        });
        if (remaining === 0) {
            yield index_1.Inscription.destroy({
                where: { id: insSubj.inscriptionId },
                transaction: t,
            });
        }
        yield t.commit();
        return res.json({ message: 'Estudiante removido de la materia pendiente' });
    }
    catch (error) {
        yield t.rollback();
        console.error('[removeStudentFromMp] Error:', error);
        return res.status(500).json({ message: 'Error al remover estudiante' });
    }
});
exports.removeStudentFromMp = removeStudentFromMp;
/* ------------------------------------------------------------------ */
/* GET /pending-subjects/nomina/:gradeId                               */
/* Nómina estilo revisión: students × subjects matrix               */
/* ------------------------------------------------------------------ */
const getMpNomina = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { gradeId } = req.params;
        const gradeIdNum = Number(gradeId);
        if (!Number.isFinite(gradeIdNum)) {
            return res.status(400).json({ message: 'gradeId inválido' });
        }
        const activePeriod = yield index_1.SchoolPeriod.findOne({ where: { status: 'activo' } });
        if (!activePeriod) {
            return res.json({ grade: null, subjects: [], students: [] });
        }
        const mpSection = yield index_1.Section.findOne({ where: { name: MP_SECTION_NAME } });
        if (!mpSection) {
            return res.json({ grade: null, subjects: [], students: [] });
        }
        // Get the PeriodGrade for this grade
        const pg = yield index_1.PeriodGrade.findOne({
            where: { schoolPeriodId: activePeriod.id, gradeId: gradeIdNum },
        });
        if (!pg) {
            return res.json({ grade: null, subjects: [], students: [] });
        }
        // Get subjects in canonical order
        const subjectOrderMap = yield (0, subjectOrderService_1.getSubjectOrderMap)(pg.id);
        const pgsList = yield index_1.PeriodGradeSubject.findAll({
            where: { periodGradeId: pg.id, active: true },
            include: [{ model: index_1.Subject, as: 'subject' }],
            transaction: undefined,
        });
        const subjects = pgsList
            .sort((a, b) => { var _a, _b; return ((_a = subjectOrderMap.get(a.subjectId)) !== null && _a !== void 0 ? _a : 99) - ((_b = subjectOrderMap.get(b.subjectId)) !== null && _b !== void 0 ? _b : 99); })
            .map(pgs => {
            var _a;
            return ({
                id: pgs.subjectId,
                name: (_a = pgs.subject) === null || _a === void 0 ? void 0 : _a.name,
                periodGradeSubjectId: pgs.id,
            });
        });
        // Get all MP inscriptions for this grade
        const inscriptions = yield index_1.Inscription.findAll({
            where: {
                schoolPeriodId: activePeriod.id,
                gradeId: gradeIdNum,
                sectionId: mpSection.id,
            },
            include: [
                { model: index_1.Person, as: 'student' },
                {
                    model: index_1.InscriptionSubject,
                    as: 'inscriptionSubjects',
                    include: [
                        { model: index_1.Subject, as: 'subject' },
                        { model: index_1.SubjectFinalGrade, as: 'finalGrade' },
                    ],
                },
            ],
        });
        (0, studentSortService_1.sortInscriptions)(inscriptions);
        const students = inscriptions.map((ins) => {
            var _a, _b, _c, _d, _e;
            return ({
                inscriptionId: ins.id,
                personId: ins.personId,
                studentName: `${(_a = ins.student) === null || _a === void 0 ? void 0 : _a.lastName} ${(_b = ins.student) === null || _b === void 0 ? void 0 : _b.firstName}`,
                studentDni: (_c = ins.student) === null || _c === void 0 ? void 0 : _c.document,
                documentType: (_d = ins.student) === null || _d === void 0 ? void 0 : _d.documentType,
                subjects: ((_e = ins.inscriptionSubjects) === null || _e === void 0 ? void 0 : _e.map((is) => {
                    var _a;
                    return ({
                        inscriptionSubjectId: is.id,
                        subjectId: is.subjectId,
                        subjectName: (_a = is.subject) === null || _a === void 0 ? void 0 : _a.name,
                        finalGrade: is.finalGrade ? {
                            finalScore: is.finalGrade.finalScore,
                            status: is.finalGrade.status,
                            gradeType: is.finalGrade.gradeType,
                            calculatedAt: is.finalGrade.calculatedAt,
                        } : null,
                    });
                })) || [],
            });
        });
        const grade = yield index_1.Grade.findByPk(gradeIdNum);
        return res.json({ grade, subjects, students });
    }
    catch (error) {
        console.error('[getMpNomina] Error:', error);
        return res.status(500).json({ message: 'Error al obtener nómina de materia pendiente' });
    }
});
exports.getMpNomina = getMpNomina;
/* ------------------------------------------------------------------ */
/* GET /pending-subjects/teacher-assignments                           */
/* Get MP assignments for the logged-in teacher                        */
/* ------------------------------------------------------------------ */
const getMpTeacherAssignments = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const personId = (_b = (_a = req.session) === null || _a === void 0 ? void 0 : _a.user) === null || _b === void 0 ? void 0 : _b.personId;
        if (!personId) {
            return res.status(403).json({ message: 'No autorizado' });
        }
        const activePeriod = yield index_1.SchoolPeriod.findOne({ where: { status: 'activo' } });
        if (!activePeriod) {
            return res.json({ assignments: [] });
        }
        const mpSection = yield index_1.Section.findOne({ where: { name: MP_SECTION_NAME } });
        if (!mpSection) {
            return res.json({ assignments: [] });
        }
        // Find TeacherAssignments where sectionId = MP section
        const assignments = yield index_1.TeacherAssignment.findAll({
            where: {
                teacherId: personId,
                sectionId: mpSection.id,
            },
            include: [
                {
                    model: index_1.PeriodGradeSubject,
                    as: 'periodGradeSubject',
                    include: [
                        { model: index_1.Subject, as: 'subject' },
                        {
                            model: index_1.PeriodGrade,
                            as: 'periodGrade',
                            where: { schoolPeriodId: activePeriod.id },
                            include: [{ model: index_1.Grade, as: 'grade' }],
                        },
                    ],
                },
            ],
        });
        const result = assignments.map((a) => {
            var _a, _b, _c, _d, _e, _f, _g, _h;
            return ({
                id: a.id,
                periodGradeSubjectId: a.periodGradeSubjectId,
                subjectId: (_a = a.periodGradeSubject) === null || _a === void 0 ? void 0 : _a.subjectId,
                subjectName: (_c = (_b = a.periodGradeSubject) === null || _b === void 0 ? void 0 : _b.subject) === null || _c === void 0 ? void 0 : _c.name,
                gradeId: (_e = (_d = a.periodGradeSubject) === null || _d === void 0 ? void 0 : _d.periodGrade) === null || _e === void 0 ? void 0 : _e.gradeId,
                gradeName: (_h = (_g = (_f = a.periodGradeSubject) === null || _f === void 0 ? void 0 : _f.periodGrade) === null || _g === void 0 ? void 0 : _g.grade) === null || _h === void 0 ? void 0 : _h.name,
            });
        });
        return res.json({ assignments: result });
    }
    catch (error) {
        console.error('[getMpTeacherAssignments] Error:', error);
        return res.status(500).json({ message: 'Error al obtener asignaciones' });
    }
});
exports.getMpTeacherAssignments = getMpTeacherAssignments;
/* ------------------------------------------------------------------ */
/* GET /pending-subjects/assignment/:periodGradeSubjectId              */
/* Get students + grades for a specific MP assignment                  */
/* ------------------------------------------------------------------ */
const getMpAssignmentDetail = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const pgsId = Number(req.params.periodGradeSubjectId);
        if (!Number.isFinite(pgsId)) {
            return res.status(400).json({ message: 'periodGradeSubjectId inválido' });
        }
        const pgs = yield index_1.PeriodGradeSubject.findByPk(pgsId, {
            include: [
                { model: index_1.Subject, as: 'subject' },
                { model: index_1.PeriodGrade, as: 'periodGrade' },
            ],
        });
        if (!pgs) {
            return res.status(404).json({ message: 'Asignación no encontrada' });
        }
        const mpSection = yield index_1.Section.findOne({ where: { name: MP_SECTION_NAME } });
        if (!mpSection) {
            return res.json(Object.assign(Object.assign({}, pgs.toJSON()), { students: [] }));
        }
        // Get MP inscriptions for this grade
        const inscriptions = yield index_1.Inscription.findAll({
            where: {
                schoolPeriodId: pgs.periodGrade.schoolPeriodId,
                gradeId: pgs.periodGrade.gradeId,
                sectionId: mpSection.id,
            },
            include: [
                { model: index_1.Person, as: 'student' },
                {
                    model: index_1.InscriptionSubject,
                    as: 'inscriptionSubjects',
                    where: { subjectId: pgs.subjectId },
                    required: true,
                    include: [
                        { model: index_1.SubjectFinalGrade, as: 'finalGrade' },
                        {
                            model: index_1.Qualification,
                            as: 'qualifications',
                            include: [{ model: index_1.EvaluationPlan, as: 'evaluationPlan' }],
                        },
                    ],
                },
            ],
        });
        (0, studentSortService_1.sortInscriptions)(inscriptions);
        const students = inscriptions.map((ins) => {
            var _a, _b, _c, _d, _e, _f;
            const insSubj = (_a = ins.inscriptionSubjects) === null || _a === void 0 ? void 0 : _a[0];
            return {
                inscriptionId: ins.id,
                inscriptionSubjectId: insSubj === null || insSubj === void 0 ? void 0 : insSubj.id,
                personId: ins.personId,
                studentName: `${(_b = ins.student) === null || _b === void 0 ? void 0 : _b.lastName} ${(_c = ins.student) === null || _c === void 0 ? void 0 : _c.firstName}`,
                studentDni: (_d = ins.student) === null || _d === void 0 ? void 0 : _d.document,
                documentType: (_e = ins.student) === null || _e === void 0 ? void 0 : _e.documentType,
                finalGrade: (insSubj === null || insSubj === void 0 ? void 0 : insSubj.finalGrade) ? {
                    finalScore: insSubj.finalGrade.finalScore,
                    status: insSubj.finalGrade.status,
                    gradeType: insSubj.finalGrade.gradeType,
                    calculatedAt: insSubj.finalGrade.calculatedAt,
                } : null,
                qualifications: ((_f = insSubj === null || insSubj === void 0 ? void 0 : insSubj.qualifications) === null || _f === void 0 ? void 0 : _f.map((q) => {
                    var _a, _b, _c;
                    return ({
                        id: q.id,
                        score: q.score,
                        remedialScore: q.remedialScore,
                        isAbsent: q.isAbsent,
                        evaluationPlanId: q.evaluationPlanId,
                        percentage: (_a = q.evaluationPlan) === null || _a === void 0 ? void 0 : _a.percentage,
                        termId: (_b = q.evaluationPlan) === null || _b === void 0 ? void 0 : _b.termId,
                        description: (_c = q.evaluationPlan) === null || _c === void 0 ? void 0 : _c.description,
                    });
                })) || [],
            };
        });
        // Get evaluation plans for this PGS+section
        const evaluationPlans = yield index_1.EvaluationPlan.findAll({
            where: { periodGradeSubjectId: pgsId, sectionId: mpSection.id },
            include: [{ model: index_1.Term, as: 'term' }],
            order: [['termId', 'ASC'], ['date', 'ASC']],
        });
        // Get active period terms
        const terms = yield index_1.Term.findAll({
            where: { schoolPeriodId: pgs.periodGrade.schoolPeriodId },
            order: [['order', 'ASC']],
        });
        return res.json({
            periodGradeSubject: pgs,
            subjectName: (_a = pgs.subject) === null || _a === void 0 ? void 0 : _a.name,
            students,
            evaluationPlans,
            terms,
        });
    }
    catch (error) {
        console.error('[getMpAssignmentDetail] Error:', error);
        return res.status(500).json({ message: 'Error al obtener detalle de la asignación' });
    }
});
exports.getMpAssignmentDetail = getMpAssignmentDetail;
/* ---------------------------------------------------------------------- */
/* GET /pending-subjects/assignment/:periodGradeSubjectId/encounters       */
/* Get students with their pendingSubjectId + encounters for this PGS.    */
/* Used by the teacher panel to render the encounter-based grading grid.  */
/* ---------------------------------------------------------------------- */
const getMpAssignmentEncounters = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const pgsId = Number(req.params.periodGradeSubjectId);
        if (!Number.isFinite(pgsId)) {
            return res.status(400).json({ message: 'periodGradeSubjectId inválido' });
        }
        const pgs = yield index_1.PeriodGradeSubject.findByPk(pgsId, {
            include: [{ model: index_1.Subject, as: 'subject' }, { model: index_1.PeriodGrade, as: 'periodGrade' }],
        });
        if (!pgs) {
            return res.status(404).json({ message: 'Asignación no encontrada' });
        }
        const mpSection = yield index_1.Section.findOne({ where: { name: MP_SECTION_NAME } });
        if (!mpSection) {
            return res.json({ subjectName: (_a = pgs.subject) === null || _a === void 0 ? void 0 : _a.name, maxEncounters: 4, students: [] });
        }
        const maxEnc = yield getMaxEncounters();
        // Get MP inscriptions with pending subjects + encounters
        const inscriptions = yield index_1.Inscription.findAll({
            where: {
                schoolPeriodId: pgs.periodGrade.schoolPeriodId,
                gradeId: pgs.periodGrade.gradeId,
                sectionId: mpSection.id,
            },
            include: [
                { model: index_1.Person, as: 'student' },
                {
                    model: index_1.PendingSubject,
                    as: 'pendingSubjects',
                    where: { subjectId: pgs.subjectId },
                    required: true,
                    include: [{
                            model: index_1.PendingSubjectEncounter,
                            as: 'encounters',
                            order: [['encounterNumber', 'ASC']],
                        }],
                },
            ],
        });
        (0, studentSortService_1.sortInscriptions)(inscriptions);
        // Ensure each pending subject has N encounters
        for (const ins of inscriptions) {
            for (const ps of ins.pendingSubjects || []) {
                yield ensureEncounters(ps.id, maxEnc);
                // Reload encounters
                ps.encounters = yield index_1.PendingSubjectEncounter.findAll({
                    where: { pendingSubjectId: ps.id },
                    order: [['encounterNumber', 'ASC']],
                });
            }
        }
        const students = inscriptions.map((ins) => {
            var _a, _b, _c, _d, _e, _f, _g;
            const ps = (_a = ins.pendingSubjects) === null || _a === void 0 ? void 0 : _a[0];
            return {
                inscriptionId: ins.id,
                pendingSubjectId: (_b = ps === null || ps === void 0 ? void 0 : ps.id) !== null && _b !== void 0 ? _b : null,
                personId: ins.personId,
                studentName: `${(_c = ins.student) === null || _c === void 0 ? void 0 : _c.lastName} ${(_d = ins.student) === null || _d === void 0 ? void 0 : _d.firstName}`,
                studentDni: (_e = ins.student) === null || _e === void 0 ? void 0 : _e.document,
                documentType: (_f = ins.student) === null || _f === void 0 ? void 0 : _f.documentType,
                status: (_g = ps === null || ps === void 0 ? void 0 : ps.status) !== null && _g !== void 0 ? _g : 'pendiente',
                encounters: ((ps === null || ps === void 0 ? void 0 : ps.encounters) || []).map((e) => ({
                    id: e.id,
                    encounterNumber: e.encounterNumber,
                    date: e.date,
                    score: e.score,
                    isAbsent: e.isAbsent,
                })),
            };
        });
        return res.json({
            subjectName: (_b = pgs.subject) === null || _b === void 0 ? void 0 : _b.name,
            maxEncounters: maxEnc,
            students,
        });
    }
    catch (error) {
        console.error('[getMpAssignmentEncounters] Error:', error);
        return res.status(500).json({ message: 'Error al obtener encuentros de la asignación' });
    }
});
exports.getMpAssignmentEncounters = getMpAssignmentEncounters;
/* ------------------------------------------------------------------ */
/* POST /pending-subjects/final-grade                                  */
/* Save a direct final grade for a pending subject                     */
/* ------------------------------------------------------------------ */
const saveMpFinalGrade = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const t = yield database_1.default.transaction();
    try {
        const { inscriptionSubjectId, finalScore, date } = req.body;
        if (!Number.isFinite(inscriptionSubjectId) || !Number.isFinite(finalScore)) {
            return res.status(400).json({ message: 'inscriptionSubjectId y finalScore son requeridos' });
        }
        const insSubj = yield index_1.InscriptionSubject.findByPk(inscriptionSubjectId, { transaction: t });
        if (!insSubj) {
            return res.status(404).json({ message: 'InscriptionSubject no encontrado' });
        }
        const academicContext = yield (0, academicContextService_1.getInscriptionAcademicContext)(inscriptionSubjectId, t);
        const activePeriod = yield index_1.SchoolPeriod.findOne({ where: { status: 'activo' } });
        const roundedScore = (0, gradeEvaluationService_1.roundFinalGrade)(finalScore);
        // Score 0 is treated as NP (inasistente), same logic as regular grades
        const isAbsent = roundedScore === 0;
        const status = isAbsent ? 'reprobada' : (0, gradeEvaluationService_1.resolveGradeStatus)(roundedScore, 10);
        // Use provided date (local noon to avoid TZ offset) or now
        const calculatedDate = date ? new Date(`${date}T12:00:00`) : new Date();
        // Upsert the single MP-type SubjectFinalGrade row (P or M — preserve the
        // existing type, e.g. Revisión de Materia Pendiente from the last encounter).
        // Use findOne + update/create instead of upsert (composite unique index on inscriptionSubjectId + gradeType)
        const existingMPGrade = yield index_1.SubjectFinalGrade.findOne({
            where: {
                inscriptionSubjectId,
                gradeType: { [sequelize_1.Op.in]: ['materia_pendiente', 'revision_materia_pendiente'] },
            },
            transaction: t,
        });
        if (existingMPGrade) {
            yield existingMPGrade.update({
                finalScore: isAbsent ? 0 : roundedScore,
                rawScore: finalScore,
                status,
                calculatedAt: calculatedDate,
                schoolPeriodId: academicContext.schoolPeriodId,
                subjectId: academicContext.subjectId,
                gradeId: academicContext.gradeId,
            }, { transaction: t });
        }
        else {
            yield index_1.SubjectFinalGrade.create({
                inscriptionSubjectId,
                finalScore: isAbsent ? 0 : roundedScore,
                rawScore: finalScore,
                status,
                calculatedAt: calculatedDate,
                gradeType: 'materia_pendiente',
                schoolPeriodId: academicContext.schoolPeriodId,
                subjectId: academicContext.subjectId,
                gradeId: academicContext.gradeId,
            }, { transaction: t });
        }
        // Update PendingSubject status
        const pending = yield index_1.PendingSubject.findOne({
            where: { newInscriptionId: insSubj.inscriptionId, subjectId: insSubj.subjectId },
            transaction: t,
        });
        if (pending) {
            yield pending.update({
                status: status === 'aprobada' ? 'aprobada' : 'pendiente',
                resolvedAt: status === 'aprobada' ? calculatedDate : null,
            }, { transaction: t });
        }
        yield t.commit();
        return res.json({
            message: 'Nota guardada correctamente',
            finalScore: isAbsent ? 0 : roundedScore,
            status,
            isAbsent,
            period: activePeriod === null || activePeriod === void 0 ? void 0 : activePeriod.name,
        });
    }
    catch (error) {
        yield t.rollback();
        if (error instanceof academicContextService_1.AcademicContextError) {
            return res.status(error.statusCode).json({ message: error.message });
        }
        console.error('[saveMpFinalGrade] Error:', error);
        return res.status(500).json({ message: 'Error al guardar la nota' });
    }
});
exports.saveMpFinalGrade = saveMpFinalGrade;
/* ------------------------------------------------------------------ */
/* POST /pending-subjects/evaluation-plan                              */
/* Create an evaluation plan item for an MP assignment                 */
/* ------------------------------------------------------------------ */
const createMpEvaluationItem = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { periodGradeSubjectId, sectionId, termId, description, percentage, date } = req.body;
        if (!Number.isFinite(periodGradeSubjectId) || !Number.isFinite(sectionId) || !Number.isFinite(termId)) {
            return res.status(400).json({ message: 'periodGradeSubjectId, sectionId y termId son requeridos' });
        }
        const item = yield index_1.EvaluationPlan.create({
            periodGradeSubjectId,
            sectionId,
            termId,
            description: description || 'Evaluación',
            percentage: percentage || 100,
            date: date ? new Date(date + 'T00:00:00') : new Date(),
        });
        return res.status(201).json(item);
    }
    catch (error) {
        console.error('[createMpEvaluationItem] Error:', error);
        return res.status(500).json({ message: 'Error al crear item de evaluación' });
    }
});
exports.createMpEvaluationItem = createMpEvaluationItem;
/* ------------------------------------------------------------------ */
/* PUT /pending-subjects/evaluation-plan/:id                           */
/* Update an evaluation plan item                                      */
/* ------------------------------------------------------------------ */
const updateMpEvaluationItem = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) {
            return res.status(400).json({ message: 'id inválido' });
        }
        const { description, percentage, termId, date } = req.body;
        const item = yield index_1.EvaluationPlan.findByPk(id);
        if (!item) {
            return res.status(404).json({ message: 'Item no encontrado' });
        }
        yield item.update(Object.assign(Object.assign(Object.assign(Object.assign({}, (description !== undefined && { description })), (percentage !== undefined && { percentage })), (termId !== undefined && { termId })), (date !== undefined && { date: new Date(date + 'T00:00:00') })));
        return res.json(item);
    }
    catch (error) {
        console.error('[updateMpEvaluationItem] Error:', error);
        return res.status(500).json({ message: 'Error al actualizar item' });
    }
});
exports.updateMpEvaluationItem = updateMpEvaluationItem;
/* ------------------------------------------------------------------ */
/* DELETE /pending-subjects/evaluation-plan/:id                        */
/* Delete an evaluation plan item and its qualifications               */
/* ------------------------------------------------------------------ */
const deleteMpEvaluationItem = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const t = yield database_1.default.transaction();
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) {
            return res.status(400).json({ message: 'id inválido' });
        }
        const item = yield index_1.EvaluationPlan.findByPk(id, { transaction: t });
        if (!item) {
            return res.status(404).json({ message: 'Item no encontrado' });
        }
        // Delete associated qualifications first
        yield index_1.Qualification.destroy({ where: { evaluationPlanId: id }, transaction: t });
        yield item.destroy({ transaction: t });
        yield t.commit();
        return res.json({ message: 'Item eliminado' });
    }
    catch (error) {
        yield t.rollback();
        console.error('[deleteMpEvaluationItem] Error:', error);
        return res.status(500).json({ message: 'Error al eliminar item' });
    }
});
exports.deleteMpEvaluationItem = deleteMpEvaluationItem;
/* ------------------------------------------------------------------ */
/* POST /pending-subjects/qualification                                */
/* Save a qualification for an MP student                              */
/* The score is the final grade for this evaluation item.              */
/* For MP: if the student passes (score >= passing grade),             */
/* mark as approved immediately using the plan item's date.            */
/* No averaging — first pass wins.                                     */
/* ------------------------------------------------------------------ */
const saveMpQualification = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const t = yield database_1.default.transaction();
    try {
        const { evaluationPlanId, inscriptionSubjectId, score, isAbsent } = req.body;
        if (!Number.isFinite(evaluationPlanId) || !Number.isFinite(inscriptionSubjectId)) {
            return res.status(400).json({ message: 'evaluationPlanId e inscriptionSubjectId son requeridos' });
        }
        // Get the evaluation plan item to use its date
        const planItem = yield index_1.EvaluationPlan.findByPk(evaluationPlanId, { transaction: t });
        if (!planItem) {
            return res.status(404).json({ message: 'Item de evaluación no encontrado' });
        }
        // Score 0 is treated as NP (inasistente), same logic as regular grades
        const rawScore = score !== null && score !== void 0 ? score : 0;
        const finalIsAbsent = isAbsent !== null && isAbsent !== void 0 ? isAbsent : (rawScore === 0);
        const academicContext = yield (0, academicContextService_1.resolveAcademicContext)(Number(evaluationPlanId), Number(inscriptionSubjectId), t);
        // Upsert qualification
        const qualificationContext = {
            schoolPeriodId: academicContext.schoolPeriodId,
            termId: academicContext.termId,
            subjectId: academicContext.subjectId,
            gradeId: academicContext.gradeId,
            sectionId: academicContext.sectionId,
            date: academicContext.date,
        };
        const existing = yield index_1.Qualification.findOne({
            where: { evaluationPlanId, inscriptionSubjectId },
            transaction: t,
        });
        if (existing) {
            const prevQScore = existing.score;
            yield existing.update(Object.assign({ score: rawScore, isAbsent: finalIsAbsent }, qualificationContext), { transaction: t });
            yield (0, gradeChangeLogService_1.logGradeChange)({
                entityType: 'qualification',
                entityId: existing.id,
                previousScore: prevQScore != null ? Number(prevQScore) : null,
                newScore: rawScore,
                editedBy: (_b = (_a = req.session) === null || _a === void 0 ? void 0 : _a.user) === null || _b === void 0 ? void 0 : _b.id,
                editorRole: 'teacher',
                gradeType: 'materia_pendiente',
                metadata: { inscriptionSubjectId, evaluationPlanId, isAbsent: finalIsAbsent, mpQualification: true },
            }, t);
        }
        else {
            const newQ = yield index_1.Qualification.create(Object.assign({ evaluationPlanId,
                inscriptionSubjectId, score: rawScore, isAbsent: finalIsAbsent }, qualificationContext), { transaction: t });
            yield (0, gradeChangeLogService_1.logGradeChange)({
                entityType: 'qualification',
                entityId: newQ.id,
                previousScore: null,
                newScore: rawScore,
                editedBy: (_d = (_c = req.session) === null || _c === void 0 ? void 0 : _c.user) === null || _d === void 0 ? void 0 : _d.id,
                editorRole: 'teacher',
                gradeType: 'materia_pendiente',
                metadata: { inscriptionSubjectId, evaluationPlanId, isAbsent: finalIsAbsent, mpQualification: true },
            }, t);
        }
        // For MP: if the student passes (score >= passing grade), mark as approved immediately
        // Use the plan item's date as the calculatedAt date
        // No averaging — first pass wins
        // NP (absent) is always failing
        const roundedScore = (0, gradeEvaluationService_1.roundFinalGrade)(rawScore);
        const status = finalIsAbsent ? 'reprobada' : (0, gradeEvaluationService_1.resolveGradeStatus)(roundedScore, 10);
        // DATEONLY returns a string 'YYYY-MM-DD'; parse as local noon to avoid TZ offset
        const rawPlanDate = planItem.date;
        const evaluationDate = rawPlanDate
            ? new Date(`${rawPlanDate}T12:00:00`)
            : new Date();
        // Get the inscription subject to find the inscription
        const insSubj = yield index_1.InscriptionSubject.findByPk(inscriptionSubjectId, { transaction: t });
        if (insSubj) {
            // Always upsert the final grade — allow overwriting even if previously approved
            // This lets both teachers and Control de Estudios correct grades.
            // Single MP-type row per subject: preserve the existing type (P or M).
            const existingMPGrade = yield index_1.SubjectFinalGrade.findOne({
                where: {
                    inscriptionSubjectId,
                    gradeType: { [sequelize_1.Op.in]: ['materia_pendiente', 'revision_materia_pendiente'] },
                },
                transaction: t,
            });
            if (existingMPGrade) {
                const prevMpScore = existingMPGrade.finalScore;
                const prevMpStatus = existingMPGrade.status;
                yield existingMPGrade.update({
                    finalScore: finalIsAbsent ? 0 : roundedScore,
                    rawScore,
                    status,
                    calculatedAt: evaluationDate,
                    schoolPeriodId: academicContext.schoolPeriodId,
                    subjectId: academicContext.subjectId,
                    gradeId: academicContext.gradeId,
                }, { transaction: t });
                yield (0, gradeChangeLogService_1.logGradeChange)({
                    entityType: 'subject_final_grade',
                    entityId: existingMPGrade.id,
                    previousScore: prevMpScore != null ? Number(prevMpScore) : null,
                    newScore: finalIsAbsent ? 0 : roundedScore,
                    previousStatus: prevMpStatus || null,
                    newStatus: status,
                    gradeType: 'materia_pendiente',
                    editedBy: (_f = (_e = req.session) === null || _e === void 0 ? void 0 : _e.user) === null || _f === void 0 ? void 0 : _f.id,
                    editorRole: 'teacher',
                    metadata: { inscriptionSubjectId, schoolPeriodId: academicContext.schoolPeriodId, subjectId: academicContext.subjectId, gradeId: academicContext.gradeId, isAbsent: finalIsAbsent, mpFinalGrade: true },
                }, t);
            }
            else {
                const newMpGrade = yield index_1.SubjectFinalGrade.create({
                    inscriptionSubjectId,
                    finalScore: finalIsAbsent ? 0 : roundedScore,
                    rawScore,
                    status,
                    calculatedAt: evaluationDate,
                    gradeType: 'materia_pendiente',
                    schoolPeriodId: academicContext.schoolPeriodId,
                    subjectId: academicContext.subjectId,
                    gradeId: academicContext.gradeId,
                }, { transaction: t });
                yield (0, gradeChangeLogService_1.logGradeChange)({
                    entityType: 'subject_final_grade',
                    entityId: newMpGrade.id,
                    previousScore: null,
                    newScore: finalIsAbsent ? 0 : roundedScore,
                    previousStatus: null,
                    newStatus: status,
                    gradeType: 'materia_pendiente',
                    editedBy: (_h = (_g = req.session) === null || _g === void 0 ? void 0 : _g.user) === null || _h === void 0 ? void 0 : _h.id,
                    editorRole: 'teacher',
                    metadata: { inscriptionSubjectId, schoolPeriodId: academicContext.schoolPeriodId, subjectId: academicContext.subjectId, gradeId: academicContext.gradeId, isAbsent: finalIsAbsent, mpFinalGrade: true },
                }, t);
            }
            // Update PendingSubject status
            const pending = yield index_1.PendingSubject.findOne({
                where: { newInscriptionId: insSubj.inscriptionId, subjectId: insSubj.subjectId },
                transaction: t,
            });
            if (pending) {
                yield pending.update({
                    status: status === 'aprobada' ? 'aprobada' : 'pendiente',
                    resolvedAt: status === 'aprobada' ? evaluationDate : null,
                }, { transaction: t });
            }
        }
        yield t.commit();
        return res.json({ message: 'Calificación guardada', status, score: roundedScore, date: evaluationDate, isAbsent: finalIsAbsent });
    }
    catch (error) {
        yield t.rollback();
        if (error instanceof academicContextService_1.AcademicContextError) {
            return res.status(error.statusCode).json({ message: error.message });
        }
        console.error('[saveMpQualification] Error:', error);
        return res.status(500).json({ message: 'Error al guardar calificación' });
    }
});
exports.saveMpQualification = saveMpQualification;
/* ====================================================================== */
/* ENCOUNTERS — Sistema de encuentros de Materia Pendiente                */
/* ====================================================================== */
/** Resolve the configured max encounters (default 4). */
function getMaxEncounters() {
    return __awaiter(this, void 0, void 0, function* () {
        const setting = yield index_1.Setting.findOne({ where: { key: 'pending_subject_max_encounters' } });
        if (setting) {
            const n = parseInt(setting.value, 10);
            if (Number.isFinite(n) && n >= 1)
                return n;
        }
        return 4;
    });
}
/** Get the list of locked encounter numbers. */
function getLockedEncounters() {
    return __awaiter(this, void 0, void 0, function* () {
        const setting = yield index_1.Setting.findOne({ where: { key: 'pending_subject_locked_encounters' } });
        if (!setting || !setting.value)
            return [];
        return setting.value
            .split(',')
            .map(s => parseInt(s.trim(), 10))
            .filter(n => Number.isFinite(n));
    });
}
/** Resolve the configured passing grade (default 10). */
function getPassingGrade() {
    return __awaiter(this, void 0, void 0, function* () {
        const setting = yield index_1.Setting.findOne({ where: { key: 'passing_grade' } });
        if (setting) {
            const n = parseInt(setting.value, 10);
            if (Number.isFinite(n))
                return n;
        }
        return 10;
    });
}
/** Ensure a PendingSubject has N encounter rows, creating missing ones. */
function ensureEncounters(pendingSubjectId, maxEncounters, t) {
    return __awaiter(this, void 0, void 0, function* () {
        const existing = yield index_1.PendingSubjectEncounter.findAll({
            where: { pendingSubjectId },
            order: [['encounterNumber', 'ASC']],
            transaction: t,
        });
        const existingNumbers = new Set(existing.map(e => e.encounterNumber));
        const toCreate = [];
        for (let i = 1; i <= maxEncounters; i++) {
            if (!existingNumbers.has(i))
                toCreate.push(i);
        }
        if (toCreate.length > 0) {
            yield index_1.PendingSubjectEncounter.bulkCreate(toCreate.map(n => ({ pendingSubjectId, encounterNumber: n })), { transaction: t });
        }
        if (toCreate.length > 0) {
            return index_1.PendingSubjectEncounter.findAll({
                where: { pendingSubjectId },
                order: [['encounterNumber', 'ASC']],
                transaction: t,
            });
        }
        return existing;
    });
}
/* ---------------------------------------------------------------------- */
/* GET /pending-subjects/:pendingSubjectId/encounters                      */
/* Returns the N encounters, auto-creating missing rows                   */
/* ---------------------------------------------------------------------- */
const getMpEncounters = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const pendingSubjectId = Number(req.params.pendingSubjectId);
        if (!Number.isFinite(pendingSubjectId)) {
            return res.status(400).json({ message: 'pendingSubjectId inválido' });
        }
        const pending = yield index_1.PendingSubject.findByPk(pendingSubjectId);
        if (!pending) {
            return res.status(404).json({ message: 'Materia pendiente no encontrada' });
        }
        const maxEnc = yield getMaxEncounters();
        const encounters = yield ensureEncounters(pendingSubjectId, maxEnc);
        return res.json({
            pendingSubjectId,
            maxEncounters: maxEnc,
            status: pending.status,
            encounters: encounters.map(e => ({
                id: e.id,
                encounterNumber: e.encounterNumber,
                date: e.date,
                score: e.score,
                isAbsent: e.isAbsent,
            })),
        });
    }
    catch (error) {
        console.error('[getMpEncounters] Error:', error);
        return res.status(500).json({ message: 'Error al obtener encuentros' });
    }
});
exports.getMpEncounters = getMpEncounters;
/* ---------------------------------------------------------------------- */
/* PUT /pending-subjects/:pendingSubjectId/encounters                      */
/* Update dates for all encounters at once (professor or CE)              */
/* ---------------------------------------------------------------------- */
const updateMpEncounterDates = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const t = yield database_1.default.transaction();
    try {
        const pendingSubjectId = Number(req.params.pendingSubjectId);
        if (!Number.isFinite(pendingSubjectId)) {
            return res.status(400).json({ message: 'pendingSubjectId inválido' });
        }
        const { encounters } = req.body;
        if (!Array.isArray(encounters)) {
            return res.status(400).json({ message: 'encounters debe ser un arreglo' });
        }
        const pending = yield index_1.PendingSubject.findByPk(pendingSubjectId, { transaction: t });
        if (!pending) {
            yield t.rollback();
            return res.status(404).json({ message: 'Materia pendiente no encontrada' });
        }
        const maxEnc = yield getMaxEncounters();
        yield ensureEncounters(pendingSubjectId, maxEnc, t);
        for (const enc of encounters) {
            if (!Number.isFinite(enc.encounterNumber))
                continue;
            yield index_1.PendingSubjectEncounter.update({ date: (_a = enc.date) !== null && _a !== void 0 ? _a : null }, { where: { pendingSubjectId, encounterNumber: enc.encounterNumber }, transaction: t });
        }
        yield t.commit();
        const updated = yield index_1.PendingSubjectEncounter.findAll({
            where: { pendingSubjectId },
            order: [['encounterNumber', 'ASC']],
        });
        return res.json({
            message: 'Fechas actualizadas',
            encounters: updated.map(e => ({
                id: e.id,
                encounterNumber: e.encounterNumber,
                date: e.date,
                score: e.score,
                isAbsent: e.isAbsent,
            })),
        });
    }
    catch (error) {
        yield t.rollback();
        console.error('[updateMpEncounterDates] Error:', error);
        return res.status(500).json({ message: 'Error al actualizar fechas' });
    }
});
exports.updateMpEncounterDates = updateMpEncounterDates;
/* ---------------------------------------------------------------------- */
/* GET /pending-subjects/encounter-dates/:periodGradeSubjectId             */
/* Get encounter dates for a subject+grade (across all students).         */
/* Returns dates from the first student's encounters, or default empty.   */
/* ---------------------------------------------------------------------- */
const getMpEncounterDatesByPgs = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const pgsId = Number(req.params.periodGradeSubjectId);
        if (!Number.isFinite(pgsId)) {
            return res.status(400).json({ message: 'periodGradeSubjectId inválido' });
        }
        const maxEnc = yield getMaxEncounters();
        // Get the subjectId and gradeId from the PGS
        const pgs = yield index_1.PeriodGradeSubject.findByPk(pgsId, {
            include: [{ model: index_1.PeriodGrade, as: 'periodGrade' }],
        });
        if (!pgs || !pgs.periodGrade) {
            return res.status(404).json({ message: 'PeriodGradeSubject no encontrado' });
        }
        const subjectId = pgs.subjectId;
        const gradeId = pgs.periodGrade.gradeId;
        // Find MP section
        const mpSection = yield index_1.Section.findOne({ where: { name: MP_SECTION_NAME } });
        if (!mpSection) {
            return res.json({
                periodGradeSubjectId: pgsId,
                maxEncounters: maxEnc,
                encounters: Array.from({ length: maxEnc }, (_, i) => ({
                    encounterNumber: i + 1,
                    date: null,
                })),
            });
        }
        // Find MP inscriptions for this grade in the active period
        const activePeriod = yield index_1.SchoolPeriod.findOne({ where: { status: 'activo' } });
        if (!activePeriod) {
            return res.json({
                periodGradeSubjectId: pgsId,
                maxEncounters: maxEnc,
                encounters: Array.from({ length: maxEnc }, (_, i) => ({
                    encounterNumber: i + 1,
                    date: null,
                })),
            });
        }
        const mpInscriptions = yield index_1.Inscription.findAll({
            where: { schoolPeriodId: activePeriod.id, gradeId, sectionId: mpSection.id },
            attributes: ['id'],
        });
        const inscriptionIds = mpInscriptions.map(i => i.id);
        if (inscriptionIds.length === 0) {
            // No students — return default empty encounters
            return res.json({
                periodGradeSubjectId: pgsId,
                maxEncounters: maxEnc,
                encounters: Array.from({ length: maxEnc }, (_, i) => ({
                    encounterNumber: i + 1,
                    date: null,
                })),
            });
        }
        // Find PendingSubjects for these inscriptions + this subject
        const pendingSubjects = yield index_1.PendingSubject.findAll({
            where: {
                newInscriptionId: { [sequelize_1.Op.in]: inscriptionIds },
                subjectId,
            },
            include: [
                {
                    model: index_1.PendingSubjectEncounter,
                    as: 'encounters',
                    required: false,
                },
            ],
        });
        // Find the one with the most dates set (use it as template)
        let template = null;
        let maxDatesSet = -1;
        for (const ps of pendingSubjects) {
            const encs = ps.encounters || [];
            const datesSet = encs.filter((e) => e.date != null).length;
            if (datesSet > maxDatesSet) {
                maxDatesSet = datesSet;
                template = ps;
            }
        }
        let encounters;
        if (template && ((_a = template.encounters) === null || _a === void 0 ? void 0 : _a.length) > 0) {
            const existing = template.encounters;
            const encMap = new Map(existing.map(e => [e.encounterNumber, e.date]));
            encounters = Array.from({ length: maxEnc }, (_, i) => {
                var _a;
                return ({
                    encounterNumber: i + 1,
                    date: (_a = encMap.get(i + 1)) !== null && _a !== void 0 ? _a : null,
                });
            });
        }
        else {
            encounters = Array.from({ length: maxEnc }, (_, i) => ({
                encounterNumber: i + 1,
                date: null,
            }));
        }
        return res.json({
            periodGradeSubjectId: pgsId,
            maxEncounters: maxEnc,
            encounters,
        });
    }
    catch (error) {
        console.error('[getMpEncounterDatesByPgs] Error:', error);
        return res.status(500).json({ message: 'Error al obtener fechas de encuentros' });
    }
});
exports.getMpEncounterDatesByPgs = getMpEncounterDatesByPgs;
/* ---------------------------------------------------------------------- */
/* PUT /pending-subjects/encounter-dates/:periodGradeSubjectId             */
/* Update encounter dates for ALL pendingSubjects of this subject+grade.  */
/* ---------------------------------------------------------------------- */
const updateMpEncounterDatesByPgs = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const t = yield database_1.default.transaction();
    try {
        const pgsId = Number(req.params.periodGradeSubjectId);
        if (!Number.isFinite(pgsId)) {
            return res.status(400).json({ message: 'periodGradeSubjectId inválido' });
        }
        const { encounters } = req.body;
        if (!Array.isArray(encounters)) {
            return res.status(400).json({ message: 'encounters debe ser un arreglo' });
        }
        const maxEnc = yield getMaxEncounters();
        // Get the subjectId and gradeId from the PGS
        const pgs = yield index_1.PeriodGradeSubject.findByPk(pgsId, {
            include: [{ model: index_1.PeriodGrade, as: 'periodGrade' }],
            transaction: t,
        });
        if (!pgs || !pgs.periodGrade) {
            yield t.rollback();
            return res.status(404).json({ message: 'PeriodGradeSubject no encontrado' });
        }
        const subjectId = pgs.subjectId;
        const gradeId = pgs.periodGrade.gradeId;
        // Find MP section
        const mpSection = yield index_1.Section.findOne({ where: { name: MP_SECTION_NAME }, transaction: t });
        if (!mpSection) {
            yield t.commit();
            return res.json({
                message: 'Fechas guardadas (sin sección MP)',
                updatedCount: 0,
                encounters,
            });
        }
        // Find MP inscriptions for this grade
        const activePeriod = yield index_1.SchoolPeriod.findOne({ where: { status: 'activo' }, transaction: t });
        if (!activePeriod) {
            yield t.commit();
            return res.json({
                message: 'Fechas guardadas (sin período activo)',
                updatedCount: 0,
                encounters,
            });
        }
        const mpInscriptions = yield index_1.Inscription.findAll({
            where: { schoolPeriodId: activePeriod.id, gradeId, sectionId: mpSection.id },
            attributes: ['id'],
            transaction: t,
        });
        const inscriptionIds = mpInscriptions.map(i => i.id);
        if (inscriptionIds.length === 0) {
            // No students — nothing to update, but return success
            yield t.commit();
            return res.json({
                message: 'Fechas guardadas (sin estudiantes registrados)',
                updatedCount: 0,
                encounters,
            });
        }
        // Find all PendingSubjects for these inscriptions + this subject
        const pendingSubjects = yield index_1.PendingSubject.findAll({
            where: {
                newInscriptionId: { [sequelize_1.Op.in]: inscriptionIds },
                subjectId,
            },
            transaction: t,
        });
        // Update dates for all pendingSubjects
        for (const ps of pendingSubjects) {
            yield ensureEncounters(ps.id, maxEnc, t);
            for (const enc of encounters) {
                if (!Number.isFinite(enc.encounterNumber))
                    continue;
                yield index_1.PendingSubjectEncounter.update({ date: (_a = enc.date) !== null && _a !== void 0 ? _a : null }, { where: { pendingSubjectId: ps.id, encounterNumber: enc.encounterNumber }, transaction: t });
            }
        }
        yield t.commit();
        return res.json({
            message: 'Fechas actualizadas',
            updatedCount: pendingSubjects.length,
            encounters,
        });
    }
    catch (error) {
        yield t.rollback();
        console.error('[updateMpEncounterDatesByPgs] Error:', error);
        return res.status(500).json({ message: 'Error al actualizar fechas' });
    }
});
exports.updateMpEncounterDatesByPgs = updateMpEncounterDatesByPgs;
/* ---------------------------------------------------------------------- */
/* POST /pending-subjects/:pendingSubjectId/encounters/:encounterNumber/score */
/* Register the score for a single encounter.                             */
/* If the student passes (>= passing_grade), the PendingSubject is        */
/* marked as 'aprobada' and remaining encounters are left null.           */
/* ---------------------------------------------------------------------- */
const saveMpEncounterScore = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f;
    const t = yield database_1.default.transaction();
    try {
        const pendingSubjectId = Number(req.params.pendingSubjectId);
        const encounterNumber = Number(req.params.encounterNumber);
        const { score, isAbsent } = req.body;
        if (!Number.isFinite(pendingSubjectId) || !Number.isFinite(encounterNumber)) {
            return res.status(400).json({ message: 'Parámetros inválidos' });
        }
        const pending = yield index_1.PendingSubject.findByPk(pendingSubjectId, { transaction: t });
        if (!pending) {
            yield t.rollback();
            return res.status(404).json({ message: 'Materia pendiente no encontrada' });
        }
        const userRoles = ((_b = (_a = req.session) === null || _a === void 0 ? void 0 : _a.user) === null || _b === void 0 ? void 0 : _b.roles) || [];
        const isCE = userRoles.some((r) => r === 'Control de Estudios' || r === 'Master' || r === 'Administrador');
        // Check per-encounter lock — only CE/Master/Admin can edit locked encounters
        const lockSetting = yield index_1.Setting.findOne({ where: { key: 'pending_subject_locked_encounters' } });
        const lockedEncounters = ((lockSetting === null || lockSetting === void 0 ? void 0 : lockSetting.value) || '')
            .split(',')
            .map(s => parseInt(s.trim(), 10))
            .filter(n => Number.isFinite(n));
        if (lockedEncounters.includes(encounterNumber) && !isCE) {
            yield t.rollback();
            return res.status(403).json({ message: `El encuentro ${encounterNumber} está bloqueado por Control de Estudios` });
        }
        const maxEnc = yield getMaxEncounters();
        const passingGrade = yield getPassingGrade();
        yield ensureEncounters(pendingSubjectId, maxEnc, t);
        // If the student already approved, find in which encounter they approved
        // and block editing of subsequent encounters (only for non-CE users)
        if (pending.status === 'aprobada') {
            const allEncounters = yield index_1.PendingSubjectEncounter.findAll({
                where: { pendingSubjectId },
                transaction: t,
            });
            const approvedEnc = allEncounters.find(e => e.score != null && e.score >= passingGrade && !e.isAbsent);
            if (approvedEnc && encounterNumber > approvedEnc.encounterNumber && !isCE) {
                yield t.rollback();
                return res.status(400).json({ message: 'El estudiante ya aprobó en un encuentro anterior' });
            }
        }
        const encounter = yield index_1.PendingSubjectEncounter.findOne({
            where: { pendingSubjectId, encounterNumber },
            transaction: t,
        });
        if (!encounter) {
            yield t.rollback();
            return res.status(404).json({ message: 'Encuentro no encontrado' });
        }
        // Find the InscriptionSubject for this pending subject to upsert final grade
        const insSubj = yield index_1.InscriptionSubject.findOne({
            where: { inscriptionId: pending.newInscriptionId, subjectId: pending.subjectId },
            transaction: t,
        });
        // --- Case: clearing the score (score === null) ---
        if (score === null) {
            const prevEncScore = encounter.score;
            yield encounter.update({
                score: null,
                isAbsent: false,
            }, { transaction: t });
            yield (0, gradeChangeLogService_1.logGradeChange)({
                entityType: 'pending_subject_encounter',
                entityId: encounter.id,
                previousScore: prevEncScore != null ? Number(prevEncScore) : null,
                newScore: null,
                editedBy: (_d = (_c = req.session) === null || _c === void 0 ? void 0 : _c.user) === null || _d === void 0 ? void 0 : _d.id,
                editorRole: 'teacher',
                gradeType: 'materia_pendiente',
                metadata: { pendingSubjectId, encounterNumber, cleared: true },
            }, t);
            // If the student was approved in THIS encounter, revert to pendiente
            if (pending.status === 'aprobada') {
                const allEncs = yield index_1.PendingSubjectEncounter.findAll({
                    where: { pendingSubjectId },
                    transaction: t,
                });
                const stillApproved = allEncs.some(e => e.encounterNumber !== encounterNumber &&
                    e.score != null && e.score >= passingGrade && !e.isAbsent);
                if (!stillApproved) {
                    yield pending.update({
                        status: 'pendiente',
                        resolvedAt: null,
                    }, { transaction: t });
                    // Remove the SubjectFinalGrade if it exists (MP records — both P and M types)
                    if (insSubj) {
                        yield index_1.SubjectFinalGrade.destroy({
                            where: {
                                inscriptionSubjectId: insSubj.id,
                                gradeType: { [sequelize_1.Op.in]: ['materia_pendiente', 'revision_materia_pendiente'] },
                            },
                            transaction: t,
                        });
                    }
                }
            }
            yield t.commit();
            return res.json({
                message: 'Nota eliminada',
                status: pending.status === 'aprobada' ? 'pendiente' : pending.status,
                score: null,
                isAbsent: false,
                encounterNumber,
                approved: false,
            });
        }
        // --- Case: saving a score ---
        const finalIsAbsent = isAbsent !== null && isAbsent !== void 0 ? isAbsent : (score === 0);
        const roundedScore = (0, gradeEvaluationService_1.roundFinalGrade)(score);
        const newStatus = finalIsAbsent ? 'reprobada' : (0, gradeEvaluationService_1.resolveGradeStatus)(roundedScore, passingGrade);
        const evaluationDate = encounter.date
            ? new Date(`${encounter.date}T12:00:00`)
            : new Date();
        // Save encounter score
        const prevEncScore = encounter.score;
        yield encounter.update({
            score: finalIsAbsent ? 0 : roundedScore,
            isAbsent: finalIsAbsent,
        }, { transaction: t });
        yield (0, gradeChangeLogService_1.logGradeChange)({
            entityType: 'pending_subject_encounter',
            entityId: encounter.id,
            previousScore: prevEncScore != null ? Number(prevEncScore) : null,
            newScore: finalIsAbsent ? 0 : roundedScore,
            editedBy: (_f = (_e = req.session) === null || _e === void 0 ? void 0 : _e.user) === null || _f === void 0 ? void 0 : _f.id,
            editorRole: 'teacher',
            gradeType: 'materia_pendiente',
            metadata: { pendingSubjectId, encounterNumber, isAbsent: finalIsAbsent, status: newStatus },
        }, t);
        if (newStatus === 'aprobada') {
            // Mark PendingSubject as approved
            yield pending.update({
                status: 'aprobada',
                resolvedAt: evaluationDate,
            }, { transaction: t });
            // Clear scores in subsequent encounters (they should be empty)
            const subsequentEncs = yield index_1.PendingSubjectEncounter.findAll({
                where: {
                    pendingSubjectId,
                    encounterNumber: { [sequelize_1.Op.gt]: encounterNumber },
                },
                transaction: t,
            });
            for (const subEnc of subsequentEncs) {
                if (subEnc.score != null) {
                    yield subEnc.update({ score: null, isAbsent: false }, { transaction: t });
                }
            }
            if (insSubj) {
                // Grade obtained in the LAST established encounter = Revisión de
                // Materia Pendiente (M); obtained in an earlier encounter = Materia
                // Pendiente (P). Single MP-type row per subject, type switches as needed.
                const finalGradeType = encounterNumber === maxEnc
                    ? 'revision_materia_pendiente'
                    : 'materia_pendiente';
                const existingMPGrade = yield index_1.SubjectFinalGrade.findOne({
                    where: {
                        inscriptionSubjectId: insSubj.id,
                        gradeType: { [sequelize_1.Op.in]: ['materia_pendiente', 'revision_materia_pendiente'] },
                    },
                    transaction: t,
                });
                if (existingMPGrade) {
                    yield existingMPGrade.update({
                        finalScore: roundedScore,
                        rawScore: score,
                        status: 'aprobada',
                        calculatedAt: evaluationDate,
                        gradeType: finalGradeType,
                    }, { transaction: t });
                }
                else {
                    yield index_1.SubjectFinalGrade.create({
                        inscriptionSubjectId: insSubj.id,
                        finalScore: roundedScore,
                        rawScore: score,
                        status: 'aprobada',
                        calculatedAt: evaluationDate,
                        gradeType: finalGradeType,
                    }, { transaction: t });
                }
            }
        }
        else {
            // Not approved — if the pending subject was previously approved (editing a score down),
            // revert it to 'pendiente'
            if (pending.status === 'aprobada') {
                yield pending.update({
                    status: 'pendiente',
                    resolvedAt: null,
                }, { transaction: t });
            }
            if (encounterNumber === maxEnc) {
                // Last encounter and still failing → mark as reprobada in SubjectFinalGrade.
                // The definitive grade comes from the last encounter = Revisión de
                // Materia Pendiente (M).
                if (insSubj) {
                    const existingMPGrade = yield index_1.SubjectFinalGrade.findOne({
                        where: {
                            inscriptionSubjectId: insSubj.id,
                            gradeType: { [sequelize_1.Op.in]: ['materia_pendiente', 'revision_materia_pendiente'] },
                        },
                        transaction: t,
                    });
                    if (existingMPGrade) {
                        yield existingMPGrade.update({
                            finalScore: finalIsAbsent ? 0 : roundedScore,
                            rawScore: score,
                            status: 'reprobada',
                            calculatedAt: evaluationDate,
                            gradeType: 'revision_materia_pendiente',
                        }, { transaction: t });
                    }
                    else {
                        yield index_1.SubjectFinalGrade.create({
                            inscriptionSubjectId: insSubj.id,
                            finalScore: finalIsAbsent ? 0 : roundedScore,
                            rawScore: score,
                            status: 'reprobada',
                            calculatedAt: evaluationDate,
                            gradeType: 'revision_materia_pendiente',
                        }, { transaction: t });
                    }
                }
            }
        }
        yield t.commit();
        return res.json({
            message: newStatus === 'aprobada'
                ? 'Estudiante aprobó — no aparecerá en encuentros posteriores'
                : 'Nota guardada',
            status: newStatus,
            score: finalIsAbsent ? 0 : roundedScore,
            isAbsent: finalIsAbsent,
            encounterNumber,
            approved: newStatus === 'aprobada',
        });
    }
    catch (error) {
        yield t.rollback();
        console.error('[saveMpEncounterScore] Error:', error);
        return res.status(500).json({ message: 'Error al guardar nota del encuentro' });
    }
});
exports.saveMpEncounterScore = saveMpEncounterScore;
/* ---------------------------------------------------------------------- */
/* GET /pending-subjects/nomina/:gradeId?encounter=N                      */
/* Nómina por encuentro: only students who haven't approved yet, with     */
/* the score for encounter N (or — if not yet graded).                    */
/* ---------------------------------------------------------------------- */
const getMpNominaByEncounter = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { gradeId } = req.params;
        const encounterNumber = Number(req.query.encounter) || 1;
        const gradeIdNum = Number(gradeId);
        if (!Number.isFinite(gradeIdNum)) {
            return res.status(400).json({ message: 'gradeId inválido' });
        }
        const activePeriod = yield index_1.SchoolPeriod.findOne({ where: { status: 'activo' } });
        if (!activePeriod) {
            return res.json({ grade: null, subjects: [], students: [], encounterNumber });
        }
        const mpSection = yield index_1.Section.findOne({ where: { name: MP_SECTION_NAME } });
        if (!mpSection) {
            return res.json({ grade: null, subjects: [], students: [], encounterNumber });
        }
        const pg = yield index_1.PeriodGrade.findOne({
            where: { schoolPeriodId: activePeriod.id, gradeId: gradeIdNum },
        });
        if (!pg) {
            return res.json({ grade: null, subjects: [], students: [], encounterNumber });
        }
        const subjectOrderMap = yield (0, subjectOrderService_1.getSubjectOrderMap)(pg.id);
        const pgsList = yield index_1.PeriodGradeSubject.findAll({
            where: { periodGradeId: pg.id, active: true },
            include: [{ model: index_1.Subject, as: 'subject' }],
        });
        const subjects = pgsList
            .sort((a, b) => { var _a, _b; return ((_a = subjectOrderMap.get(a.subjectId)) !== null && _a !== void 0 ? _a : 99) - ((_b = subjectOrderMap.get(b.subjectId)) !== null && _b !== void 0 ? _b : 99); })
            .map(pgs => {
            var _a;
            return ({
                id: pgs.subjectId,
                name: (_a = pgs.subject) === null || _a === void 0 ? void 0 : _a.name,
                periodGradeSubjectId: pgs.id,
            });
        });
        // Get all MP inscriptions for this grade — include ALL pending subjects
        // (both 'pendiente' and 'aprobada') so we can show the score for this encounter
        // even if the student already approved.
        const inscriptions = yield index_1.Inscription.findAll({
            where: {
                schoolPeriodId: activePeriod.id,
                gradeId: gradeIdNum,
                sectionId: mpSection.id,
            },
            include: [
                { model: index_1.Person, as: 'student' },
                {
                    model: index_1.PendingSubject,
                    as: 'pendingSubjects',
                    required: true,
                    include: [
                        {
                            model: index_1.PendingSubjectEncounter,
                            as: 'encounters',
                            where: { encounterNumber },
                            required: false,
                        },
                    ],
                },
                {
                    model: index_1.InscriptionSubject,
                    as: 'inscriptionSubjects',
                    required: false,
                },
            ],
        });
        (0, studentSortService_1.sortInscriptions)(inscriptions);
        const students = inscriptions.map((ins) => {
            var _a, _b, _c, _d, _e;
            return ({
                inscriptionId: ins.id,
                personId: ins.personId,
                studentName: `${(_a = ins.student) === null || _a === void 0 ? void 0 : _a.lastName} ${(_b = ins.student) === null || _b === void 0 ? void 0 : _b.firstName}`,
                studentDni: (_c = ins.student) === null || _c === void 0 ? void 0 : _c.document,
                documentType: (_d = ins.student) === null || _d === void 0 ? void 0 : _d.documentType,
                subjects: ((_e = ins.pendingSubjects) === null || _e === void 0 ? void 0 : _e.filter((ps) => {
                    var _a;
                    // Show if: status is 'pendiente' (still needs this encounter)
                    // OR: has a score for this encounter (even if approved)
                    const enc = (_a = ps.encounters) === null || _a === void 0 ? void 0 : _a[0];
                    return ps.status === 'pendiente' || (enc && enc.score != null);
                }).map((ps) => {
                    var _a, _b, _c, _d;
                    const enc = (_a = ps.encounters) === null || _a === void 0 ? void 0 : _a[0];
                    // Find the matching InscriptionSubject for this pending subject
                    const insSubj = (_b = ins.inscriptionSubjects) === null || _b === void 0 ? void 0 : _b.find((is) => is.subjectId === ps.subjectId);
                    return {
                        pendingSubjectId: ps.id,
                        subjectId: ps.subjectId,
                        inscriptionSubjectId: (_c = insSubj === null || insSubj === void 0 ? void 0 : insSubj.id) !== null && _c !== void 0 ? _c : null,
                        encounterScore: enc ? (enc.isAbsent ? 0 : enc.score) : null,
                        encounterIsAbsent: enc ? enc.isAbsent : false,
                        encounterDate: (_d = enc === null || enc === void 0 ? void 0 : enc.date) !== null && _d !== void 0 ? _d : null,
                        status: ps.status,
                    };
                })) || [],
            });
        });
        const grade = yield index_1.Grade.findByPk(gradeIdNum);
        return res.json({ grade, subjects, students, encounterNumber });
    }
    catch (error) {
        console.error('[getMpNominaByEncounter] Error:', error);
        return res.status(500).json({ message: 'Error al obtener nómina por encuentro' });
    }
});
exports.getMpNominaByEncounter = getMpNominaByEncounter;
/* ---------------------------------------------------------------------- */
/* GET /pending-subjects/nomina-final/:gradeId                            */
/* Nómina final: all students who took MP this year, with their last      */
/* achieved score per subject (the encounter where they approved, or      */
/* the last encounter they took if they failed all).                      */
/* ---------------------------------------------------------------------- */
const getMpNominaFinal = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { gradeId } = req.params;
        const gradeIdNum = Number(gradeId);
        if (!Number.isFinite(gradeIdNum)) {
            return res.status(400).json({ message: 'gradeId inválido' });
        }
        const activePeriod = yield index_1.SchoolPeriod.findOne({ where: { status: 'activo' } });
        if (!activePeriod) {
            return res.json({ grade: null, subjects: [], students: [] });
        }
        const mpSection = yield index_1.Section.findOne({ where: { name: MP_SECTION_NAME } });
        if (!mpSection) {
            return res.json({ grade: null, subjects: [], students: [] });
        }
        const pg = yield index_1.PeriodGrade.findOne({
            where: { schoolPeriodId: activePeriod.id, gradeId: gradeIdNum },
        });
        if (!pg) {
            return res.json({ grade: null, subjects: [], students: [] });
        }
        const subjectOrderMap = yield (0, subjectOrderService_1.getSubjectOrderMap)(pg.id);
        const pgsList = yield index_1.PeriodGradeSubject.findAll({
            where: { periodGradeId: pg.id, active: true },
            include: [{ model: index_1.Subject, as: 'subject' }],
        });
        const subjects = pgsList
            .sort((a, b) => { var _a, _b; return ((_a = subjectOrderMap.get(a.subjectId)) !== null && _a !== void 0 ? _a : 99) - ((_b = subjectOrderMap.get(b.subjectId)) !== null && _b !== void 0 ? _b : 99); })
            .map(pgs => {
            var _a;
            return ({
                id: pgs.subjectId,
                name: (_a = pgs.subject) === null || _a === void 0 ? void 0 : _a.name,
                periodGradeSubjectId: pgs.id,
            });
        });
        // Get ALL MP inscriptions (regardless of status) with their pending subjects + encounters
        const inscriptions = yield index_1.Inscription.findAll({
            where: {
                schoolPeriodId: activePeriod.id,
                gradeId: gradeIdNum,
                sectionId: mpSection.id,
            },
            include: [
                { model: index_1.Person, as: 'student' },
                {
                    model: index_1.PendingSubject,
                    as: 'pendingSubjects',
                    required: true,
                    include: [
                        {
                            model: index_1.PendingSubjectEncounter,
                            as: 'encounters',
                            required: false,
                        },
                    ],
                },
            ],
        });
        (0, studentSortService_1.sortInscriptions)(inscriptions);
        const maxEnc = yield getMaxEncounters();
        const students = inscriptions.map((ins) => {
            var _a, _b, _c, _d, _e;
            return ({
                inscriptionId: ins.id,
                personId: ins.personId,
                studentName: `${(_a = ins.student) === null || _a === void 0 ? void 0 : _a.lastName} ${(_b = ins.student) === null || _b === void 0 ? void 0 : _b.firstName}`,
                studentDni: (_c = ins.student) === null || _c === void 0 ? void 0 : _c.document,
                documentType: (_d = ins.student) === null || _d === void 0 ? void 0 : _d.documentType,
                subjects: ((_e = ins.pendingSubjects) === null || _e === void 0 ? void 0 : _e.map((ps) => {
                    var _a;
                    const encs = (ps.encounters || []).sort((a, b) => a.encounterNumber - b.encounterNumber);
                    const approvedEnc = encs.find((e) => e.score !== null && e.score >= 10 && !e.isAbsent);
                    const lastScored = [...encs].reverse().find((e) => e.score !== null || e.isAbsent);
                    // Build full encounters array (1..maxEnc), filling missing with nulls
                    const encMap = new Map(encs.map((e) => [e.encounterNumber, e]));
                    const allEncounters = Array.from({ length: maxEnc }, (_, i) => {
                        const e = encMap.get(i + 1);
                        return {
                            encounterNumber: i + 1,
                            score: e ? (e.isAbsent ? 0 : e.score) : null,
                            isAbsent: e ? e.isAbsent : false,
                            date: e ? e.date : null,
                        };
                    });
                    return {
                        pendingSubjectId: ps.id,
                        subjectId: ps.subjectId,
                        status: ps.status,
                        finalScore: approvedEnc ? approvedEnc.score : (lastScored ? (lastScored.isAbsent ? 0 : lastScored.score) : null),
                        finalEncounterNumber: approvedEnc ? approvedEnc.encounterNumber : (lastScored ? lastScored.encounterNumber : null),
                        isAbsent: (_a = lastScored === null || lastScored === void 0 ? void 0 : lastScored.isAbsent) !== null && _a !== void 0 ? _a : false,
                        encounters: allEncounters,
                    };
                })) || [],
            });
        });
        const grade = yield index_1.Grade.findByPk(gradeIdNum);
        return res.json({ grade, subjects, students, maxEncounters: maxEnc });
    }
    catch (error) {
        console.error('[getMpNominaFinal] Error:', error);
        return res.status(500).json({ message: 'Error al obtener nómina final' });
    }
});
exports.getMpNominaFinal = getMpNominaFinal;
/* ---------------------------------------------------------------------- */
/* GET /pending-subjects/locked-encounters                                 */
/* Returns the list of locked encounter numbers.                           */
/* ---------------------------------------------------------------------- */
const getMpLockedEncounters = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const locked = yield getLockedEncounters();
        return res.json({ lockedEncounters: locked });
    }
    catch (error) {
        console.error('[getMpLockedEncounters] Error:', error);
        return res.status(500).json({ message: 'Error al obtener encuentros bloqueados' });
    }
});
exports.getMpLockedEncounters = getMpLockedEncounters;
/* ---------------------------------------------------------------------- */
/* PUT /pending-subjects/locked-encounters                                 */
/* Update the list of locked encounter numbers.                            */
/* Body: { lockedEncounters: number[] }                                    */
/* ---------------------------------------------------------------------- */
const updateMpLockedEncounters = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { lockedEncounters } = req.body;
        if (!Array.isArray(lockedEncounters)) {
            return res.status(400).json({ message: 'lockedEncounters debe ser un arreglo' });
        }
        const value = lockedEncounters.map(n => String(n)).join(',');
        const [setting] = yield index_1.Setting.findOrCreate({
            where: { key: 'pending_subject_locked_encounters' },
            defaults: { key: 'pending_subject_locked_encounters', value },
        });
        if (setting.value !== value) {
            yield setting.update({ value });
        }
        return res.json({ message: 'Encuentros bloqueados actualizados', lockedEncounters });
    }
    catch (error) {
        console.error('[updateMpLockedEncounters] Error:', error);
        return res.status(500).json({ message: 'Error al actualizar encuentros bloqueados' });
    }
});
exports.updateMpLockedEncounters = updateMpLockedEncounters;
/* ---------------------------------------------------------------------- */
/* GET /pending-subjects/:pendingSubjectId/content                        */
/* Returns the global content (theme title + items) for a MP subject.     */
/* ---------------------------------------------------------------------- */
const getMpContent = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const pendingSubjectId = Number(req.params.pendingSubjectId);
        if (!Number.isFinite(pendingSubjectId)) {
            return res.status(400).json({ message: 'pendingSubjectId inválido' });
        }
        const pending = yield index_1.PendingSubject.findByPk(pendingSubjectId);
        if (!pending) {
            return res.status(404).json({ message: 'Materia pendiente no encontrada' });
        }
        let content = yield index_1.PendingSubjectContent.findOne({
            where: { pendingSubjectId },
            include: [{
                    model: index_1.PendingSubjectContentItem,
                    as: 'items',
                    order: [['order', 'ASC']],
                }],
        });
        if (!content) {
            // Auto-create empty content
            content = yield index_1.PendingSubjectContent.create({ pendingSubjectId, themeTitle: '' });
        }
        const items = content.items
            ? content.items
            : yield index_1.PendingSubjectContentItem.findAll({
                where: { contentId: content.id },
                order: [['order', 'ASC']],
            });
        return res.json({
            id: content.id,
            pendingSubjectId,
            themeTitle: content.themeTitle,
            items: items.map((it) => ({ id: it.id, text: it.text, order: it.order })),
        });
    }
    catch (error) {
        console.error('[getMpContent] Error:', error);
        return res.status(500).json({ message: 'Error al obtener contenido' });
    }
});
exports.getMpContent = getMpContent;
/* ---------------------------------------------------------------------- */
/* PUT /pending-subjects/:pendingSubjectId/content                        */
/* Upsert the global content (theme title + items).                       */
/* ---------------------------------------------------------------------- */
const updateMpContent = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const t = yield database_1.default.transaction();
    try {
        const pendingSubjectId = Number(req.params.pendingSubjectId);
        if (!Number.isFinite(pendingSubjectId)) {
            return res.status(400).json({ message: 'pendingSubjectId inválido' });
        }
        const { themeTitle, items } = req.body;
        const pending = yield index_1.PendingSubject.findByPk(pendingSubjectId, { transaction: t });
        if (!pending) {
            yield t.rollback();
            return res.status(404).json({ message: 'Materia pendiente no encontrada' });
        }
        // Upsert content record
        let content = yield index_1.PendingSubjectContent.findOne({ where: { pendingSubjectId }, transaction: t });
        if (!content) {
            content = yield index_1.PendingSubjectContent.create({ pendingSubjectId, themeTitle: themeTitle || '' }, { transaction: t });
        }
        else {
            yield content.update({ themeTitle: themeTitle || '' }, { transaction: t });
        }
        // Replace all items (delete + recreate)
        yield index_1.PendingSubjectContentItem.destroy({ where: { contentId: content.id }, transaction: t });
        if (Array.isArray(items) && items.length > 0) {
            yield index_1.PendingSubjectContentItem.bulkCreate(items.map((it, idx) => {
                var _a;
                return ({
                    contentId: content.id,
                    text: it.text,
                    order: (_a = it.order) !== null && _a !== void 0 ? _a : idx,
                });
            }), { transaction: t });
        }
        yield t.commit();
        const freshItems = yield index_1.PendingSubjectContentItem.findAll({
            where: { contentId: content.id },
            order: [['order', 'ASC']],
        });
        return res.json({
            id: content.id,
            pendingSubjectId,
            themeTitle: content.themeTitle,
            items: freshItems.map(it => ({ id: it.id, text: it.text, order: it.order })),
        });
    }
    catch (error) {
        yield t.rollback();
        console.error('[updateMpContent] Error:', error);
        return res.status(500).json({ message: 'Error al guardar contenido' });
    }
});
exports.updateMpContent = updateMpContent;
