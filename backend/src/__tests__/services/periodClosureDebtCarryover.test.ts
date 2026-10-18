import '../setup';
import { Charge, Inscription, PeriodGradeSection } from '@/models/index';
import {
  createFullClosureSetup,
  createStudentWithGrades,
  markCouncilsDone,
  executeClosure,
} from '../helpers/periodClosureTestHelper';

describe('Period Closure — inherits unpaid debts', () => {
  it('a promoted student keeps owing last year\'s August and also owes the new year', async () => {
    const setup = await createFullClosureSetup({ gradeCount: 2, subjectsPerGrade: 3, nextPeriodStructure: 'none' });
    await markCouncilsDone(setup);
    await PeriodGradeSection.create({
      periodGradeId: setup.periodGradesCurrent.get(setup.grades[1].id)!.id,
      sectionId: setup.sections[0].id,
    });
    const student = await createStudentWithGrades(setup, 0, { 0: 15, 1: 15, 2: 15 });
    const oldInscription = await Inscription.findOne({
      where: { personId: student.person.id, schoolPeriodId: setup.currentPeriod.id },
    });

    await Charge.create({
      inscriptionId: oldInscription!.id, schoolPeriodId: setup.currentPeriod.id, type: 'mensualidad',
      month: 'Aug', description: 'Mensualidad', amount: 60, currency: 'USD', active: true,
    } as any);

    const result = await executeClosure(setup);
    expect(result.success).toBe(true);

    const newInscription = await Inscription.findOne({
      where: { personId: student.person.id, schoolPeriodId: setup.nextPeriod.id },
    });
    const inherited = await Charge.findAll({ where: { inscriptionId: newInscription!.id, schoolPeriodId: setup.currentPeriod.id } });
    expect(inherited).toHaveLength(1);
    expect(inherited[0].month).toBe('Aug');
    expect(Number(inherited[0].amount)).toBe(60);

    const old = await Charge.findAll({ where: { inscriptionId: oldInscription!.id } });
    expect(old.every(c => !c.active)).toBe(true);
  });
});
