import {
  TermSectionClosureService,
} from '@/services/termSectionClosureService';
import {
  Term,
  TermSectionClosure,
  Section,
} from '@/models/index';
import {
  createTestTerm,
  createAcademicStructure,
  createTestUser,
  createTestSection,
} from '../helpers/testData';

describe('TermSectionClosureService', () => {
  describe('isSectionClosed', () => {
    it('retorna true cuando el term está globalmente bloqueado', async () => {
      const structure = await createAcademicStructure();
      const term = await createTestTerm(structure.period.id, { isBlocked: true });
      const result = await TermSectionClosureService.isSectionClosed(term.id, structure.section.id, structure.grade.id);
      expect(result).toBe(true);
    });

    it('retorna true cuando existe TermSectionClosure', async () => {
      const structure = await createAcademicStructure();
      const term = await createTestTerm(structure.period.id, { isBlocked: false });
      await TermSectionClosure.create({
        termId: term.id,
        sectionId: structure.section.id,
        gradeId: structure.grade.id,
        closedAt: new Date(),
      });
      const result = await TermSectionClosureService.isSectionClosed(term.id, structure.section.id, structure.grade.id);
      expect(result).toBe(true);
    });

    it('retorna false cuando no hay closure y el term no está bloqueado', async () => {
      const structure = await createAcademicStructure();
      const term = await createTestTerm(structure.period.id, { isBlocked: false });
      const result = await TermSectionClosureService.isSectionClosed(term.id, structure.section.id, structure.grade.id);
      expect(result).toBe(false);
    });

    it('retorna false cuando no hay gradeId y el term no está bloqueado', async () => {
      const structure = await createAcademicStructure();
      const term = await createTestTerm(structure.period.id, { isBlocked: false });
      const result = await TermSectionClosureService.isSectionClosed(term.id, structure.section.id);
      expect(result).toBe(false);
    });

    it('retorna false cuando el term no existe', async () => {
      const result = await TermSectionClosureService.isSectionClosed(99999, 1, 1);
      expect(result).toBe(false);
    });
  });

  describe('getClosedSections', () => {
    it('retorna null cuando el term está globalmente bloqueado', async () => {
      const structure = await createAcademicStructure();
      const term = await createTestTerm(structure.period.id, { isBlocked: true });
      const result = await TermSectionClosureService.getClosedSections(term.id);
      expect(result).toBeNull();
    });

    it('retorna [] cuando no hay closures', async () => {
      const structure = await createAcademicStructure();
      const term = await createTestTerm(structure.period.id, { isBlocked: false });
      const result = await TermSectionClosureService.getClosedSections(term.id);
      expect(result).toEqual([]);
    });

    it('retorna la lista de sections cerradas', async () => {
      const structure = await createAcademicStructure();
      const term = await createTestTerm(structure.period.id, { isBlocked: false });
      await TermSectionClosure.create({
        termId: term.id,
        sectionId: structure.section.id,
        gradeId: structure.grade.id,
        closedAt: new Date(),
      });
      const result = await TermSectionClosureService.getClosedSections(term.id);
      expect(result).toHaveLength(1);
      expect(result![0].sectionId).toBe(structure.section.id);
      expect(result![0].gradeId).toBe(structure.grade.id);
    });

    it('retorna [] cuando el term no existe', async () => {
      const result = await TermSectionClosureService.getClosedSections(99999);
      expect(result).toEqual([]);
    });
  });

  describe('closeSection', () => {
    it('crea un registro de cierre', async () => {
      const structure = await createAcademicStructure();
      const term = await createTestTerm(structure.period.id, { isBlocked: false });
      const closure = await TermSectionClosureService.closeSection({
        termId: term.id,
        sectionId: structure.section.id,
        gradeId: structure.grade.id,
      });
      expect(closure).toBeDefined();
      expect(closure.termId).toBe(term.id);
      expect(closure.sectionId).toBe(structure.section.id);
    });

    it('es idempotente (findOrCreate)', async () => {
      const structure = await createAcademicStructure();
      const term = await createTestTerm(structure.period.id, { isBlocked: false });
      await TermSectionClosureService.closeSection({
        termId: term.id,
        sectionId: structure.section.id,
        gradeId: structure.grade.id,
      });
      await TermSectionClosureService.closeSection({
        termId: term.id,
        sectionId: structure.section.id,
        gradeId: structure.grade.id,
      });
      const count = await TermSectionClosure.count({
        where: { termId: term.id, sectionId: structure.section.id, gradeId: structure.grade.id },
      });
      expect(count).toBe(1);
    });

    it('guarda closedBy cuando se provee', async () => {
      const structure = await createAcademicStructure();
      const term = await createTestTerm(structure.period.id, { isBlocked: false });
      const { user } = await createTestUser({ username: 'closer' });
      const closure = await TermSectionClosureService.closeSection({
        termId: term.id,
        sectionId: structure.section.id,
        gradeId: structure.grade.id,
        closedBy: user.id,
      });
      expect(closure.closedBy).toBe(user.id);
    });
  });

  describe('reopenSection', () => {
    it('elimina el registro de cierre', async () => {
      const structure = await createAcademicStructure();
      const term = await createTestTerm(structure.period.id, { isBlocked: false });
      await TermSectionClosureService.closeSection({
        termId: term.id,
        sectionId: structure.section.id,
        gradeId: structure.grade.id,
      });
      await TermSectionClosureService.reopenSection(term.id, structure.section.id, structure.grade.id);
      const count = await TermSectionClosure.count({
        where: { termId: term.id, sectionId: structure.section.id, gradeId: structure.grade.id },
      });
      expect(count).toBe(0);
    });

    it('no falla si no hay registro que eliminar', async () => {
      const structure = await createAcademicStructure();
      const term = await createTestTerm(structure.period.id, { isBlocked: false });
      await TermSectionClosureService.reopenSection(term.id, structure.section.id, structure.grade.id);
      // No error thrown
    });
  });

  describe('areAllSectionsClosed', () => {
    it('retorna true cuando el term está globalmente bloqueado', async () => {
      const structure = await createAcademicStructure();
      const term = await createTestTerm(structure.period.id, { isBlocked: true });
      const result = await TermSectionClosureService.areAllSectionsClosed(term.id, structure.period.id);
      expect(result).toBe(true);
    });

    it('retorna true cuando todas las secciones están cerradas', async () => {
      const structure = await createAcademicStructure();
      const term = await createTestTerm(structure.period.id, { isBlocked: false });
      await TermSectionClosure.create({
        termId: term.id,
        sectionId: structure.section.id,
        gradeId: structure.grade.id,
        closedAt: new Date(),
      });
      const result = await TermSectionClosureService.areAllSectionsClosed(term.id, structure.period.id);
      expect(result).toBe(true);
    });

    it('retorna false cuando algunas secciones no están cerradas', async () => {
      const structure = await createAcademicStructure();
      const extraSection = await createTestSection();
      const { PeriodGradeSection } = await import('@/models/index');
      await PeriodGradeSection.create({
        periodGradeId: structure.periodGrade.id,
        sectionId: extraSection.id,
      });
      const term = await createTestTerm(structure.period.id, { isBlocked: false });
      // Close only one of two sections
      await TermSectionClosure.create({
        termId: term.id,
        sectionId: structure.section.id,
        gradeId: structure.grade.id,
        closedAt: new Date(),
      });
      const result = await TermSectionClosureService.areAllSectionsClosed(term.id, structure.period.id);
      expect(result).toBe(false);
    });

    it('retorna true cuando no hay secciones (vacuously true)', async () => {
      const { createTestPeriod } = await import('../helpers/testData');
      const period = await createTestPeriod();
      const term = await createTestTerm(period.id, { isBlocked: false });
      const result = await TermSectionClosureService.areAllSectionsClosed(term.id, period.id);
      expect(result).toBe(true);
    });
  });

  describe('areAllTermsFullyClosed', () => {
    it('retorna true cuando todos los terms están bloqueados', async () => {
      const structure = await createAcademicStructure();
      await createTestTerm(structure.period.id, { isBlocked: true, order: 1 });
      await createTestTerm(structure.period.id, { isBlocked: true, order: 2 });
      const result = await TermSectionClosureService.areAllTermsFullyClosed(structure.period.id);
      expect(result).toBe(true);
    });

    it('retorna true cuando no hay terms', async () => {
      const { createTestPeriod } = await import('../helpers/testData');
      const period = await createTestPeriod();
      const result = await TermSectionClosureService.areAllTermsFullyClosed(period.id);
      expect(result).toBe(true);
    });

    it('retorna false cuando algún term no tiene todas sus secciones cerradas', async () => {
      const structure = await createAcademicStructure();
      await createTestTerm(structure.period.id, { isBlocked: true, order: 1 });
      await createTestTerm(structure.period.id, { isBlocked: false, order: 2 });
      const result = await TermSectionClosureService.areAllTermsFullyClosed(structure.period.id);
      expect(result).toBe(false);
    });
  });

  describe('getClosureStatus', () => {
    it('retorna summary correcto para term bloqueado', async () => {
      const structure = await createAcademicStructure();
      const term = await createTestTerm(structure.period.id, { isBlocked: true });
      const status = await TermSectionClosureService.getClosureStatus(term.id, structure.period.id);
      expect(status.termGloballyBlocked).toBe(true);
      expect(status.allClosed).toBe(true);
      expect(status.closedSections).toBeNull();
    });

    it('retorna summary correcto para term no bloqueado con secciones cerradas', async () => {
      const structure = await createAcademicStructure();
      const term = await createTestTerm(structure.period.id, { isBlocked: false });
      await TermSectionClosure.create({
        termId: term.id,
        sectionId: structure.section.id,
        gradeId: structure.grade.id,
        closedAt: new Date(),
      });
      const status = await TermSectionClosureService.getClosureStatus(term.id, structure.period.id);
      expect(status.termGloballyBlocked).toBe(false);
      expect(status.allClosed).toBe(true);
      expect(status.totalSections).toBe(1);
      expect(status.closedSections).toHaveLength(1);
    });

    it('retorna allClosed=false cuando no todas están cerradas', async () => {
      const structure = await createAcademicStructure();
      const term = await createTestTerm(structure.period.id, { isBlocked: false });
      const status = await TermSectionClosureService.getClosureStatus(term.id, structure.period.id);
      expect(status.allClosed).toBe(false);
      expect(status.totalSections).toBe(1);
      expect(status.closedSections).toHaveLength(0);
    });

    it('retorna vacío cuando el term no existe', async () => {
      const status = await TermSectionClosureService.getClosureStatus(99999, 1);
      expect(status.totalSections).toBe(0);
      expect(status.allClosed).toBe(false);
      expect(status.termGloballyBlocked).toBe(false);
    });
  });
});
