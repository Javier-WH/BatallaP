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
// Helper: find the new inscription for a person in the next period
function findNextInscription(personId, nextPeriodId) {
    return __awaiter(this, void 0, void 0, function* () {
        return index_1.Inscription.findOne({
            where: { personId, schoolPeriodId: nextPeriodId },
        });
    });
}
function findNextInscriptions(personId, nextPeriodId) {
    return __awaiter(this, void 0, void 0, function* () {
        return index_1.Inscription.findAll({
            where: { personId, schoolPeriodId: nextPeriodId },
        });
    });
}
function getOutcome(inscriptionId) {
    return __awaiter(this, void 0, void 0, function* () {
        return index_1.StudentPeriodOutcome.findOne({ where: { inscriptionId } });
    });
}
function getPendingSubjectsForInscription(inscriptionId) {
    return __awaiter(this, void 0, void 0, function* () {
        return index_1.PendingSubject.findAll({ where: { newInscriptionId: inscriptionId } });
    });
}
describe('Period Closure Rules — Integration Tests', () => {
    let setup;
    // Most tests use a standard setup with 2 grades and 3 subjects
    function standardSetup() {
        return __awaiter(this, arguments, void 0, function* (gradeCount = 2, subjectsPerGrade = 3) {
            const s = yield (0, periodClosureTestHelper_1.createFullClosureSetup)({ gradeCount, subjectsPerGrade });
            yield (0, periodClosureTestHelper_1.markCouncilsDone)(s);
            return s;
        });
    }
    // ============================================================
    // R1 — Prerrequisitos del cierre
    // ============================================================
    describe('R1 — Prerrequisitos del cierre', () => {
        it('R1a: falla si los lapsos no están bloqueados ni cerrados', () => __awaiter(void 0, void 0, void 0, function* () {
            setup = yield (0, periodClosureTestHelper_1.createFullClosureSetup)({ gradeCount: 2, subjectsPerGrade: 1 });
            yield (0, periodClosureTestHelper_1.markCouncilsDone)(setup);
            // Unblock all terms
            yield index_1.Term.update({ isBlocked: false }, { where: { schoolPeriodId: setup.currentPeriod.id } });
            const result = yield (0, periodClosureTestHelper_1.validateClosure)(setup);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('no tiene todas sus secciones cerradas'))).toBe(true);
        }));
        it('R1b: falla si hay CouncilChecklist sin completar', () => __awaiter(void 0, void 0, void 0, function* () {
            setup = yield (0, periodClosureTestHelper_1.createFullClosureSetup)({ gradeCount: 2, subjectsPerGrade: 1 });
            // Create incomplete council checklist
            yield index_1.CouncilChecklist.create({
                schoolPeriodId: setup.currentPeriod.id,
                gradeId: setup.grades[0].id,
                sectionId: setup.sections[0].id,
                termId: setup.terms[0].id,
                status: 'open',
            });
            const result = yield (0, periodClosureTestHelper_1.validateClosure)(setup);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('consejos de curso'))).toBe(true);
        }));
        it('R1c: falla si RevisionPeriod.status=open', () => __awaiter(void 0, void 0, void 0, function* () {
            setup = yield standardSetup(2, 1);
            yield index_1.RevisionPeriod.create({
                schoolPeriodId: setup.currentPeriod.id,
                status: 'open',
                maxOpportunities: 3,
                passingGrade: 10,
                currentOpportunity: 1,
            });
            const result = yield (0, periodClosureTestHelper_1.validateClosure)(setup);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('revisión'))).toBe(true);
        }));
        it('R1d: pasa si RevisionPeriod.status=pending (no se abrieron revisiones)', () => __awaiter(void 0, void 0, void 0, function* () {
            setup = yield standardSetup(2, 1);
            // No revision period created — should pass
            const result = yield (0, periodClosureTestHelper_1.validateClosure)(setup);
            expect(result.valid).toBe(true);
        }));
    });
    // ============================================================
    // R2 — Aprobados → siguiente grado
    // ============================================================
    describe('R2 — Aprobados → siguiente grado', () => {
        it('estudiante con todas las notas ≥10 se inscribe como regular en grado siguiente', () => __awaiter(void 0, void 0, void 0, function* () {
            setup = yield standardSetup(2, 3);
            // Student in grade 0 (1er año), all subjects approved (15, 14, 12)
            const student = yield (0, periodClosureTestHelper_1.createStudentWithGrades)(setup, 0, { 0: 15, 1: 14, 2: 12 });
            const result = yield (0, periodClosureTestHelper_1.executeClosure)(setup);
            expect(result.success).toBe(true);
            expect(result.stats.approved).toBe(1);
            // New inscription in next period, grade 1 (2do año), regular
            const newInsc = yield findNextInscription(student.person.id, setup.nextPeriod.id);
            expect(newInsc).not.toBeNull();
            expect(newInsc.gradeId).toBe(setup.grades[1].id);
            expect(newInsc.escolaridad).toBe('regular');
            expect(newInsc.isRepeater).toBe(false);
            // No pending subjects
            const pendings = yield getPendingSubjectsForInscription(newInsc.id);
            expect(pendings.length).toBe(0);
            // Outcome: aprobado
            const outcome = yield getOutcome(student.inscription.id);
            expect(outcome).not.toBeNull();
            expect(outcome.status).toBe('aprobado');
            expect(outcome.graduatedAt).toBeNull();
        }));
    });
    // ============================================================
    // R3 — Reprobados > máximo → repitiente
    // ============================================================
    describe('R3 — Reprobados > máximo → repitiente', () => {
        it('estudiante con 4 reprobadas (max=3) repite como repitiente en mismo grado', () => __awaiter(void 0, void 0, void 0, function* () {
            setup = yield standardSetup(2, 5);
            // Student in grade 0, 4 subjects failed, 1 approved
            const student = yield (0, periodClosureTestHelper_1.createStudentWithGrades)(setup, 0, { 0: 8, 1: 7, 2: 6, 3: 5, 4: 15 });
            const result = yield (0, periodClosureTestHelper_1.executeClosure)(setup);
            expect(result.success).toBe(true);
            expect(result.stats.failed).toBe(1);
            // New inscription in next period, same grade, repitiente
            const newInsc = yield findNextInscription(student.person.id, setup.nextPeriod.id);
            expect(newInsc).not.toBeNull();
            expect(newInsc.gradeId).toBe(setup.grades[0].id);
            expect(newInsc.escolaridad).toBe('repitiente');
            expect(newInsc.isRepeater).toBe(true);
            // No pending subjects (repitiente retakes all subjects)
            const pendings = yield getPendingSubjectsForInscription(newInsc.id);
            expect(pendings.length).toBe(0);
            // Outcome: reprobado
            const outcome = yield getOutcome(student.inscription.id);
            expect(outcome.status).toBe('reprobado');
        }));
    });
    // ============================================================
    // R4 — Reprobados ≤ máximo → siguiente grado + MP
    // ============================================================
    describe('R4 — Reprobados ≤ máximo → siguiente grado + MP', () => {
        it('estudiante con 2 reprobadas (max=3) pasa a siguiente grado con materias pendientes', () => __awaiter(void 0, void 0, void 0, function* () {
            setup = yield standardSetup(2, 3);
            // Student in grade 0, 2 failed, 1 approved
            const student = yield (0, periodClosureTestHelper_1.createStudentWithGrades)(setup, 0, { 0: 8, 1: 7, 2: 15 });
            const result = yield (0, periodClosureTestHelper_1.executeClosure)(setup);
            expect(result.success).toBe(true);
            expect(result.stats.withPendingSubjects).toBe(1);
            // Should have TWO inscriptions in next period:
            // 1. regular in grade 1 (2do año)
            // 2. materia_pendiente in grade 0 (1er año)
            const newInscs = yield findNextInscriptions(student.person.id, setup.nextPeriod.id);
            expect(newInscs.length).toBe(2);
            const regularInsc = newInscs.find(i => i.escolaridad === 'regular');
            const mpInsc = newInscs.find(i => i.escolaridad === 'materia_pendiente');
            expect(regularInsc).toBeDefined();
            expect(regularInsc.gradeId).toBe(setup.grades[1].id);
            expect(mpInsc).toBeDefined();
            expect(mpInsc.gradeId).toBe(setup.grades[0].id);
            // 2 pending subjects in MP inscription
            const pendings = yield getPendingSubjectsForInscription(mpInsc.id);
            expect(pendings.length).toBe(2);
            expect(pendings.every(p => p.status === 'pendiente')).toBe(true);
            // Outcome: materias_pendientes
            const outcome = yield getOutcome(student.inscription.id);
            expect(outcome.status).toBe('materias_pendientes');
        }));
    });
    // ============================================================
    // R5 — Reprueba materia pendiente → REZAGADO
    // ============================================================
    describe('R5 — Reprueba materia pendiente → REZAGADO', () => {
        it('R5a: estudiante con 1 pendiente reprobada → repitiente en grado actual + MP + isRezagado', () => __awaiter(void 0, void 0, void 0, function* () {
            setup = yield standardSetup(2, 3);
            // Student in grade 1 (2do año), subject 0 reprobada in his current grade
            // and an unresolved pending subject coursed in grade 0 (1er año)
            const student2 = yield (0, periodClosureTestHelper_1.createStudentWithGrades)(setup, 1, { 0: 8, 1: 15, 2: 14 });
            // The pending subject lives in a separate MP inscription in its origin grade
            yield (0, periodClosureTestHelper_1.createSeparateMPInscription)(setup, student2, [0], { gradeIndex: 0 });
            const result = yield (0, periodClosureTestHelper_1.executeClosure)(setup);
            expect(result.success).toBe(true);
            // Outcome: reprobado with isRezagado
            const outcome = yield getOutcome(student2.inscription.id);
            expect(outcome.status).toBe('reprobado');
            expect(outcome.metadata).toHaveProperty('isRezagado', true);
            // New inscription: repitiente in grade 1 (current grade, not grade 0)
            const newInscs = yield findNextInscriptions(student2.person.id, setup.nextPeriod.id);
            const repitienteInsc = newInscs.find(i => i.escolaridad === 'repitiente');
            expect(repitienteInsc).toBeDefined();
            expect(repitienteInsc.gradeId).toBe(setup.grades[1].id); // current grade
            expect(repitienteInsc.isRepeater).toBe(true);
            // MP inscription with the reprobada pending subject, in the ORIGIN grade
            const mpInsc = newInscs.find(i => i.escolaridad === 'materia_pendiente');
            expect(mpInsc).toBeDefined();
            expect(mpInsc.gradeId).toBe(setup.grades[0].id); // origin grade of the MP
            const pendings = yield getPendingSubjectsForInscription(mpInsc.id);
            expect(pendings.length).toBe(1);
            expect(pendings[0].subjectId).toBe(setup.subjects[0].id);
        }));
        it('R5b: estudiante con 1 pendiente reprobada + 1 aprobada → aprobada se marca, reprobada se arrastra', () => __awaiter(void 0, void 0, void 0, function* () {
            setup = yield standardSetup(2, 3);
            // Student in grade 1 with 2 pending subjects coursed in grade 0:
            // subject 0 pendiente (unresolved → failed at closure),
            // subject 1 already aprobada (student passed the encounter)
            const student = yield (0, periodClosureTestHelper_1.createStudentWithGrades)(setup, 1, { 0: 8, 1: 15, 2: 14 });
            const { mpInscription: oldMpInsc, pendingSubjects: oldPendingsMap } = yield (0, periodClosureTestHelper_1.createSeparateMPInscription)(setup, student, [0, 1], { gradeIndex: 0 });
            yield oldPendingsMap.get(1).update({ status: 'aprobada' });
            const result = yield (0, periodClosureTestHelper_1.executeClosure)(setup);
            expect(result.success).toBe(true);
            // The approved pending subject should still be 'aprobada'
            const oldPendings = yield index_1.PendingSubject.findAll({
                where: { newInscriptionId: oldMpInsc.id },
            });
            const approvedOld = oldPendings.find(p => p.subjectId === setup.subjects[1].id);
            expect(approvedOld).toBeDefined();
            expect(approvedOld.status).toBe('aprobada');
            // Check new MP inscription in the ORIGIN grade (grade 0) has only the reprobada
            const newInscs = yield findNextInscriptions(student.person.id, setup.nextPeriod.id);
            const mpInsc = newInscs.find(i => i.escolaridad === 'materia_pendiente');
            expect(mpInsc).toBeDefined();
            expect(mpInsc.gradeId).toBe(setup.grades[0].id);
            const newPendings = yield getPendingSubjectsForInscription(mpInsc.id);
            expect(newPendings.length).toBe(1);
            expect(newPendings[0].subjectId).toBe(setup.subjects[0].id); // only the reprobada
        }));
        it('R5c: estudiante con pendiente reprobada pero aprobó todas las del grado actual → aún así repite (rezagado)', () => __awaiter(void 0, void 0, void 0, function* () {
            setup = yield standardSetup(2, 3);
            // Student in grade 1, all regular subjects approved, but the pending
            // subject coursed in grade 0 remains unresolved
            const student = yield (0, periodClosureTestHelper_1.createStudentWithGrades)(setup, 1, { 0: 15, 1: 15, 2: 14 });
            yield (0, periodClosureTestHelper_1.createSeparateMPInscription)(setup, student, [0], { gradeIndex: 0 });
            const result = yield (0, periodClosureTestHelper_1.executeClosure)(setup);
            expect(result.success).toBe(true);
            const outcome = yield getOutcome(student.inscription.id);
            expect(outcome.status).toBe('reprobado');
            expect(outcome.metadata).toHaveProperty('isRezagado', true);
            // Still repeats current grade, and the MP carries over in grade 0
            const newInscs = yield findNextInscriptions(student.person.id, setup.nextPeriod.id);
            const repitienteInsc = newInscs.find(i => i.escolaridad === 'repitiente');
            expect(repitienteInsc).toBeDefined();
            expect(repitienteInsc.gradeId).toBe(setup.grades[1].id);
            const mpInsc = newInscs.find(i => i.escolaridad === 'materia_pendiente');
            expect(mpInsc).toBeDefined();
            expect(mpInsc.gradeId).toBe(setup.grades[0].id);
        }));
        it('R5d: rezagado repite en las mismas condiciones — MP queda en el grado origen, sin MP del grado actual', () => __awaiter(void 0, void 0, void 0, function* () {
            setup = yield standardSetup(3, 3);
            // Student in grade 1 (2do año) with an unresolved MP coursed in grade 0
            // (1er año) AND two failed subjects in his current grade.
            // He repeats 2do año under the same conditions: repitiente in grade 1
            // + MP of grade 0 only. The failed current-grade subjects are retaken
            // inside the repitiente inscription, never as materia pendiente.
            const student = yield (0, periodClosureTestHelper_1.createStudentWithGrades)(setup, 1, { 0: 8, 1: 7, 2: 15 });
            yield (0, periodClosureTestHelper_1.createSeparateMPInscription)(setup, student, [1], { gradeIndex: 0 });
            const result = yield (0, periodClosureTestHelper_1.executeClosure)(setup);
            expect(result.success).toBe(true);
            expect(result.stats.failed).toBe(1);
            const outcome = yield getOutcome(student.inscription.id);
            expect(outcome.status).toBe('reprobado');
            expect(outcome.metadata).toHaveProperty('isRezagado', true);
            const newInscs = yield findNextInscriptions(student.person.id, setup.nextPeriod.id);
            // Repitiente in grade 1 with ALL subjects of the grade
            const repitienteInsc = newInscs.find(i => i.escolaridad === 'repitiente');
            expect(repitienteInsc).toBeDefined();
            expect(repitienteInsc.gradeId).toBe(setup.grades[1].id);
            const repitienteSubjects = yield index_1.InscriptionSubject.findAll({
                where: { inscriptionId: repitienteInsc.id },
            });
            expect(repitienteSubjects.length).toBe(3);
            // Exactly one MP inscription, in the ORIGIN grade (grade 0)
            const mpInscs = newInscs.filter(i => i.escolaridad === 'materia_pendiente');
            expect(mpInscs.length).toBe(1);
            expect(mpInscs[0].gradeId).toBe(setup.grades[0].id);
            // It carries only the unresolved MP subject — the failed current-grade
            // subjects (0 and 1 of grade 1) are NOT materia pendiente
            const pendings = yield getPendingSubjectsForInscription(mpInscs[0].id);
            expect(pendings.length).toBe(1);
            expect(pendings[0].subjectId).toBe(setup.subjects[1].id);
        }));
    });
    describe('R6 — Aprueba pendientes + aprueba grado actual → siguiente grado', () => {
        it('estudiante aprueba todas las pendientes y todas las del grado → regular en siguiente grado', () => __awaiter(void 0, void 0, void 0, function* () {
            setup = yield standardSetup(3, 3);
            // Student in grade 1 (2do año) with 2 pending subjects, both approved
            const student = yield (0, periodClosureTestHelper_1.createStudentWithGrades)(setup, 1, { 0: 15, 1: 14, 2: 12 });
            // Both MPs already aprobada (student passed the encounters)
            yield (0, periodClosureTestHelper_1.createPendingSubjectForStudent)(setup, student, 0, setup.currentPeriod.id, 'aprobada');
            yield (0, periodClosureTestHelper_1.createPendingSubjectForStudent)(setup, student, 1, setup.currentPeriod.id, 'aprobada');
            const result = yield (0, periodClosureTestHelper_1.executeClosure)(setup);
            expect(result.success).toBe(true);
            expect(result.stats.approved).toBe(1);
            // Outcome: aprobado
            const outcome = yield getOutcome(student.inscription.id);
            expect(outcome.status).toBe('aprobado');
            // Both pending subjects marked as aprobada
            const oldPendings = yield index_1.PendingSubject.findAll({
                where: { newInscriptionId: student.inscription.id },
            });
            expect(oldPendings.every(p => p.status === 'aprobada')).toBe(true);
            // New inscription: regular in grade 2 (3er año)
            const newInsc = yield findNextInscription(student.person.id, setup.nextPeriod.id);
            expect(newInsc).not.toBeNull();
            expect(newInsc.gradeId).toBe(setup.grades[2].id);
            expect(newInsc.escolaridad).toBe('regular');
            // No MP inscription
            const allNewInscs = yield findNextInscriptions(student.person.id, setup.nextPeriod.id);
            expect(allNewInscs.length).toBe(1);
        }));
    });
    // ============================================================
    // R7 — Aprueba pendientes + reprueba ≤ max del grado actual → siguiente grado + nuevas MP
    // ============================================================
    describe('R7 — Aprueba pendientes + reprueba ≤ max → siguiente grado + nuevas MP', () => {
        it('estudiante aprueba pendientes, reprueba 2 del grado → regular en siguiente + MP con reprobadas', () => __awaiter(void 0, void 0, void 0, function* () {
            setup = yield standardSetup(3, 3);
            // Student in grade 1 with 1 pending subject (approved), 2 regular subjects reprobadas
            const student = yield (0, periodClosureTestHelper_1.createStudentWithGrades)(setup, 1, { 0: 15, 1: 8, 2: 7 });
            // Pending subject is subject 0 (already aprobada — student passed the encounter)
            yield (0, periodClosureTestHelper_1.createPendingSubjectForStudent)(setup, student, 0, setup.currentPeriod.id, 'aprobada');
            const result = yield (0, periodClosureTestHelper_1.executeClosure)(setup);
            expect(result.success).toBe(true);
            expect(result.stats.withPendingSubjects).toBe(1);
            // Old pending marked as aprobada
            const oldPendings = yield index_1.PendingSubject.findAll({
                where: { newInscriptionId: student.inscription.id },
            });
            expect(oldPendings[0].status).toBe('aprobada');
            // New inscriptions: regular in grade 2 + MP in grade 1
            const newInscs = yield findNextInscriptions(student.person.id, setup.nextPeriod.id);
            const regularInsc = newInscs.find(i => i.escolaridad === 'regular');
            const mpInsc = newInscs.find(i => i.escolaridad === 'materia_pendiente');
            expect(regularInsc).toBeDefined();
            expect(regularInsc.gradeId).toBe(setup.grades[2].id);
            expect(mpInsc).toBeDefined();
            expect(mpInsc.gradeId).toBe(setup.grades[1].id);
            // 2 pending subjects (the reprobadas from grade actual)
            const newPendings = yield getPendingSubjectsForInscription(mpInsc.id);
            expect(newPendings.length).toBe(2);
        }));
    });
    // ============================================================
    // R8 — 5to año aprueba todo → egresado
    // ============================================================
    describe('R8 — Último grado aprueba todo → egresado', () => {
        it('estudiante en último grado con todas aprobadas → graduatedAt, sin nueva inscripción', () => __awaiter(void 0, void 0, void 0, function* () {
            // 1 grade only (it's the last), with autoGraduate=true
            setup = yield standardSetup(1, 3);
            // Student in grade 0 (the only grade = last grade), all approved
            const student = yield (0, periodClosureTestHelper_1.createStudentWithGrades)(setup, 0, { 0: 15, 1: 14, 2: 12 });
            const result = yield (0, periodClosureTestHelper_1.executeClosure)(setup);
            expect(result.success).toBe(true);
            expect(result.stats.approved).toBe(1);
            // Outcome: aprobado with graduatedAt
            const outcome = yield getOutcome(student.inscription.id);
            expect(outcome.status).toBe('aprobado');
            expect(outcome.graduatedAt).not.toBeNull();
            // NO new inscription in next period
            const newInscs = yield findNextInscriptions(student.person.id, setup.nextPeriod.id);
            expect(newInscs.length).toBe(0);
        }));
    });
    // ============================================================
    // R9 — 5to año reprueba → repitiente
    // ============================================================
    describe('R9 — Último grado reprueba → repitiente', () => {
        it('R9a: estudiante en último grado con 1 reprobada (≤max) → repitiente con todas las materias', () => __awaiter(void 0, void 0, void 0, function* () {
            // 1 grade only (last grade), 3 subjects
            setup = yield standardSetup(1, 3);
            const student = yield (0, periodClosureTestHelper_1.createStudentWithGrades)(setup, 0, { 0: 8, 1: 15, 2: 14 });
            const result = yield (0, periodClosureTestHelper_1.executeClosure)(setup);
            expect(result.success).toBe(true);
            expect(result.stats.failed).toBe(1);
            // Outcome: reprobado (forced by R9 logic)
            const outcome = yield getOutcome(student.inscription.id);
            expect(outcome.status).toBe('reprobado');
            expect(outcome.graduatedAt).toBeNull();
            // New inscription: repitiente in same grade
            const newInscs = yield findNextInscriptions(student.person.id, setup.nextPeriod.id);
            const repitienteInsc = newInscs.find(i => i.escolaridad === 'repitiente');
            expect(repitienteInsc).toBeDefined();
            expect(repitienteInsc.gradeId).toBe(setup.grades[0].id);
            expect(repitienteInsc.isRepeater).toBe(true);
            // Should have all 3 subjects as InscriptionSubject (repitiente takes all)
            const { InscriptionSubject } = yield Promise.resolve().then(() => __importStar(require('../../models/index.js')));
            const insSubs = yield InscriptionSubject.findAll({
                where: { inscriptionId: repitienteInsc.id },
            });
            expect(insSubs.length).toBe(3);
        }));
        it('R9b: estudiante en último grado con 4 reprobadas (>max) → repitiente', () => __awaiter(void 0, void 0, void 0, function* () {
            setup = yield standardSetup(1, 5);
            const student = yield (0, periodClosureTestHelper_1.createStudentWithGrades)(setup, 0, { 0: 8, 1: 7, 2: 6, 3: 5, 4: 15 });
            const result = yield (0, periodClosureTestHelper_1.executeClosure)(setup);
            expect(result.success).toBe(true);
            const outcome = yield getOutcome(student.inscription.id);
            expect(outcome.status).toBe('reprobado');
            const newInscs = yield findNextInscriptions(student.person.id, setup.nextPeriod.id);
            const repitienteInsc = newInscs.find(i => i.escolaridad === 'repitiente');
            expect(repitienteInsc).toBeDefined();
            expect(repitienteInsc.gradeId).toBe(setup.grades[0].id);
        }));
        it('R9c: estudiante en último grado con pendiente reprobada → repitiente + isRezagado + MP arrastrada', () => __awaiter(void 0, void 0, void 0, function* () {
            setup = yield standardSetup(1, 3);
            const student = yield (0, periodClosureTestHelper_1.createStudentWithGrades)(setup, 0, { 0: 8, 1: 15, 2: 14 });
            yield (0, periodClosureTestHelper_1.createPendingSubjectForStudent)(setup, student, 0, setup.currentPeriod.id);
            const result = yield (0, periodClosureTestHelper_1.executeClosure)(setup);
            expect(result.success).toBe(true);
            const outcome = yield getOutcome(student.inscription.id);
            expect(outcome.status).toBe('reprobado');
            expect(outcome.metadata).toHaveProperty('isRezagado', true);
            // Repitiente inscription carries the unresolved pending subject. Since
            // the pending belongs to the same grade he repeats, it is tracked on the
            // repitiente inscription — a student can never have a materia_pendiente
            // inscription of the grade he is coursing.
            const newInscs = yield findNextInscriptions(student.person.id, setup.nextPeriod.id);
            const repitienteInsc = newInscs.find(i => i.escolaridad === 'repitiente');
            expect(repitienteInsc).toBeDefined();
            const mpInsc = newInscs.find(i => i.escolaridad === 'materia_pendiente');
            expect(mpInsc).toBeUndefined();
            const pendings = yield getPendingSubjectsForInscription(repitienteInsc.id);
            expect(pendings.length).toBe(1);
            expect(pendings[0].subjectId).toBe(setup.subjects[0].id);
        }));
    });
    // ============================================================
    // R10 — Excluir estudiantes retirados
    // ============================================================
    describe('R10 — Excluir estudiantes retirados', () => {
        it('R10a: estudiante con withdrawnAt no null → no se procesa ni se inscribe', () => __awaiter(void 0, void 0, void 0, function* () {
            setup = yield standardSetup(2, 3);
            const student = yield (0, periodClosureTestHelper_1.createStudentWithGrades)(setup, 0, { 0: 15, 1: 14, 2: 12 });
            // Mark as withdrawn
            yield student.inscription.update({ withdrawnAt: new Date() });
            const result = yield (0, periodClosureTestHelper_1.executeClosure)(setup);
            expect(result.success).toBe(true);
            expect(result.stats.totalStudents).toBe(0);
            // No outcome
            const outcome = yield getOutcome(student.inscription.id);
            expect(outcome).toBeNull();
            // No new inscription
            const newInscs = yield findNextInscriptions(student.person.id, setup.nextPeriod.id);
            expect(newInscs.length).toBe(0);
        }));
        it('R10b: estudiante con withdrawnAt=null → se procesa normalmente', () => __awaiter(void 0, void 0, void 0, function* () {
            setup = yield standardSetup(2, 3);
            const student = yield (0, periodClosureTestHelper_1.createStudentWithGrades)(setup, 0, { 0: 15, 1: 14, 2: 12 });
            // withdrawnAt is null by default
            const result = yield (0, periodClosureTestHelper_1.executeClosure)(setup);
            expect(result.success).toBe(true);
            expect(result.stats.totalStudents).toBe(1);
            expect(result.stats.approved).toBe(1);
            const newInsc = yield findNextInscription(student.person.id, setup.nextPeriod.id);
            expect(newInsc).not.toBeNull();
        }));
    });
    // ============================================================
    // Post-closure verification
    // ============================================================
    describe('Post-closure state', () => {
        it('período cerrado cambia a historico, siguiente cambia a activo', () => __awaiter(void 0, void 0, void 0, function* () {
            setup = yield standardSetup(2, 3);
            yield (0, periodClosureTestHelper_1.createStudentWithGrades)(setup, 0, { 0: 15, 1: 14, 2: 12 });
            const result = yield (0, periodClosureTestHelper_1.executeClosure)(setup);
            expect(result.success).toBe(true);
            yield setup.currentPeriod.reload();
            yield setup.nextPeriod.reload();
            expect(setup.currentPeriod.status).toBe('historico');
            expect(setup.nextPeriod.status).toBe('activo');
        }));
        it('PeriodClosure.status = closed con stats', () => __awaiter(void 0, void 0, void 0, function* () {
            setup = yield standardSetup(2, 3);
            yield (0, periodClosureTestHelper_1.createStudentWithGrades)(setup, 0, { 0: 15, 1: 14, 2: 12 });
            const result = yield (0, periodClosureTestHelper_1.executeClosure)(setup);
            expect(result.success).toBe(true);
            expect(result.closureId).toBeGreaterThan(0);
            const closure = yield index_1.PeriodClosure.findByPk(result.closureId);
            expect(closure).not.toBeNull();
            expect(closure.status).toBe('closed');
            expect(closure.finishedAt).not.toBeNull();
        }));
    });
});
