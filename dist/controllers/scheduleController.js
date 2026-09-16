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
exports.checkTeacherConflict = exports.getSectionScheduleOptions = exports.getTeacherSchedule = exports.saveScheduleEntries = exports.updateSchedule = exports.createSchedule = exports.getSchedule = exports.listSchedules = exports.generateSchedules = void 0;
const database_1 = __importDefault(require("../config/database.js"));
const models_1 = require("../models/index.js");
const scheduleGeneratorService_1 = require("../services/scheduleGeneratorService.js");
// POST /api/schedules/generate?schoolPeriodId=
const generateSchedules = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { schoolPeriodId } = req.query;
        if (!schoolPeriodId) {
            return res.status(400).json({ message: 'schoolPeriodId es requerido' });
        }
        const result = yield (0, scheduleGeneratorService_1.generateSchedulesForPeriod)(Number(schoolPeriodId));
        return res.json(result);
    }
    catch (error) {
        console.error('[generateSchedules] Error:', error);
        return res.status(500).json({ message: 'Error al generar horarios automáticamente' });
    }
});
exports.generateSchedules = generateSchedules;
// GET /api/schedules?schoolPeriodId=&sectionId=
const listSchedules = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { schoolPeriodId, sectionId } = req.query;
        const where = {};
        if (schoolPeriodId)
            where.schoolPeriodId = Number(schoolPeriodId);
        if (sectionId)
            where.periodGradeSectionId = Number(sectionId);
        const schedules = yield models_1.Schedule.findAll({
            where,
            include: [
                { model: models_1.PeriodGradeSection, as: 'section', include: [
                        { model: models_1.PeriodGrade, as: 'periodGrade', include: [{ model: models_1.Grade, as: 'grade' }] },
                        { model: models_1.Section, as: 'section' },
                    ] },
                { model: models_1.ScheduleEntry, as: 'entries', include: [
                        { model: models_1.Subject, as: 'subject' },
                        { model: models_1.Person, as: 'teacher' },
                    ] },
            ],
        });
        return res.json(schedules);
    }
    catch (error) {
        console.error('[listSchedules] Error:', error);
        return res.status(500).json({ message: 'Error al listar horarios' });
    }
});
exports.listSchedules = listSchedules;
// GET /api/schedules/:id
const getSchedule = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const schedule = yield models_1.Schedule.findByPk(Number(id), {
            include: [
                { model: models_1.PeriodGradeSection, as: 'section', include: [
                        { model: models_1.PeriodGrade, as: 'periodGrade', include: [{ model: models_1.Grade, as: 'grade' }] },
                        { model: models_1.Section, as: 'section' },
                    ] },
                { model: models_1.ScheduleEntry, as: 'entries', include: [
                        { model: models_1.Subject, as: 'subject' },
                        { model: models_1.Person, as: 'teacher' },
                    ] },
            ],
        });
        if (!schedule)
            return res.status(404).json({ message: 'Horario no encontrado' });
        return res.json(schedule);
    }
    catch (error) {
        console.error('[getSchedule] Error:', error);
        return res.status(500).json({ message: 'Error al obtener horario' });
    }
});
exports.getSchedule = getSchedule;
// POST /api/schedules — create or get-or-create for a section
const createSchedule = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { schoolPeriodId, periodGradeSectionId } = req.body;
        if (!schoolPeriodId || !periodGradeSectionId) {
            return res.status(400).json({ message: 'schoolPeriodId y periodGradeSectionId son requeridos' });
        }
        const [schedule, created] = yield models_1.Schedule.findOrCreate({
            where: { schoolPeriodId, periodGradeSectionId },
            defaults: { schoolPeriodId, periodGradeSectionId, status: 'draft' },
        });
        return res.status(created ? 201 : 200).json(schedule);
    }
    catch (error) {
        console.error('[createSchedule] Error:', error);
        return res.status(500).json({ message: 'Error al crear horario' });
    }
});
exports.createSchedule = createSchedule;
// PUT /api/schedules/:id — update status
const updateSchedule = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const schedule = yield models_1.Schedule.findByPk(Number(id));
        if (!schedule)
            return res.status(404).json({ message: 'Horario no encontrado' });
        if (status)
            yield schedule.update({ status });
        return res.json(schedule);
    }
    catch (error) {
        console.error('[updateSchedule] Error:', error);
        return res.status(500).json({ message: 'Error al actualizar horario' });
    }
});
exports.updateSchedule = updateSchedule;
// PUT /api/schedules/:id/entries — replace all entries (full schedule save)
const saveScheduleEntries = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { id } = req.params;
        const { entries } = req.body;
        const schedule = yield models_1.Schedule.findByPk(Number(id));
        if (!schedule)
            return res.status(404).json({ message: 'Horario no encontrado' });
        // ── Validate group subject rule ──
        // For each (day, periodId), at most ONE non-group entry is allowed.
        // Multiple group entries are allowed only if they all share the same subjectGroupId.
        if (entries && entries.length > 0) {
            // Build a map subjectId -> subjectGroupId
            const subjectIds = Array.from(new Set(entries.map(e => e.subjectId).filter((s) => s !== null)));
            const subjects = yield models_1.Subject.findAll({ where: { id: subjectIds }, attributes: ['id', 'subjectGroupId'] });
            const subjGroupMap = new Map();
            subjects.forEach(s => { var _a; return subjGroupMap.set(s.id, (_a = s.subjectGroupId) !== null && _a !== void 0 ? _a : null); });
            // Group entries by `${day}|${periodId}`
            const cellMap = new Map();
            entries.forEach(e => {
                const k = `${e.day}|${e.periodId}`;
                if (!cellMap.has(k))
                    cellMap.set(k, []);
                cellMap.get(k).push(e);
            });
            for (const [cellKey, cellEntries] of cellMap) {
                const nonGroup = cellEntries.filter(e => !e.isGroupSubject);
                const groupEntries = cellEntries.filter(e => e.isGroupSubject);
                // At most one non-group subject per cell
                if (nonGroup.length > 1) {
                    const subjNames = yield models_1.Subject.findAll({ where: { id: nonGroup.map(e => e.subjectId).filter((s) => s !== null) } });
                    return res.status(400).json({
                        message: `No se pueden colocar múltiples materias regulares en el mismo bloque (${cellKey}). Materias en conflicto: ${subjNames.map(s => s.name).join(', ')}`,
                    });
                }
                // A non-group subject cannot coexist with group subjects in the same cell
                if (nonGroup.length > 0 && groupEntries.length > 0) {
                    return res.status(400).json({
                        message: `No se puede mezclar una materia regular con materias de grupo en el mismo bloque (${cellKey})`,
                    });
                }
                // All group subjects in the same cell must share the same subjectGroupId
                if (groupEntries.length > 1) {
                    const groupIds = new Set(groupEntries.map(e => { var _a; return (_a = subjGroupMap.get(e.subjectId)) !== null && _a !== void 0 ? _a : null; }));
                    if (groupIds.size > 1) {
                        return res.status(400).json({
                            message: `Las materias de grupo en el mismo bloque (${cellKey}) deben pertenecer al mismo grupo. Grupos detectados: ${Array.from(groupIds).join(', ')}`,
                        });
                    }
                }
            }
        }
        const t = yield database_1.default.transaction();
        try {
            yield models_1.ScheduleEntry.destroy({ where: { scheduleId: schedule.id }, transaction: t });
            if (entries && entries.length > 0) {
                yield models_1.ScheduleEntry.bulkCreate(entries.map(e => {
                    var _a;
                    return ({
                        scheduleId: schedule.id,
                        day: e.day,
                        periodId: e.periodId,
                        subjectId: e.subjectId,
                        teacherId: e.teacherId,
                        isGroupSubject: (_a = e.isGroupSubject) !== null && _a !== void 0 ? _a : false,
                    });
                }), { transaction: t });
            }
            yield t.commit();
            return res.json({ message: 'Horario guardado', count: (_a = entries === null || entries === void 0 ? void 0 : entries.length) !== null && _a !== void 0 ? _a : 0 });
        }
        catch (err) {
            yield t.rollback();
            throw err;
        }
    }
    catch (error) {
        console.error('[saveScheduleEntries] Error:', error);
        return res.status(500).json({ message: 'Error al guardar entradas del horario' });
    }
});
exports.saveScheduleEntries = saveScheduleEntries;
// GET /api/schedules/teacher/:personId?schoolPeriodId=
const getTeacherSchedule = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { personId } = req.params;
        const { schoolPeriodId } = req.query;
        const where = { teacherId: Number(personId) };
        if (schoolPeriodId) {
            // Filter by schedule's schoolPeriodId via include
        }
        const entries = yield models_1.ScheduleEntry.findAll({
            where,
            include: [
                { model: models_1.Schedule, as: 'schedule', where: schoolPeriodId ? { schoolPeriodId: Number(schoolPeriodId) } : undefined, include: [
                        { model: models_1.PeriodGradeSection, as: 'section', include: [
                                { model: models_1.PeriodGrade, as: 'periodGrade', include: [{ model: models_1.Grade, as: 'grade' }] },
                                { model: models_1.Section, as: 'section' },
                            ] },
                    ] },
                { model: models_1.Subject, as: 'subject' },
            ],
        });
        return res.json(entries);
    }
    catch (error) {
        console.error('[getTeacherSchedule] Error:', error);
        return res.status(500).json({ message: 'Error al obtener horario del profesor' });
    }
});
exports.getTeacherSchedule = getTeacherSchedule;
// GET /api/schedules/section/:sectionId/options — returns available subject+teacher combos for a section
const getSectionScheduleOptions = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { sectionId } = req.params;
        // Find the PeriodGradeSection to get periodGradeId
        const pgs = yield models_1.PeriodGradeSection.findByPk(Number(sectionId));
        if (!pgs)
            return res.status(404).json({ message: 'Sección no encontrada' });
        // Get all subjects for this grade (PeriodGradeSubject)
        const pgsList = yield models_1.PeriodGradeSubject.findAll({
            where: { periodGradeId: pgs.periodGradeId, active: true },
            include: [{ model: models_1.Subject, as: 'subject' }],
            order: [['order', 'ASC']],
        });
        // Get teacher assignments for this section
        // TeacherAssignment.sectionId references Section.id, NOT PeriodGradeSection.id
        const assignments = yield models_1.TeacherAssignment.findAll({
            where: { sectionId: pgs.sectionId },
            include: [
                { model: models_1.Person, as: 'teacher', attributes: ['id', 'firstName', 'lastName'] },
                { model: models_1.PeriodGradeSubject, as: 'periodGradeSubject', attributes: ['id', 'subjectId', 'weeklyBlocks'] },
            ],
        });
        // Build options: for each subject, list teachers assigned to it for this section
        const options = pgsList.map(p => {
            var _a, _b, _c, _d;
            const subject = p.subject;
            const teachers = assignments
                .filter(a => a.periodGradeSubjectId === p.id)
                .map(a => {
                var _a, _b, _c, _d;
                return ({
                    teacherId: a.teacherId,
                    teacherName: `${(_b = (_a = a.teacher) === null || _a === void 0 ? void 0 : _a.firstName) !== null && _b !== void 0 ? _b : ''} ${(_d = (_c = a.teacher) === null || _c === void 0 ? void 0 : _c.lastName) !== null && _d !== void 0 ? _d : ''}`.trim(),
                });
            });
            return {
                periodGradeSubjectId: p.id,
                subjectId: p.subjectId,
                subjectName: (_a = subject === null || subject === void 0 ? void 0 : subject.name) !== null && _a !== void 0 ? _a : '',
                weeklyBlocks: p.weeklyBlocks,
                allowConsecutiveBlocks: (_b = subject === null || subject === void 0 ? void 0 : subject.allowConsecutiveBlocks) !== null && _b !== void 0 ? _b : 0,
                maxHoursPerDay: (_c = subject === null || subject === void 0 ? void 0 : subject.maxHoursPerDay) !== null && _c !== void 0 ? _c : null,
                subjectGroupId: (_d = subject === null || subject === void 0 ? void 0 : subject.subjectGroupId) !== null && _d !== void 0 ? _d : null,
                teachers,
            };
        });
        return res.json(options);
    }
    catch (error) {
        console.error('[getSectionScheduleOptions] Error:', error);
        return res.status(500).json({ message: 'Error al obtener opciones de horario' });
    }
});
exports.getSectionScheduleOptions = getSectionScheduleOptions;
// GET /api/schedules/conflicts?day=&periodId=&teacherId=&scheduleId= — check if teacher is busy at a slot
const checkTeacherConflict = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { day, periodId, teacherId, scheduleId, schoolPeriodId } = req.query;
        if (!day || !periodId || !teacherId) {
            return res.status(400).json({ message: 'day, periodId, teacherId son requeridos' });
        }
        // Find all entries for this teacher at this day+period, excluding the current schedule
        const entries = yield models_1.ScheduleEntry.findAll({
            where: {
                day: String(day),
                periodId: String(periodId),
                teacherId: Number(teacherId),
            },
            include: [
                { model: models_1.Schedule, as: 'schedule', where: schoolPeriodId ? { schoolPeriodId: Number(schoolPeriodId) } : undefined, include: [
                        { model: models_1.PeriodGradeSection, as: 'section', include: [
                                { model: models_1.PeriodGrade, as: 'periodGrade', include: [{ model: models_1.Grade, as: 'grade' }] },
                                { model: models_1.Section, as: 'section' },
                            ] },
                    ] },
                { model: models_1.Subject, as: 'subject' },
            ],
        });
        // Filter out entries belonging to the current schedule (the one being edited)
        const conflicts = entries.filter((e) => e.scheduleId !== Number(scheduleId));
        return res.json({ hasConflict: conflicts.length > 0, conflicts });
    }
    catch (error) {
        console.error('[checkTeacherConflict] Error:', error);
        return res.status(500).json({ message: 'Error al verificar conflicto' });
    }
});
exports.checkTeacherConflict = checkTeacherConflict;
