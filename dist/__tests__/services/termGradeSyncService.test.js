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
const termGradeSyncService_1 = require("../../services/termGradeSyncService.js");
const index_1 = require("../../models/index.js");
const testData_1 = require("../helpers/testData");
describe('TermGradeSyncService', () => {
    describe('syncForInscriptionSubject', () => {
        it('crea SubjectTermGrade para cada term del período', () => __awaiter(void 0, void 0, void 0, function* () {
            const structure = yield (0, testData_1.createAcademicStructure)();
            const term1 = yield (0, testData_1.createTestTerm)(structure.period.id, { order: 1 });
            const term2 = yield (0, testData_1.createTestTerm)(structure.period.id, { order: 2 });
            const { person } = yield (0, testData_1.createTestUser)({ username: 'student1' });
            const inscription = yield (0, testData_1.createTestInscription)(person.id, structure.period.id, structure.grade.id, structure.section.id);
            const insSub = yield index_1.InscriptionSubject.create({
                inscriptionId: inscription.id,
                subjectId: structure.subject.id,
                schoolPeriodId: structure.period.id,
                gradeId: structure.grade.id,
                sectionId: structure.section.id,
            });
            const evalPlan = yield index_1.EvaluationPlan.create({
                periodGradeSubjectId: structure.periodGradeSubject.id,
                sectionId: structure.section.id,
                termId: term1.id,
                description: 'Examen 1',
                percentage: 100,
                date: new Date(),
            });
            yield index_1.Qualification.create({
                evaluationPlanId: evalPlan.id,
                inscriptionSubjectId: insSub.id,
                score: 15,
                isAbsent: false,
            });
            yield termGradeSyncService_1.TermGradeSyncService.syncForInscriptionSubject(insSub.id);
            const termGrades = yield index_1.SubjectTermGrade.findAll({
                where: { inscriptionSubjectId: insSub.id },
            });
            expect(termGrades).toHaveLength(2);
            const tg1 = termGrades.find(tg => tg.termId === term1.id);
            expect(tg1.score).toBe(15);
            const tg2 = termGrades.find(tg => tg.termId === term2.id);
            expect(tg2.score).toBe(1); // MIN_FINAL_GRADE
        }));
        it('calcula score por term: sum(score * percentage/100)', () => __awaiter(void 0, void 0, void 0, function* () {
            const structure = yield (0, testData_1.createAcademicStructure)();
            const term = yield (0, testData_1.createTestTerm)(structure.period.id, { order: 1 });
            const { person } = yield (0, testData_1.createTestUser)({ username: 'student2' });
            const inscription = yield (0, testData_1.createTestInscription)(person.id, structure.period.id, structure.grade.id, structure.section.id);
            const insSub = yield index_1.InscriptionSubject.create({
                inscriptionId: inscription.id,
                subjectId: structure.subject.id,
                schoolPeriodId: structure.period.id,
                gradeId: structure.grade.id,
                sectionId: structure.section.id,
            });
            const evalPlan1 = yield index_1.EvaluationPlan.create({
                periodGradeSubjectId: structure.periodGradeSubject.id,
                sectionId: structure.section.id,
                termId: term.id,
                description: 'Examen 1',
                percentage: 50,
                date: new Date(),
            });
            const evalPlan2 = yield index_1.EvaluationPlan.create({
                periodGradeSubjectId: structure.periodGradeSubject.id,
                sectionId: structure.section.id,
                termId: term.id,
                description: 'Examen 2',
                percentage: 50,
                date: new Date(),
            });
            yield index_1.Qualification.create({
                evaluationPlanId: evalPlan1.id,
                inscriptionSubjectId: insSub.id,
                score: 10,
                isAbsent: false,
            });
            yield index_1.Qualification.create({
                evaluationPlanId: evalPlan2.id,
                inscriptionSubjectId: insSub.id,
                score: 20,
                isAbsent: false,
            });
            yield termGradeSyncService_1.TermGradeSyncService.syncForInscriptionSubject(insSub.id);
            const tg = yield index_1.SubjectTermGrade.findOne({
                where: { inscriptionSubjectId: insSub.id, termId: term.id },
            });
            // 10*0.5 + 20*0.5 = 15
            expect(tg.score).toBe(15);
        }));
        it('suma councilPoints al term correspondiente', () => __awaiter(void 0, void 0, void 0, function* () {
            const structure = yield (0, testData_1.createAcademicStructure)();
            const term = yield (0, testData_1.createTestTerm)(structure.period.id, { order: 1 });
            const { person } = yield (0, testData_1.createTestUser)({ username: 'student3' });
            const inscription = yield (0, testData_1.createTestInscription)(person.id, structure.period.id, structure.grade.id, structure.section.id);
            const insSub = yield index_1.InscriptionSubject.create({
                inscriptionId: inscription.id,
                subjectId: structure.subject.id,
                schoolPeriodId: structure.period.id,
                gradeId: structure.grade.id,
                sectionId: structure.section.id,
            });
            yield index_1.CouncilPoint.create({
                inscriptionSubjectId: insSub.id,
                termId: term.id,
                points: 3,
            });
            yield termGradeSyncService_1.TermGradeSyncService.syncForInscriptionSubject(insSub.id);
            const tg = yield index_1.SubjectTermGrade.findOne({
                where: { inscriptionSubjectId: insSub.id, termId: term.id },
            });
            expect(tg.score).toBe(3);
        }));
        it('usa remedialScore cuando > 0, sino score', () => __awaiter(void 0, void 0, void 0, function* () {
            const structure = yield (0, testData_1.createAcademicStructure)();
            const term = yield (0, testData_1.createTestTerm)(structure.period.id, { order: 1 });
            const { person } = yield (0, testData_1.createTestUser)({ username: 'student4' });
            const inscription = yield (0, testData_1.createTestInscription)(person.id, structure.period.id, structure.grade.id, structure.section.id);
            const insSub = yield index_1.InscriptionSubject.create({
                inscriptionId: inscription.id,
                subjectId: structure.subject.id,
                schoolPeriodId: structure.period.id,
                gradeId: structure.grade.id,
                sectionId: structure.section.id,
            });
            const evalPlan = yield index_1.EvaluationPlan.create({
                periodGradeSubjectId: structure.periodGradeSubject.id,
                sectionId: structure.section.id,
                termId: term.id,
                description: 'Examen 1',
                percentage: 100,
                date: new Date(),
            });
            yield index_1.Qualification.create({
                evaluationPlanId: evalPlan.id,
                inscriptionSubjectId: insSub.id,
                score: 5,
                remedialScore: 12,
                isAbsent: false,
            });
            yield termGradeSyncService_1.TermGradeSyncService.syncForInscriptionSubject(insSub.id);
            const tg = yield index_1.SubjectTermGrade.findOne({
                where: { inscriptionSubjectId: insSub.id, termId: term.id },
            });
            expect(tg.score).toBe(12); // usa remedialScore
        }));
        it('ignora qualifications con isAbsent=true', () => __awaiter(void 0, void 0, void 0, function* () {
            const structure = yield (0, testData_1.createAcademicStructure)();
            const term = yield (0, testData_1.createTestTerm)(structure.period.id, { order: 1 });
            const { person } = yield (0, testData_1.createTestUser)({ username: 'student5' });
            const inscription = yield (0, testData_1.createTestInscription)(person.id, structure.period.id, structure.grade.id, structure.section.id);
            const insSub = yield index_1.InscriptionSubject.create({
                inscriptionId: inscription.id,
                subjectId: structure.subject.id,
                schoolPeriodId: structure.period.id,
                gradeId: structure.grade.id,
                sectionId: structure.section.id,
            });
            const evalPlan = yield index_1.EvaluationPlan.create({
                periodGradeSubjectId: structure.periodGradeSubject.id,
                sectionId: structure.section.id,
                termId: term.id,
                description: 'Examen 1',
                percentage: 100,
                date: new Date(),
            });
            yield index_1.Qualification.create({
                evaluationPlanId: evalPlan.id,
                inscriptionSubjectId: insSub.id,
                score: 20,
                isAbsent: true,
            });
            yield termGradeSyncService_1.TermGradeSyncService.syncForInscriptionSubject(insSub.id);
            const tg = yield index_1.SubjectTermGrade.findOne({
                where: { inscriptionSubjectId: insSub.id, termId: term.id },
            });
            expect(tg.score).toBe(1); // MIN_FINAL_GRADE, no sumó nada
        }));
        it('actualiza registros existentes (upsert)', () => __awaiter(void 0, void 0, void 0, function* () {
            const structure = yield (0, testData_1.createAcademicStructure)();
            const term = yield (0, testData_1.createTestTerm)(structure.period.id, { order: 1 });
            const { person } = yield (0, testData_1.createTestUser)({ username: 'student6' });
            const inscription = yield (0, testData_1.createTestInscription)(person.id, structure.period.id, structure.grade.id, structure.section.id);
            const insSub = yield index_1.InscriptionSubject.create({
                inscriptionId: inscription.id,
                subjectId: structure.subject.id,
                schoolPeriodId: structure.period.id,
                gradeId: structure.grade.id,
                sectionId: structure.section.id,
            });
            const evalPlan = yield index_1.EvaluationPlan.create({
                periodGradeSubjectId: structure.periodGradeSubject.id,
                sectionId: structure.section.id,
                termId: term.id,
                description: 'Examen 1',
                percentage: 100,
                date: new Date(),
            });
            yield index_1.Qualification.create({
                evaluationPlanId: evalPlan.id,
                inscriptionSubjectId: insSub.id,
                score: 10,
                isAbsent: false,
            });
            yield termGradeSyncService_1.TermGradeSyncService.syncForInscriptionSubject(insSub.id);
            // Update the qualification score
            yield index_1.Qualification.update({ score: 18 }, {
                where: { evaluationPlanId: evalPlan.id, inscriptionSubjectId: insSub.id },
            });
            yield termGradeSyncService_1.TermGradeSyncService.syncForInscriptionSubject(insSub.id);
            const count = yield index_1.SubjectTermGrade.count({
                where: { inscriptionSubjectId: insSub.id, termId: term.id },
            });
            expect(count).toBe(1); // no duplicó
            const tg = yield index_1.SubjectTermGrade.findOne({
                where: { inscriptionSubjectId: insSub.id, termId: term.id },
            });
            expect(tg.score).toBe(18); // actualizó
        }));
        it('no falla si el InscriptionSubject no existe', () => __awaiter(void 0, void 0, void 0, function* () {
            yield termGradeSyncService_1.TermGradeSyncService.syncForInscriptionSubject(99999);
            // No error thrown
        }));
    });
    describe('syncForInscription', () => {
        it('sincroniza todos los InscriptionSubjects de una inscripción', () => __awaiter(void 0, void 0, void 0, function* () {
            const structure = yield (0, testData_1.createAcademicStructure)();
            const term = yield (0, testData_1.createTestTerm)(structure.period.id, { order: 1 });
            const { person } = yield (0, testData_1.createTestUser)({ username: 'student7' });
            const inscription = yield (0, testData_1.createTestInscription)(person.id, structure.period.id, structure.grade.id, structure.section.id);
            const insSub1 = yield index_1.InscriptionSubject.create({
                inscriptionId: inscription.id,
                subjectId: structure.subject.id,
                schoolPeriodId: structure.period.id,
                gradeId: structure.grade.id,
                sectionId: structure.section.id,
            });
            const { subject: subject2 } = yield (0, testData_1.createAcademicStructure)({ periodId: structure.period.id });
            const insSub2 = yield index_1.InscriptionSubject.create({
                inscriptionId: inscription.id,
                subjectId: subject2.id,
                schoolPeriodId: structure.period.id,
                gradeId: structure.grade.id,
                sectionId: structure.section.id,
            });
            const evalPlan1 = yield index_1.EvaluationPlan.create({
                periodGradeSubjectId: structure.periodGradeSubject.id,
                sectionId: structure.section.id,
                termId: term.id,
                description: 'Examen 1',
                percentage: 100,
                date: new Date(),
            });
            yield index_1.Qualification.create({
                evaluationPlanId: evalPlan1.id,
                inscriptionSubjectId: insSub1.id,
                score: 14,
                isAbsent: false,
            });
            yield termGradeSyncService_1.TermGradeSyncService.syncForInscription(inscription.id);
            const tg1 = yield index_1.SubjectTermGrade.findOne({
                where: { inscriptionSubjectId: insSub1.id, termId: term.id },
            });
            expect(tg1.score).toBe(14);
            const tg2 = yield index_1.SubjectTermGrade.findOne({
                where: { inscriptionSubjectId: insSub2.id, termId: term.id },
            });
            expect(tg2.score).toBe(1); // MIN_FINAL_GRADE, no qualifications
        }));
    });
});
