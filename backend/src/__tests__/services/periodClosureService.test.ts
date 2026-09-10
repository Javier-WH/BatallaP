import { PeriodClosureService } from '@/services/periodClosureService';
import {
  CouncilChecklist,
  Term,
  Section,
  PeriodGradeSection,
  PeriodGrade,
  Setting,
} from '@/models/index';
import {
  createTestPeriod,
  createTestGrade,
  createTestSection,
  createTestTerm,
  createTestSetting,
  createTestUser,
  createAcademicStructure,
} from '../helpers/testData';

describe('PeriodClosureService', () => {
  describe('getChecklistEntry', () => {
    it('retorna null cuando no existe entry', async () => {
      const period = await createTestPeriod();
      const term = await createTestTerm(period.id);
      const structure = await createAcademicStructure({ periodId: period.id });
      const entry = await PeriodClosureService.getChecklistEntry({
        schoolPeriodId: period.id,
        gradeId: structure.grade.id,
        sectionId: structure.section.id,
        termId: term.id,
      });
      expect(entry).toBeNull();
    });

    it('retorna el entry cuando existe', async () => {
      const period = await createTestPeriod();
      const term = await createTestTerm(period.id);
      const structure = await createAcademicStructure({ periodId: period.id });
      await CouncilChecklist.create({
        schoolPeriodId: period.id,
        gradeId: structure.grade.id,
        sectionId: structure.section.id,
        termId: term.id,
        status: 'done',
      });
      const entry = await PeriodClosureService.getChecklistEntry({
        schoolPeriodId: period.id,
        gradeId: structure.grade.id,
        sectionId: structure.section.id,
        termId: term.id,
      });
      expect(entry).not.toBeNull();
      expect(entry!.status).toBe('done');
    });
  });

  describe('listChecklistEntries', () => {
    it('retorna entries del term correcto', async () => {
      const period = await createTestPeriod();
      const term1 = await createTestTerm(period.id, { order: 1 });
      const term2 = await createTestTerm(period.id, { order: 2 });
      const s1 = await createAcademicStructure({ periodId: period.id });
      const s2 = await createAcademicStructure({ periodId: period.id });

      await CouncilChecklist.create({
        schoolPeriodId: period.id, gradeId: s1.grade.id, sectionId: s1.section.id,
        termId: term1.id, status: 'done',
      });
      await CouncilChecklist.create({
        schoolPeriodId: period.id, gradeId: s2.grade.id, sectionId: s2.section.id,
        termId: term2.id, status: 'open',
      });

      const entries = await PeriodClosureService.listChecklistEntries({
        schoolPeriodId: period.id,
        termId: term1.id,
      });
      expect(entries).toHaveLength(1);
      expect(entries[0].gradeId).toBe(s1.grade.id);
    });

    it('retorna vacío si no hay entries', async () => {
      const period = await createTestPeriod();
      const term = await createTestTerm(period.id);
      const entries = await PeriodClosureService.listChecklistEntries({
        schoolPeriodId: period.id,
        termId: term.id,
      });
      expect(entries).toEqual([]);
    });
  });

  describe('upsertChecklistEntry', () => {
    it('crea nuevo entry si no existe', async () => {
      const period = await createTestPeriod();
      const term = await createTestTerm(period.id);
      const structure = await createAcademicStructure({ periodId: period.id });
      const { user } = await createTestUser({ username: 'tester' });

      const entry = await PeriodClosureService.upsertChecklistEntry({
        schoolPeriodId: period.id,
        gradeId: structure.grade.id,
        sectionId: structure.section.id,
        termId: term.id,
        status: 'done',
        completedBy: user.id,
      });

      expect(entry).toBeDefined();
      expect(entry.status).toBe('done');
      expect(entry.completedBy).toBe(user.id);
      expect(entry.completedAt).not.toBeNull();
    });

    it('actualiza entry existente', async () => {
      const period = await createTestPeriod();
      const term = await createTestTerm(period.id);
      const structure = await createAcademicStructure({ periodId: period.id });

      await PeriodClosureService.upsertChecklistEntry({
        schoolPeriodId: period.id,
        gradeId: structure.grade.id,
        sectionId: structure.section.id,
        termId: term.id,
        status: 'open',
      });
      const { user } = await createTestUser({ username: 'tester2' });
      const entry = await PeriodClosureService.upsertChecklistEntry({
        schoolPeriodId: period.id,
        gradeId: structure.grade.id,
        sectionId: structure.section.id,
        termId: term.id,
        status: 'done',
        completedBy: user.id,
      });

      expect(entry.status).toBe('done');
      expect(entry.completedAt).not.toBeNull();
    });

    it('status=open resetea completedAt y completedBy', async () => {
      const period = await createTestPeriod();
      const term = await createTestTerm(period.id);
      const structure = await createAcademicStructure({ periodId: period.id });
      const { user } = await createTestUser({ username: 'tester3' });

      await PeriodClosureService.upsertChecklistEntry({
        schoolPeriodId: period.id,
        gradeId: structure.grade.id,
        sectionId: structure.section.id,
        termId: term.id,
        status: 'done',
        completedBy: user.id,
      });
      const entry = await PeriodClosureService.upsertChecklistEntry({
        schoolPeriodId: period.id,
        gradeId: structure.grade.id,
        sectionId: structure.section.id,
        termId: term.id,
        status: 'open',
      });

      expect(entry.status).toBe('open');
      expect(entry.completedAt).toBeNull();
      expect(entry.completedBy).toBeNull();
    });
  });

  describe('maybeAutoTransitionActiveTerm', () => {
    it('no transiciona cuando auto_term_transition está desactivado', async () => {
      const period = await createTestPeriod();
      const term1 = await createTestTerm(period.id, { order: 1, isActive: true, isBlocked: true });
      const term2 = await createTestTerm(period.id, { order: 2, isActive: false });
      const structure = await createAcademicStructure({ periodId: period.id });
      await createTestSetting('auto_term_transition', 'false');

      await CouncilChecklist.create({
        schoolPeriodId: period.id, gradeId: structure.grade.id, sectionId: structure.section.id,
        termId: term1.id, status: 'done',
      });

      await PeriodClosureService.maybeAutoTransitionActiveTerm(period.id, term1.id);

      const t1 = await Term.findByPk(term1.id);
      const t2 = await Term.findByPk(term2.id);
      expect(t1!.isActive).toBe(true);
      expect(t2!.isActive).toBe(false);
    });

    it('transiciona al siguiente term cuando todos los consejos están done', async () => {
      const period = await createTestPeriod();
      const term1 = await createTestTerm(period.id, { order: 1, isActive: true, isBlocked: true });
      const term2 = await createTestTerm(period.id, { order: 2, isActive: false });
      const structure = await createAcademicStructure({ periodId: period.id });
      await createTestSetting('auto_term_transition', 'true');

      await CouncilChecklist.create({
        schoolPeriodId: period.id, gradeId: structure.grade.id, sectionId: structure.section.id,
        termId: term1.id, status: 'done',
      });

      await PeriodClosureService.maybeAutoTransitionActiveTerm(period.id, term1.id);

      const t1 = await Term.findByPk(term1.id);
      const t2 = await Term.findByPk(term2.id);
      expect(t1!.isActive).toBe(false);
      expect(t2!.isActive).toBe(true);
    });

    it('no transiciona cuando no todos los consejos están done', async () => {
      const period = await createTestPeriod();
      const term1 = await createTestTerm(period.id, { order: 1, isActive: true, isBlocked: true });
      const term2 = await createTestTerm(period.id, { order: 2, isActive: false });
      const s1 = await createAcademicStructure({ periodId: period.id });
      const s2 = await createAcademicStructure({ periodId: period.id });
      await createTestSetting('auto_term_transition', 'true');

      await CouncilChecklist.create({
        schoolPeriodId: period.id, gradeId: s1.grade.id, sectionId: s1.section.id,
        termId: term1.id, status: 'done',
      });
      // s2 not done

      await PeriodClosureService.maybeAutoTransitionActiveTerm(period.id, term1.id);

      const t1 = await Term.findByPk(term1.id);
      expect(t1!.isActive).toBe(true);
    });

    it('no transiciona cuando el term no es el activo', async () => {
      const period = await createTestPeriod();
      const term1 = await createTestTerm(period.id, { order: 1, isActive: true, isBlocked: true });
      const term2 = await createTestTerm(period.id, { order: 2, isActive: false });
      const structure = await createAcademicStructure({ periodId: period.id });
      await createTestSetting('auto_term_transition', 'true');

      await CouncilChecklist.create({
        schoolPeriodId: period.id, gradeId: structure.grade.id, sectionId: structure.section.id,
        termId: term2.id, status: 'done',
      });

      // Call with term2.id but term1 is active
      await PeriodClosureService.maybeAutoTransitionActiveTerm(period.id, term2.id);

      const t1 = await Term.findByPk(term1.id);
      expect(t1!.isActive).toBe(true);
    });

    it('EXCLUYE secciones "MATERIA PENDIENTE" del conteo (regresión del bug)', async () => {
      const period = await createTestPeriod();
      const term1 = await createTestTerm(period.id, { order: 1, isActive: true, isBlocked: true });
      const term2 = await createTestTerm(period.id, { order: 2, isActive: false });
      const grade = await createTestGrade();
      const sectionA = await createTestSection({ name: 'SECCIÓN A' });
      const sectionPend = await createTestSection({ name: 'MATERIA PENDIENTE' });

      const pg = await PeriodGrade.create({ schoolPeriodId: period.id, gradeId: grade.id });
      await PeriodGradeSection.create({ periodGradeId: pg.id, sectionId: sectionA.id });
      await PeriodGradeSection.create({ periodGradeId: pg.id, sectionId: sectionPend.id });

      await createTestSetting('auto_term_transition', 'true');

      // Only mark sectionA as done — sectionPend should be excluded
      await CouncilChecklist.create({
        schoolPeriodId: period.id, gradeId: grade.id, sectionId: sectionA.id,
        termId: term1.id, status: 'done',
      });

      await PeriodClosureService.maybeAutoTransitionActiveTerm(period.id, term1.id);

      const t1 = await Term.findByPk(term1.id);
      const t2 = await Term.findByPk(term2.id);
      expect(t1!.isActive).toBe(false);
      expect(t2!.isActive).toBe(true);
    });

    it('no transiciona cuando no hay siguiente term', async () => {
      const period = await createTestPeriod();
      const term1 = await createTestTerm(period.id, { order: 1, isActive: true, isBlocked: true });
      const structure = await createAcademicStructure({ periodId: period.id });
      await createTestSetting('auto_term_transition', 'true');

      await CouncilChecklist.create({
        schoolPeriodId: period.id, gradeId: structure.grade.id, sectionId: structure.section.id,
        termId: term1.id, status: 'done',
      });

      await PeriodClosureService.maybeAutoTransitionActiveTerm(period.id, term1.id);

      const t1 = await Term.findByPk(term1.id);
      expect(t1!.isActive).toBe(true); // no next term, stays active
    });

    it('no transiciona cuando no hay secciones', async () => {
      const period = await createTestPeriod();
      const term1 = await createTestTerm(period.id, { order: 1, isActive: true, isBlocked: true });
      const term2 = await createTestTerm(period.id, { order: 2, isActive: false });
      await createTestSetting('auto_term_transition', 'true');

      // No sections created
      await PeriodClosureService.maybeAutoTransitionActiveTerm(period.id, term1.id);

      const t1 = await Term.findByPk(term1.id);
      expect(t1!.isActive).toBe(true);
    });
  });
});
