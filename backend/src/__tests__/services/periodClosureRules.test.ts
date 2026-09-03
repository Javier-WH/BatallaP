import '../setup';
import {
  Inscription,
  StudentPeriodOutcome,
  PendingSubject,
  SubjectFinalGrade,
  SchoolPeriod,
  Term,
  CouncilChecklist,
  RevisionPeriod,
  PeriodClosure,
} from '@/models/index';
import {
  createFullClosureSetup,
  createStudentWithGrades,
  createPendingSubjectForStudent,
  markCouncilsDone,
  createCompletedRevisionPeriod,
  executeClosure,
  validateClosure,
  ClosureSetup,
  StudentWithGrades,
} from '../helpers/periodClosureTestHelper';

// Helper: find the new inscription for a person in the next period
async function findNextInscription(personId: number, nextPeriodId: number): Promise<Inscription | null> {
  return Inscription.findOne({
    where: { personId, schoolPeriodId: nextPeriodId },
  });
}

async function findNextInscriptions(personId: number, nextPeriodId: number): Promise<Inscription[]> {
  return Inscription.findAll({
    where: { personId, schoolPeriodId: nextPeriodId },
  });
}

async function getOutcome(inscriptionId: number): Promise<StudentPeriodOutcome | null> {
  return StudentPeriodOutcome.findOne({ where: { inscriptionId } });
}

async function getPendingSubjectsForInscription(inscriptionId: number): Promise<PendingSubject[]> {
  return PendingSubject.findAll({ where: { newInscriptionId: inscriptionId } });
}

