import '../setup';
import {
  Grade,
  Section,
  Subject,
  SubjectGroup,
  PeriodGrade,
  PeriodGradeSection,
  PeriodGradeSubject,
  TeacherAssignment,
  ThematicComponent,
  ThematicContent,
  ExpectedLearning,
  ExpectedLearningContent,
} from '@/models/index';
import {
  createTestPeriod,
  createTestTerm,
  createTestUser,
} from '../helpers/testData';
import { copyThematicTree, mapThematicIdsByTitle } from '@/services/thematicCopyService';

describe('thematicCopyService — copyThematicTree', () => {
  const buildStructure = async () => {
    const period = await createTestPeriod();
    const term = await createTestTerm(period.id);
    const group = await SubjectGroup.create({ name: 'Área Técnica' });
    const subject = await Subject.create({ name: 'Artes Gráficas', subjectGroupId: group.id });

    const gradeA = await Grade.create({ name: 'Primer Año', isDiversified: false });
    const gradeB = await Grade.create({ name: 'Segundo Año', isDiversified: false });
    const sectionA = await Section.create({ name: 'A', isMateriaPendiente: false });
    const sectionB = await Section.create({ name: 'A2', isMateriaPendiente: false });

    const pgA = await PeriodGrade.create({ schoolPeriodId: period.id, gradeId: gradeA.id });
    const pgB = await PeriodGrade.create({ schoolPeriodId: period.id, gradeId: gradeB.id });
    await PeriodGradeSection.create({ periodGradeId: pgA.id, sectionId: sectionA.id });
    await PeriodGradeSection.create({ periodGradeId: pgB.id, sectionId: sectionB.id });
    const pgsA = await PeriodGradeSubject.create({ periodGradeId: pgA.id, subjectId: subject.id, order: 1 });
    const pgsB = await PeriodGradeSubject.create({ periodGradeId: pgB.id, subjectId: subject.id, order: 1 });

    const { person: teacher } = await createTestUser({ username: 'profesor' });
    await TeacherAssignment.create({ teacherId: teacher.id, periodGradeSubjectId: pgsA.id, sectionId: sectionA.id });
    await TeacherAssignment.create({ teacherId: teacher.id, periodGradeSubjectId: pgsB.id, sectionId: sectionB.id });

    return { period, term, group, subject, gradeA, gradeB, sectionA, sectionB, pgsA, pgsB, teacher };
  };

  it('copies the full tree (components, contents, learnings) to the other grade', async () => {
    const { term, pgsA, pgsB, teacher } = await buildStructure();

    const comp = await ThematicComponent.create({
      periodGradeSubjectId: pgsA.id, termId: term.id, teacherId: teacher.id, title: 'Dibujo', order: 1,
    });
    const c1 = await ThematicContent.create({ thematicComponentId: comp.id, title: 'Línea', order: 1 });
    const c2 = await ThematicContent.create({ thematicComponentId: comp.id, title: 'Color', order: 2 });
    const learning = await ExpectedLearning.create({ description: 'Domina el trazo', order: 1 });
    await ExpectedLearningContent.create({ learningId: learning.id, contentId: c1.id });
    await ExpectedLearningContent.create({ learningId: learning.id, contentId: c2.id });

    const result = await copyThematicTree({
      sourcePeriodGradeSubjectId: pgsA.id,
      targetPeriodGradeSubjectId: pgsB.id,
      termId: term.id,
      sourceTeacherId: teacher.id,
      targetTeacherId: teacher.id,
    });

    expect(result.createdComponents).toBe(1);
    expect(result.createdContents).toBe(2);
    // One learning linked to two contents → a single clone linked to both.
    expect(result.createdLearnings).toBe(1);

    const targetComp = await ThematicComponent.findOne({
      where: { periodGradeSubjectId: pgsB.id, termId: term.id, teacherId: teacher.id },
      include: [{ association: 'contents', include: [{ association: 'learnings' }] }],
    });
    expect(targetComp).not.toBeNull();
    expect(targetComp!.title).toBe('Dibujo');
    expect(result.componentIdMap.get(comp.id)).toBe(targetComp!.id);

    const contents = (targetComp as any).contents as any[];
    expect(contents.map((c: any) => c.title).sort()).toEqual(['Color', 'Línea']);
    const linea = contents.find((c: any) => c.title === 'Línea');
    expect(result.contentIdMap.get(c1.id)).toBe(linea.id);
    expect(linea.learnings.map((l: any) => l.description)).toEqual(['Domina el trazo']);
  });

  it('is additive: existing target components are reused, missing contents are merged', async () => {
    const { term, pgsA, pgsB, teacher } = await buildStructure();

    const comp = await ThematicComponent.create({
      periodGradeSubjectId: pgsA.id, termId: term.id, teacherId: teacher.id, title: 'Dibujo', order: 1,
    });
    await ThematicContent.create({ thematicComponentId: comp.id, title: 'Línea', order: 1 });
    await ThematicContent.create({ thematicComponentId: comp.id, title: 'Color', order: 2 });

    // Target already has the component and one of the contents.
    const existingComp = await ThematicComponent.create({
      periodGradeSubjectId: pgsB.id, termId: term.id, teacherId: teacher.id, title: 'dibujo ', order: 1,
    });
    const existingContent = await ThematicContent.create({ thematicComponentId: existingComp.id, title: 'Línea', order: 1 });

    const result = await copyThematicTree({
      sourcePeriodGradeSubjectId: pgsA.id,
      targetPeriodGradeSubjectId: pgsB.id,
      termId: term.id,
      sourceTeacherId: teacher.id,
      targetTeacherId: teacher.id,
    });

    expect(result.createdComponents).toBe(0);
    expect(result.skippedComponents).toBe(1);
    expect(result.createdContents).toBe(1); // only "Color"
    expect(result.skippedContents).toBe(1); // "Línea"
    expect(result.componentIdMap.get(comp.id)).toBe(existingComp.id);

    const contents = await ThematicContent.findAll({ where: { thematicComponentId: existingComp.id } });
    expect(contents.length).toBe(2);
    expect(contents.map((c) => c.title).sort()).toEqual(['Color', 'Línea']);
    expect(result.contentIdMap.get((await ThematicContent.findOne({ where: { thematicComponentId: comp.id, title: 'Línea' } }))!.id)).toBe(existingContent.id);
  });

  it('respects onlyComponentIds and scopes the copy to the target teacher', async () => {
    const { term, pgsA, pgsB, teacher } = await buildStructure();
    const { person: otherTeacher } = await createTestUser({ username: 'otro-prof' });

    const compA = await ThematicComponent.create({
      periodGradeSubjectId: pgsA.id, termId: term.id, teacherId: teacher.id, title: 'Dibujo', order: 1,
    });
    const compB = await ThematicComponent.create({
      periodGradeSubjectId: pgsA.id, termId: term.id, teacherId: teacher.id, title: 'Grabado', order: 2,
    });
    await ThematicContent.create({ thematicComponentId: compA.id, title: 'Línea', order: 1 });
    await ThematicContent.create({ thematicComponentId: compB.id, title: 'Punta seca', order: 1 });

    const result = await copyThematicTree({
      sourcePeriodGradeSubjectId: pgsA.id,
      targetPeriodGradeSubjectId: pgsB.id,
      termId: term.id,
      sourceTeacherId: teacher.id,
      targetTeacherId: otherTeacher.id,
      onlyComponentIds: [compA.id],
    });

    expect(result.createdComponents).toBe(1);
    expect(result.componentIdMap.has(compB.id)).toBe(false);

    const targetComps = await ThematicComponent.findAll({ where: { periodGradeSubjectId: pgsB.id } });
    expect(targetComps.length).toBe(1);
    expect(targetComps[0].title).toBe('Dibujo');
    expect(targetComps[0].teacherId).toBe(otherTeacher.id);
  });

  it('mapThematicIdsByTitle remaps without writing', async () => {
    const { term, pgsA, pgsB, teacher } = await buildStructure();

    const comp = await ThematicComponent.create({
      periodGradeSubjectId: pgsA.id, termId: term.id, teacherId: teacher.id, title: 'Dibujo', order: 1,
    });
    const c1 = await ThematicContent.create({ thematicComponentId: comp.id, title: 'Línea', order: 1 });

    // Before copy: no maps.
    const before = await mapThematicIdsByTitle(pgsA.id, pgsB.id, term.id, teacher.id, teacher.id);
    expect(before.componentIdMap.size).toBe(0);

    await copyThematicTree({
      sourcePeriodGradeSubjectId: pgsA.id,
      targetPeriodGradeSubjectId: pgsB.id,
      termId: term.id,
      sourceTeacherId: teacher.id,
      targetTeacherId: teacher.id,
    });

    // After copy: ids remap by title.
    const after = await mapThematicIdsByTitle(pgsA.id, pgsB.id, term.id, teacher.id, teacher.id);
    expect(after.componentIdMap.has(comp.id)).toBe(true);
    expect(after.contentIdMap.has(c1.id)).toBe(true);
  });
});
