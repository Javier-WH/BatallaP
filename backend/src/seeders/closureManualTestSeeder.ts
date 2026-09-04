/**
 * Seeder para probar manualmente el cierre de período.
 * Crea 9 estudiantes cubriendo todos los casos de uso (R2-R10):
 *   R2: Aprobado → siguiente grado
 *   R3: Reprobados > máximo → repitiente
 *   R4: Reprobados ≤ máximo → siguiente + materias pendientes
 *   R5: Reprueba materia pendiente → rezagado
 *   R6: Aprueba pendientes + aprueba grado → siguiente
 *   R7: Aprueba pendientes + reprueba ≤ max → siguiente + nuevas MP
 *   R8: Último grado aprueba todo → egresado
 *   R9: Último grado reprueba → repitiente
 *   R10: Estudiante retirado → excluido
 *
 * Uso: npm run seed:closure-test:sqlite
 */
import sequelize from '@/config/database';
import {
  SchoolPeriod,
  Grade,
  Section,
  Subject,
  PeriodGrade,
  PeriodGradeSubject,
  PeriodGradeSection,
  Term,
  Inscription,
  InscriptionSubject,
  SubjectFinalGrade,
  SubjectTermGrade,
  Setting,
  SchoolPeriodTransitionRule,
  Person,
  Role,
  PersonRole,
  CouncilChecklist,
  RevisionPeriod,
  PendingSubject,
  Matriculation,
} from '@/models/index';
import { Transaction } from 'sequelize';

interface StudentCase {
  label: string;
  document: string;
  firstName: string;
  lastName: string;
  gradeOrder: number;        // 1=1er año, 5=5to año
  scores: number[];          // nota por materia (en orden del pensum)
  pendingSubjects?: number[]; // índices de materias que son pendientes
  withdrawn?: boolean;
  caseCode: string;          // R2, R3, etc.
}

const STUDENT_CASES: StudentCase[] = [
  // R2 — Aprobado (1er año, 8 materias, todas 15)
  {
    label: 'R2-Aprobado',
    document: 'V-99000001',
    firstName: 'Ana',
    lastName: 'Aprobada',
    gradeOrder: 1,
    scores: [15, 15, 15, 15, 15, 15, 15, 15],
    caseCode: 'R2',
  },
  // R3 — Repitiente (1er año, 8 materias, 4 reprobadas)
  {
    label: 'R3-Repitiente',
    document: 'V-99000002',
    firstName: 'Carlos',
    lastName: 'Repitiente',
    gradeOrder: 1,
    scores: [5, 6, 7, 8, 15, 15, 15, 15],
    caseCode: 'R3',
  },
  // R4 — Con pendientes (1er año, 8 materias, 2 reprobadas)
  {
    label: 'R4-ConPendientes',
    document: 'V-99000003',
    firstName: 'Elena',
    lastName: 'Pendiente',
    gradeOrder: 1,
    scores: [8, 9, 15, 15, 15, 15, 15, 15],
    caseCode: 'R4',
  },
  // R5 — Rezagado (2do año, 10 materias, 1 pendiente reprobada)
  {
    label: 'R5-Rezagado',
    document: 'V-99000004',
    firstName: 'Pedro',
    lastName: 'Rezagado',
    gradeOrder: 2,
    scores: [8, 15, 15, 15, 15, 15, 15, 15, 15, 15],
    pendingSubjects: [0], // materia 0 es pendiente y está reprobada (8)
    caseCode: 'R5',
  },
  // R6 — Aprueba pendientes + aprueba grado (2do año, 10 materias)
  {
    label: 'R6-AprPendientes',
    document: 'V-99000005',
    firstName: 'Lucia',
    lastName: 'SinPendientes',
    gradeOrder: 2,
    scores: [15, 15, 15, 15, 15, 15, 15, 15, 15, 15],
    pendingSubjects: [0, 1], // ambas pendientes aprobadas
    caseCode: 'R6',
  },
  // R7 — Aprueba pendientes + reprueba ≤ max (2do año, 10 materias)
  {
    label: 'R7-AprPendReprob',
    document: 'V-99000006',
    firstName: 'Miguel',
    lastName: 'Mixto',
    gradeOrder: 2,
    scores: [15, 8, 9, 15, 15, 15, 15, 15, 15, 15],
    pendingSubjects: [0], // pendiente aprobada (15), pero reprueba materias 1 y 2
    caseCode: 'R7',
  },
  // R8 — Egresado (5to año, 13 materias, todas aprobadas)
  {
    label: 'R8-Egresado',
    document: 'V-99000007',
    firstName: 'Sofia',
    lastName: 'Egresada',
    gradeOrder: 5,
    scores: [15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15],
    caseCode: 'R8',
  },
  // R9 — Repitiente 5to año (5to año, 13 materias, 1 reprobada)
  {
    label: 'R9-Repitiente5to',
    document: 'V-99000008',
    firstName: 'Diego',
    lastName: 'CasiEgresado',
    gradeOrder: 5,
    scores: [8, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15],
    caseCode: 'R9',
  },
  // R10 — Retirado (1er año, 8 materias, todas aprobadas pero retirado)
  {
    label: 'R10-Retirado',
    document: 'V-99000009',
    firstName: 'Rosa',
    lastName: 'Retirada',
    gradeOrder: 1,
    scores: [15, 15, 15, 15, 15, 15, 15, 15],
    withdrawn: true,
    caseCode: 'R10',
  },
];

