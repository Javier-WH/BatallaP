"use strict";
/**
 * scheduleGeneratorService
 *
 * Generates schedules automatically for ALL sections of ALL grades in a school period.
 * Uses Google OR-Tools CP-SAT solver via a Python child process.
 *
 * The TypeScript side:
 *   1. Loads all data from the DB (sections, subjects, teachers, availability, settings)
 *   2. Builds a JSON problem description
 *   3. Calls schedule_solver.py via child_process
 *   4. Parses the solution and saves to DB
 *
 * The Python side (schedule_solver.py):
 *   1. Reads the JSON problem from stdin
 *   2. Builds a CP-SAT model with all constraints
 *   3. Solves it
 *   4. Returns the solution as JSON on stdout
 */
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
exports.generateSchedulesForPeriod = generateSchedulesForPeriod;
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const database_1 = __importDefault(require("../config/database.js"));
const models_1 = require("../models/index.js");
// ── Days ──
const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
// ── Build period slots from settings ──
function buildPeriodSlots(settings) {
    const slots = [];
    let globalOrder = 0;
    const buildSection = (prefix, section, blocksBefore, recess, blocksAfter) => {
        let sectionOrder = 0;
        for (let i = 0; i < blocksBefore; i++) {
            slots.push({ id: `${prefix}${i + 1}`, section, isBreak: false, order: globalOrder++, sectionOrder });
            sectionOrder++;
        }
        if (recess > 0) {
            slots.push({ id: `${prefix}_break`, section, isBreak: true, order: globalOrder++, sectionOrder });
            sectionOrder++;
        }
        for (let i = 0; i < blocksAfter; i++) {
            slots.push({ id: `${prefix}${blocksBefore + i + 1}`, section, isBreak: false, order: globalOrder++, sectionOrder });
            sectionOrder++;
        }
    };
    const mBefore = Number(settings.morning_blocks_before_recess) || 3;
    const mRecess = Number(settings.morning_recess_minutes) > 0 ? 1 : 0;
    const mAfter = Number(settings.morning_blocks_after_recess) || 0;
    buildSection('m', 'manana', mBefore, mRecess, mAfter);
    const aBefore = Number(settings.afternoon_blocks_before_recess) || 2;
    const aRecess = Number(settings.afternoon_recess_minutes) > 0 ? 1 : 0;
    const aAfter = Number(settings.afternoon_blocks_after_recess) || 0;
    buildSection('t', 'tarde', aBefore, aRecess, aAfter);
    return slots;
}
// ── Build fixed blocks from period slots ──
// Blocks are groups of `blockSize` consecutive non-break periods within the same section (manana/tarde).
// A class can only start at the beginning of a block.
function buildBlocks(slots, blockSize) {
    const blocks = [];
    const days = DAYS;
    let globalOrder = 0;
    for (const day of days) {
        for (const sec of ['manana', 'tarde']) {
            const sectionSlots = slots.filter(s => s.section === sec && !s.isBreak);
            let order = 0;
            for (let i = 0; i < sectionSlots.length; i += blockSize) {
                const chunk = sectionSlots.slice(i, i + blockSize);
                if (chunk.length < blockSize)
                    break; // incomplete block, skip
                const periodIds = chunk.map(s => s.id);
                const blockId = periodIds.join('_');
                blocks.push({
                    id: blockId,
                    day,
                    section: sec,
                    periodIds,
                    order,
                    globalOrder,
                });
                order++;
                globalOrder++;
            }
        }
    }
    return blocks;
}
// ── Call the Python solver ──
function callSolver(problem) {
    return new Promise((resolve, reject) => {
        const scriptPath = path_1.default.join(__dirname, '..', '..', 'scripts', 'schedule_solver.py');
        const py = (0, child_process_1.spawn)('python', [scriptPath], {
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        let stdout = '';
        let stderr = '';
        py.stdout.on('data', (data) => { stdout += data.toString(); });
        py.stderr.on('data', (data) => { stderr += data.toString(); });
        py.on('close', (code) => {
            if (stderr) {
                console.log(`[scheduleSolver] stderr: ${stderr}`);
            }
            if (code !== 0) {
                reject(new Error(`Python solver exited with code ${code}. stderr: ${stderr}`));
                return;
            }
            try {
                const result = JSON.parse(stdout);
                resolve(result);
            }
            catch (e) {
                reject(new Error(`Failed to parse solver output: ${e}. stdout: ${stdout.slice(0, 500)}. stderr: ${stderr.slice(0, 500)}`));
            }
        });
        py.on('error', (err) => {
            reject(new Error(`Failed to spawn python: ${err.message}`));
        });
        // Send the problem as JSON on stdin
        py.stdin.write(JSON.stringify(problem));
        py.stdin.end();
    });
}
// ── Main generation function ──
function generateSchedulesForPeriod(schoolPeriodId) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        // 1. Load settings
        const settingsRows = yield models_1.Setting.findAll();
        const settings = {};
        settingsRows.forEach(s => { settings[s.key] = s.value; });
        const blockSize = Number(settings.min_academic_hours_per_block) || 1;
        const avoidLastMorningFirstAfternoon = settings.avoid_last_morning_first_afternoon === 'true';
        // 2. Build period slots and blocks
        const allSlots = buildPeriodSlots(settings);
        const blocks = buildBlocks(allSlots, blockSize);
        // 3. Load ALL period grades
        const periodGrades = yield models_1.PeriodGrade.findAll({
            where: { schoolPeriodId },
            include: [{ model: models_1.Grade, as: 'grade' }],
        });
        if (periodGrades.length === 0) {
            return { success: false, placed: [], unplaced: [], conflicts: [], stats: { totalSlots: 0, filledSlots: 0, sections: 0, subjects: 0, solverStatus: 'NO_GRADES' } };
        }
        const periodGradeIds = periodGrades.map(pg => pg.id);
        // 4. Load ALL sections, excluding MATERIA PENDIENTE
        const mpSection = yield models_1.Section.findOne({ where: { name: 'MATERIA PENDIENTE' } });
        const allPgs = yield models_1.PeriodGradeSection.findAll({
            where: { periodGradeId: periodGradeIds },
            include: [
                { model: models_1.PeriodGrade, as: 'periodGrade', include: [{ model: models_1.Grade, as: 'grade' }] },
                { model: models_1.Section, as: 'section' },
            ],
        });
        const allPgsFiltered = mpSection
            ? allPgs.filter(pgs => pgs.sectionId !== mpSection.id)
            : allPgs;
        // 5. Load ALL subjects for ALL grades
        const allPgsSubjects = yield models_1.PeriodGradeSubject.findAll({
            where: { periodGradeId: periodGradeIds, active: true },
            include: [{ model: models_1.Subject, as: 'subject' }],
            order: [['order', 'ASC']],
        });
        // 6. Load ALL teacher assignments
        // TeacherAssignment.sectionId references Section.id (NOT PeriodGradeSection.id)
        const allSectionIds = allPgsFiltered.map(pgs => pgs.sectionId);
        const allAssignments = yield models_1.TeacherAssignment.findAll({
            where: { sectionId: allSectionIds },
            include: [
                { model: models_1.Person, as: 'teacher', attributes: ['id', 'firstName', 'lastName'] },
                { model: models_1.PeriodGradeSubject, as: 'periodGradeSubject', attributes: ['id', 'subjectId', 'weeklyBlocks'] },
            ],
        });
        // 7. Build section inputs for the solver
        // Load schedule exceptions (per-subject overrides)
        const allSubjectIds = new Set();
        allPgsSubjects.forEach(p => allSubjectIds.add(p.subjectId));
        const exceptions = yield models_1.ScheduleException.findAll({
            where: { subjectId: Array.from(allSubjectIds) },
        });
        const exceptionMap = new Map();
        exceptions.forEach(e => exceptionMap.set(e.subjectId, e));
        const sectionInputs = [];
        const sectionPgMap = new Map(); // sectionId (PGS.id) -> periodGradeId
        for (const pgs of allPgsFiltered) {
            const gradeSubjects = allPgsSubjects.filter(p => p.periodGradeId === pgs.periodGradeId);
            const sectionAssignments = allAssignments.filter(a => a.sectionId === pgs.sectionId);
            const subjects = gradeSubjects.map(p => {
                var _a, _b, _c;
                const subject = p.subject;
                const assignment = sectionAssignments.find(a => a.periodGradeSubjectId === p.id);
                const exc = exceptionMap.get(p.subjectId);
                return {
                    subjectId: p.subjectId,
                    weeklyBlocks: (exc === null || exc === void 0 ? void 0 : exc.weeklyBlocks) != null ? exc.weeklyBlocks : p.weeklyBlocks,
                    allowConsecutiveBlocks: (exc === null || exc === void 0 ? void 0 : exc.allowConsecutiveBlocks) != null ? exc.allowConsecutiveBlocks : ((_a = subject === null || subject === void 0 ? void 0 : subject.allowConsecutiveBlocks) !== null && _a !== void 0 ? _a : 0),
                    maxHoursPerDay: (exc === null || exc === void 0 ? void 0 : exc.maxHoursPerDay) != null ? exc.maxHoursPerDay : ((_b = subject === null || subject === void 0 ? void 0 : subject.maxHoursPerDay) !== null && _b !== void 0 ? _b : null),
                    subjectGroupId: (_c = subject === null || subject === void 0 ? void 0 : subject.subjectGroupId) !== null && _c !== void 0 ? _c : null,
                    teacherId: assignment ? assignment.teacherId : null,
                };
            });
            sectionInputs.push({
                id: pgs.id,
                periodGradeId: pgs.periodGradeId,
                subjects,
            });
            sectionPgMap.set(pgs.id, pgs.periodGradeId);
        }
        // 8. Load teacher availability (busy slots)
        const allTeacherIds = new Set();
        allAssignments.forEach(a => allTeacherIds.add(a.teacherId));
        const availabilityRows = yield models_1.TeacherAvailability.findAll({
            where: { personId: Array.from(allTeacherIds) },
        });
        // Map teacher busy slots to block IDs
        // TeacherAvailability uses periodId (single period), we need to find which block contains that period
        const periodToBlock = new Map(); // periodId -> block (for a given day)
        // Actually blocks are per-day, so we need (day, periodId) -> blockId
        const dayPeriodToBlock = new Map();
        for (const b of blocks) {
            for (const pid of b.periodIds) {
                dayPeriodToBlock.set(`${b.day}|${pid}`, b.id);
            }
        }
        const teacherBusy = [];
        const teacherPreferred = [];
        availabilityRows.forEach(a => {
            const blockId = dayPeriodToBlock.get(`${a.day}|${a.periodId}`);
            if (!blockId)
                return;
            if (a.status === 'busy') {
                teacherBusy.push({ teacherId: a.personId, day: a.day, blockId });
            }
            else if (a.status === 'preferred') {
                teacherPreferred.push({ teacherId: a.personId, day: a.day, blockId });
            }
        });
        // 9. Build group subjects list
        // Group subjects by subjectGroupId within each periodGradeId
        const groupMap = new Map();
        for (const pgs of allPgsFiltered) {
            const gradeSubjects = allPgsSubjects.filter(p => p.periodGradeId === pgs.periodGradeId);
            for (const p of gradeSubjects) {
                const subject = p.subject;
                const sgId = subject === null || subject === void 0 ? void 0 : subject.subjectGroupId;
                if (sgId) {
                    const key = `${pgs.periodGradeId}|${sgId}`;
                    if (!groupMap.has(key)) {
                        groupMap.set(key, { subjectGroupId: sgId, periodGradeId: pgs.periodGradeId, subjectIds: [] });
                    }
                    const entry = groupMap.get(key);
                    if (!entry.subjectIds.includes(p.subjectId)) {
                        entry.subjectIds.push(p.subjectId);
                    }
                }
            }
        }
        const groupSubjects = Array.from(groupMap.values());
        // 9b. Load cross-grade schedule links (manually configured synchronization across grades)
        const linkRows = yield models_1.ScheduleLink.findAll({
            where: { schoolPeriodId },
            include: [{ model: models_1.ScheduleLinkItem, as: 'items' }],
        });
        const crossGradeLinks = linkRows
            .map(link => ({
            id: link.id,
            items: link.items.map((it) => ({
                subjectId: it.subjectId,
                periodGradeId: it.periodGradeId,
            })),
        }))
            .filter(l => l.items.length >= 2);
        // 10. Build the problem JSON
        const problem = {
            blockSize,
            avoidLastMorningFirstAfternoon,
            days: DAYS,
            blocks,
            sections: sectionInputs,
            teacherBusy,
            teacherPreferred,
            groupSubjects,
            crossGradeLinks,
        };
        // Debug: log problem summary
        console.log(`[scheduleGenerator] Problem: ${sectionInputs.length} sections, ${blocks.length} blocks, ${groupSubjects.length} group subjects, ${crossGradeLinks.length} cross-grade links, ${teacherBusy.length} busy slots, ${teacherPreferred.length} preferred slots`);
        console.log(`[scheduleGenerator] blockSize=${blockSize}, avoidLastMorningFirstAfternoon=${avoidLastMorningFirstAfternoon}`);
        // Log busy slots per teacher for the group subject teachers
        const groupTeacherIds = new Set();
        for (const sec of sectionInputs) {
            for (const sub of sec.subjects) {
                if (sub.subjectGroupId !== null && sub.teacherId !== null) {
                    groupTeacherIds.add(sub.teacherId);
                }
            }
        }
        for (const tid of groupTeacherIds) {
            const busyCount = teacherBusy.filter(b => b.teacherId === tid).length;
            const prefCount = teacherPreferred.filter(p => p.teacherId === tid).length;
            const teacher = allAssignments.find(a => a.teacherId === tid);
            const tName = teacher ? `${(_a = teacher.teacher) === null || _a === void 0 ? void 0 : _a.firstName} ${(_b = teacher.teacher) === null || _b === void 0 ? void 0 : _b.lastName}` : `ID ${tid}`;
            console.log(`[scheduleGenerator] Group teacher ${tName} (id=${tid}): ${busyCount} busy slots, ${prefCount} preferred slots`);
            // Log which days are busy
            const busyByDay = {};
            teacherBusy.filter(b => b.teacherId === tid).forEach(b => {
                busyByDay[b.day] = (busyByDay[b.day] || 0) + 1;
            });
        }
        // 11. Call the solver
        let solverResult;
        try {
            solverResult = yield callSolver(problem);
        }
        catch (e) {
            console.error('[scheduleGenerator] Solver error:', e.message);
            return {
                success: false,
                placed: [],
                unplaced: [],
                conflicts: [],
                stats: { totalSlots: 0, filledSlots: 0, sections: sectionInputs.length, subjects: 0, solverStatus: `SOLVER_ERROR: ${e.message}` },
            };
        }
        // 12. Convert solver result to DB entries
        // Each placed block has periodIds — we need to create one ScheduleEntry per period
        const placedEntries = [];
        for (const p of solverResult.placed) {
            for (const pid of p.periodIds) {
                placedEntries.push({
                    day: p.day,
                    periodId: pid,
                    subjectId: p.subjectId,
                    teacherId: p.teacherId,
                    isGroupSubject: p.isGroupSubject,
                    periodGradeSectionId: p.sectionId,
                });
            }
        }
        // 13. Save to database
        if (placedEntries.length > 0) {
            const t = yield database_1.default.transaction();
            try {
                const bySection = new Map();
                placedEntries.forEach(e => {
                    if (!bySection.has(e.periodGradeSectionId))
                        bySection.set(e.periodGradeSectionId, []);
                    bySection.get(e.periodGradeSectionId).push(e);
                });
                for (const [sectionId, entries] of bySection) {
                    const [schedule] = yield models_1.Schedule.findOrCreate({
                        where: { schoolPeriodId, periodGradeSectionId: sectionId },
                        defaults: { schoolPeriodId, periodGradeSectionId: sectionId, status: 'draft' },
                        transaction: t,
                    });
                    yield models_1.ScheduleEntry.destroy({ where: { scheduleId: schedule.id }, transaction: t });
                    yield models_1.ScheduleEntry.bulkCreate(entries.map(e => ({
                        scheduleId: schedule.id,
                        day: e.day,
                        periodId: e.periodId,
                        subjectId: e.subjectId,
                        teacherId: e.teacherId,
                        isGroupSubject: e.isGroupSubject,
                    })), { transaction: t });
                }
                yield t.commit();
            }
            catch (err) {
                yield t.rollback();
                throw err;
            }
        }
        // 14. Return result
        const totalSlots = sectionInputs.length * blocks.length;
        return {
            success: solverResult.success,
            placed: placedEntries,
            unplaced: solverResult.unplaced,
            conflicts: [],
            stats: {
                totalSlots,
                filledSlots: placedEntries.length,
                sections: sectionInputs.length,
                subjects: sectionInputs.reduce((acc, s) => acc + s.subjects.length, 0),
                solverStatus: solverResult.stats.status,
            },
        };
    });
}
