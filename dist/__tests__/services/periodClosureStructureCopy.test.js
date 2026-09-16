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
require("../setup");
const database_1 = __importDefault(require("../../config/database.js"));
const index_1 = require("../../models/index.js");
const schoolPeriodService_1 = require("../../services/schoolPeriodService.js");
const periodClosureTestHelper_1 = require("../helpers/periodClosureTestHelper");
describe('Period Closure — Structure copy to next period', () => {
    let setup;
    // E1: Next period has NO structure — the executor must clone it and still
    // inscribe the student in the promoted grade/section.
    it('E1: clones structure into an empty next period and inscribes the student', () => __awaiter(void 0, void 0, void 0, function* () {
        setup = yield (0, periodClosureTestHelper_1.createFullClosureSetup)({ gradeCount: 2, subjectsPerGrade: 3, nextPeriodStructure: 'none' });
        yield (0, periodClosureTestHelper_1.markCouncilsDone)(setup);
        // The helper assigns one distinct section per grade. Link the student's
        // section to the target grade (grade[1]) in the current period so the
        // promoted student can keep it.
        yield index_1.PeriodGradeSection.create({
            periodGradeId: setup.periodGradesCurrent.get(setup.grades[1].id).id,
            sectionId: setup.sections[0].id,
        });
        const student = yield (0, periodClosureTestHelper_1.createStudentWithGrades)(setup, 0, { 0: 15, 1: 15, 2: 15 });
        const result = yield (0, periodClosureTestHelper_1.executeClosure)(setup);
        expect(result.success).toBe(true);
        expect(result.stats.skipped).toBe(0);
        expect(result.stats.newInscriptions).toBe(1);
        // Structure was cloned into the next period
        const nextPeriodGrades = yield index_1.PeriodGrade.findAll({
            where: { schoolPeriodId: setup.nextPeriod.id },
        });
        expect(nextPeriodGrades.map(pg => pg.gradeId).sort()).toEqual(setup.grades.map(g => g.id).sort());
        // The student was promoted: grade[0] -> grade[1], same section
        const newInscription = yield index_1.Inscription.findOne({
            where: {
                personId: student.person.id,
                schoolPeriodId: setup.nextPeriod.id,
            },
        });
        expect(newInscription).not.toBeNull();
        expect(newInscription.gradeId).toBe(setup.grades[1].id);
        expect(newInscription.sectionId).toBe(setup.sections[0].id);
        expect(newInscription.escolaridad).toBe('regular');
    }));
    // E2: Next period partially configured — merge fills gaps without
    // duplicating the grade that already exists.
    it('E2: merges into a partially configured next period without duplicates', () => __awaiter(void 0, void 0, void 0, function* () {
        setup = yield (0, periodClosureTestHelper_1.createFullClosureSetup)({ gradeCount: 2, subjectsPerGrade: 2, nextPeriodStructure: 'none' });
        yield (0, periodClosureTestHelper_1.markCouncilsDone)(setup);
        // Pre-configure ONLY grade[0] in the next period (simulates manual config)
        const existingPg = yield index_1.PeriodGrade.create({
            schoolPeriodId: setup.nextPeriod.id,
            gradeId: setup.grades[0].id,
        });
        yield index_1.PeriodGradeSection.create({
            periodGradeId: existingPg.id,
            sectionId: setup.sections[0].id,
        });
        yield index_1.PeriodGradeSubject.create({
            periodGradeId: existingPg.id,
            subjectId: setup.subjects[0].id,
            order: 1,
            weeklyBlocks: 5,
        });
        const student = yield (0, periodClosureTestHelper_1.createStudentWithGrades)(setup, 0, { 0: 15, 1: 15 });
        const result = yield (0, periodClosureTestHelper_1.executeClosure)(setup);
        expect(result.success).toBe(true);
        expect(result.stats.skipped).toBe(0);
        expect(result.stats.newInscriptions).toBe(1);
        // grade[0] exists exactly once in the next period (not duplicated)
        const grade0Rows = yield index_1.PeriodGrade.count({
            where: { schoolPeriodId: setup.nextPeriod.id, gradeId: setup.grades[0].id },
        });
        expect(grade0Rows).toBe(1);
        // grade[1] was added by the merge
        const grade1Pg = yield index_1.PeriodGrade.findOne({
            where: { schoolPeriodId: setup.nextPeriod.id, gradeId: setup.grades[1].id },
        });
        expect(grade1Pg).not.toBeNull();
        // The manually configured weeklyBlocks on the existing row were preserved
        const existingPgs = yield index_1.PeriodGradeSubject.findOne({
            where: { periodGradeId: existingPg.id, subjectId: setup.subjects[0].id },
        });
        expect(existingPgs.weeklyBlocks).toBe(5);
        // Student promoted into grade[1]
        const newInscription = yield index_1.Inscription.findOne({
            where: { personId: student.person.id, schoolPeriodId: setup.nextPeriod.id },
        });
        expect(newInscription.gradeId).toBe(setup.grades[1].id);
    }));
    // E3: field fidelity — subject flags and colors are copied.
    it('E3: copies includeInAverage, notRepairable, weeklyBlocks and colors', () => __awaiter(void 0, void 0, void 0, function* () {
        setup = yield (0, periodClosureTestHelper_1.createFullClosureSetup)({ gradeCount: 1, subjectsPerGrade: 2, nextPeriodStructure: 'none' });
        // Customize the source rows
        const pgCurrent = setup.periodGradesCurrent.get(setup.grades[0].id);
        yield pgCurrent.update({ color: '#112233' });
        const pgsSection = yield index_1.PeriodGradeSection.findOne({
            where: { periodGradeId: pgCurrent.id, sectionId: setup.sections[0].id },
        });
        yield pgsSection.update({ color: '#445566' });
        const pgsCurrent = setup.periodGradeSubjectsCurrent.get(`${setup.grades[0].id}:${setup.subjects[0].id}`);
        yield pgsCurrent.update({
            includeInAverage: false,
            notRepairable: true,
            weeklyBlocks: 4,
            order: 7,
        });
        const t = yield database_1.default.transaction();
        yield (0, schoolPeriodService_1.clonePeriodStructure)(setup.currentPeriod.id, setup.nextPeriod.id, t);
        yield t.commit();
        const pgNext = yield index_1.PeriodGrade.findOne({
            where: { schoolPeriodId: setup.nextPeriod.id, gradeId: setup.grades[0].id },
        });
        expect(pgNext).not.toBeNull();
        expect(pgNext.color).toBe('#112233');
        const sectionNext = yield index_1.PeriodGradeSection.findOne({
            where: { periodGradeId: pgNext.id, sectionId: setup.sections[0].id },
        });
        expect(sectionNext.color).toBe('#445566');
        const pgsNext = yield index_1.PeriodGradeSubject.findOne({
            where: { periodGradeId: pgNext.id, subjectId: setup.subjects[0].id },
        });
        expect(pgsNext).not.toBeNull();
        expect(pgsNext.includeInAverage).toBe(false);
        expect(pgsNext.notRepairable).toBe(true);
        expect(pgsNext.weeklyBlocks).toBe(4);
        expect(pgsNext.order).toBe(7);
    }));
    // E4: teacher assignments are copied to the new periodGradeSubject/section.
    it('E4: copies teacher assignments to the new period structure', () => __awaiter(void 0, void 0, void 0, function* () {
        setup = yield (0, periodClosureTestHelper_1.createFullClosureSetup)({ gradeCount: 1, subjectsPerGrade: 1, nextPeriodStructure: 'none' });
        const teacher = yield index_1.Person.create({
            firstName: 'Docente',
            lastName: 'Prueba',
            document: 'T-0001',
            documentType: 'Venezolano',
            birthdate: new Date('1985-05-15'),
            gender: 'F',
        });
        const pgsCurrent = setup.periodGradeSubjectsCurrent.get(`${setup.grades[0].id}:${setup.subjects[0].id}`);
        yield index_1.TeacherAssignment.create({
            teacherId: teacher.id,
            periodGradeSubjectId: pgsCurrent.id,
            sectionId: setup.sections[0].id,
        });
        const t = yield database_1.default.transaction();
        yield (0, schoolPeriodService_1.clonePeriodStructure)(setup.currentPeriod.id, setup.nextPeriod.id, t);
        yield t.commit();
        const pgNext = yield index_1.PeriodGrade.findOne({
            where: { schoolPeriodId: setup.nextPeriod.id, gradeId: setup.grades[0].id },
        });
        const pgsNext = yield index_1.PeriodGradeSubject.findOne({
            where: { periodGradeId: pgNext.id, subjectId: setup.subjects[0].id },
        });
        const newAssignment = yield index_1.TeacherAssignment.findOne({
            where: {
                periodGradeSubjectId: pgsNext.id,
                sectionId: setup.sections[0].id,
            },
        });
        expect(newAssignment).not.toBeNull();
        expect(newAssignment.teacherId).toBe(teacher.id);
    }));
    // E5: validation warns (does not block) when the next period lacks structure.
    it('E5: validateClosure warns that structure will be auto-copied', () => __awaiter(void 0, void 0, void 0, function* () {
        setup = yield (0, periodClosureTestHelper_1.createFullClosureSetup)({ gradeCount: 2, subjectsPerGrade: 1, nextPeriodStructure: 'none' });
        yield (0, periodClosureTestHelper_1.markCouncilsDone)(setup);
        const result = yield (0, periodClosureTestHelper_1.validateClosure)(setup);
        expect(result.valid).toBe(true);
        expect(result.warnings.some(w => w.includes('se copiará automáticamente'))).toBe(true);
    }));
    // Sanity: 'none' structure also skips cloning the Materia Pendiente section
    // row per grade — the MP inscription flow still creates it on demand.
    it('E6: MP inscriptions still work when next period structure was cloned', () => __awaiter(void 0, void 0, void 0, function* () {
        setup = yield (0, periodClosureTestHelper_1.createFullClosureSetup)({ gradeCount: 2, subjectsPerGrade: 4, nextPeriodStructure: 'none' });
        yield (0, periodClosureTestHelper_1.markCouncilsDone)(setup);
        // Student fails 1 of 4 subjects → materias_pendientes (max_failed_subjects=3)
        const student = yield (0, periodClosureTestHelper_1.createStudentWithGrades)(setup, 0, { 0: 15, 1: 15, 2: 15, 3: 5 });
        const result = yield (0, periodClosureTestHelper_1.executeClosure)(setup);
        expect(result.success).toBe(true);
        expect(result.stats.withPendingSubjects).toBe(1);
        expect(result.stats.pendingSubjectsCreated).toBe(1);
        // Two inscriptions: regular in grade[1] + MP in grade[0] with MP section
        const newInscriptions = yield index_1.Inscription.findAll({
            where: { personId: student.person.id, schoolPeriodId: setup.nextPeriod.id },
        });
        expect(newInscriptions.length).toBe(2);
        const regularIns = newInscriptions.find(i => i.escolaridad === 'regular');
        const mpIns = newInscriptions.find(i => i.escolaridad === 'materia_pendiente');
        expect(regularIns === null || regularIns === void 0 ? void 0 : regularIns.gradeId).toBe(setup.grades[1].id);
        expect(mpIns === null || mpIns === void 0 ? void 0 : mpIns.gradeId).toBe(setup.grades[0].id);
        const mpSection = yield index_1.Section.findOne({ where: { name: 'MATERIA PENDIENTE' } });
        expect(mpIns === null || mpIns === void 0 ? void 0 : mpIns.sectionId).toBe(mpSection === null || mpSection === void 0 ? void 0 : mpSection.id);
    }));
});
