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
const index_1 = require("../../models/index.js");
const periodClosurePreview_1 = require("../../services/periodClosurePreview.js");
const periodClosureTestHelper_1 = require("../helpers/periodClosureTestHelper");
const index_2 = require("../../models/index.js");
/**
 * Verifies that the closure PREVIEW and the real closure EXECUTION produce
 * identical results for each student (status, failedSubjects, finalAverage).
 *
 * The preview calls `calculateForInscription` with persist=false — the same
 * code path as the executor — instead of the old `calculateForInscriptionFast`
 * which trusted stored SubjectFinalGrade/SubjectTermGrade values.
 */
describe('Closure preview vs execution consistency', () => {
    let setup;
    beforeEach(() => __awaiter(void 0, void 0, void 0, function* () {
        setup = yield (0, periodClosureTestHelper_1.createFullClosureSetup)({ gradeCount: 2, subjectsPerGrade: 3 });
        yield (0, periodClosureTestHelper_1.markCouncilsDone)(setup);
    }));
    /**
     * Creates a student whose InscriptionSubjects have REAL Qualifications
     * (via EvaluationPlans) but NO SubjectFinalGrade and NO SubjectTermGrade —
     * the real pre-closure state. Both preview and execution must compute the
     * same final score from the qualifications.
     */
    function createStudentWithQualifications(subjectScores) {
        return __awaiter(this, void 0, void 0, function* () {
            const grade = setup.grades[0];
            const section = setup.sections[0];
            const suffix = `${Date.now()}${Math.floor(Math.random() * 10000)}`;
            const person = yield index_2.Person.create({
                firstName: 'Consistencia',
                lastName: `Test ${suffix}`,
                document: `C${suffix}`,
                documentType: 'Venezolano',
                birthdate: new Date('2010-01-01'),
                gender: 'M',
            });
            const inscription = yield index_1.Inscription.create({
                personId: person.id,
                schoolPeriodId: setup.currentPeriod.id,
                gradeId: grade.id,
                sectionId: section.id,
                escolaridad: 'regular',
                isRepeater: false,
            });
            for (const [siStr, score] of Object.entries(subjectScores)) {
                const si = Number(siStr);
                const subject = setup.subjects[si];
                const pgs = setup.periodGradeSubjectsCurrent.get(`${grade.id}:${subject.id}`);
                const insSub = yield index_1.InscriptionSubject.create({
                    inscriptionId: inscription.id,
                    subjectId: subject.id,
                    schoolPeriodId: setup.currentPeriod.id,
                    gradeId: grade.id,
                    sectionId: section.id,
                });
                // One evaluation plan per term, 100% weight, with a qualification
                // carrying the target score — each term ends up with `score`.
                for (const term of setup.terms) {
                    const evalPlan = yield index_1.EvaluationPlan.create({
                        periodGradeSubjectId: pgs.id,
                        sectionId: section.id,
                        termId: term.id,
                        description: `Eval ${term.id}`,
                        percentage: 100,
                        date: new Date(),
                    });
                    yield index_1.Qualification.create({
                        evaluationPlanId: evalPlan.id,
                        inscriptionSubjectId: insSub.id,
                        score,
                        isAbsent: false,
                    });
                }
            }
            return { person, inscription };
        });
    }
    it('C1: preview and execution agree for a student computed from qualifications (no stored grades)', () => __awaiter(void 0, void 0, void 0, function* () {
        // Student: 15, 8, 12 → failedSubjects=1, average=11.67 → materias_pendientes
        const { person } = yield createStudentWithQualifications({ 0: 15, 1: 8, 2: 12 });
        const preview = yield periodClosurePreview_1.PeriodClosurePreview.calculatePreview(setup.currentPeriod.id);
        const previewRow = preview.find(p => { var _a; return ((_a = p.inscription.student) === null || _a === void 0 ? void 0 : _a.id) === person.id; });
        expect(previewRow).toBeDefined();
        expect(previewRow.failedSubjects).toBe(1);
        expect(previewRow.finalAverage).toBeCloseTo(11.67, 2);
        expect(previewRow.status).toBe('materias_pendientes');
        const result = yield (0, periodClosureTestHelper_1.executeClosure)(setup);
        expect(result.success).toBe(true);
        const outcome = yield index_1.StudentPeriodOutcome.findOne({
            include: [{ model: index_1.Inscription, as: 'inscription', where: { personId: person.id } }],
        });
        expect(outcome).not.toBeNull();
        expect(outcome.status).toBe(previewRow.status);
        expect(outcome.failedSubjects).toBe(previewRow.failedSubjects);
        expect(Number(outcome.finalAverage)).toBeCloseTo(previewRow.finalAverage, 2);
    }));
    it('C2: preview ignores stale SubjectTermGrade — same recalculated result as execution', () => __awaiter(void 0, void 0, void 0, function* () {
        // Student with correct qualifications (15 per term per subject)
        const { person, inscription } = yield createStudentWithQualifications({ 0: 15, 1: 15, 2: 15 });
        // Plant a STALE SubjectTermGrade with a wrong score (1) — the old fast
        // preview would read it; the new preview recomputes like the executor.
        const insSub = yield index_1.InscriptionSubject.findOne({ where: { inscriptionId: inscription.id } });
        yield index_1.SubjectTermGrade.create({
            inscriptionSubjectId: insSub.id,
            termId: setup.terms[0].id,
            score: 1,
            calculatedAt: new Date(),
        });
        const preview = yield periodClosurePreview_1.PeriodClosurePreview.calculatePreview(setup.currentPeriod.id);
        const previewRow = preview.find(p => { var _a; return ((_a = p.inscription.student) === null || _a === void 0 ? void 0 : _a.id) === person.id; });
        expect(previewRow).toBeDefined();
        // Stale row must NOT leak into the calculation: all subjects = 15
        expect(previewRow.failedSubjects).toBe(0);
        expect(previewRow.finalAverage).toBe(15);
        expect(previewRow.status).toBe('aprobado');
        const result = yield (0, periodClosureTestHelper_1.executeClosure)(setup);
        expect(result.success).toBe(true);
        const outcome = yield index_1.StudentPeriodOutcome.findOne({
            include: [{ model: index_1.Inscription, as: 'inscription', where: { personId: person.id } }],
        });
        expect(outcome).not.toBeNull();
        expect(outcome.status).toBe(previewRow.status);
        expect(outcome.failedSubjects).toBe(previewRow.failedSubjects);
        expect(Number(outcome.finalAverage)).toBeCloseTo(previewRow.finalAverage, 2);
    }));
    it('C3: preview does not persist anything — no SubjectFinalGrade or Outcome created', () => __awaiter(void 0, void 0, void 0, function* () {
        const { inscription } = yield createStudentWithQualifications({ 0: 15, 1: 15, 2: 15 });
        yield periodClosurePreview_1.PeriodClosurePreview.calculatePreview(setup.currentPeriod.id);
        const sfgCount = yield index_1.StudentPeriodOutcome.count();
        expect(sfgCount).toBe(0);
        const sfgRows = yield index_1.SubjectFinalGrade.count({
            include: [{
                    model: index_1.InscriptionSubject,
                    as: 'inscriptionSubject',
                    where: { inscriptionId: inscription.id },
                }],
        });
        expect(sfgRows).toBe(0);
    }));
    it('C4: reprobado student — preview status matches persisted outcome', () => __awaiter(void 0, void 0, void 0, function* () {
        // Lower max_failed_subjects to 2 so 3 failed subjects → 'reprobado'
        yield index_1.Setting.update({ value: '2' }, { where: { key: 'max_failed_subjects' } });
        const { person } = yield createStudentWithQualifications({ 0: 5, 1: 5, 2: 5 });
        const preview = yield periodClosurePreview_1.PeriodClosurePreview.calculatePreview(setup.currentPeriod.id);
        const previewRow = preview.find(p => { var _a; return ((_a = p.inscription.student) === null || _a === void 0 ? void 0 : _a.id) === person.id; });
        expect(previewRow).toBeDefined();
        expect(previewRow.failedSubjects).toBe(3);
        expect(previewRow.status).toBe('reprobado');
        const result = yield (0, periodClosureTestHelper_1.executeClosure)(setup);
        expect(result.success).toBe(true);
        const outcome = yield index_1.StudentPeriodOutcome.findOne({
            include: [{ model: index_1.Inscription, as: 'inscription', where: { personId: person.id } }],
        });
        expect(outcome).not.toBeNull();
        expect(outcome.status).toBe('reprobado');
        expect(outcome.failedSubjects).toBe(3);
    }));
});
