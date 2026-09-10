import { TermGradeSyncService } from '@/services/termGradeSyncService';
import {
  EvaluationPlan,
  Qualification,
  CouncilPoint,
  SubjectTermGrade,
  Inscription,
  InscriptionSubject,
} from '@/models/index';
import {
  createAcademicStructure,
  createTestTerm,
  createTestInscription,
  createTestUser,
} from '../helpers/testData';

describe('TermGradeSyncService', () => {
  describe('syncForInscriptionSubject', () => {
    it('crea SubjectTermGrade para cada term del período', async () => {
      const structure = await createAcademicStructure();
      const term1 = await createTestTerm(structure.period.id, { order: 1 });
      const term2 = await createTestTerm(structure.period.id, { order: 2 });
      const { person } = await createTestUser({ username: 'student1' });
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
      const evalPlan = await EvaluationPlan.create({
        periodGradeSubjectId: structure.periodGradeSubject.id,
        sectionId: structure.section.id,
        termId: term1.id,
        description: 'Examen 1',
        percentage: 100,
        date: new Date(),
      });
      await Qualification.create({
        evaluationPlanId: evalPlan.id,
        inscriptionSubjectId: insSub.id,
        score: 15,
        isAbsent: false,
      });

      await TermGradeSyncService.syncForInscriptionSubject(insSub.id);

      const termGrades = await SubjectTermGrade.findAll({
        where: { inscriptionSubjectId: insSub.id },
      });
      expect(termGrades).toHaveLength(2);
      const tg1 = termGrades.find(tg => tg.termId === term1.id);
      expect(tg1!.score).toBe(15);
      const tg2 = termGrades.find(tg => tg.termId === term2.id);
      expect(tg2!.score).toBe(1); // MIN_FINAL_GRADE
    });

    it('calcula score por term: sum(score * percentage/100)', async () => {
      const structure = await createAcademicStructure();
      const term = await createTestTerm(structure.period.id, { order: 1 });
      const { person } = await createTestUser({ username: 'student2' });
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
      const evalPlan1 = await EvaluationPlan.create({
        periodGradeSubjectId: structure.periodGradeSubject.id,
        sectionId: structure.section.id,
        termId: term.id,
        description: 'Examen 1',
        percentage: 50,
        date: new Date(),
      });
      const evalPlan2 = await EvaluationPlan.create({
        periodGradeSubjectId: structure.periodGradeSubject.id,
        sectionId: structure.section.id,
        termId: term.id,
        description: 'Examen 2',
        percentage: 50,
        date: new Date(),
      });
      await Qualification.create({
        evaluationPlanId: evalPlan1.id,
        inscriptionSubjectId: insSub.id,
        score: 10,
        isAbsent: false,
      });
      await Qualification.create({
        evaluationPlanId: evalPlan2.id,
        inscriptionSubjectId: insSub.id,
        score: 20,
        isAbsent: false,
      });

      await TermGradeSyncService.syncForInscriptionSubject(insSub.id);

      const tg = await SubjectTermGrade.findOne({
        where: { inscriptionSubjectId: insSub.id, termId: term.id },
      });
      // 10*0.5 + 20*0.5 = 15
      expect(tg!.score).toBe(15);
    });

    it('suma councilPoints al term correspondiente', async () => {
      const structure = await createAcademicStructure();
      const term = await createTestTerm(structure.period.id, { order: 1 });
      const { person } = await createTestUser({ username: 'student3' });
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
      await CouncilPoint.create({
        inscriptionSubjectId: insSub.id,
        termId: term.id,
        points: 3,
      });

      await TermGradeSyncService.syncForInscriptionSubject(insSub.id);

      const tg = await SubjectTermGrade.findOne({
        where: { inscriptionSubjectId: insSub.id, termId: term.id },
      });
      expect(tg!.score).toBe(3);
    });

    it('usa remedialScore cuando > 0, sino score', async () => {
      const structure = await createAcademicStructure();
      const term = await createTestTerm(structure.period.id, { order: 1 });
      const { person } = await createTestUser({ username: 'student4' });
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
      const evalPlan = await EvaluationPlan.create({
        periodGradeSubjectId: structure.periodGradeSubject.id,
        sectionId: structure.section.id,
        termId: term.id,
        description: 'Examen 1',
        percentage: 100,
        date: new Date(),
      });
      await Qualification.create({
        evaluationPlanId: evalPlan.id,
        inscriptionSubjectId: insSub.id,
        score: 5,
        remedialScore: 12,
        isAbsent: false,
      });

      await TermGradeSyncService.syncForInscriptionSubject(insSub.id);

      const tg = await SubjectTermGrade.findOne({
        where: { inscriptionSubjectId: insSub.id, termId: term.id },
      });
      expect(tg!.score).toBe(12); // usa remedialScore
    });

    it('ignora qualifications con isAbsent=true', async () => {
      const structure = await createAcademicStructure();
      const term = await createTestTerm(structure.period.id, { order: 1 });
      const { person } = await createTestUser({ username: 'student5' });
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
      const evalPlan = await EvaluationPlan.create({
        periodGradeSubjectId: structure.periodGradeSubject.id,
        sectionId: structure.section.id,
        termId: term.id,
        description: 'Examen 1',
        percentage: 100,
        date: new Date(),
      });
      await Qualification.create({
        evaluationPlanId: evalPlan.id,
        inscriptionSubjectId: insSub.id,
        score: 20,
        isAbsent: true,
      });

      await TermGradeSyncService.syncForInscriptionSubject(insSub.id);

      const tg = await SubjectTermGrade.findOne({
        where: { inscriptionSubjectId: insSub.id, termId: term.id },
      });
      expect(tg!.score).toBe(1); // MIN_FINAL_GRADE, no sumó nada
    });

    it('actualiza registros existentes (upsert)', async () => {
      const structure = await createAcademicStructure();
      const term = await createTestTerm(structure.period.id, { order: 1 });
      const { person } = await createTestUser({ username: 'student6' });
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
      const evalPlan = await EvaluationPlan.create({
        periodGradeSubjectId: structure.periodGradeSubject.id,
        sectionId: structure.section.id,
        termId: term.id,
        description: 'Examen 1',
        percentage: 100,
        date: new Date(),
      });
      await Qualification.create({
        evaluationPlanId: evalPlan.id,
        inscriptionSubjectId: insSub.id,
        score: 10,
        isAbsent: false,
      });
      await TermGradeSyncService.syncForInscriptionSubject(insSub.id);

      // Update the qualification score
      await Qualification.update({ score: 18 }, {
        where: { evaluationPlanId: evalPlan.id, inscriptionSubjectId: insSub.id },
      });
      await TermGradeSyncService.syncForInscriptionSubject(insSub.id);

      const count = await SubjectTermGrade.count({
        where: { inscriptionSubjectId: insSub.id, termId: term.id },
      });
      expect(count).toBe(1); // no duplicó
      const tg = await SubjectTermGrade.findOne({
        where: { inscriptionSubjectId: insSub.id, termId: term.id },
      });
      expect(tg!.score).toBe(18); // actualizó
    });

    it('no falla si el InscriptionSubject no existe', async () => {
      await TermGradeSyncService.syncForInscriptionSubject(99999);
      // No error thrown
    });
  });

  describe('syncForInscription', () => {
    it('sincroniza todos los InscriptionSubjects de una inscripción', async () => {
      const structure = await createAcademicStructure();
      const term = await createTestTerm(structure.period.id, { order: 1 });
      const { person } = await createTestUser({ username: 'student7' });
      const inscription = await createTestInscription(
        person.id, structure.period.id, structure.grade.id, structure.section.id,
      );
      const insSub1 = await InscriptionSubject.create({
        inscriptionId: inscription.id,
        subjectId: structure.subject.id,
        schoolPeriodId: structure.period.id,
        gradeId: structure.grade.id,
        sectionId: structure.section.id,
      });
      const { subject: subject2 } = await createAcademicStructure({ periodId: structure.period.id });
      const insSub2 = await InscriptionSubject.create({
        inscriptionId: inscription.id,
        subjectId: subject2.id,
        schoolPeriodId: structure.period.id,
        gradeId: structure.grade.id,
        sectionId: structure.section.id,
      });
      const evalPlan1 = await EvaluationPlan.create({
        periodGradeSubjectId: structure.periodGradeSubject.id,
        sectionId: structure.section.id,
        termId: term.id,
        description: 'Examen 1',
        percentage: 100,
        date: new Date(),
      });
      await Qualification.create({
        evaluationPlanId: evalPlan1.id,
        inscriptionSubjectId: insSub1.id,
        score: 14,
        isAbsent: false,
      });

      await TermGradeSyncService.syncForInscription(inscription.id);

      const tg1 = await SubjectTermGrade.findOne({
        where: { inscriptionSubjectId: insSub1.id, termId: term.id },
      });
      expect(tg1!.score).toBe(14);
      const tg2 = await SubjectTermGrade.findOne({
        where: { inscriptionSubjectId: insSub2.id, termId: term.id },
      });
      expect(tg2!.score).toBe(1); // MIN_FINAL_GRADE, no qualifications
    });
  });
});
