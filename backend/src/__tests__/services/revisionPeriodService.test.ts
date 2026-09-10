import { RevisionPeriodService } from '@/services/revisionPeriodService';
import {
  RevisionPeriod,
  InscriptionSubjectRevision,
  CouncilChecklist,
  Term,
  TermSectionClosure,
  Inscription,
  InscriptionSubject,
  SubjectTermGrade,
  SchoolPeriod,
} from '@/models/index';
import {
  createAcademicStructure,
  createTestTerm,
  createTestInscription,
  createTestUser,
  createTestSetting,
} from '../helpers/testData';

const setupPeriodForRevision = async (username: string) => {
  const structure = await createAcademicStructure();
  const term1 = await createTestTerm(structure.period.id, { order: 1, isBlocked: true });
  const term2 = await createTestTerm(structure.period.id, { order: 2, isBlocked: true });

  // Close all sections for both terms
  await TermSectionClosure.create({
    termId: term1.id, sectionId: structure.section.id, gradeId: structure.grade.id, closedAt: new Date(),
  });
  await TermSectionClosure.create({
    termId: term2.id, sectionId: structure.section.id, gradeId: structure.grade.id, closedAt: new Date(),
  });

  // Mark council checklist as done
  await CouncilChecklist.create({
    schoolPeriodId: structure.period.id, gradeId: structure.grade.id, sectionId: structure.section.id,
    termId: term1.id, status: 'done',
  });
  await CouncilChecklist.create({
    schoolPeriodId: structure.period.id, gradeId: structure.grade.id, sectionId: structure.section.id,
    termId: term2.id, status: 'done',
  });

  // Make the period active
  await structure.period.update({ status: 'activo' });

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

describe('RevisionPeriodService', () => {
  describe('getOrCreate', () => {
    it('crea un RevisionPeriod si no existe', async () => {
      const structure = await createAcademicStructure();
      const rp = await RevisionPeriodService.getOrCreate(structure.period.id);
      expect(rp).toBeDefined();
      expect(rp.schoolPeriodId).toBe(structure.period.id);
      expect(rp.status).toBe('pending');
    });

    it('retorna existente si ya existe', async () => {
      const structure = await createAcademicStructure();
      const rp1 = await RevisionPeriodService.getOrCreate(structure.period.id);
      const rp2 = await RevisionPeriodService.getOrCreate(structure.period.id);
      expect(rp1.id).toBe(rp2.id);
    });
  });

  describe('getSummary', () => {
    it('retorna summary con councilStatus y termsStatus', async () => {
      const structure = await createAcademicStructure();
      const term1 = await createTestTerm(structure.period.id, { order: 1, isBlocked: true });
      await CouncilChecklist.create({
        schoolPeriodId: structure.period.id, gradeId: structure.grade.id, sectionId: structure.section.id,
        termId: term1.id, status: 'done',
      });

      const summary = await RevisionPeriodService.getSummary(structure.period.id);
      expect(summary.councilStatus.totalChecklists).toBe(1);
      expect(summary.councilStatus.doneChecklists).toBe(1);
      expect(summary.councilStatus.allDone).toBe(true);
      expect(summary.termsStatus.totalTerms).toBe(1);
      expect(summary.termsStatus.blockedTerms).toBe(1);
    });

    it('allDone=false cuando no todos los checklists están done', async () => {
      const structure = await createAcademicStructure();
      const term1 = await createTestTerm(structure.period.id, { order: 1 });
      await CouncilChecklist.create({
        schoolPeriodId: structure.period.id, gradeId: structure.grade.id, sectionId: structure.section.id,
        termId: term1.id, status: 'open',
      });

      const summary = await RevisionPeriodService.getSummary(structure.period.id);
      expect(summary.councilStatus.allDone).toBe(false);
    });
  });

  describe('openRevisionPeriod', () => {
    it('abre el período de revisión y crea revisions para materias reprobadas', async () => {
      const { structure, term1, term2, inscription, insSub } = await setupPeriodForRevision('rev1');
      await createTestSetting('passing_grade', '10');
      // Create failing term grades
      await SubjectTermGrade.create({ inscriptionSubjectId: insSub.id, termId: term1.id, score: 5 });
      await SubjectTermGrade.create({ inscriptionSubjectId: insSub.id, termId: term2.id, score: 5 });

      const result = await RevisionPeriodService.openRevisionPeriod(structure.period.id);
      expect(result.revisionPeriod.status).toBe('open');
      expect(result.revisionsCreated).toBe(1);

      const revisions = await InscriptionSubjectRevision.count({
        where: { revisionPeriodId: result.revisionPeriod.id },
      });
      expect(revisions).toBe(1);
    });

    it('rechaza si el período no está activo', async () => {
      const structure = await createAcademicStructure();
      await structure.period.update({ status: 'historico' });

      await expect(RevisionPeriodService.openRevisionPeriod(structure.period.id))
        .rejects.toThrow('no está activo');
    });

    it('rechaza si no todos los lapsos están cerrados', async () => {
      const structure = await createAcademicStructure();
      await createTestTerm(structure.period.id, { order: 1, isBlocked: false });
      await structure.period.update({ status: 'activo' });

      await expect(RevisionPeriodService.openRevisionPeriod(structure.period.id))
        .rejects.toThrow('Todos los lapsos deben tener todas sus secciones cerradas');
    });

    it('rechaza si no hay consejos de curso', async () => {
      const structure = await createAcademicStructure();
      await createTestTerm(structure.period.id, { order: 1, isBlocked: true });
      await structure.period.update({ status: 'activo' });

      await expect(RevisionPeriodService.openRevisionPeriod(structure.period.id))
        .rejects.toThrow('No hay consejos de curso registrados');
    });

    it('rechaza si ya está abierto', async () => {
      const { structure } = await setupPeriodForRevision('rev2');
      await RevisionPeriodService.openRevisionPeriod(structure.period.id);

      await expect(RevisionPeriodService.openRevisionPeriod(structure.period.id))
        .rejects.toThrow('ya está abierto');
    });
  });

  describe('lockRevisionPeriod', () => {
    it('cierra el período de revisión', async () => {
      const { structure } = await setupPeriodForRevision('rev3');
      await RevisionPeriodService.openRevisionPeriod(structure.period.id);

      const rp = await RevisionPeriodService.lockRevisionPeriod(structure.period.id);
      expect(rp.status).toBe('closed');
    });

    it('es idempotente si ya está closed', async () => {
      const { structure } = await setupPeriodForRevision('rev4');
      await RevisionPeriodService.openRevisionPeriod(structure.period.id);
      await RevisionPeriodService.lockRevisionPeriod(structure.period.id);

      const rp = await RevisionPeriodService.lockRevisionPeriod(structure.period.id);
      expect(rp.status).toBe('closed');
    });

    it('rechaza si está pending', async () => {
      const structure = await createAcademicStructure();
      await RevisionPeriod.create({ schoolPeriodId: structure.period.id });

      await expect(RevisionPeriodService.lockRevisionPeriod(structure.period.id))
        .rejects.toThrow('no ha sido abierto');
    });
  });

  describe('reopenRevisionPeriod', () => {
    it('reabre el período cerrado', async () => {
      const { structure } = await setupPeriodForRevision('rev5');
      await RevisionPeriodService.openRevisionPeriod(structure.period.id);
      await RevisionPeriodService.lockRevisionPeriod(structure.period.id);

      const rp = await RevisionPeriodService.reopenRevisionPeriod(structure.period.id);
      expect(rp.status).toBe('open');
    });

    it('es idempotente si ya está open', async () => {
      const { structure } = await setupPeriodForRevision('rev6');
      await RevisionPeriodService.openRevisionPeriod(structure.period.id);

      const rp = await RevisionPeriodService.reopenRevisionPeriod(structure.period.id);
      expect(rp.status).toBe('open');
    });

    it('rechaza si está pending', async () => {
      const structure = await createAcademicStructure();
      await RevisionPeriod.create({ schoolPeriodId: structure.period.id });

      await expect(RevisionPeriodService.reopenRevisionPeriod(structure.period.id))
        .rejects.toThrow('no ha sido abierto');
    });
  });

  describe('updateMaxOpportunities', () => {
    it('actualiza el maxOpportunities', async () => {
      const { structure } = await setupPeriodForRevision('rev7');
      await RevisionPeriodService.openRevisionPeriod(structure.period.id);

      const rp = await RevisionPeriodService.updateMaxOpportunities(structure.period.id, 5);
      expect(rp.maxOpportunities).toBe(5);
    });

    it('rechaza valores no enteros', async () => {
      const { structure } = await setupPeriodForRevision('rev8');
      await RevisionPeriodService.openRevisionPeriod(structure.period.id);

      await expect(RevisionPeriodService.updateMaxOpportunities(structure.period.id, 2.5))
        .rejects.toThrow('entero mayor o igual a 1');
    });

    it('rechaza valores < 1', async () => {
      const { structure } = await setupPeriodForRevision('rev9');
      await RevisionPeriodService.openRevisionPeriod(structure.period.id);

      await expect(RevisionPeriodService.updateMaxOpportunities(structure.period.id, 0))
        .rejects.toThrow('entero mayor o igual a 1');
    });

    it('elimina revisions con opportunity > nuevo max', async () => {
      const { structure, insSub } = await setupPeriodForRevision('rev10');
      await createTestSetting('passing_grade', '10');
      await SubjectTermGrade.create({ inscriptionSubjectId: insSub.id, termId: (await Term.findOne({ where: { schoolPeriodId: structure.period.id, order: 1 } }))!.id, score: 5 });
      await SubjectTermGrade.create({ inscriptionSubjectId: insSub.id, termId: (await Term.findOne({ where: { schoolPeriodId: structure.period.id, order: 2 } }))!.id, score: 5 });
      const { revisionPeriod } = await RevisionPeriodService.openRevisionPeriod(structure.period.id);
      // Create a revision at opportunity 3
      await InscriptionSubjectRevision.create({
        revisionPeriodId: revisionPeriod.id, inscriptionSubjectId: insSub.id,
        opportunity: 3, status: 'pending',
      });

      await RevisionPeriodService.updateMaxOpportunities(structure.period.id, 2);

      const count = await InscriptionSubjectRevision.count({
        where: { revisionPeriodId: revisionPeriod.id, opportunity: 3 },
      });
      expect(count).toBe(0);
    });
  });

  describe('advanceOpportunity', () => {
    it('avanza currentOpportunity en 1', async () => {
      const { structure } = await setupPeriodForRevision('rev11');
      await RevisionPeriodService.openRevisionPeriod(structure.period.id);

      const rp = await RevisionPeriodService.advanceOpportunity(structure.period.id);
      expect(rp.currentOpportunity).toBe(2);
    });

    it('marca pending como NP (isAbsent=true, score=0)', async () => {
      const { structure, insSub } = await setupPeriodForRevision('rev12');
      await createTestSetting('passing_grade', '10');
      await SubjectTermGrade.create({ inscriptionSubjectId: insSub.id, termId: (await Term.findOne({ where: { schoolPeriodId: structure.period.id, order: 1 } }))!.id, score: 5 });
      await SubjectTermGrade.create({ inscriptionSubjectId: insSub.id, termId: (await Term.findOne({ where: { schoolPeriodId: structure.period.id, order: 2 } }))!.id, score: 5 });
      const { revisionPeriod } = await RevisionPeriodService.openRevisionPeriod(structure.period.id);

      await RevisionPeriodService.advanceOpportunity(structure.period.id);

      const rev = await InscriptionSubjectRevision.findOne({
        where: { revisionPeriodId: revisionPeriod.id, opportunity: 1 },
      });
      expect(rev!.isAbsent).toBe(true);
      expect(rev!.score).toBe(0);
      expect(rev!.status).toBe('failed');
    });

    it('rechaza si ya está en la última oportunidad', async () => {
      const { structure } = await setupPeriodForRevision('rev13');
      await RevisionPeriodService.openRevisionPeriod(structure.period.id);
      await RevisionPeriodService.updateMaxOpportunities(structure.period.id, 1);

      await expect(RevisionPeriodService.advanceOpportunity(structure.period.id))
        .rejects.toThrow('Ya está en la última oportunidad');
    });

    it('rechaza si no está open', async () => {
      const structure = await createAcademicStructure();
      await RevisionPeriod.create({ schoolPeriodId: structure.period.id });

      await expect(RevisionPeriodService.advanceOpportunity(structure.period.id))
        .rejects.toThrow('no está abierto');
    });
  });

  describe('setOpportunity', () => {
    it('setea currentOpportunity a un valor específico', async () => {
      const { structure } = await setupPeriodForRevision('rev14');
      await RevisionPeriodService.openRevisionPeriod(structure.period.id);
      await RevisionPeriodService.updateMaxOpportunities(structure.period.id, 5);

      const rp = await RevisionPeriodService.setOpportunity(structure.period.id, 3);
      expect(rp.currentOpportunity).toBe(3);
    });

    it('marca oportunidades saltadas como NP', async () => {
      const { structure, insSub } = await setupPeriodForRevision('rev15');
      await createTestSetting('passing_grade', '10');
      await SubjectTermGrade.create({ inscriptionSubjectId: insSub.id, termId: (await Term.findOne({ where: { schoolPeriodId: structure.period.id, order: 1 } }))!.id, score: 5 });
      await SubjectTermGrade.create({ inscriptionSubjectId: insSub.id, termId: (await Term.findOne({ where: { schoolPeriodId: structure.period.id, order: 2 } }))!.id, score: 5 });
      const { revisionPeriod } = await RevisionPeriodService.openRevisionPeriod(structure.period.id);
      await RevisionPeriodService.updateMaxOpportunities(structure.period.id, 5);

      await RevisionPeriodService.setOpportunity(structure.period.id, 3);

      const skipped = await InscriptionSubjectRevision.findAll({
        where: { revisionPeriodId: revisionPeriod.id, opportunity: 1 },
      });
      expect(skipped[0].isAbsent).toBe(true);
      expect(skipped[0].score).toBe(0);
    });

    it('rechaza valores fuera de rango', async () => {
      const { structure } = await setupPeriodForRevision('rev16');
      await RevisionPeriodService.openRevisionPeriod(structure.period.id);

      await expect(RevisionPeriodService.setOpportunity(structure.period.id, 0))
        .rejects.toThrow('entre 1 y');
      await expect(RevisionPeriodService.setOpportunity(structure.period.id, 99))
        .rejects.toThrow('entre 1 y');
    });
  });

  describe('resetRevisionPeriod', () => {
    it('elimina todas las revisions y resetea a pending', async () => {
      const { structure, insSub } = await setupPeriodForRevision('rev17');
      await createTestSetting('passing_grade', '10');
      await SubjectTermGrade.create({ inscriptionSubjectId: insSub.id, termId: (await Term.findOne({ where: { schoolPeriodId: structure.period.id, order: 1 } }))!.id, score: 5 });
      await SubjectTermGrade.create({ inscriptionSubjectId: insSub.id, termId: (await Term.findOne({ where: { schoolPeriodId: structure.period.id, order: 2 } }))!.id, score: 5 });
      const { revisionPeriod } = await RevisionPeriodService.openRevisionPeriod(structure.period.id);

      const result = await RevisionPeriodService.resetRevisionPeriod(structure.period.id);
      expect(result.revisionPeriod.status).toBe('pending');
      expect(result.deleted).toBeGreaterThan(0);

      const count = await InscriptionSubjectRevision.count({
        where: { revisionPeriodId: revisionPeriod.id },
      });
      expect(count).toBe(0);
    });

    it('rechaza si no existe el período de revisión', async () => {
      const structure = await createAcademicStructure();
      await expect(RevisionPeriodService.resetRevisionPeriod(structure.period.id))
        .rejects.toThrow('No existe un período de revisión');
    });
  });

  describe('recalculateRevisionPeriod', () => {
    it('rechaza si no está open', async () => {
      const structure = await createAcademicStructure();
      await RevisionPeriod.create({ schoolPeriodId: structure.period.id });

      await expect(RevisionPeriodService.recalculateRevisionPeriod(structure.period.id))
        .rejects.toThrow('debe estar abierto');
    });

    it('elimina pending de materias ahora aprobadas', async () => {
      const { structure, insSub, term1, term2 } = await setupPeriodForRevision('rev18');
      await createTestSetting('passing_grade', '10');
      // Initially failing
      await SubjectTermGrade.create({ inscriptionSubjectId: insSub.id, termId: term1.id, score: 5 });
      await SubjectTermGrade.create({ inscriptionSubjectId: insSub.id, termId: term2.id, score: 5 });
      const { revisionPeriod } = await RevisionPeriodService.openRevisionPeriod(structure.period.id);

      // Now the student passes — update term grades
      await SubjectTermGrade.update({ score: 14 }, {
        where: { inscriptionSubjectId: insSub.id, termId: term1.id },
      });
      await SubjectTermGrade.update({ score: 14 }, {
        where: { inscriptionSubjectId: insSub.id, termId: term2.id },
      });

      const result = await RevisionPeriodService.recalculateRevisionPeriod(structure.period.id);
      expect(result.removed).toBe(1);
      expect(result.created).toBe(0);
    });

    it('crea pending para nuevas materias reprobadas', async () => {
      const { structure, insSub, term1, term2 } = await setupPeriodForRevision('rev19');
      await createTestSetting('passing_grade', '10');
      // Initially passing
      await SubjectTermGrade.create({ inscriptionSubjectId: insSub.id, termId: term1.id, score: 14 });
      await SubjectTermGrade.create({ inscriptionSubjectId: insSub.id, termId: term2.id, score: 14 });
      const { revisionPeriod } = await RevisionPeriodService.openRevisionPeriod(structure.period.id);

      // Now the student fails — update term grades
      await SubjectTermGrade.update({ score: 5 }, {
        where: { inscriptionSubjectId: insSub.id, termId: term1.id },
      });
      await SubjectTermGrade.update({ score: 5 }, {
        where: { inscriptionSubjectId: insSub.id, termId: term2.id },
      });

      const result = await RevisionPeriodService.recalculateRevisionPeriod(structure.period.id);
      expect(result.created).toBe(1);
      expect(result.removed).toBe(0);
    });
  });
});
