import '../setup';
import {
  Inscription,
  StudentPeriodOutcome,
  PendingSubject,
  SubjectFinalGrade,
  RevisionPeriod,
} from '@/models/index';
import {
  createFullClosureSetup,
  createStudentWithGrades,
  createSeparateMPInscription,
  createRevisionGrade,
  createCompletedRevisionPeriod,
  createPendingSubjectForStudent,
  removeRegularFinalGrade,
  markCouncilsDone,
  executeClosure,
  validateClosure,
  ClosureSetup,
  StudentWithGrades,
} from '../helpers/periodClosureTestHelper';
import { FinalGradeCalculator } from '@/services/finalGradeCalculator';
import { StudentPromotionEngine } from '@/services/studentPromotionEngine';
import { PeriodClosurePreview } from '@/services/periodClosurePreview';

async function findNextInscriptions(personId: number, nextPeriodId: number): Promise<Inscription[]> {
  return Inscription.findAll({ where: { personId, schoolPeriodId: nextPeriodId } });
}

async function getOutcome(inscriptionId: number): Promise<StudentPeriodOutcome | null> {
  return StudentPeriodOutcome.findOne({ where: { inscriptionId } });
}

describe('Closure MP + Repair Sequence — Integration Tests', () => {
  let setup: ClosureSetup;

  async function standardSetup(gradeCount = 2, subjectsPerGrade = 3): Promise<ClosureSetup> {
    const s = await createFullClosureSetup({ gradeCount, subjectsPerGrade });
    await markCouncilsDone(s);
    return s;
  }

  // ============================================================
  // Repair applies even without stored regular SubjectFinalGrade
  // ============================================================
  describe('Repair with term-grade fallback', () => {
    it('reparación aprobada se aplica aunque no exista SubjectFinalGrade regular', async () => {
      setup = await standardSetup(2, 3);
      await createCompletedRevisionPeriod(setup);

      // Student in grade 0: subject 0 = 8 (reprobada), subjects 1,2 approved
      const student = await createStudentWithGrades(setup, 0, { 0: 8, 1: 15, 2: 14 });

      // Remove the pre-created regular SubjectFinalGrade for subject 0
      // (simulates the real pre-closure state)
      const insSub0 = student.inscriptionSubjects.get(setup.subjects[0].id);
      if (!insSub0) throw new Error('insSub0 not found');
      await removeRegularFinalGrade(insSub0.id);

      // Create a repair grade for subject 0 = 12 (approved)
      await createRevisionGrade(setup, insSub0.id, 1, 12, { gradedBy: setup.masterPerson.id });

      const summary = await FinalGradeCalculator.calculateForInscriptionFast(
        student.inscription.id,
      );

      // Subject 0 should be aprobada via repair, not reprobada
      const result0 = summary.subjectResults.find(r => r.subjectId === setup.subjects[0].id);
      expect(result0).toBeDefined();
      expect(result0!.status).toBe('aprobada');
      expect(result0!.finalScore).toBe(12);
      expect(summary.failedSubjects).toBe(0);
    });
  });

  // ============================================================
  // Last manual repair grade takes precedence over automatic NP
  // ============================================================
  describe('Last manual repair grade precedence', () => {
    it('última nota manual prevalece sobre NP automático posterior', async () => {
      setup = await standardSetup(2, 3);
      await createCompletedRevisionPeriod(setup);

      const student = await createStudentWithGrades(setup, 0, { 0: 8, 1: 15, 2: 14 });
      const insSub0 = student.inscriptionSubjects.get(setup.subjects[0].id)!;
      await removeRegularFinalGrade(insSub0.id);

      // Opportunity 1: manual grade = 12 (approved)
      await createRevisionGrade(setup, insSub0.id, 1, 12, { gradedBy: setup.masterPerson.id });
      // Opportunity 2: automatic NP (gradedBy = null, isAbsent = true)
      await createRevisionGrade(setup, insSub0.id, 2, 0, { gradedBy: null, isAbsent: true });

      const summary = await FinalGradeCalculator.calculateForInscriptionFast(
        student.inscription.id,
      );

      const result0 = summary.subjectResults.find(r => r.subjectId === setup.subjects[0].id);
      expect(result0).toBeDefined();
      // The last MANUAL grade (12) should prevail, not the auto-NP (0)
      expect(result0!.status).toBe('aprobada');
      expect(result0!.finalScore).toBe(12);
    });
  });

  // ============================================================
  // Separate MP inscription: approved MP resolves
  // ============================================================
  describe('Separate MP inscription — approved', () => {
    it('MP aprobada en inscripción separada → estudiante promovido', async () => {
      setup = await standardSetup(3, 3);

      // Student in grade 1 (2do año), all regular subjects approved
      const student = await createStudentWithGrades(setup, 1, { 0: 15, 1: 14, 2: 12 });

      // Create a separate MP inscription with subject 0 already aprobada
      await createSeparateMPInscription(setup, student, [0], { status: 'aprobada' });

      const result = await executeClosure(setup);
      expect(result.success).toBe(true);
      expect(result.stats.approved).toBe(1);

      // Outcome: aprobado (MP was approved, regular subjects all approved)
      const outcome = await getOutcome(student.inscription.id);
      expect(outcome).not.toBeNull();
      expect(outcome!.status).toBe('aprobado');
      expect(outcome!.metadata).toHaveProperty('isRezagado', false);

      // New inscription: regular in grade 2 (3er año)
      const newInscs = await findNextInscriptions(student.person.id, setup.nextPeriod.id);
      const regularInsc = newInscs.find(i => i.escolaridad === 'regular');
      expect(regularInsc).toBeDefined();
      expect(regularInsc!.gradeId).toBe(setup.grades[2].id);
    });
  });

  // ============================================================
  // Consolidated preview by person
  // ============================================================
  describe('Consolidated student preview', () => {
    it('principal + MP inscription producen una sola fila de preview', async () => {
      setup = await standardSetup(3, 3);
      const student = await createStudentWithGrades(setup, 1, { 0: 15, 1: 14, 2: 12 });
      const { mpInscription } = await createSeparateMPInscription(setup, student, [0], { status: 'aprobada' });

      const previews = await PeriodClosurePreview.calculatePreview(setup.currentPeriod.id);
      const studentRows = previews.filter(row => row.inscription?.student?.id === student.person.id);

      expect(studentRows).toHaveLength(1);
      expect(studentRows[0].inscriptionId).toBe(student.inscription.id);
    });

    it('usa la inscripción del grado superior aunque escolaridad no la identifique como principal', async () => {
      setup = await standardSetup(3, 3);
      const student = await createStudentWithGrades(setup, 1, { 0: 15, 1: 14, 2: 12 });
      const { mpInscription } = await createSeparateMPInscription(setup, student, [0], { status: 'aprobada' });

      // Simulate the real data shape: the lower-grade MP exists and the
      // higher-grade inscription is the current one, regardless of escolaridad.
      await mpInscription.update({ gradeId: setup.grades[0].id });
      await student.inscription.update({ escolaridad: 'materia_pendiente' });

      const validation = await validateClosure(setup);
      expect(validation.warnings).toHaveLength(0);

      const previews = await PeriodClosurePreview.calculatePreview(setup.currentPeriod.id);
      const studentPreview = previews.find(row => row.inscription?.student?.id === student.person.id);
      expect(studentPreview).toBeDefined();
      expect(studentPreview!.inscriptionId).toBe(student.inscription.id);
      expect(studentPreview!.inscription.grade?.id).toBe(setup.grades[1].id);
    });
  });

  // ============================================================
  // Separate MP inscription: unresolved MP → rezagado
  // ============================================================
  describe('Separate MP inscription — unresolved → rezagado', () => {
    it('MP pendiente en inscripción separada → rezagado (repite grado actual)', async () => {
      setup = await standardSetup(3, 3);

      // Student in grade 1, all regular subjects approved
      const student = await createStudentWithGrades(setup, 1, { 0: 15, 1: 14, 2: 12 });

      // Create a separate MP inscription in the ORIGIN grade (grade 0) with
      // subject 0 still pendiente — mirrors production, where MP subjects
      // live in the grade where they are coursed.
      await createSeparateMPInscription(setup, student, [0], { status: 'pendiente', gradeIndex: 0 });

      const result = await executeClosure(setup);
      expect(result.success).toBe(true);

      // Outcome: reprobado with isRezagado
      const outcome = await getOutcome(student.inscription.id);
      expect(outcome).not.toBeNull();
      expect(outcome!.status).toBe('reprobado');
      expect(outcome!.metadata).toHaveProperty('isRezagado', true);

      // New inscription: repitiente in grade 1 (current grade)
      const newInscs = await findNextInscriptions(student.person.id, setup.nextPeriod.id);
      const repitienteInsc = newInscs.find(i => i.escolaridad === 'repitiente');
      expect(repitienteInsc).toBeDefined();
      expect(repitienteInsc!.gradeId).toBe(setup.grades[1].id);

      // The carried MP inscription is recreated in the ORIGIN grade (grade 0),
      // never in the grade the student is enrolled in.
      const mpInsc = newInscs.find(i => i.escolaridad === 'materia_pendiente');
      expect(mpInsc).toBeDefined();
      expect(mpInsc!.gradeId).toBe(setup.grades[0].id);

      const pendings = await PendingSubject.findAll({
        where: { newInscriptionId: mpInsc!.id },
      });
      expect(pendings.length).toBe(1);
      expect(pendings[0].subjectId).toBe(setup.subjects[0].id);
    });
  });

  // ============================================================
  // MP-only inscription is processed as a student fallback
  // ============================================================
  describe('MP-only inscription', () => {
    it('estudiante con solo inscripción MP → se muestra y se procesa', async () => {
      setup = await standardSetup(2, 3);

      // Create a student with ONLY an MP inscription (no regular/repeater).
      const { Person } = await import('@/models/index');
      const orphanDocument = `77${String(Date.now()).slice(-7)}`;
      const orphanPerson = await Person.create({
        firstName: 'Orphan',
        lastName: 'Test',
        document: orphanDocument,
        documentType: 'Venezolano',
        birthdate: new Date('2010-01-01'),
        gender: 'M',
      });

      const [mpSection] = await (await import('@/models/index')).Section.findOrCreate({
        where: { isMateriaPendiente: true },
        defaults: { name: 'MATERIA PENDIENTE', isMateriaPendiente: true },
      });

      const mpInscription = await Inscription.create({
        personId: orphanPerson.id,
        schoolPeriodId: setup.currentPeriod.id,
        gradeId: setup.grades[0].id,
        sectionId: mpSection.id,
        escolaridad: 'materia_pendiente',
        originPeriodId: setup.currentPeriod.id,
        isRepeater: false,
      });

      await PendingSubject.create({
        newInscriptionId: mpInscription.id,
        subjectId: setup.subjects[0].id,
        originPeriodId: setup.currentPeriod.id,
        status: 'pendiente',
      });

      const validation = await validateClosure(setup);
      expect(validation.warnings).toHaveLength(1);
      expect(validation.warnings[0]).toContain('ORPHAN TEST');
      expect(validation.warnings[0]).toContain(`Cédula: ${orphanDocument}`);
      expect(validation.warnings[0]).toContain('sección de materia_pendiente');
      expect(validation.warnings[0]).toContain('no tiene otra inscripción activa');

      const result = await executeClosure(setup);
      // Closure should proceed and process the MP-only student once
      expect(result.success).toBe(true);
      expect(result.stats.totalStudents).toBe(1);
      const newInscs = await findNextInscriptions(orphanPerson.id, setup.nextPeriod.id);
      expect(newInscs.length).toBe(1);
    });
  });

  // ============================================================
  // Preview does not persist StudentPeriodOutcome
  // ============================================================
  describe('Preview non-persistence', () => {
    it('preview no crea ni modifica StudentPeriodOutcome', async () => {
      setup = await standardSetup(2, 3);

      const student = await createStudentWithGrades(setup, 0, { 0: 15, 1: 14, 2: 12 });

      // Count outcomes before preview
      const outcomesBefore = await StudentPeriodOutcome.count();

      const previews = await PeriodClosurePreview.calculatePreview(setup.currentPeriod.id);

      // Count outcomes after preview — should be unchanged
      const outcomesAfter = await StudentPeriodOutcome.count();
      expect(outcomesAfter).toBe(outcomesBefore);

      // Preview should still return correct data
      const studentPreview = previews.find(p => p.inscriptionId === student.inscription.id);
      expect(studentPreview).toBeDefined();
      expect(studentPreview!.status).toBe('aprobado');
    });
  });

  // ============================================================
  // Preview and execution produce identical classification
  // ============================================================
  describe('Preview vs execution consistency', () => {
    it('preview y ejecución producen la misma clasificación', async () => {
      setup = await standardSetup(2, 3);

      // Student with 2 failed subjects (≤ max=3) → materias_pendientes
      const student = await createStudentWithGrades(setup, 0, { 0: 8, 1: 7, 2: 15 });

      const previews = await PeriodClosurePreview.calculatePreview(setup.currentPeriod.id);
      const studentPreview = previews.find(p => p.inscriptionId === student.inscription.id);
      expect(studentPreview).toBeDefined();
      expect(studentPreview!.status).toBe('materias_pendientes');

      const result = await executeClosure(setup);
      expect(result.success).toBe(true);

      const outcome = await getOutcome(student.inscription.id);
      expect(outcome).not.toBeNull();
      expect(outcome!.status).toBe(studentPreview!.status);
    });
  });

  // ============================================================
  // Repair approval eliminates false failure
  // ============================================================
  describe('Repair approval eliminates false failure', () => {
    it('estudiante reprobado sin reparación → aprobado con reparación', async () => {
      setup = await standardSetup(2, 3);
      await createCompletedRevisionPeriod(setup);

      // Student with subject 0 = 8 (reprobada), subjects 1,2 approved
      const student = await createStudentWithGrades(setup, 0, { 0: 8, 1: 15, 2: 14 });

      // Without repair: should be materias_pendientes (1 failed ≤ 3)
      const previewsBefore = await PeriodClosurePreview.calculatePreview(setup.currentPeriod.id);
      const beforePreview = previewsBefore.find(p => p.inscriptionId === student.inscription.id);
      expect(beforePreview!.status).toBe('materias_pendientes');
      expect(beforePreview!.failedSubjects).toBe(1);

      // Now add a repair for subject 0 = 12 (approved)
      const insSub0 = student.inscriptionSubjects.get(setup.subjects[0].id)!;
      await createRevisionGrade(setup, insSub0.id, 1, 12, { gradedBy: setup.masterPerson.id });

      const previewsAfter = await PeriodClosurePreview.calculatePreview(setup.currentPeriod.id);
      const afterPreview = previewsAfter.find(p => p.inscriptionId === student.inscription.id);
      expect(afterPreview!.status).toBe('aprobado');
      expect(afterPreview!.failedSubjects).toBe(0);
    });
  });

  // ============================================================
  // Subject with notRepairable + includeInAverage=false → excluded
  // ============================================================
  describe('Subject excluded by both flags (notRepairable + !includeInAverage)', () => {
    it('materia reprobada con ambos flags → no cuenta como reprobada ni genera MP', async () => {
      setup = await standardSetup(2, 3);

      // Mark subject 0 as notRepairable AND includeInAverage=false
      const pgs0 = setup.periodGradeSubjectsCurrent.get(
        `${setup.grades[0].id}:${setup.subjects[0].id}`,
      );
      expect(pgs0).toBeDefined();
      await pgs0!.update({ notRepairable: true, includeInAverage: false });

      // Student in grade 0: subject 0 = 8 (reprobada), subjects 1,2 approved
      const student = await createStudentWithGrades(setup, 0, { 0: 8, 1: 15, 2: 14 });

      const previews = await PeriodClosurePreview.calculatePreview(setup.currentPeriod.id);
      const studentPreview = previews.find(p => p.inscriptionId === student.inscription.id);
      expect(studentPreview).toBeDefined();
      // Subject 0 is excluded → 0 failed subjects → aprobado
      expect(studentPreview!.failedSubjects).toBe(0);
      expect(studentPreview!.status).toBe('aprobado');
    });

    it('materia reprobada con ambos flags → no genera PendingSubject en el cierre', async () => {
      setup = await standardSetup(2, 3);

      const pgs0 = setup.periodGradeSubjectsCurrent.get(
        `${setup.grades[0].id}:${setup.subjects[0].id}`,
      );
      await pgs0!.update({ notRepairable: true, includeInAverage: false });

      // Student with subject 0 = 8 (reprobada), subjects 1,2 approved
      const student = await createStudentWithGrades(setup, 0, { 0: 8, 1: 15, 2: 14 });

      const result = await executeClosure(setup);
      expect(result.success).toBe(true);
      expect(result.stats.approved).toBe(1);

      // No MP inscription should be created (subject 0 is excluded)
      const newInscs = await findNextInscriptions(student.person.id, setup.nextPeriod.id);
      const mpInsc = newInscs.find(i => i.escolaridad === 'materia_pendiente');
      expect(mpInsc).toBeUndefined();

      // Outcome: aprobado
      const outcome = await getOutcome(student.inscription.id);
      expect(outcome!.status).toBe('aprobado');
      expect(outcome!.failedSubjects).toBe(0);
    });

    it('materia reprobada con solo notRepairable (sin !includeInAverage) → SI cuenta como reprobada', async () => {
      setup = await standardSetup(2, 3);

      // Mark subject 0 as notRepairable only (includeInAverage stays true)
      const pgs0 = setup.periodGradeSubjectsCurrent.get(
        `${setup.grades[0].id}:${setup.subjects[0].id}`,
      );
      await pgs0!.update({ notRepairable: true, includeInAverage: true });

      const student = await createStudentWithGrades(setup, 0, { 0: 8, 1: 15, 2: 14 });

      const previews = await PeriodClosurePreview.calculatePreview(setup.currentPeriod.id);
      const studentPreview = previews.find(p => p.inscriptionId === student.inscription.id);
      // Subject 0 counts as failed (only notRepairable, not excluded from closure)
      expect(studentPreview!.failedSubjects).toBe(1);
      expect(studentPreview!.status).toBe('materias_pendientes');
    });
  });
});
