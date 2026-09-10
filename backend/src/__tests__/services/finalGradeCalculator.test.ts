import { FinalGradeCalculator } from '@/services/finalGradeCalculator';
import {
  EvaluationPlan,
  Qualification,
  CouncilPoint,
  SubjectFinalGrade,
  SubjectTermGrade,
  Inscription,
  InscriptionSubject,
  RevisionPeriod,
  InscriptionSubjectRevision,
  PeriodGradeSubject,
  Plantel,
  Setting,
} from '@/models/index';
import {
  createAcademicStructure,
  createTestTerm,
  createTestInscription,
  createTestUser,
  createTestSetting,
} from '../helpers/testData';

const setupInscriptionWithSubject = async (username: string) => {
  const structure = await createAcademicStructure();
  const term1 = await createTestTerm(structure.period.id, { order: 1 });
  const term2 = await createTestTerm(structure.period.id, { order: 2 });
  const { person } = await createTestUser({ username });
  const inscription = await createTestInscription(
    person.id, structure.period.id, structure.grade.id, structure.section.id,
  );
  const insSub = await InscriptionSubject.create({
    inscriptionId: inscription.id,
    subjectId: structure.subject.id,
    schoolPeriodId: structure.period.id,
    gradeId: structure.grade.id,
    sectionId: structure.section.id,
  });
  return { structure, term1, term2, person, inscription, insSub };
};

const createQualification = async (
  insSubId: number,
  periodGradeSubjectId: number,
  sectionId: number,
  termId: number,
  score: number,
  percentage: number,
  isAbsent = false,
  remedialScore?: number,
) => {
  const evalPlan = await EvaluationPlan.create({
    periodGradeSubjectId,
    sectionId,
    termId,
    description: `Eval-${termId}-${insSubId}-${score}`,
    percentage,
    date: new Date(),
  });
  return await Qualification.create({
    evaluationPlanId: evalPlan.id,
    inscriptionSubjectId: insSubId,
    score,
    remedialScore: remedialScore ?? undefined,
    isAbsent,
  });
};