describe('Period Closure Rules — Integration Tests', () => {
  let setup: ClosureSetup;

  // Most tests use a standard setup with 2 grades and 3 subjects
  async function standardSetup(gradeCount = 2, subjectsPerGrade = 3): Promise<ClosureSetup> {
    const s = await createFullClosureSetup({ gradeCount, subjectsPerGrade });
    await markCouncilsDone(s);
    return s;
  }

  // ============================================================
  // R1 — Prerrequisitos del cierre
  // ============================================================
  describe('R1 — Prerrequisitos del cierre', () => {
    it('R1a: falla si los lapsos no están bloqueados ni cerrados', async () => {
      setup = await createFullClosureSetup({ gradeCount: 2, subjectsPerGrade: 1 });
      await markCouncilsDone(setup);
      // Unblock all terms
      await Term.update({ isBlocked: false }, { where: { schoolPeriodId: setup.currentPeriod.id } });

      const result = await validateClosure(setup);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('no tiene todas sus secciones cerradas'))).toBe(true);
    });

    it('R1b: falla si hay CouncilChecklist sin completar', async () => {
      setup = await createFullClosureSetup({ gradeCount: 2, subjectsPerGrade: 1 });
      // Create incomplete council checklist
      await CouncilChecklist.create({
        schoolPeriodId: setup.currentPeriod.id,
        gradeId: setup.grades[0].id,
        sectionId: setup.sections[0].id,
        termId: setup.terms[0].id,
        status: 'open',
      });

      const result = await validateClosure(setup);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('consejos de curso'))).toBe(true);
    });

    it('R1c: falla si RevisionPeriod.status=open', async () => {
      setup = await standardSetup(2, 1);
      await RevisionPeriod.create({
        schoolPeriodId: setup.currentPeriod.id,
        status: 'open',
        maxOpportunities: 3,
        passingGrade: 10,
        currentOpportunity: 1,
      });

      const result = await validateClosure(setup);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('revisión'))).toBe(true);
    });

    it('R1d: pasa si RevisionPeriod.status=pending (no se abrieron revisiones)', async () => {
      setup = await standardSetup(2, 1);
      // No revision period created — should pass
      const result = await validateClosure(setup);
      expect(result.valid).toBe(true);
    });
  });

  // ============================================================
  // R2 — Aprobados → siguiente grado
  // ============================================================
  describe('R2 — Aprobados → siguiente grado', () => {
    it('estudiante con todas las notas ≥10 se inscribe como regular en grado siguiente', async () => {
      setup = await standardSetup(2, 3);
      // Student in grade 0 (1er año), all subjects approved (15, 14, 12)
      const student = await createStudentWithGrades(setup, 0, { 0: 15, 1: 14, 2: 12 });

      const result = await executeClosure(setup);
      expect(result.success).toBe(true);
      expect(result.stats.approved).toBe(1);

      // New inscription in next period, grade 1 (2do año), regular
      const newInsc = await findNextInscription(student.person.id, setup.nextPeriod.id);
      expect(newInsc).not.toBeNull();
      expect(newInsc!.gradeId).toBe(setup.grades[1].id);
      expect(newInsc!.escolaridad).toBe('regular');
      expect(newInsc!.isRepeater).toBe(false);

      // No pending subjects
      const pendings = await getPendingSubjectsForInscription(newInsc!.id);
      expect(pendings.length).toBe(0);

      // Outcome: aprobado
      const outcome = await getOutcome(student.inscription.id);
      expect(outcome).not.toBeNull();
      expect(outcome!.status).toBe('aprobado');
      expect(outcome!.graduatedAt).toBeNull();
    });
  });

  // ============================================================
  // R3 — Reprobados > máximo → repitiente
  // ============================================================
  describe('R3 — Reprobados > máximo → repitiente', () => {
    it('estudiante con 4 reprobadas (max=3) repite como repitiente en mismo grado', async () => {
      setup = await standardSetup(2, 5);
      // Student in grade 0, 4 subjects failed, 1 approved
      const student = await createStudentWithGrades(setup, 0, { 0: 8, 1: 7, 2: 6, 3: 5, 4: 15 });

      const result = await executeClosure(setup);
      expect(result.success).toBe(true);
      expect(result.stats.failed).toBe(1);

      // New inscription in next period, same grade, repitiente
      const newInsc = await findNextInscription(student.person.id, setup.nextPeriod.id);
      expect(newInsc).not.toBeNull();
      expect(newInsc!.gradeId).toBe(setup.grades[0].id);
      expect(newInsc!.escolaridad).toBe('repitiente');
      expect(newInsc!.isRepeater).toBe(true);

      // No pending subjects (repitiente retakes all subjects)
      const pendings = await getPendingSubjectsForInscription(newInsc!.id);
      expect(pendings.length).toBe(0);

      // Outcome: reprobado
      const outcome = await getOutcome(student.inscription.id);
      expect(outcome!.status).toBe('reprobado');
    });
  });

  // ============================================================
  // R4 — Reprobados ≤ máximo → siguiente grado + MP
  // ============================================================
  describe('R4 — Reprobados ≤ máximo → siguiente grado + MP', () => {
    it('estudiante con 2 reprobadas (max=3) pasa a siguiente grado con materias pendientes', async () => {
      setup = await standardSetup(2, 3);
      // Student in grade 0, 2 failed, 1 approved
      const student = await createStudentWithGrades(setup, 0, { 0: 8, 1: 7, 2: 15 });

      const result = await executeClosure(setup);
      expect(result.success).toBe(true);
      expect(result.stats.withPendingSubjects).toBe(1);

      // Should have TWO inscriptions in next period:
      // 1. regular in grade 1 (2do año)
      // 2. materia_pendiente in grade 0 (1er año)
      const newInscs = await findNextInscriptions(student.person.id, setup.nextPeriod.id);
      expect(newInscs.length).toBe(2);

      const regularInsc = newInscs.find(i => i.escolaridad === 'regular');
      const mpInsc = newInscs.find(i => i.escolaridad === 'materia_pendiente');

      expect(regularInsc).toBeDefined();
      expect(regularInsc!.gradeId).toBe(setup.grades[1].id);

      expect(mpInsc).toBeDefined();
      expect(mpInsc!.gradeId).toBe(setup.grades[0].id);

      // 2 pending subjects in MP inscription
      const pendings = await getPendingSubjectsForInscription(mpInsc!.id);
      expect(pendings.length).toBe(2);
      expect(pendings.every(p => p.status === 'pendiente')).toBe(true);

      // Outcome: materias_pendientes
      const outcome = await getOutcome(student.inscription.id);
      expect(outcome!.status).toBe('materias_pendientes');
    });
  });

  // ============================================================
  // R5 — Reprueba materia pendiente → REZAGADO
  // ============================================================
  describe('R5 — Reprueba materia pendiente → REZAGADO', () => {
    it('R5a: estudiante con 1 pendiente reprobada → repitiente en grado actual + MP + isRezagado', async () => {
      setup = await standardSetup(2, 3);
      // Student in grade 1 (2do año) with a pending subject from grade 0
      const student = await createStudentWithGrades(setup, 1, { 0: 15, 1: 14, 2: 12 });
      // Add pending subject (subject 0) from previous period
      await createPendingSubjectForStudent(setup, student, 0, setup.currentPeriod.id);
      // The pending subject (subject 0) has finalScore=15 in the inscription...
      // But wait, the pending subject IS one of the subjects in the inscription.
      // We need the pending subject to be reprobada. Let's set subject 0 to 8.
      // Redo: student with subject 0 reprobada (the pending one)
      // Actually, let's create a fresh student with the pending subject reprobada.

      // Recreate: student in grade 1, subject 0 = 8 (reprobada = the pending one)
      const suffix = Date.now();
      const student2 = await createStudentWithGrades(setup, 1, { 0: 8, 1: 15, 2: 14 });
      await createPendingSubjectForStudent(setup, student2, 0, setup.currentPeriod.id);

      const result = await executeClosure(setup);
      expect(result.success).toBe(true);

      // Outcome: reprobado with isRezagado
      const outcome = await getOutcome(student2.inscription.id);
      expect(outcome!.status).toBe('reprobado');
      expect(outcome!.metadata).toHaveProperty('isRezagado', true);

      // New inscription: repitiente in grade 1 (current grade, not grade 0)
      const newInscs = await findNextInscriptions(student2.person.id, setup.nextPeriod.id);
      const repitienteInsc = newInscs.find(i => i.escolaridad === 'repitiente');
      expect(repitienteInsc).toBeDefined();
      expect(repitienteInsc!.gradeId).toBe(setup.grades[1].id); // current grade
      expect(repitienteInsc!.isRepeater).toBe(true);

      // MP inscription with the reprobada pending subject
      const mpInsc = newInscs.find(i => i.escolaridad === 'materia_pendiente');
      expect(mpInsc).toBeDefined();
      expect(mpInsc!.gradeId).toBe(setup.grades[1].id); // current grade (rezagado repeats current)

      const pendings = await getPendingSubjectsForInscription(mpInsc!.id);
      expect(pendings.length).toBe(1);
      expect(pendings[0].subjectId).toBe(setup.subjects[0].id);
    });

    it('R5b: estudiante con 1 pendiente reprobada + 1 aprobada → aprobada se marca, reprobada se arrastra', async () => {
      setup = await standardSetup(2, 3);
      // Student in grade 1 with 2 pending subjects: subject 0 reprobada (8), subject 1 aprobada (15)
      const student = await createStudentWithGrades(setup, 1, { 0: 8, 1: 15, 2: 14 });
      await createPendingSubjectForStudent(setup, student, 0, setup.currentPeriod.id);
      await createPendingSubjectForStudent(setup, student, 1, setup.currentPeriod.id);

      const result = await executeClosure(setup);
      expect(result.success).toBe(true);

      // The approved pending subject should be marked as 'aprobada'
      const oldPendings = await PendingSubject.findAll({
        where: { newInscriptionId: student.inscription.id },
      });
      const approvedOld = oldPendings.find(p => p.subjectId === setup.subjects[1].id);
      expect(approvedOld).toBeDefined();
      expect(approvedOld!.status).toBe('aprobada');

      const reprobadaOld = oldPendings.find(p => p.subjectId === setup.subjects[0].id);
      // The old one might still be 'pendiente' — the new one is in the MP inscription
      // Actually, the executor marks approved ones, but doesn't change reprobated ones
      // The reprobated pending gets a NEW PendingSubject in the new MP inscription

      // Check new MP inscription has only the reprobada
      const newInscs = await findNextInscriptions(student.person.id, setup.nextPeriod.id);
      const mpInsc = newInscs.find(i => i.escolaridad === 'materia_pendiente');
      expect(mpInsc).toBeDefined();

      const newPendings = await getPendingSubjectsForInscription(mpInsc!.id);
      expect(newPendings.length).toBe(1);
      expect(newPendings[0].subjectId).toBe(setup.subjects[0].id); // only the reprobada
    });

    it('R5c: estudiante con pendiente reprobada pero aprobó todas las del grado actual → aún así repite (rezagado)', async () => {
      setup = await standardSetup(2, 3);
      // Student in grade 1, all regular subjects approved, but pending subject reprobada
      const student = await createStudentWithGrades(setup, 1, { 0: 8, 1: 15, 2: 14 });
      await createPendingSubjectForStudent(setup, student, 0, setup.currentPeriod.id);

      const result = await executeClosure(setup);
      expect(result.success).toBe(true);

      const outcome = await getOutcome(student.inscription.id);
      expect(outcome!.status).toBe('reprobado');
      expect(outcome!.metadata).toHaveProperty('isRezagado', true);

      // Still repeats current grade
      const newInscs = await findNextInscriptions(student.person.id, setup.nextPeriod.id);
      const repitienteInsc = newInscs.find(i => i.escolaridad === 'repitiente');
      expect(repitienteInsc).toBeDefined();
      expect(repitienteInsc!.gradeId).toBe(setup.grades[1].id);
    });
  });

  // ============================================================
  // R6 — Aprueba pendientes + aprueba grado actual → siguiente grado
  // ============================================================
  describe('R6 — Aprueba pendientes + aprueba grado actual → siguiente grado', () => {
    it('estudiante aprueba todas las pendientes y todas las del grado → regular en siguiente grado', async () => {
      setup = await standardSetup(3, 3);
      // Student in grade 1 (2do año) with 2 pending subjects, both approved
      const student = await createStudentWithGrades(setup, 1, { 0: 15, 1: 14, 2: 12 });
      await createPendingSubjectForStudent(setup, student, 0, setup.currentPeriod.id);
      await createPendingSubjectForStudent(setup, student, 1, setup.currentPeriod.id);

      const result = await executeClosure(setup);
      expect(result.success).toBe(true);
      expect(result.stats.approved).toBe(1);

      // Outcome: aprobado
      const outcome = await getOutcome(student.inscription.id);
      expect(outcome!.status).toBe('aprobado');

      // Both pending subjects marked as aprobada
      const oldPendings = await PendingSubject.findAll({
        where: { newInscriptionId: student.inscription.id },
      });
      expect(oldPendings.every(p => p.status === 'aprobada')).toBe(true);

      // New inscription: regular in grade 2 (3er año)
      const newInsc = await findNextInscription(student.person.id, setup.nextPeriod.id);
      expect(newInsc).not.toBeNull();
      expect(newInsc!.gradeId).toBe(setup.grades[2].id);
      expect(newInsc!.escolaridad).toBe('regular');

      // No MP inscription
      const allNewInscs = await findNextInscriptions(student.person.id, setup.nextPeriod.id);
      expect(allNewInscs.length).toBe(1);
    });
  });

  // ============================================================
  // R7 — Aprueba pendientes + reprueba ≤ max del grado actual → siguiente grado + nuevas MP
  // ============================================================
  describe('R7 — Aprueba pendientes + reprueba ≤ max → siguiente grado + nuevas MP', () => {
    it('estudiante aprueba pendientes, reprueba 2 del grado → regular en siguiente + MP con reprobadas', async () => {
      setup = await standardSetup(3, 3);
      // Student in grade 1 with 1 pending subject (approved), 2 regular subjects reprobadas
      const student = await createStudentWithGrades(setup, 1, { 0: 15, 1: 8, 2: 7 });
      // Pending subject is subject 0 (approved with 15)
      await createPendingSubjectForStudent(setup, student, 0, setup.currentPeriod.id);

      const result = await executeClosure(setup);
      expect(result.success).toBe(true);
      expect(result.stats.withPendingSubjects).toBe(1);

      // Old pending marked as aprobada
      const oldPendings = await PendingSubject.findAll({
        where: { newInscriptionId: student.inscription.id },
      });
      expect(oldPendings[0].status).toBe('aprobada');

      // New inscriptions: regular in grade 2 + MP in grade 1
      const newInscs = await findNextInscriptions(student.person.id, setup.nextPeriod.id);
      const regularInsc = newInscs.find(i => i.escolaridad === 'regular');
      const mpInsc = newInscs.find(i => i.escolaridad === 'materia_pendiente');

      expect(regularInsc).toBeDefined();
      expect(regularInsc!.gradeId).toBe(setup.grades[2].id);

      expect(mpInsc).toBeDefined();
      expect(mpInsc!.gradeId).toBe(setup.grades[1].id);

      // 2 pending subjects (the reprobadas from grade actual)
      const newPendings = await getPendingSubjectsForInscription(mpInsc!.id);
      expect(newPendings.length).toBe(2);
    });
  });

  // ============================================================
  // R8 — 5to año aprueba todo → egresado
  // ============================================================
  describe('R8 — Último grado aprueba todo → egresado', () => {
    it('estudiante en último grado con todas aprobadas → graduatedAt, sin nueva inscripción', async () => {
      // 1 grade only (it's the last), with autoGraduate=true
      setup = await standardSetup(1, 3);
      // Student in grade 0 (the only grade = last grade), all approved
      const student = await createStudentWithGrades(setup, 0, { 0: 15, 1: 14, 2: 12 });

      const result = await executeClosure(setup);
      expect(result.success).toBe(true);
      expect(result.stats.approved).toBe(1);

      // Outcome: aprobado with graduatedAt
      const outcome = await getOutcome(student.inscription.id);
      expect(outcome!.status).toBe('aprobado');
      expect(outcome!.graduatedAt).not.toBeNull();

      // NO new inscription in next period
      const newInscs = await findNextInscriptions(student.person.id, setup.nextPeriod.id);
      expect(newInscs.length).toBe(0);
    });
  });

  // ============================================================
  // R9 — 5to año reprueba → repitiente
  // ============================================================
  describe('R9 — Último grado reprueba → repitiente', () => {
    it('R9a: estudiante en último grado con 1 reprobada (≤max) → repitiente con todas las materias', async () => {
      // 1 grade only (last grade), 3 subjects
      setup = await standardSetup(1, 3);
      const student = await createStudentWithGrades(setup, 0, { 0: 8, 1: 15, 2: 14 });

      const result = await executeClosure(setup);
      expect(result.success).toBe(true);
      expect(result.stats.failed).toBe(1);

      // Outcome: reprobado (forced by R9 logic)
      const outcome = await getOutcome(student.inscription.id);
      expect(outcome!.status).toBe('reprobado');
      expect(outcome!.graduatedAt).toBeNull();

      // New inscription: repitiente in same grade
      const newInscs = await findNextInscriptions(student.person.id, setup.nextPeriod.id);
      const repitienteInsc = newInscs.find(i => i.escolaridad === 'repitiente');
      expect(repitienteInsc).toBeDefined();
      expect(repitienteInsc!.gradeId).toBe(setup.grades[0].id);
      expect(repitienteInsc!.isRepeater).toBe(true);

      // Should have all 3 subjects as InscriptionSubject (repitiente takes all)
      const { InscriptionSubject } = await import('@/models/index');
      const insSubs = await InscriptionSubject.findAll({
        where: { inscriptionId: repitienteInsc!.id },
      });
      expect(insSubs.length).toBe(3);
    });

    it('R9b: estudiante en último grado con 4 reprobadas (>max) → repitiente', async () => {
      setup = await standardSetup(1, 5);
      const student = await createStudentWithGrades(setup, 0, { 0: 8, 1: 7, 2: 6, 3: 5, 4: 15 });

      const result = await executeClosure(setup);
      expect(result.success).toBe(true);

      const outcome = await getOutcome(student.inscription.id);
      expect(outcome!.status).toBe('reprobado');

      const newInscs = await findNextInscriptions(student.person.id, setup.nextPeriod.id);
      const repitienteInsc = newInscs.find(i => i.escolaridad === 'repitiente');
      expect(repitienteInsc).toBeDefined();
      expect(repitienteInsc!.gradeId).toBe(setup.grades[0].id);
    });

    it('R9c: estudiante en último grado con pendiente reprobada → repitiente + isRezagado + MP', async () => {
      setup = await standardSetup(1, 3);
      const student = await createStudentWithGrades(setup, 0, { 0: 8, 1: 15, 2: 14 });
      await createPendingSubjectForStudent(setup, student, 0, setup.currentPeriod.id);

      const result = await executeClosure(setup);
      expect(result.success).toBe(true);

      const outcome = await getOutcome(student.inscription.id);
      expect(outcome!.status).toBe('reprobado');
      expect(outcome!.metadata).toHaveProperty('isRezagado', true);

      // Repitiente + MP
      const newInscs = await findNextInscriptions(student.person.id, setup.nextPeriod.id);
      const repitienteInsc = newInscs.find(i => i.escolaridad === 'repitiente');
      expect(repitienteInsc).toBeDefined();

      const mpInsc = newInscs.find(i => i.escolaridad === 'materia_pendiente');
      expect(mpInsc).toBeDefined();

      const pendings = await getPendingSubjectsForInscription(mpInsc!.id);
      expect(pendings.length).toBe(1);
      expect(pendings[0].subjectId).toBe(setup.subjects[0].id);
    });
  });

  // ============================================================
  // R10 — Excluir estudiantes retirados
  // ============================================================
  describe('R10 — Excluir estudiantes retirados', () => {
    it('R10a: estudiante con withdrawnAt no null → no se procesa ni se inscribe', async () => {
      setup = await standardSetup(2, 3);
      const student = await createStudentWithGrades(setup, 0, { 0: 15, 1: 14, 2: 12 });
      // Mark as withdrawn
      await student.inscription.update({ withdrawnAt: new Date() });

      const result = await executeClosure(setup);
      expect(result.success).toBe(true);
      expect(result.stats.totalStudents).toBe(0);

      // No outcome
      const outcome = await getOutcome(student.inscription.id);
      expect(outcome).toBeNull();

      // No new inscription
      const newInscs = await findNextInscriptions(student.person.id, setup.nextPeriod.id);
      expect(newInscs.length).toBe(0);
    });

    it('R10b: estudiante con withdrawnAt=null → se procesa normalmente', async () => {
      setup = await standardSetup(2, 3);
      const student = await createStudentWithGrades(setup, 0, { 0: 15, 1: 14, 2: 12 });
      // withdrawnAt is null by default

      const result = await executeClosure(setup);
      expect(result.success).toBe(true);
      expect(result.stats.totalStudents).toBe(1);
      expect(result.stats.approved).toBe(1);

      const newInsc = await findNextInscription(student.person.id, setup.nextPeriod.id);
      expect(newInsc).not.toBeNull();
    });
  });

  // ============================================================
  // Post-closure verification
  // ============================================================
  describe('Post-closure state', () => {
    it('período cerrado cambia a historico, siguiente cambia a activo', async () => {
      setup = await standardSetup(2, 3);
      await createStudentWithGrades(setup, 0, { 0: 15, 1: 14, 2: 12 });

      const result = await executeClosure(setup);
      expect(result.success).toBe(true);

      await setup.currentPeriod.reload();
      await setup.nextPeriod.reload();

      expect(setup.currentPeriod.status).toBe('historico');
      expect(setup.nextPeriod.status).toBe('activo');
    });

    it('PeriodClosure.status = closed con stats', async () => {
      setup = await standardSetup(2, 3);
      await createStudentWithGrades(setup, 0, { 0: 15, 1: 14, 2: 12 });

      const result = await executeClosure(setup);
      expect(result.success).toBe(true);
      expect(result.closureId).toBeGreaterThan(0);

      const closure = await PeriodClosure.findByPk(result.closureId);
      expect(closure).not.toBeNull();
      expect(closure!.status).toBe('closed');
      expect(closure!.finishedAt).not.toBeNull();
    });
  });
});
