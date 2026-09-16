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
const finalGradeCalculator_1 = require("../../services/finalGradeCalculator.js");
const index_1 = require("../../models/index.js");
const testData_1 = require("../helpers/testData");
const setupInscriptionWithSubject = (username) => __awaiter(void 0, void 0, void 0, function* () {
    const structure = yield (0, testData_1.createAcademicStructure)();
    const term1 = yield (0, testData_1.createTestTerm)(structure.period.id, { order: 1 });
    const term2 = yield (0, testData_1.createTestTerm)(structure.period.id, { order: 2 });
    const { person } = yield (0, testData_1.createTestUser)({ username });
    const inscription = yield (0, testData_1.createTestInscription)(person.id, structure.period.id, structure.grade.id, structure.section.id);
    const insSub = yield index_1.InscriptionSubject.create({
        inscriptionId: inscription.id,
        subjectId: structure.subject.id,
        schoolPeriodId: structure.period.id,
        gradeId: structure.grade.id,
        sectionId: structure.section.id,
    });
    return { structure, term1, term2, person, inscription, insSub };
});
const createQualification = (insSubId_1, periodGradeSubjectId_1, sectionId_1, termId_1, score_1, percentage_1, ...args_1) => __awaiter(void 0, [insSubId_1, periodGradeSubjectId_1, sectionId_1, termId_1, score_1, percentage_1, ...args_1], void 0, function* (insSubId, periodGradeSubjectId, sectionId, termId, score, percentage, isAbsent = false, remedialScore) {
    const evalPlan = yield index_1.EvaluationPlan.create({
        periodGradeSubjectId,
        sectionId,
        termId,
        description: `Eval-${termId}-${insSubId}-${score}`,
        percentage,
        date: new Date(),
    });
    return yield index_1.Qualification.create({
        evaluationPlanId: evalPlan.id,
        inscriptionSubjectId: insSubId,
        score,
        remedialScore: remedialScore !== null && remedialScore !== void 0 ? remedialScore : undefined,
        isAbsent,
    });
});
describe('FinalGradeCalculator', () => {
    describe('calculateForInscription', () => {
        it('estudiante con todas las evaluaciones ≥10 → aprobada', () => __awaiter(void 0, void 0, void 0, function* () {
            const { structure, term1, term2, inscription, insSub } = yield setupInscriptionWithSubject('fgc1');
            yield createQualification(insSub.id, structure.periodGradeSubject.id, structure.section.id, term1.id, 14, 100);
            yield createQualification(insSub.id, structure.periodGradeSubject.id, structure.section.id, term2.id, 16, 100);
            const result = yield finalGradeCalculator_1.FinalGradeCalculator.calculateForInscription(inscription.id);
            expect(result.failedSubjects).toBe(0);
            expect(result.subjectResults).toHaveLength(1);
            expect(result.subjectResults[0].status).toBe('aprobada');
            expect(result.subjectResults[0].finalScore).toBeGreaterThanOrEqual(10);
        }));
        it('estudiante con NP (isAbsent=true) → esa materia no suma al rawScore', () => __awaiter(void 0, void 0, void 0, function* () {
            const { structure, term1, term2, inscription, insSub } = yield setupInscriptionWithSubject('fgc2');
            yield createQualification(insSub.id, structure.periodGradeSubject.id, structure.section.id, term1.id, 20, 100, true);
            yield createQualification(insSub.id, structure.periodGradeSubject.id, structure.section.id, term2.id, 20, 100, true);
            const result = yield finalGradeCalculator_1.FinalGradeCalculator.calculateForInscription(inscription.id);
            expect(result.subjectResults[0].rawScore).toBe(0); // no sumó nada
            expect(result.subjectResults[0].finalScore).toBe(1); // MIN_FINAL_GRADE
            expect(result.subjectResults[0].status).toBe('reprobada');
        }));
        it('todas las evaluaciones NP/zero → finalScore=01 (MIN_FINAL_GRADE)', () => __awaiter(void 0, void 0, void 0, function* () {
            const { structure, term1, term2, inscription, insSub } = yield setupInscriptionWithSubject('fgc3');
            yield createQualification(insSub.id, structure.periodGradeSubject.id, structure.section.id, term1.id, 0, 100);
            yield createQualification(insSub.id, structure.periodGradeSubject.id, structure.section.id, term2.id, 0, 100);
            const result = yield finalGradeCalculator_1.FinalGradeCalculator.calculateForInscription(inscription.id);
            expect(result.subjectResults[0].finalScore).toBe(1);
            expect(result.subjectResults[0].status).toBe('reprobada');
        }));
        it('councilPoints sumados correctamente', () => __awaiter(void 0, void 0, void 0, function* () {
            const { structure, term1, term2, inscription, insSub } = yield setupInscriptionWithSubject('fgc4');
            yield createQualification(insSub.id, structure.periodGradeSubject.id, structure.section.id, term1.id, 10, 100);
            yield createQualification(insSub.id, structure.periodGradeSubject.id, structure.section.id, term2.id, 10, 100);
            yield index_1.CouncilPoint.create({ inscriptionSubjectId: insSub.id, termId: term1.id, points: 2 });
            yield index_1.CouncilPoint.create({ inscriptionSubjectId: insSub.id, termId: term2.id, points: 2 });
            const result = yield finalGradeCalculator_1.FinalGradeCalculator.calculateForInscription(inscription.id);
            expect(result.subjectResults[0].councilPoints).toBe(2); // (2+2)/2 terms = 2
        }));
        it('repair grade (revision) → reemplaza finalScore y status', () => __awaiter(void 0, void 0, void 0, function* () {
            const { structure, term1, term2, person, inscription, insSub } = yield setupInscriptionWithSubject('fgc5');
            yield createQualification(insSub.id, structure.periodGradeSubject.id, structure.section.id, term1.id, 5, 100);
            yield createQualification(insSub.id, structure.periodGradeSubject.id, structure.section.id, term2.id, 5, 100);
            // Create a completed revision period with a repair grade
            const revisionPeriod = yield index_1.RevisionPeriod.create({
                schoolPeriodId: structure.period.id,
                status: 'completed',
                passingGrade: 10,
                maxOpportunities: 3,
                currentOpportunity: 1,
            });
            yield index_1.InscriptionSubjectRevision.create({
                revisionPeriodId: revisionPeriod.id,
                inscriptionSubjectId: insSub.id,
                opportunity: 1,
                status: 'approved',
                score: 14,
                gradedBy: person.id,
            });
            const result = yield finalGradeCalculator_1.FinalGradeCalculator.calculateForInscription(inscription.id);
            expect(result.subjectResults[0].finalScore).toBe(14);
            expect(result.subjectResults[0].status).toBe('aprobada');
        }));
        it('external grade (transferencia) → no se recalcula', () => __awaiter(void 0, void 0, void 0, function* () {
            const { structure, term1, term2, inscription, insSub } = yield setupInscriptionWithSubject('fgc6');
            // Pre-existing external grade
            yield index_1.SubjectFinalGrade.create({
                inscriptionSubjectId: insSub.id,
                finalScore: 18,
                status: 'aprobada',
                gradeType: 'transferencia',
                calculatedAt: new Date(),
                schoolPeriodId: structure.period.id,
                subjectId: structure.subject.id,
                gradeId: structure.grade.id,
            });
            yield finalGradeCalculator_1.FinalGradeCalculator.calculateForInscription(inscription.id);
            // The external grade should remain unchanged
            const fg = yield index_1.SubjectFinalGrade.findOne({
                where: { inscriptionSubjectId: insSub.id, gradeType: 'transferencia' },
            });
            expect(fg.finalScore).toBe(18);
        }));
        it('persiste SubjectFinalGrade (create)', () => __awaiter(void 0, void 0, void 0, function* () {
            const { structure, term1, term2, inscription, insSub } = yield setupInscriptionWithSubject('fgc7');
            yield createQualification(insSub.id, structure.periodGradeSubject.id, structure.section.id, term1.id, 14, 100);
            yield createQualification(insSub.id, structure.periodGradeSubject.id, structure.section.id, term2.id, 14, 100);
            yield finalGradeCalculator_1.FinalGradeCalculator.calculateForInscription(inscription.id);
            const fg = yield index_1.SubjectFinalGrade.findOne({
                where: { inscriptionSubjectId: insSub.id, gradeType: 'regular' },
            });
            expect(fg).not.toBeNull();
            expect(fg.status).toBe('aprobada');
        }));
        it('persiste SubjectFinalGrade (update si ya existe)', () => __awaiter(void 0, void 0, void 0, function* () {
            const { structure, term1, term2, inscription, insSub } = yield setupInscriptionWithSubject('fgc8');
            // Pre-create with a good score; isClosedPeriod=true uses stored value
            yield index_1.SubjectFinalGrade.create({
                inscriptionSubjectId: insSub.id,
                finalScore: 14,
                status: 'aprobada',
                gradeType: 'regular',
                calculatedAt: new Date(),
                schoolPeriodId: structure.period.id,
                subjectId: structure.subject.id,
                gradeId: structure.grade.id,
            });
            yield createQualification(insSub.id, structure.periodGradeSubject.id, structure.section.id, term1.id, 14, 100);
            yield createQualification(insSub.id, structure.periodGradeSubject.id, structure.section.id, term2.id, 14, 100);
            yield finalGradeCalculator_1.FinalGradeCalculator.calculateForInscription(inscription.id);
            const count = yield index_1.SubjectFinalGrade.count({
                where: { inscriptionSubjectId: insSub.id, gradeType: 'regular' },
            });
            expect(count).toBe(1); // no duplicó
            const fg = yield index_1.SubjectFinalGrade.findOne({
                where: { inscriptionSubjectId: insSub.id, gradeType: 'regular' },
            });
            expect(fg.status).toBe('aprobada');
            expect(fg.rawScore).toBeGreaterThanOrEqual(10); // recalculado desde qualifications
        }));
        it('finalAverage calcula el promedio de materias aprobadas', () => __awaiter(void 0, void 0, void 0, function* () {
            const { structure, term1, term2, inscription, insSub } = yield setupInscriptionWithSubject('fgc9');
            yield createQualification(insSub.id, structure.periodGradeSubject.id, structure.section.id, term1.id, 14, 100);
            yield createQualification(insSub.id, structure.periodGradeSubject.id, structure.section.id, term2.id, 14, 100);
            const result = yield finalGradeCalculator_1.FinalGradeCalculator.calculateForInscription(inscription.id);
            expect(result.finalAverage).not.toBeNull();
            expect(result.finalAverage).toBeGreaterThanOrEqual(10);
        }));
    });
    describe('calculateForInscriptionFast', () => {
        it('lee SubjectFinalGrade existente sin recalcular', () => __awaiter(void 0, void 0, void 0, function* () {
            const { structure, inscription, insSub } = yield setupInscriptionWithSubject('fgc10');
            yield index_1.SubjectFinalGrade.create({
                inscriptionSubjectId: insSub.id,
                finalScore: 15,
                status: 'aprobada',
                gradeType: 'regular',
                calculatedAt: new Date(),
                schoolPeriodId: structure.period.id,
                subjectId: structure.subject.id,
                gradeId: structure.grade.id,
            });
            const result = yield finalGradeCalculator_1.FinalGradeCalculator.calculateForInscriptionFast(inscription.id);
            expect(result.subjectResults).toHaveLength(1);
            expect(result.subjectResults[0].finalScore).toBe(15);
            expect(result.subjectResults[0].status).toBe('aprobada');
        }));
        it('repair grade → reemplaza finalScore', () => __awaiter(void 0, void 0, void 0, function* () {
            const { structure, person, inscription, insSub } = yield setupInscriptionWithSubject('fgc11');
            yield index_1.SubjectFinalGrade.create({
                inscriptionSubjectId: insSub.id,
                finalScore: 5,
                status: 'reprobada',
                gradeType: 'regular',
                calculatedAt: new Date(),
                schoolPeriodId: structure.period.id,
                subjectId: structure.subject.id,
                gradeId: structure.grade.id,
            });
            const revisionPeriod = yield index_1.RevisionPeriod.create({
                schoolPeriodId: structure.period.id,
                status: 'completed',
                passingGrade: 10,
                maxOpportunities: 3,
                currentOpportunity: 1,
            });
            yield index_1.InscriptionSubjectRevision.create({
                revisionPeriodId: revisionPeriod.id,
                inscriptionSubjectId: insSub.id,
                opportunity: 1,
                status: 'approved',
                score: 16,
                gradedBy: person.id,
            });
            const result = yield finalGradeCalculator_1.FinalGradeCalculator.calculateForInscriptionFast(inscription.id);
            expect(result.subjectResults[0].finalScore).toBe(16);
            expect(result.subjectResults[0].status).toBe('aprobada');
        }));
        it('sin SubjectFinalGrade → skip', () => __awaiter(void 0, void 0, void 0, function* () {
            const { inscription } = yield setupInscriptionWithSubject('fgc12');
            const result = yield finalGradeCalculator_1.FinalGradeCalculator.calculateForInscriptionFast(inscription.id);
            expect(result.subjectResults).toEqual([]);
            expect(result.finalAverage).toBeNull();
        }));
        it('sin SubjectFinalGrade pero con SubjectTermGrade → calcula desde lapsos (fallback Excel)', () => __awaiter(void 0, void 0, void 0, function* () {
            const { term1, term2, inscription, insSub } = yield setupInscriptionWithSubject('fgc13');
            yield index_1.SubjectTermGrade.create({ inscriptionSubjectId: insSub.id, termId: term1.id, score: 14 });
            yield index_1.SubjectTermGrade.create({ inscriptionSubjectId: insSub.id, termId: term2.id, score: 16 });
            const result = yield finalGradeCalculator_1.FinalGradeCalculator.calculateForInscriptionFast(inscription.id);
            expect(result.subjectResults).toHaveLength(1);
            expect(result.subjectResults[0].finalScore).toBe(15);
            expect(result.subjectResults[0].status).toBe('aprobada');
            expect(result.finalAverage).toBe(15);
        }));
        it('fallback desde SubjectTermGrade con promedio reprobado → reprobada', () => __awaiter(void 0, void 0, void 0, function* () {
            const { term1, term2, inscription, insSub } = yield setupInscriptionWithSubject('fgc14');
            yield index_1.SubjectTermGrade.create({ inscriptionSubjectId: insSub.id, termId: term1.id, score: 8 });
            yield index_1.SubjectTermGrade.create({ inscriptionSubjectId: insSub.id, termId: term2.id, score: 6 });
            const result = yield finalGradeCalculator_1.FinalGradeCalculator.calculateForInscriptionFast(inscription.id);
            expect(result.subjectResults).toHaveLength(1);
            expect(result.subjectResults[0].finalScore).toBe(7);
            expect(result.subjectResults[0].status).toBe('reprobada');
            expect(result.failedSubjects).toBe(1);
        }));
    });
});