describe('FinalGradeCalculator', () => {
  describe('calculateForInscription', () => {
    it('estudiante con todas las evaluaciones ≥10 → aprobada', async () => {
      const { structure, term1, term2, inscription, insSub } = await setupInscriptionWithSubject('fgc1');
      await createQualification(insSub.id, structure.periodGradeSubject.id, structure.section.id, term1.id, 14, 100);
      await createQualification(insSub.id, structure.periodGradeSubject.id, structure.section.id, term2.id, 16, 100);

      const result = await FinalGradeCalculator.calculateForInscription(inscription.id);

      expect(result.failedSubjects).toBe(0);
      expect(result.subjectResults).toHaveLength(1);
      expect(result.subjectResults[0].status).toBe('aprobada');
      expect(result.subjectResults[0].finalScore).toBeGreaterThanOrEqual(10);
    });

    it('estudiante con NP (isAbsent=true) → esa materia no suma al rawScore', async () => {
      const { structure, term1, term2, inscription, insSub } = await setupInscriptionWithSubject('fgc2');
      await createQualification(insSub.id, structure.periodGradeSubject.id, structure.section.id, term1.id, 20, 100, true);
      await createQualification(insSub.id, structure.periodGradeSubject.id, structure.section.id, term2.id, 20, 100, true);

      const result = await FinalGradeCalculator.calculateForInscription(inscription.id);

      expect(result.subjectResults[0].rawScore).toBe(0); // no sumó nada
      expect(result.subjectResults[0].finalScore).toBe(1); // MIN_FINAL_GRADE
      expect(result.subjectResults[0].status).toBe('reprobada');
    });

    it('todas las evaluaciones NP/zero → finalScore=01 (MIN_FINAL_GRADE)', async () => {
      const { structure, term1, term2, inscription, insSub } = await setupInscriptionWithSubject('fgc3');
      await createQualification(insSub.id, structure.periodGradeSubject.id, structure.section.id, term1.id, 0, 100);
      await createQualification(insSub.id, structure.periodGradeSubject.id, structure.section.id, term2.id, 0, 100);

      const result = await FinalGradeCalculator.calculateForInscription(inscription.id);

      expect(result.subjectResults[0].finalScore).toBe(1);
      expect(result.subjectResults[0].status).toBe('reprobada');
    });

    it('councilPoints sumados correctamente', async () => {
      const { structure, term1, term2, inscription, insSub } = await setupInscriptionWithSubject('fgc4');
      await createQualification(insSub.id, structure.periodGradeSubject.id, structure.section.id, term1.id, 10, 100);
      await createQualification(insSub.id, structure.periodGradeSubject.id, structure.section.id, term2.id, 10, 100);
      await CouncilPoint.create({ inscriptionSubjectId: insSub.id, termId: term1.id, points: 2 });
      await CouncilPoint.create({ inscriptionSubjectId: insSub.id, termId: term2.id, points: 2 });

      const result = await FinalGradeCalculator.calculateForInscription(inscription.id);

      expect(result.subjectResults[0].councilPoints).toBe(2); // (2+2)/2 terms = 2
    });

    it('repair grade (revision) → reemplaza finalScore y status', async () => {
      const { structure, term1, term2, inscription, insSub } = await setupInscriptionWithSubject('fgc5');
      await createQualification(insSub.id, structure.periodGradeSubject.id, structure.section.id, term1.id, 5, 100);
      await createQualification(insSub.id, structure.periodGradeSubject.id, structure.section.id, term2.id, 5, 100);

      // Create a completed revision period with a repair grade
      const revisionPeriod = await RevisionPeriod.create({
        schoolPeriodId: structure.period.id,
        status: 'completed',
        passingGrade: 10,
        maxOpportunities: 3,
        currentOpportunity: 1,
      });
      await InscriptionSubjectRevision.create({
        revisionPeriodId: revisionPeriod.id,
        inscriptionSubjectId: insSub.id,
        opportunity: 1,
        status: 'approved',
        score: 14,
      });

      const result = await FinalGradeCalculator.calculateForInscription(inscription.id);

      expect(result.subjectResults[0].finalScore).toBe(14);
      expect(result.subjectResults[0].status).toBe('aprobada');
    });

    it('external grade (transferencia) → no se recalcula', async () => {
      const { structure, term1, term2, inscription, insSub } = await setupInscriptionWithSubject('fgc6');
      // Pre-existing external grade
      await SubjectFinalGrade.create({
        inscriptionSubjectId: insSub.id,
        finalScore: 18,
        status: 'aprobada',
        gradeType: 'transferencia',
        calculatedAt: new Date(),
        schoolPeriodId: structure.period.id,
        subjectId: structure.subject.id,
        gradeId: structure.grade.id,
      });

      await FinalGradeCalculator.calculateForInscription(inscription.id);

      // The external grade should remain unchanged
      const fg = await SubjectFinalGrade.findOne({
        where: { inscriptionSubjectId: insSub.id, gradeType: 'transferencia' },
      });
      expect(fg!.finalScore).toBe(18);
    });

    it('persiste SubjectFinalGrade (create)', async () => {
      const { structure, term1, term2, inscription, insSub } = await setupInscriptionWithSubject('fgc7');
      await createQualification(insSub.id, structure.periodGradeSubject.id, structure.section.id, term1.id, 14, 100);
      await createQualification(insSub.id, structure.periodGradeSubject.id, structure.section.id, term2.id, 14, 100);

      await FinalGradeCalculator.calculateForInscription(inscription.id);

      const fg = await SubjectFinalGrade.findOne({
        where: { inscriptionSubjectId: insSub.id, gradeType: 'regular' },
      });
      expect(fg).not.toBeNull();
      expect(fg!.status).toBe('aprobada');
    });

    it('persiste SubjectFinalGrade (update si ya existe)', async () => {
      const { structure, term1, term2, inscription, insSub } = await setupInscriptionWithSubject('fgc8');
      // Pre-create with a good score; isClosedPeriod=true uses stored value
      await SubjectFinalGrade.create({
        inscriptionSubjectId: insSub.id,
        finalScore: 14,
        status: 'aprobada',
        gradeType: 'regular',
        calculatedAt: new Date(),
        schoolPeriodId: structure.period.id,
        subjectId: structure.subject.id,
        gradeId: structure.grade.id,
      });
      await createQualification(insSub.id, structure.periodGradeSubject.id, structure.section.id, term1.id, 14, 100);
      await createQualification(insSub.id, structure.periodGradeSubject.id, structure.section.id, term2.id, 14, 100);

      await FinalGradeCalculator.calculateForInscription(inscription.id);

      const count = await SubjectFinalGrade.count({
        where: { inscriptionSubjectId: insSub.id, gradeType: 'regular' },
      });
      expect(count).toBe(1); // no duplicó
      const fg = await SubjectFinalGrade.findOne({
        where: { inscriptionSubjectId: insSub.id, gradeType: 'regular' },
      });
      expect(fg!.status).toBe('aprobada');
      expect(fg!.rawScore).toBeGreaterThanOrEqual(10); // recalculado desde qualifications
    });

    it('finalAverage calcula el promedio de materias aprobadas', async () => {
      const { structure, term1, term2, inscription, insSub } = await setupInscriptionWithSubject('fgc9');
      await createQualification(insSub.id, structure.periodGradeSubject.id, structure.section.id, term1.id, 14, 100);
      await createQualification(insSub.id, structure.periodGradeSubject.id, structure.section.id, term2.id, 14, 100);

      const result = await FinalGradeCalculator.calculateForInscription(inscription.id);

      expect(result.finalAverage).not.toBeNull();
      expect(result.finalAverage).toBeGreaterThanOrEqual(10);
    });
  });

  describe('calculateForInscriptionFast', () => {
    it('lee SubjectFinalGrade existente sin recalcular', async () => {
      const { structure, inscription, insSub } = await setupInscriptionWithSubject('fgc10');
      await SubjectFinalGrade.create({
        inscriptionSubjectId: insSub.id,
        finalScore: 15,
        status: 'aprobada',
        gradeType: 'regular',
        calculatedAt: new Date(),
        schoolPeriodId: structure.period.id,
        subjectId: structure.subject.id,
        gradeId: structure.grade.id,
      });

      const result = await FinalGradeCalculator.calculateForInscriptionFast(inscription.id);

      expect(result.subjectResults).toHaveLength(1);
      expect(result.subjectResults[0].finalScore).toBe(15);
      expect(result.subjectResults[0].status).toBe('aprobada');
    });

    it('repair grade → reemplaza finalScore', async () => {
      const { structure, inscription, insSub } = await setupInscriptionWithSubject('fgc11');
      await SubjectFinalGrade.create({
        inscriptionSubjectId: insSub.id,
        finalScore: 5,
        status: 'reprobada',
        gradeType: 'regular',
        calculatedAt: new Date(),
        schoolPeriodId: structure.period.id,
        subjectId: structure.subject.id,
        gradeId: structure.grade.id,
      });
      const revisionPeriod = await RevisionPeriod.create({
        schoolPeriodId: structure.period.id,
        status: 'completed',
        passingGrade: 10,
        maxOpportunities: 3,
        currentOpportunity: 1,
      });
      await InscriptionSubjectRevision.create({
        revisionPeriodId: revisionPeriod.id,
        inscriptionSubjectId: insSub.id,
        opportunity: 1,
        status: 'approved',
        score: 16,
      });

      const result = await FinalGradeCalculator.calculateForInscriptionFast(inscription.id);

      expect(result.subjectResults[0].finalScore).toBe(16);
      expect(result.subjectResults[0].status).toBe('aprobada');
    });

    it('sin SubjectFinalGrade → skip', async () => {
      const { inscription } = await setupInscriptionWithSubject('fgc12');
      const result = await FinalGradeCalculator.calculateForInscriptionFast(inscription.id);
      expect(result.subjectResults).toEqual([]);
      expect(result.finalAverage).toBeNull();
    });
  });
});
