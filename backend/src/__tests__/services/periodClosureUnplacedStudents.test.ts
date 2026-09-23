import '../setup';
import { Inscription, Matriculation, Person, PeriodGradeSection } from '@/models/index';
import {
  createFullClosureSetup,
  createStudentWithGrades,
  markCouncilsDone,
  executeClosure,
  validateClosure,
  ClosureSetup,
} from '../helpers/periodClosureTestHelper';

/**
 * Regla: no se puede cerrar el año con estudiantes del período actual
 * inscritos pero sin sección ("No Matriculados"). Las preinscripciones del
 * período siguiente no bloquean y quedan en "No Matriculados" de ese período.
 */
describe('Cierre de período — estudiantes inscritos sin sección', () => {
  let setup: ClosureSetup;
  let counter = 0;

  const createPerson = async (lastName: string) => {
    counter += 1;
    return Person.create({
      firstName: 'Sin',
      lastName,
      document: `U${Date.now()}${counter}`,
      documentType: 'Venezolano',
      birthdate: new Date('2010-01-01'),
      gender: 'F',
    });
  };

  const createPendingMatriculation = async (personId: number, schoolPeriodId: number, status: 'pending' | 'withdrawn' = 'pending') =>
    Matriculation.create({
      schoolPeriodId,
      gradeId: setup.grades[0].id,
      sectionId: null,
      personId,
      status,
      escolaridad: 'regular',
      hiddenFromControlEstudios: false,
    });

  beforeEach(async () => {
    setup = await createFullClosureSetup({ gradeCount: 2, subjectsPerGrade: 1 });
    await markCouncilsDone(setup);
  });

  it('U1: bloquea el cierre si hay un estudiante del período actual inscrito sin sección, y lo nombra', async () => {
    const person = await createPerson('Pendiente');
    await createPendingMatriculation(person.id, setup.currentPeriod.id);

    const validation = await validateClosure(setup);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some(e => e.includes('sin sección'))).toBe(true);
    expect(validation.errors.some(e => e.toLowerCase().includes('pendiente') && e.includes(person.document!))).toBe(true);

    const result = await executeClosure(setup);
    expect(result.success).toBe(false);
  });

  it('U2: un retirado del período actual no bloquea el cierre', async () => {
    const person = await createPerson('Retirado');
    await createPendingMatriculation(person.id, setup.currentPeriod.id, 'withdrawn');

    const validation = await validateClosure(setup);
    expect(validation.errors.some(e => e.includes('sin sección'))).toBe(false);
    expect(validation.valid).toBe(true);
  });

  it('U3: una preinscripción del período siguiente no bloquea y queda en No Matriculados de ese período', async () => {
    const person = await createPerson('Preinscrito');
    const pre = await createPendingMatriculation(person.id, setup.nextPeriod.id);

    const validation = await validateClosure(setup);
    expect(validation.valid).toBe(true);

    const result = await executeClosure(setup);
    expect(result.success).toBe(true);

    const after = await Matriculation.findByPk(pre.id);
    expect(after!.schoolPeriodId).toBe(setup.nextPeriod.id);
    expect(after!.status).toBe('pending');
    expect(after!.sectionId).toBeNull();
    expect(await Inscription.count({ where: { personId: person.id } })).toBe(0);
  });

  it('U4: si un estudiante del período actual ya tenía preinscripción en el siguiente, el resultado del cierre prevalece y queda matriculado con su sección', async () => {
    // Real-world structure: sections are shared across grades ("SECCIÓN A" is the
    // same Section in every year), so the student's section exists in the
    // promoted grade of the next period.
    const nextGrade2 = setup.periodGradesNext.get(setup.grades[1].id)!;
    await PeriodGradeSection.create({ periodGradeId: nextGrade2.id, sectionId: setup.sections[0].id });
    const student = await createStudentWithGrades(setup, 0, { 0: 18 });
    // Current-period matriculation record (matriculated, with section)
    await Matriculation.create({
      schoolPeriodId: setup.currentPeriod.id,
      gradeId: setup.grades[0].id,
      sectionId: setup.sections[0].id,
      personId: student.person.id,
      inscriptionId: student.inscription.id,
      status: 'completed',
      escolaridad: 'regular',
      hiddenFromControlEstudios: false,
    });
    const pre = await createPendingMatriculation(student.person.id, setup.nextPeriod.id);

    const result = await executeClosure(setup);
    expect(result.success).toBe(true);

    const nextInscription = await Inscription.findOne({
      where: { personId: student.person.id, schoolPeriodId: setup.nextPeriod.id },
    });
    expect(nextInscription).not.toBeNull();
    expect(nextInscription!.sectionId).not.toBeNull();

    const after = await Matriculation.findByPk(pre.id);
    expect(after!.status).toBe('completed');
    expect(after!.inscriptionId).toBe(nextInscription!.id);
    expect(after!.sectionId).toBe(nextInscription!.sectionId);
    expect(after!.gradeId).toBe(nextInscription!.gradeId);
  });
});