async function seedClosureManualTest() {
  const t = await sequelize.transaction();
  try {
    console.log('🌱 Iniciando seeder de cierre de período...\n');

    // 1. Settings
    await Setting.findOrCreate({
      where: { key: 'min_approval_grade' },
      defaults: { key: 'min_approval_grade', value: '10' },
      transaction: t,
    });
    await Setting.findOrCreate({
      where: { key: 'max_failed_subjects' },
      defaults: { key: 'max_failed_subjects', value: '3' },
      transaction: t,
    });
    console.log('✅ Settings verificados (min_approval_grade=10, max_failed_subjects=3)');

    // 2. Get active period
    const activePeriod = await SchoolPeriod.findOne({
      where: { status: 'activo' },
      transaction: t,
    });
    if (!activePeriod) {
      throw new Error('No hay período activo. Ejecute el seed básico primero.');
    }
    console.log(`📅 Período activo: ${activePeriod.period} (id=${activePeriod.id})`);

    // 3. Get or create next period (preinscripcion)
    let nextPeriod = await SchoolPeriod.findOne({
      where: { status: 'preinscripcion' },
      transaction: t,
    });
    if (!nextPeriod) {
      nextPeriod = await SchoolPeriod.create({
        period: '2026-2027',
        name: 'Año Escolar 2026-2027',
        startYear: 2026,
        endYear: 2027,
        status: 'preinscripcion',
      }, { transaction: t });
      console.log(`📅 Período siguiente creado: ${nextPeriod.period} (id=${nextPeriod.id})`);
    } else {
      console.log(`📅 Período siguiente: ${nextPeriod.period} (id=${nextPeriod.id})`);
    }

    // 4. Get grades ordered by 'order'
    const grades = await Grade.findAll({
      order: [['order', 'ASC']],
      transaction: t,
    });
    if (grades.length === 0) {
      throw new Error('No hay grados. Ejecute el seed básico primero.');
    }
    console.log(`📚 Grados encontrados: ${grades.length}`);

    // 5. Get terms for active period and block them
    const terms = await Term.findAll({
      where: { schoolPeriodId: activePeriod.id },
      order: [['order', 'ASC']],
      transaction: t,
    });
    if (terms.length === 0) {
      throw new Error('No hay lapsos para el período activo.');
    }
    await Term.update(
      { isBlocked: true, isActive: false },
      { where: { schoolPeriodId: activePeriod.id }, transaction: t },
    );
    console.log(`🔒 ${terms.length} lapsos bloqueados`);

    // 6. Get role Alumno
    const studentRole = await Role.findOne({ where: { name: 'Alumno' as const }, transaction: t });
    if (!studentRole) {
      throw new Error('Rol Alumno no encontrado. Ejecute el seed básico primero.');
    }

    // 7. Create transition rules (if not exist)
    for (let i = 0; i < grades.length; i++) {
      const gradeFrom = grades[i];
      const gradeTo = i < grades.length - 1 ? grades[i + 1] : null;
      const existing = await SchoolPeriodTransitionRule.findOne({
        where: { gradeFromId: gradeFrom.id },
        transaction: t,
      });
      if (!existing) {
        await SchoolPeriodTransitionRule.create({
          gradeFromId: gradeFrom.id,
          gradeToId: gradeTo?.id ?? null,
          minAverage: 10,
          maxPendingSubjects: 3,
          autoGraduate: i === grades.length - 1,
        }, { transaction: t });
      }
    }
    console.log('✅ Reglas de transición verificadas');

    // 8. Mark all council checklists as done
    for (const grade of grades) {
      // Get PeriodGrade for this grade in active period
      const pg = await PeriodGrade.findOne({
        where: { schoolPeriodId: activePeriod.id, gradeId: grade.id },
        transaction: t,
      });
      if (!pg) continue;

      // Get sections for this PeriodGrade
      const pgSections = await PeriodGradeSection.findAll({
        where: { periodGradeId: pg.id },
        transaction: t,
      });

      for (const pgs of pgSections) {
        for (const term of terms) {
          await CouncilChecklist.findOrCreate({
            where: {
              schoolPeriodId: activePeriod.id,
              gradeId: grade.id,
              sectionId: pgs.sectionId,
              termId: term.id,
            },
            defaults: {
              schoolPeriodId: activePeriod.id,
              gradeId: grade.id,
              sectionId: pgs.sectionId,
              termId: term.id,
              status: 'done',
              completedAt: new Date(),
            },
            transaction: t,
          });
        }
      }
    }
    console.log('✅ Consejos de curso marcados como completados');

    // 9. Ensure RevisionPeriod status=pending (no revisiones abiertas)
    const existingRevision = await RevisionPeriod.findOne({
      where: { schoolPeriodId: activePeriod.id },
      transaction: t,
    });
    if (existingRevision && existingRevision.status === 'open') {
      await existingRevision.update({ status: 'pending' }, { transaction: t });
    }
    console.log('✅ Período de revisiones en estado pending');

    // 10. Ensure next period has structure (PeriodGrade + sections + subjects)
    for (const grade of grades) {
      let pgNext = await PeriodGrade.findOne({
        where: { schoolPeriodId: nextPeriod.id, gradeId: grade.id },
        transaction: t,
      });
      if (!pgNext) {
        pgNext = await PeriodGrade.create({
          schoolPeriodId: nextPeriod.id,
          gradeId: grade.id,
        }, { transaction: t });
      }

      // Copy sections from active period
      const pgCurrent = await PeriodGrade.findOne({
        where: { schoolPeriodId: activePeriod.id, gradeId: grade.id },
        transaction: t,
      });
      if (!pgCurrent) continue;

      const currentSections = await PeriodGradeSection.findAll({
        where: { periodGradeId: pgCurrent.id },
        transaction: t,
      });
      for (const cs of currentSections) {
        await PeriodGradeSection.findOrCreate({
          where: { periodGradeId: pgNext.id, sectionId: cs.sectionId },
          defaults: { periodGradeId: pgNext.id, sectionId: cs.sectionId },
          transaction: t,
        });
      }

      // Copy subjects from active period
      const currentSubjects = await PeriodGradeSubject.findAll({
        where: { periodGradeId: pgCurrent.id },
        transaction: t,
      });
      for (const cs of currentSubjects) {
        await PeriodGradeSubject.findOrCreate({
          where: { periodGradeId: pgNext.id, subjectId: cs.subjectId },
          defaults: {
            periodGradeId: pgNext.id,
            subjectId: cs.subjectId,
            order: cs.order,
            active: true,
            includeInAverage: cs.includeInAverage,
            weeklyBlocks: cs.weeklyBlocks,
          },
          transaction: t,
        });
      }
    }
    console.log('✅ Estructura del período siguiente verificada');

    // 11. Create students
    let created = 0;
    for (const studentCase of STUDENT_CASES) {
      // Find grade by order
      const grade = grades.find(g => g.order === studentCase.gradeOrder);
      if (!grade) {
        console.warn(`⚠️  No se encontró grado con order=${studentCase.gradeOrder}, saltando ${studentCase.label}`);
        continue;
      }

      // Get PeriodGrade for this grade in active period
      const pg = await PeriodGrade.findOne({
        where: { schoolPeriodId: activePeriod.id, gradeId: grade.id },
        transaction: t,
      });
      if (!pg) {
        console.warn(`⚠️  No se encontró PeriodGrade para grado ${grade.name}, saltando ${studentCase.label}`);
        continue;
      }

      // Get subjects for this grade (ordered by PeriodGradeSubject.order)
      const pgsList = await PeriodGradeSubject.findAll({
        where: { periodGradeId: pg.id },
        order: [['order', 'ASC']],
        transaction: t,
      });
      const subjects = await Subject.findAll({
        where: { id: pgsList.map(pgs => pgs.subjectId) },
        transaction: t,
      });
      // Sort subjects by PGS order
      const orderedSubjects = pgsList
        .map(pgs => subjects.find(s => s.id === pgs.subjectId))
        .filter((s): s is Subject => s !== undefined);

      // Get first section for this grade
      const pgSection = await PeriodGradeSection.findOne({
        where: { periodGradeId: pg.id },
        transaction: t,
      });
      if (!pgSection) {
        console.warn(`⚠️  No se encontró sección para grado ${grade.name}, saltando ${studentCase.label}`);
        continue;
      }
      const section = await Section.findByPk(pgSection.sectionId, { transaction: t });
      if (!section) continue;

      // Check if student already exists (idempotency)
      const existingPerson = await Person.findOne({
        where: { document: studentCase.document },
        transaction: t,
      });
      if (existingPerson) {
        console.log(`ℹ️  ${studentCase.label} ya existe (doc=${studentCase.document}), saltando...`);
        continue;
      }

      // Create person
      const person = await Person.create({
        firstName: studentCase.firstName,
        lastName: studentCase.lastName,
        documentType: 'Venezolano',
        document: studentCase.document,
        gender: 'M',
        birthdate: new Date('2010-01-01'),
      }, { transaction: t });

      await PersonRole.create({
        personId: person.id,
        roleId: studentRole.id,
      }, { transaction: t });

      // Create matriculation
      const matriculation = await Matriculation.create({
        personId: person.id,
        schoolPeriodId: activePeriod.id,
        gradeId: grade.id,
        sectionId: section.id,
        status: 'completed',
        escolaridad: 'regular',
      }, { transaction: t });

      // Create inscription
      const inscription = await Inscription.create({
        personId: person.id,
        schoolPeriodId: activePeriod.id,
        gradeId: grade.id,
        sectionId: section.id,
        escolaridad: 'regular',
        withdrawnAt: studentCase.withdrawn ? new Date() : null,
      }, { transaction: t });

      matriculation.inscriptionId = inscription.id;
      await matriculation.save({ transaction: t });

      // Create InscriptionSubject + SubjectTermGrade + SubjectFinalGrade for each subject
      for (let si = 0; si < orderedSubjects.length; si++) {
        const subject = orderedSubjects[si];
        const score = studentCase.scores[si] ?? 15; // default 15 if not specified
        const status = score >= 10 ? 'aprobada' : 'reprobada';

        const insSub = await InscriptionSubject.create({
          inscriptionId: inscription.id,
          subjectId: subject.id,
          schoolPeriodId: activePeriod.id,
          gradeId: grade.id,
          sectionId: section.id,
        }, { transaction: t });

        // SubjectTermGrade for each term (same score in all 3 terms)
        for (const term of terms) {
          await SubjectTermGrade.create({
            inscriptionSubjectId: insSub.id,
            termId: term.id,
            score,
            calculatedAt: new Date(),
          }, { transaction: t });
        }

        // SubjectFinalGrade (pre-created, used by calculator when isClosedPeriod=true)
        await SubjectFinalGrade.create({
          inscriptionSubjectId: insSub.id,
          finalScore: score,
          rawScore: score,
          councilPoints: 0,
          status,
          calculatedAt: new Date(),
          gradeType: 'regular',
          schoolPeriodId: activePeriod.id,
          subjectId: subject.id,
          gradeId: grade.id,
        }, { transaction: t });
      }

      // Create pending subjects (for R5, R6, R7)
      if (studentCase.pendingSubjects) {
        for (const subjectIdx of studentCase.pendingSubjects) {
          const subject = orderedSubjects[subjectIdx];
          if (!subject) continue;
          await PendingSubject.create({
            newInscriptionId: inscription.id,
            subjectId: subject.id,
            originPeriodId: activePeriod.id,
            status: 'pendiente',
          }, { transaction: t });
        }
      }

      created++;
      console.log(`  ✅ ${studentCase.caseCode}: ${studentCase.firstName} ${studentCase.lastName} (${studentCase.document}) — ${grade.name}, ${orderedSubjects.length} materias${studentCase.withdrawn ? ' [RETIRADO]' : ''}${studentCase.pendingSubjects ? ` [${studentCase.pendingSubjects.length} pendiente(s)]` : ''}`);
    }

    await t.commit();
    console.log(`\n🎉 Seeder completado: ${created} estudiantes creados`);
    console.log('\n📋 Casos de uso disponibles para probar:');
    console.log('   R2  — Ana Aprobada (V-99000001) — 1er año, todo aprobado → 2do año regular');
    console.log('   R3  — Carlos Repitiente (V-99000002) — 1er año, 4 reprobadas → repitiente');
    console.log('   R4  — Elena Pendiente (V-99000003) — 1er año, 2 reprobadas → 2do año + MP');
    console.log('   R5  — Pedro Rezagado (V-99000004) — 2do año, 1 pendiente reprobada → rezagado');
    console.log('   R6  — Lucia SinPendientes (V-99000005) — 2do año, pendientes aprobadas → 3er año');
    console.log('   R7  — Miguel Mixto (V-99000006) — 2do año, pendiente aprobada + 2 reprobadas → 3er año + MP');
    console.log('   R8  — Sofia Egresada (V-99000007) — 5to año, todo aprobado → egresada');
    console.log('   R9  — Diego CasiEgresado (V-99000008) — 5to año, 1 reprobada → repitiente');
    console.log('   R10 — Rosa Retirada (V-99000009) — 1er año, retirada → excluida');
    console.log('\n💡 Use la interfaz de Cierre de Período para validar, previsualizar y ejecutar.');
  } catch (error) {
    await t.rollback();
    console.error('❌ Error en seeder de cierre:', error);
    throw error;
  } finally {
    try {
      await sequelize.close();
    } catch {
      /* ignore */
    }
  }
}

if (require.main === module) {
  seedClosureManualTest()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export default seedClosureManualTest;
