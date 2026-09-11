import {
  Inscription,
  InscriptionGroupTermChoice,
  InscriptionSubject,
  Subject,
  SubjectGroup,
} from '@/models/index';
import { changeGroupSubjectFromTerm } from '@/services/groupSubjectChoiceService';
import {
  createTestPeriod,
  createTestTerm,
  createTestUser,
  createAcademicStructure,
} from '../helpers/testData';

describe('groupSubjectChoiceService', () => {
  it('aplica el cambio desde el lapso indicado y conserva las notas históricas', async () => {
    const period = await createTestPeriod();
    const term1 = await createTestTerm(period.id, { order: 1 });
    const term2 = await createTestTerm(period.id, { order: 2 });
    const structure = await createAcademicStructure({ periodId: period.id });
    const { person } = await createTestUser();
    const group = await SubjectGroup.create({ name: `Grupo ${Date.now()}` });
    const oldSubject = await Subject.create({ name: `Artes ${Date.now()}`, subjectGroupId: group.id });
    const newSubject = await Subject.create({ name: `Desfile ${Date.now()}`, subjectGroupId: group.id });
    const inscription = await Inscription.create({
      personId: person.id,
      schoolPeriodId: period.id,
      gradeId: structure.grade.id,
      sectionId: structure.section.id,
      escolaridad: 'regular',
    });
    const oldInscriptionSubject = await InscriptionSubject.create({
      inscriptionId: inscription.id,
      subjectId: oldSubject.id,
      schoolPeriodId: period.id,
      gradeId: structure.grade.id,
      sectionId: structure.section.id,
    });
    await InscriptionGroupTermChoice.create({
      inscriptionId: inscription.id,
      subjectGroupId: group.id,
      termId: term1.id,
      subjectId: oldSubject.id,
    });

    await changeGroupSubjectFromTerm(inscription.id, group.id, newSubject.id, term2.id);

    const choices = await InscriptionGroupTermChoice.findAll({
      where: { inscriptionId: inscription.id },
      order: [['termId', 'ASC']],
    });
    expect(choices.map(choice => [choice.termId, choice.subjectId])).toEqual([
      [term1.id, oldSubject.id],
      [term2.id, newSubject.id],
    ]);
    expect(await InscriptionSubject.findOne({ where: { id: oldInscriptionSubject.id } })).not.toBeNull();
    expect(await InscriptionSubject.findOne({ where: { inscriptionId: inscription.id, subjectId: newSubject.id } })).not.toBeNull();
    expect(term1.id).not.toBe(term2.id);
  });
});
