import {
  resolveCouncilDate,
  formatDateInCaracas,
} from '@/services/councilDateResolver';
import {
  CouncilChecklist,
  Term,
} from '@/models/index';
import {
  createTestPeriod,
  createAcademicStructure,
  createTestTerm,
} from '../helpers/testData';

describe('councilDateResolver', () => {
  describe('formatDateInCaracas', () => {
    it('formatea un Date a YYYY-MM-DD en America/Caracas', () => {
      // 2026-07-16T02:30:00Z == 2026-07-15 22:30 en Caracas (UTC-4)
      const date = new Date('2026-07-16T02:30:00Z');
      expect(formatDateInCaracas(date)).toBe('2026-07-15');
    });

    it('no desplaza el día cuando el instante es mediodía Caracas', () => {
      const date = new Date('2026-07-15T16:30:00Z'); // 12:30 Caracas
      expect(formatDateInCaracas(date)).toBe('2026-07-15');
    });

    it('acepta strings YYYY-MM-DD sin modificarlos', () => {
      expect(formatDateInCaracas('2026-07-15')).toBe('2026-07-15');
    });

    it('retorna null para valores vacíos', () => {
      expect(formatDateInCaracas(null)).toBeNull();
      expect(formatDateInCaracas(undefined)).toBeNull();
      expect(formatDateInCaracas('')).toBeNull();
    });
  });

  describe('resolveCouncilDate', () => {
    it('usa el override del lapso cuando está marcado (aunque exista checklist)', async () => {
      const period = await createTestPeriod();
      const term = await createTestTerm(period.id, { order: 1 });
      const structure = await createAcademicStructure({ periodId: period.id });

      await term.update({ councilCompletedAtOverride: '2026-07-15' });
      await CouncilChecklist.create({
        schoolPeriodId: period.id,
        gradeId: structure.grade.id,
        sectionId: structure.section.id,
        termId: term.id,
        status: 'done',
        completedAt: new Date('2026-09-10T12:00:00Z'),
      });

      const result = await resolveCouncilDate({
        schoolPeriodId: period.id,
        sectionId: structure.section.id,
      });
      expect(result).toBe('2026-07-15');
    });

    it('usa completedAt del checklist del último lapso cuando no hay override', async () => {
      const period = await createTestPeriod();
      const term1 = await createTestTerm(period.id, { order: 1 });
      const term2 = await createTestTerm(period.id, { order: 2 });
      const structure = await createAcademicStructure({ periodId: period.id });

      // Checklist done en el primer lapso (no debe usarse)
      await CouncilChecklist.create({
        schoolPeriodId: period.id,
        gradeId: structure.grade.id,
        sectionId: structure.section.id,
        termId: term1.id,
        status: 'done',
        completedAt: new Date('2026-05-01T12:00:00Z'),
      });
      // Checklist done en el último lapso con fecha en julio
      await CouncilChecklist.create({
        schoolPeriodId: period.id,
        gradeId: structure.grade.id,
        sectionId: structure.section.id,
        termId: term2.id,
        status: 'done',
        completedAt: new Date('2026-07-15T19:30:00Z'), // 15:30 Caracas
      });

      const result = await resolveCouncilDate({
        schoolPeriodId: period.id,
        sectionId: structure.section.id,
      });
      expect(result).toBe('2026-07-15');
    });

    it('retorna null cuando no hay override ni checklist done', async () => {
      const period = await createTestPeriod();
      await createTestTerm(period.id, { order: 1 });
      const structure = await createAcademicStructure({ periodId: period.id });

      const result = await resolveCouncilDate({
        schoolPeriodId: period.id,
        sectionId: structure.section.id,
      });
      expect(result).toBeNull();
    });

    it('retorna null cuando el checklist existe pero no está done', async () => {
      const period = await createTestPeriod();
      const term = await createTestTerm(period.id, { order: 1 });
      const structure = await createAcademicStructure({ periodId: period.id });

      await CouncilChecklist.create({
        schoolPeriodId: period.id,
        gradeId: structure.grade.id,
        sectionId: structure.section.id,
        termId: term.id,
        status: 'open',
      });

      const result = await resolveCouncilDate({
        schoolPeriodId: period.id,
        sectionId: structure.section.id,
      });
      expect(result).toBeNull();
    });

    it('usa el lapso con mayor order como último lapso', async () => {
      const period = await createTestPeriod();
      const term1 = await createTestTerm(period.id, { order: 1 });
      const term2 = await createTestTerm(period.id, { order: 2 });
      const term3 = await createTestTerm(period.id, { order: 3 });
      const structure = await createAcademicStructure({ periodId: period.id });

      await term1.update({ councilCompletedAtOverride: '2026-01-10' });
      await term2.update({ councilCompletedAtOverride: '2026-04-10' });
      await term3.update({ councilCompletedAtOverride: '2026-07-10' });

      const result = await resolveCouncilDate({
        schoolPeriodId: period.id,
        sectionId: structure.section.id,
      });
      expect(result).toBe('2026-07-10');
    });

    it('respeta termId explícito cuando se provee', async () => {
      const period = await createTestPeriod();
      const term1 = await createTestTerm(period.id, { order: 1 });
      const term2 = await createTestTerm(period.id, { order: 2 });
      await term2.update({ councilCompletedAtOverride: '2026-07-10' });

      const result = await resolveCouncilDate({
        schoolPeriodId: period.id,
        termId: term1.id,
      });
      expect(result).toBeNull();
    });

    it('retorna null cuando el período no tiene lapsos', async () => {
      const period = await createTestPeriod();
      const result = await resolveCouncilDate({
        schoolPeriodId: period.id,
      });
      expect(result).toBeNull();
    });

    it('el override aplica a todas las secciones del lapso', async () => {
      const period = await createTestPeriod();
      const term = await createTestTerm(period.id, { order: 1 });
      const s1 = await createAcademicStructure({ periodId: period.id });
      const s2 = await createAcademicStructure({ periodId: period.id });
      await term.update({ councilCompletedAtOverride: '2026-07-20' });

      const r1 = await resolveCouncilDate({
        schoolPeriodId: period.id,
        sectionId: s1.section.id,
      });
      const r2 = await resolveCouncilDate({
        schoolPeriodId: period.id,
        sectionId: s2.section.id,
      });
      expect(r1).toBe('2026-07-20');
      expect(r2).toBe('2026-07-20');
    });

    it('sin override, secciones sin checklist caen al fallback null aunque otras secciones tengan checklist', async () => {
      const period = await createTestPeriod();
      const term = await createTestTerm(period.id, { order: 1 });
      const s1 = await createAcademicStructure({ periodId: period.id });
      const s2 = await createAcademicStructure({ periodId: period.id });

      await CouncilChecklist.create({
        schoolPeriodId: period.id,
        gradeId: s1.grade.id,
        sectionId: s1.section.id,
        termId: term.id,
        status: 'done',
        completedAt: new Date('2026-07-15T19:30:00Z'),
      });

      const withChecklist = await resolveCouncilDate({
        schoolPeriodId: period.id,
        sectionId: s1.section.id,
      });
      const withoutChecklist = await resolveCouncilDate({
        schoolPeriodId: period.id,
        sectionId: s2.section.id,
      });
      expect(withChecklist).toBe('2026-07-15');
      expect(withoutChecklist).toBeNull();
    });

    it('no consulta Terms de otros períodos', async () => {
      const periodA = await createTestPeriod();
      const periodB = await createTestPeriod();
      const termA = await createTestTerm(periodA.id, { order: 1 });
      await createTestTerm(periodB.id, { order: 1 });
      await termA.update({ councilCompletedAtOverride: '2026-07-15' });

      const resultForB = await resolveCouncilDate({ schoolPeriodId: periodB.id });
      expect(resultForB).toBeNull();

      const resultForA = await resolveCouncilDate({ schoolPeriodId: periodA.id });
      expect(resultForA).toBe('2026-07-15');
    });

    it('usa Term.findOne con order DESC internamente (último lapso aunque orders no sean consecutivos)', async () => {
      const period = await createTestPeriod();
      const term1 = await createTestTerm(period.id, { order: 1 });
      const term5 = await createTestTerm(period.id, { order: 5 });
      await term5.update({ councilCompletedAtOverride: '2026-07-15' });
      void term1;

      const result = await resolveCouncilDate({ schoolPeriodId: period.id });
      expect(result).toBe('2026-07-15');
    });
  });
});
