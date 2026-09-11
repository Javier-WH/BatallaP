import {
  TermSectionClosureService,
} from '@/services/termSectionClosureService';
import {
  TermSectionClosure,
  CouncilChecklist,
} from '@/models/index';
import {
  createTestTerm,
  createAcademicStructure,
  createTestGrade,
} from '../helpers/testData';

describe('TermSectionClosureService.isSectionReadOnly', () => {
  it('retorna true cuando el term está globalmente bloqueado', async () => {
    const structure = await createAcademicStructure();
    const term = await createTestTerm(structure.period.id, { isBlocked: true });
    const result = await TermSectionClosureService.isSectionReadOnly(term.id, structure.section.id, structure.grade.id);
    expect(result).toBe(true);
  });

  it('retorna true cuando existe TermSectionClosure aunque el term esté abierto', async () => {
    const structure = await createAcademicStructure();
    const term = await createTestTerm(structure.period.id, { isBlocked: false });
    await TermSectionClosure.create({
      termId: term.id,
      sectionId: structure.section.id,
      gradeId: structure.grade.id,
      closedAt: new Date(),
    });
    const result = await TermSectionClosureService.isSectionReadOnly(term.id, structure.section.id, structure.grade.id);
    expect(result).toBe(true);
  });

  it('retorna true cuando el consejo de curso está completado aunque el lapso esté desbloqueado', async () => {
    const structure = await createAcademicStructure();
    const term = await createTestTerm(structure.period.id, { isBlocked: false });
    await CouncilChecklist.create({
      schoolPeriodId: structure.period.id,
      gradeId: structure.grade.id,
      sectionId: structure.section.id,
      termId: term.id,
      status: 'done',
    });
    const result = await TermSectionClosureService.isSectionReadOnly(term.id, structure.section.id, structure.grade.id);
    expect(result).toBe(true);
  });

  it('retorna false cuando el consejo existe pero no está done', async () => {
    const structure = await createAcademicStructure();
    const term = await createTestTerm(structure.period.id, { isBlocked: false });
    await CouncilChecklist.create({
      schoolPeriodId: structure.period.id,
      gradeId: structure.grade.id,
      sectionId: structure.section.id,
      termId: term.id,
      status: 'open',
    });
    const result = await TermSectionClosureService.isSectionReadOnly(term.id, structure.section.id, structure.grade.id);
    expect(result).toBe(false);
  });

  it('retorna false cuando el consejo estaba done y se desmarca (dinámico)', async () => {
    const structure = await createAcademicStructure();
    const term = await createTestTerm(structure.period.id, { isBlocked: false });
    const checklist = await CouncilChecklist.create({
      schoolPeriodId: structure.period.id,
      gradeId: structure.grade.id,
      sectionId: structure.section.id,
      termId: term.id,
      status: 'done',
    });
    expect(await TermSectionClosureService.isSectionReadOnly(term.id, structure.section.id, structure.grade.id)).toBe(true);

    await checklist.update({ status: 'open', completedAt: null, completedBy: null });
    const result = await TermSectionClosureService.isSectionReadOnly(term.id, structure.section.id, structure.grade.id);
    expect(result).toBe(false);
  });

  it('retorna false cuando no hay bloqueo, cierre ni consejo', async () => {
    const structure = await createAcademicStructure();
    const term = await createTestTerm(structure.period.id, { isBlocked: false });
    const result = await TermSectionClosureService.isSectionReadOnly(term.id, structure.section.id, structure.grade.id);
    expect(result).toBe(false);
  });

  it('el consejo done de OTRA sección no bloquea esta sección', async () => {
    const structure = await createAcademicStructure();
    const other = await createAcademicStructure({ periodId: structure.period.id });
    const term = await createTestTerm(structure.period.id, { isBlocked: false });
    await CouncilChecklist.create({
      schoolPeriodId: structure.period.id,
      gradeId: other.grade.id,
      sectionId: other.section.id,
      termId: term.id,
      status: 'done',
    });
    const result = await TermSectionClosureService.isSectionReadOnly(term.id, structure.section.id, structure.grade.id);
    expect(result).toBe(false);
  });

  it('REGRESIÓN: misma sección compartida entre grados — consejo done de otro grado NO bloquea (scope por gradeId)', async () => {
    // Real-world scenario: the same section row (e.g. "SECCIÓN B") is reused
    // across grades. Council done for Sección B/5to año must not lock Sección B/1er año.
    const structure = await createAcademicStructure(); // section B + grade 1
    const otherGrade = await createTestGrade({ name: 'Quinto año' });
    const term = await createTestTerm(structure.period.id, { isBlocked: false });

    // Council done for the SAME section but a DIFFERENT grade
    await CouncilChecklist.create({
      schoolPeriodId: structure.period.id,
      gradeId: otherGrade.id,
      sectionId: structure.section.id,
      termId: term.id,
      status: 'done',
    });

    const result = await TermSectionClosureService.isSectionReadOnly(term.id, structure.section.id, structure.grade.id);
    expect(result).toBe(false);

    // ...and the grade whose council IS done stays read-only
    const resultOther = await TermSectionClosureService.isSectionReadOnly(term.id, structure.section.id, otherGrade.id);
    expect(resultOther).toBe(true);
  });

  it('el consejo done de OTRO lapso no bloquea este lapso', async () => {
    const structure = await createAcademicStructure();
    const term1 = await createTestTerm(structure.period.id, { order: 1, isBlocked: false });
    const term2 = await createTestTerm(structure.period.id, { order: 2, isBlocked: false });
    await CouncilChecklist.create({
      schoolPeriodId: structure.period.id,
      gradeId: structure.grade.id,
      sectionId: structure.section.id,
      termId: term1.id,
      status: 'done',
    });
    const result = await TermSectionClosureService.isSectionReadOnly(term2.id, structure.section.id, structure.grade.id);
    expect(result).toBe(false);
  });

  it('retorna false cuando el term no existe', async () => {
    const result = await TermSectionClosureService.isSectionReadOnly(99999, 1, 1);
    expect(result).toBe(false);
  });
});
