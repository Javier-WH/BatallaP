"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
require("../setup");
const index_1 = require("../../models/index.js");
const periodClosureTestHelper_1 = require("../helpers/periodClosureTestHelper");
const finalGradeCalculator_1 = require("../../services/finalGradeCalculator.js");
const periodClosurePreview_1 = require("../../services/periodClosurePreview.js");
function findNextInscriptions(personId, nextPeriodId) {
    return __awaiter(this, void 0, void 0, function* () {
        return index_1.Inscription.findAll({ where: { personId, schoolPeriodId: nextPeriodId } });
    });
}
function getOutcome(inscriptionId) {
    return __awaiter(this, void 0, void 0, function* () {
        return index_1.StudentPeriodOutcome.findOne({ where: { inscriptionId } });
    });
}
describe('Closure MP + Repair Sequence — Integration Tests', () => {
    let setup;
    function standardSetup() {
        return __awaiter(this, arguments, void 0, function* (gradeCount = 2, subjectsPerGrade = 3) {
            const s = yield (0, periodClosureTestHelper_1.createFullClosureSetup)({ gradeCount, subjectsPerGrade });
            yield (0, periodClosureTestHelper_1.markCouncilsDone)(s);
            return s;
        });
    }
    // ============================================================
    // Repair applies even without stored regular SubjectFinalGrade
    // ============================================================
    describe('Repair with term-grade fallback', () => {
        it('reparación aprobada se aplica aunque no exista SubjectFinalGrade regular', () => __awaiter(void 0, void 0, void 0, function* () {
            setup = yield standardSetup(2, 3);
            yield (0, periodClosureTestHelper_1.createCompletedRevisionPeriod)(setup);
            // Student in grade 0: subject 0 = 8 (reprobada), subjects 1,2 approved
            const student = yield (0, periodClosureTestHelper_1.createStudentWithGrades)(setup, 0, { 0: 8, 1: 15, 2: 14 });
            // Remove the pre-created regular SubjectFinalGrade for subject 0
            // (simulates the real pre-closure state)
            const insSub0 = student.inscriptionSubjects.get(setup.subjects[0].id);
            if (!insSub0)
                throw new Error('insSub0 not found');
            yield (0, periodClosureTestHelper_1.removeRegularFinalGrade)(insSub0.id);
            // Create a repair grade for subject 0 = 12 (approved)
            yield (0, periodClosureTestHelper_1.createRevisionGrade)(setup, insSub0.id, 1, 12, { gradedBy: setup.masterPerson.id });
            const summary = yield finalGradeCalculator_1.FinalGradeCalculator.calculateForInscriptionFast(student.inscription.id);
            // Subject 0 should be aprobada via repair, not reprobada
            const result0 = summary.subjectResults.find(r => r.subjectId === setup.subjects[0].id);
            expect(result0).toBeDefined();
            expect(result0.status).toBe('aprobada');
            expect(result0.finalScore).toBe(12);
            expect(summary.failedSubjects).toBe(0);
        }));
    });
    // ============================================================
    // Last manual repair grade takes precedence over automatic NP
    // ============================================================
    describe('Last manual repair grade precedence', () => {
        it('última nota manual prevalece sobre NP automático posterior', () => __awaiter(void 0, void 0, void 0, function* () {
            setup = yield standardSetup(2, 3);
            yield (0, periodClosureTestHelper_1.createCompletedRevisionPeriod)(setup);
            const student = yield (0, periodClosureTestHelper_1.createStudentWithGrades)(setup, 0, { 0: 8, 1: 15, 2: 14 });
            const insSub0 = student.inscriptionSubjects.get(setup.subjects[0].id);
            yield (0, periodClosureTestHelper_1.removeRegularFinalGrade)(insSub0.id);
            // Opportunity 1: manual grade = 12 (approved)
            yield (0, periodClosureTestHelper_1.createRevisionGrade)(setup, insSub0.id, 1, 12, { gradedBy: setup.masterPerson.id });
            // Opportunity 2: automatic NP (gradedBy = null, isAbsent = true)
            yield (0, periodClosureTestHelper_1.createRevisionGrade)(setup, insSub0.id, 2, 0, { gradedBy: null, isAbsent: true });
            const summary = yield finalGradeCalculator_1.FinalGradeCalculator.calculateForInscriptionFast(student.inscription.id);
            const result0 = summary.subjectResults.find(r => r.subjectId === setup.subjects[0].id);
            expect(result0).toBeDefined();
            // The last MANUAL grade (12) should prevail, not the auto-NP (0)
            expect(result0.status).toBe('aprobada');
            expect(result0.finalScore).toBe(12);
        }));
    });
    // ============================================================
    // Separate MP inscription: approved MP resolves
    // ============================================================
    describe('Separate MP inscription — approved', () => {
        it('MP aprobada en inscripción separada → estudiante promovido', () => __awaiter(void 0, void 0, void 0, function* () {
            setup = yield standardSetup(3, 3);
            // Student in grade 1 (2do año), all regular subjects approved
            const student = yield (0, periodClosureTestHelper_1.createStudentWithGrades)(setup, 1, { 0: 15, 1: 14, 2: 12 });
            // Create a separate MP inscription with subject 0 already aprobada
            yield (0, periodClosureTestHelper_1.createSeparateMPInscription)(setup, student, [0], { status: 'aprobada' });
            const result = yield (0, periodClosureTestHelper_1.executeClosure)(setup);
            expect(result.success).toBe(true);
            expect(result.stats.approved).toBe(1);
            // Outcome: aprobado (MP was approved, regular subjects all approved)
            const outcome = yield getOutcome(student.inscription.id);
            expect(outcome).not.toBeNull();
            expect(outcome.status).toBe('aprobado');
            expect(outcome.metadata).toHaveProperty('isRezagado', false);
            // New inscription: regular in grade 2 (3er año)
            const newInscs = yield findNextInscriptions(student.person.id, setup.nextPeriod.id);
            const regularInsc = newInscs.find(i => i.escolaridad === 'regular');
            expect(regularInsc).toBeDefined();
            expect(regularInsc.gradeId).toBe(setup.grades[2].id);
        }));
    });
    // ============================================================
    // Consolidated preview by person
    // ============================================================
    describe('Consolidated student preview', () => {
        it('principal + MP inscription producen una sola fila de preview', () => __awaiter(void 0, void 0, void 0, function* () {
            setup = yield standardSetup(3, 3);
            const student = yield (0, periodClosureTestHelper_1.createStudentWithGrades)(setup, 1, { 0: 15, 1: 14, 2: 12 });
            const { mpInscription } = yield (0, periodClosureTestHelper_1.createSeparateMPInscription)(setup, student, [0], { status: 'aprobada' });
            const previews = yield periodClosurePreview_1.PeriodClosurePreview.calculatePreview(setup.currentPeriod.id);
            const studentRows = previews.filter(row => { var _a, _b; return ((_b = (_a = row.inscription) === null || _a === void 0 ? void 0 : _a.student) === null || _b === void 0 ? void 0 : _b.id) === student.person.id; });
            expect(studentRows).toHaveLength(1);
            expect(studentRows[0].inscriptionId).toBe(student.inscription.id);
        }));
        it('usa la inscripción del grado superior aunque escolaridad no la identifique como principal', () => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            setup = yield standardSetup(3, 3);
            const student = yield (0, periodClosureTestHelper_1.createStudentWithGrades)(setup, 1, { 0: 15, 1: 14, 2: 12 });
            const { mpInscription } = yield (0, periodClosureTestHelper_1.createSeparateMPInscription)(setup, student, [0], { status: 'aprobada' });
            // Simulate the real data shape: the lower-grade MP exists and the
            // higher-grade inscription is the current one, regardless of escolaridad.
            yield mpInscription.update({ gradeId: setup.grades[0].id });
            yield student.inscription.update({ escolaridad: 'materia_pendiente' });
            const validation = yield (0, periodClosureTestHelper_1.validateClosure)(setup);
            expect(validation.warnings).toHaveLength(0);
            const previews = yield periodClosurePreview_1.PeriodClosurePreview.calculatePreview(setup.currentPeriod.id);
            const studentPreview = previews.find(row => { var _a, _b; return ((_b = (_a = row.inscription) === null || _a === void 0 ? void 0 : _a.student) === null || _b === void 0 ? void 0 : _b.id) === student.person.id; });
            expect(studentPreview).toBeDefined();
            expect(studentPreview.inscriptionId).toBe(student.inscription.id);
            expect((_a = studentPreview.inscription.grade) === null || _a === void 0 ? void 0 : _a.id).toBe(setup.grades[1].id);
        }));
    });
    // ============================================================
    // Separate MP inscription: unresolved MP → rezagado
    // ============================================================
    describe('Separate MP inscription — unresolved → rezagado', () => {
        it('MP pendiente en inscripción separada → rezagado (repite grado actual)', () => __awaiter(void 0, void 0, void 0, function* () {
            setup = yield standardSetup(3, 3);
            // Student in grade 1, all regular subjects approved
            const student = yield (0, periodClosureTestHelper_1.createStudentWithGrades)(setup, 1, { 0: 15, 1: 14, 2: 12 });
            // Create a separate MP inscription in the ORIGIN grade (grade 0) with
            // subject 0 still pendiente — mirrors production, where MP subjects
            // live in the grade where they are coursed.
            yield (0, periodClosureTestHelper_1.createSeparateMPInscription)(setup, student, [0], { status: 'pendiente', gradeIndex: 0 });
            const result = yield (0, periodClosureTestHelper_1.executeClosure)(setup);
            expect(result.success).toBe(true);
            // Outcome: reprobado with isRezagado
            const outcome = yield getOutcome(student.inscription.id);
            expect(outcome).not.toBeNull();
            expect(outcome.status).toBe('reprobado');
            expect(outcome.metadata).toHaveProperty('isRezagado', true);
            // New inscription: repitiente in grade 1 (current grade)
            const newInscs = yield findNextInscriptions(student.person.id, setup.nextPeriod.id);
            const repitienteInsc = newInscs.find(i => i.escolaridad === 'repitiente');
            expect(repitienteInsc).toBeDefined();
            expect(repitienteInsc.gradeId).toBe(setup.grades[1].id);
            // The carried MP inscription is recreated in the ORIGIN grade (grade 0),
            // never in the grade the student is enrolled in.
            const mpInsc = newInscs.find(i => i.escolaridad === 'materia_pendiente');
            expect(mpInsc).toBeDefined();
            expect(mpInsc.gradeId).toBe(setup.grades[0].id);
            const pendings = yield index_1.PendingSubject.findAll({
                where: { newInscriptionId: mpInsc.id },
            });
            expect(pendings.length).toBe(1);
            expect(pendings[0].subjectId).toBe(setup.subjects[0].id);
        }));
    });
    // ============================================================
    // MP-only inscription is processed as a student fallback
    // ============================================================
    describe('MP-only inscription', () => {
        it('estudiante con solo inscripción MP → se muestra y se procesa', () => __awaiter(void 0, void 0, void 0, function* () {
            setup = yield standardSetup(2, 3);
            // Create a student with ONLY an MP inscription (no regular/repeater).
            const { Person } = yield Promise.resolve().then(() => __importStar(require('../../models/index.js')));
            const orphanPerson = yield Person.create({
                firstName: 'Orphan',
                lastName: 'Test',
                document: `ORPH${Date.now()}`,
                documentType: 'Venezolano',
                birthdate: new Date('2010-01-01'),
                gender: 'M',
            });
            const [mpSection] = yield (yield Promise.resolve().then(() => __importStar(require('../../models/index.js')))).Section.findOrCreate({
                where: { name: 'Materia Pendiente' },
                defaults: { name: 'Materia Pendiente' },
            });
            const mpInscription = yield index_1.Inscription.create({
                personId: orphanPerson.id,
                schoolPeriodId: setup.currentPeriod.id,
                gradeId: setup.grades[0].id,
                sectionId: mpSection.id,
                escolaridad: 'materia_pendiente',
                originPeriodId: setup.currentPeriod.id,
                isRepeater: false,
            });
            yield index_1.PendingSubject.create({
                newInscriptionId: mpInscription.id,
                subjectId: setup.subjects[0].id,
                originPeriodId: setup.currentPeriod.id,
                status: 'pendiente',
            });
            const validation = yield (0, periodClosureTestHelper_1.validateClosure)(setup);
            expect(validation.warnings).toHaveLength(1);
            expect(validation.warnings[0]).toContain('ORPHAN TEST');
            expect(validation.warnings[0]).toContain(`Cédula: ORPH`);
            expect(validation.warnings[0]).toContain('sección de materia_pendiente');
            expect(validation.warnings[0]).toContain('no tiene otra inscripción activa');
            const result = yield (0, periodClosureTestHelper_1.executeClosure)(setup);
            // Closure should proceed and process the MP-only student once
            expect(result.success).toBe(true);
            expect(result.stats.totalStudents).toBe(1);
            const newInscs = yield findNextInscriptions(orphanPerson.id, setup.nextPeriod.id);
            expect(newInscs.length).toBe(1);
        }));
    });
    // ============================================================
    // Preview does not persist StudentPeriodOutcome
    // ============================================================
    describe('Preview non-persistence', () => {
        it('preview no crea ni modifica StudentPeriodOutcome', () => __awaiter(void 0, void 0, void 0, function* () {
            setup = yield standardSetup(2, 3);
            const student = yield (0, periodClosureTestHelper_1.createStudentWithGrades)(setup, 0, { 0: 15, 1: 14, 2: 12 });
            // Count outcomes before preview
            const outcomesBefore = yield index_1.StudentPeriodOutcome.count();
            const previews = yield periodClosurePreview_1.PeriodClosurePreview.calculatePreview(setup.currentPeriod.id);
            // Count outcomes after preview — should be unchanged
            const outcomesAfter = yield index_1.StudentPeriodOutcome.count();
            expect(outcomesAfter).toBe(outcomesBefore);
            // Preview should still return correct data
            const studentPreview = previews.find(p => p.inscriptionId === student.inscription.id);
            expect(studentPreview).toBeDefined();
            expect(studentPreview.status).toBe('aprobado');
        }));
    });
    // ============================================================
    // Preview and execution produce identical classification
    // ============================================================
    describe('Preview vs execution consistency', () => {
        it('preview y ejecución producen la misma clasificación', () => __awaiter(void 0, void 0, void 0, function* () {
            setup = yield standardSetup(2, 3);
            // Student with 2 failed subjects (≤ max=3) → materias_pendientes
            const student = yield (0, periodClosureTestHelper_1.createStudentWithGrades)(setup, 0, { 0: 8, 1: 7, 2: 15 });
            const previews = yield periodClosurePreview_1.PeriodClosurePreview.calculatePreview(setup.currentPeriod.id);
            const studentPreview = previews.find(p => p.inscriptionId === student.inscription.id);
            expect(studentPreview).toBeDefined();
            expect(studentPreview.status).toBe('materias_pendientes');
            const result = yield (0, periodClosureTestHelper_1.executeClosure)(setup);
            expect(result.success).toBe(true);
            const outcome = yield getOutcome(student.inscription.id);
            expect(outcome).not.toBeNull();
            expect(outcome.status).toBe(studentPreview.status);
        }));
    });
    // ============================================================
    // Repair approval eliminates false failure
    // ============================================================
    describe('Repair approval eliminates false failure', () => {
        it('estudiante reprobado sin reparación → aprobado con reparación', () => __awaiter(void 0, void 0, void 0, function* () {
            setup = yield standardSetup(2, 3);
            yield (0, periodClosureTestHelper_1.createCompletedRevisionPeriod)(setup);
            // Student with subject 0 = 8 (reprobada), subjects 1,2 approved
            const student = yield (0, periodClosureTestHelper_1.createStudentWithGrades)(setup, 0, { 0: 8, 1: 15, 2: 14 });
            // Without repair: should be materias_pendientes (1 failed ≤ 3)
            const previewsBefore = yield periodClosurePreview_1.PeriodClosurePreview.calculatePreview(setup.currentPeriod.id);
            const beforePreview = previewsBefore.find(p => p.inscriptionId === student.inscription.id);
            expect(beforePreview.status).toBe('materias_pendientes');
            expect(beforePreview.failedSubjects).toBe(1);
            // Now add a repair for subject 0 = 12 (approved)
            const insSub0 = student.inscriptionSubjects.get(setup.subjects[0].id);
            yield (0, periodClosureTestHelper_1.createRevisionGrade)(setup, insSub0.id, 1, 12, { gradedBy: setup.masterPerson.id });
            const previewsAfter = yield periodClosurePreview_1.PeriodClosurePreview.calculatePreview(setup.currentPeriod.id);
            const afterPreview = previewsAfter.find(p => p.inscriptionId === student.inscription.id);
            expect(afterPreview.status).toBe('aprobado');
            expect(afterPreview.failedSubjects).toBe(0);
        }));
    });
    // ============================================================
    // Subject with notRepairable + includeInAverage=false → excluded
    // ============================================================
    describe('Subject excluded by both flags (notRepairable + !includeInAverage)', () => {
        it('materia reprobada con ambos flags → no cuenta como reprobada ni genera MP', () => __awaiter(void 0, void 0, void 0, function* () {
            setup = yield standardSetup(2, 3);
            // Mark subject 0 as notRepairable AND includeInAverage=false
            const pgs0 = setup.periodGradeSubjectsCurrent.get(`${setup.grades[0].id}:${setup.subjects[0].id}`);
            expect(pgs0).toBeDefined();
            yield pgs0.update({ notRepairable: true, includeInAverage: false });
            // Student in grade 0: subject 0 = 8 (reprobada), subjects 1,2 approved
            const student = yield (0, periodClosureTestHelper_1.createStudentWithGrades)(setup, 0, { 0: 8, 1: 15, 2: 14 });
            const previews = yield periodClosurePreview_1.PeriodClosurePreview.calculatePreview(setup.currentPeriod.id);
            const studentPreview = previews.find(p => p.inscriptionId === student.inscription.id);
            expect(studentPreview).toBeDefined();
            // Subject 0 is excluded → 0 failed subjects → aprobado
            expect(studentPreview.failedSubjects).toBe(0);
            expect(studentPreview.status).toBe('aprobado');
        }));
        it('materia reprobada con ambos flags → no genera PendingSubject en el cierre', () => __awaiter(void 0, void 0, void 0, function* () {
            setup = yield standardSetup(2, 3);
            const pgs0 = setup.periodGradeSubjectsCurrent.get(`${setup.grades[0].id}:${setup.subjects[0].id}`);
            yield pgs0.update({ notRepairable: true, includeInAverage: false });
            // Student with subject 0 = 8 (reprobada), subjects 1,2 approved
            const student = yield (0, periodClosureTestHelper_1.createStudentWithGrades)(setup, 0, { 0: 8, 1: 15, 2: 14 });
            const result = yield (0, periodClosureTestHelper_1.executeClosure)(setup);
            expect(result.success).toBe(true);
            expect(result.stats.approved).toBe(1);
            // No MP inscription should be created (subject 0 is excluded)
            const newInscs = yield findNextInscriptions(student.person.id, setup.nextPeriod.id);
            const mpInsc = newInscs.find(i => i.escolaridad === 'materia_pendiente');
            expect(mpInsc).toBeUndefined();
            // Outcome: aprobado
            const outcome = yield getOutcome(student.inscription.id);
            expect(outcome.status).toBe('aprobado');
            expect(outcome.failedSubjects).toBe(0);
        }));
        it('materia reprobada con solo notRepairable (sin !includeInAverage) → SI cuenta como reprobada', () => __awaiter(void 0, void 0, void 0, function* () {
            setup = yield standardSetup(2, 3);
            // Mark subject 0 as notRepairable only (includeInAverage stays true)
            const pgs0 = setup.periodGradeSubjectsCurrent.get(`${setup.grades[0].id}:${setup.subjects[0].id}`);
            yield pgs0.update({ notRepairable: true, includeInAverage: true });
            const student = yield (0, periodClosureTestHelper_1.createStudentWithGrades)(setup, 0, { 0: 8, 1: 15, 2: 14 });
            const previews = yield periodClosurePreview_1.PeriodClosurePreview.calculatePreview(setup.currentPeriod.id);
            const studentPreview = previews.find(p => p.inscriptionId === student.inscription.id);
            // Subject 0 counts as failed (only notRepairable, not excluded from closure)
            expect(studentPreview.failedSubjects).toBe(1);
            expect(studentPreview.status).toBe('materias_pendientes');
        }));
    });
});
