import { Transaction, Op } from 'sequelize';
import sequelize from '@/config/database';
import {
  SchoolPeriod,
  Inscription,
  PeriodClosure,
  CouncilChecklist,
  Term,
  Setting,
  StudentPeriodOutcome,
  PendingSubject,
  InscriptionSubject,
  PeriodGrade,
  PeriodGradeSection,
  Grade,
  Section,
  Person,
  Subject,
  RevisionPeriod,
  Matriculation,
} from '@/models/index';
import { FinalGradeCalculator } from './finalGradeCalculator';
import { StudentPromotionEngine } from './studentPromotionEngine';
import * as SchoolPeriodService from './schoolPeriodService';
import { TermSectionClosureService } from './termSectionClosureService';
import { loadClosureStudentGroups, sortClosureStudentGroups } from './periodClosureStudentService';

interface ClosureValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

interface ClosureExecutionResult {
  success: boolean;
  closureId: number;
  stats: {
    totalStudents: number;
    approved: number;
    withPendingSubjects: number;
    failed: number;
    newInscriptions: number;
    pendingSubjectsCreated: number;
    skipped: number;
  };
  errors: string[];
  log: Record<string, unknown>;
}

/**
 * Resolve the period that will receive the promoted students. Prefers the
 * explicit 'preinscripcion' period and falls back to the closest future
 * non-external period for databases created before the status enum existed.
 */
const findNextPeriod = async (
  period: SchoolPeriod,
  transaction?: Transaction
): Promise<SchoolPeriod | null> => {
  const preinscription = await SchoolPeriodService.getPreinscriptionPeriod(transaction);
  if (preinscription && preinscription.startYear > period.startYear) return preinscription;

  return SchoolPeriod.findOne({
    where: {
      status: { [Op.ne]: 'externo' },
      startYear: { [Op.gt]: period.startYear }
    },
    order: [['startYear', 'ASC'], ['endYear', 'ASC']],
    transaction
  });
};

export class PeriodClosureExecutor {
  static async validateClosure(schoolPeriodId: number): Promise<ClosureValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    const period = await SchoolPeriod.findByPk(schoolPeriodId);
    if (!period) {
      errors.push('Periodo escolar no encontrado');
      return { valid: false, errors, warnings };
    }

    if (period.status !== 'activo') {
      errors.push('El periodo no está activo');
    }

    const nextPeriod = await findNextPeriod(period);

    if (!nextPeriod || nextPeriod.id === schoolPeriodId) {
      errors.push('Debe existir un periodo siguiente creado antes de cerrar el periodo actual');
    } else {
      // The executor auto-copies missing structure into the next period, so
      // this is a warning (not an error) to let the user know it will happen.
      const [currentGradeIds, nextGradeIds] = await Promise.all([
        PeriodGrade.findAll({
          where: { schoolPeriodId },
          attributes: ['gradeId']
        }),
        PeriodGrade.findAll({
          where: { schoolPeriodId: nextPeriod.id },
          attributes: ['gradeId']
        })
      ]);
      const nextGradeIdSet = new Set(nextGradeIds.map(pg => pg.gradeId));
      const missingGrades = currentGradeIds
        .map(pg => pg.gradeId)
        .filter(gradeId => !nextGradeIdSet.has(gradeId));
      if (missingGrades.length > 0) {
        warnings.push(
          `El período siguiente (${nextPeriod.name}) no tiene configurados ${missingGrades.length} grado(s) ` +
          'del período actual. La estructura (grados, secciones, materias, asignaciones de profesores) ' +
          'se copiará automáticamente al ejecutar el cierre.'
        );
      }
    }

    const terms = await Term.findAll({
      where: { schoolPeriodId },
      attributes: ['id', 'isBlocked', 'name']
    });

    // Check that all terms are fully closed (either globally blocked or all sections closed)
    for (const term of terms) {
      if (term.isBlocked) continue;
      const allSectionsClosed = await TermSectionClosureService.areAllSectionsClosed(term.id, schoolPeriodId);
      if (!allSectionsClosed) {
        errors.push(
          `El lapso "${term.name}" no tiene todas sus secciones cerradas. Debe cerrar todas las secciones o bloquear el lapso.`
        );
      }
    }

    const [totalChecklist, completedChecklist] = await Promise.all([
      CouncilChecklist.count({ where: { schoolPeriodId } }),
      CouncilChecklist.count({ where: { schoolPeriodId, status: 'done' } })
    ]);

    if (totalChecklist === 0) {
      warnings.push('No hay registros de consejos de curso');
    } else if (completedChecklist < totalChecklist) {
      errors.push(
        `Todos los consejos de curso deben estar completados. Completados: ${completedChecklist}/${totalChecklist}`
      );
    }

    // Validate RevisionPeriod status — must be 'completed' or 'closed'.
    // 'open' means revisions are still in progress and cannot be used for closure.
    const revisionPeriod = await RevisionPeriod.findOne({ where: { schoolPeriodId } });
    if (revisionPeriod && revisionPeriod.status === 'open') {
      errors.push('El período de revisión debe estar completado antes de ejecutar el cierre de período');
    }

    const studentGroups = await loadClosureStudentGroups(schoolPeriodId);
    const mpOnlyStudents = studentGroups.filter(group => group.isPendingOnly);
    for (const group of mpOnlyStudents) {
      const reference = group.referenceInscription as Inscription & {
        student?: Person;
      };
      const studentName = reference.student
        ? `${reference.student.firstName} ${reference.student.lastName}`.trim()
        : `Persona #${group.personId}`;
      const document = reference.student?.document
        ? `Cédula: ${reference.student.document}. `
        : '';

      warnings.push(
        `${studentName} — ${document}` +
        'Solo tiene inscripciones en la sección de materia_pendiente y no tiene otra inscripción ' +
        'activa en el período para representar su grado actual. ' +
        'Será procesado usando la inscripción disponible como referencia.'
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  static async executeClosure(
    schoolPeriodId: number,
    initiatedBy?: number
  ): Promise<ClosureExecutionResult> {
    const validation = await this.validateClosure(schoolPeriodId);
    if (!validation.valid) {
      return {
        success: false,
        closureId: 0,
        stats: {
          totalStudents: 0,
          approved: 0,
          withPendingSubjects: 0,
          failed: 0,
          newInscriptions: 0,
          pendingSubjectsCreated: 0,
          skipped: 0
        },
        errors: validation.errors,
        log: { validation }
      };
    }

    const transaction = await sequelize.transaction();

    try {
      const startedAt = new Date();

      const closure = await PeriodClosure.create(
        {
          schoolPeriodId,
          status: 'validating',
          initiatedBy,
          startedAt
        },
        { transaction }
      );

      const minApprovalSetting = await Setting.findByPk('min_approval_grade');
      const minApproval = minApprovalSetting ? Number(minApprovalSetting.value) : 10;

      const currentPeriod = await SchoolPeriod.findByPk(schoolPeriodId, { transaction });
      if (!currentPeriod) {
        throw new Error('Periodo escolar no encontrado');
      }

      const nextPeriod = await findNextPeriod(currentPeriod, transaction);
      if (!nextPeriod) {
        throw new Error('No se encontró periodo siguiente');
      }

      // Ensure the next period has the same academic structure (grades,
      // sections, subjects, teacher assignments) before enrolling students.
      // Merge semantics: fills gaps without duplicating existing config.
      await SchoolPeriodService.clonePeriodStructure(
        currentPeriod.id,
        nextPeriod.id,
        transaction
      );

      const studentGroups = sortClosureStudentGroups(
        await loadClosureStudentGroups(schoolPeriodId, { transaction }),
      );

      const stats = {
        totalStudents: studentGroups.length,
        approved: 0,
        withPendingSubjects: 0,
        failed: 0,
        newInscriptions: 0,
        pendingSubjectsCreated: 0,
        skipped: 0
      };

      const processLog: Record<string, unknown>[] = [];

      // Fetch revision period for locking at the end of closure
      const revisionPeriod = await RevisionPeriod.findOne({ where: { schoolPeriodId }, transaction });

      // Repair grades are now applied by FinalGradeCalculator automatically
      // when it detects a completed/closed RevisionPeriod for this school period.

      for (const studentGroup of studentGroups) {
        const inscription = studentGroup.referenceInscription;
        try {
          const summary = await FinalGradeCalculator.calculateForInscription(inscription.id, {
            transaction,
            minApproval
          });

          const evaluation = await StudentPromotionEngine.evaluateInscription(
            inscription.id,
            summary,
            { transaction, now: startedAt }
          );

          const { pendingSubjects, promotionGrade, approvedPendingSubjectIds, unresolvedPendingSubjects, status: evalStatus, promotionGradeId: evalPromotionGradeId, graduatedAt: evalGraduatedAt, finalAverage: evalFinalAverage, failedSubjects: evalFailedSubjects } = evaluation;

          // R6/R7: Mark previously-pending subjects that were approved as resolved.
          // MP subjects may live in a separate materia_pendiente inscription, so
          // we update across all of the student's inscriptions in this period.
          if (approvedPendingSubjectIds.length > 0) {
            // Find all inscription IDs for this person in this period (regular + MP)
            const personInscriptions = await Inscription.findAll({
              where: {
                schoolPeriodId,
                personId: inscription.personId,
                withdrawnAt: null,
              },
              attributes: ['id'],
              transaction,
            });
            const personInscriptionIds = personInscriptions.map(i => i.id);
            await PendingSubject.update(
              { status: 'aprobada', resolvedAt: startedAt },
              {
                where: {
                  newInscriptionId: { [Op.in]: personInscriptionIds },
                  subjectId: { [Op.in]: approvedPendingSubjectIds },
                  status: 'pendiente'
                },
                transaction
              }
            );
          }

          // R8: Skip graduates — no new inscription needed
          if (evalGraduatedAt) {
            stats.approved++;
            processLog.push({
              inscriptionId: inscription.id,
              studentId: inscription.personId,
              status: 'egresado',
              graduatedAt: evalGraduatedAt,
              approvedPendingSubjects: approvedPendingSubjectIds.length
            });
            continue;
          }

          if (evalStatus === 'aprobado') {
            stats.approved++;
          } else if (evalStatus === 'materias_pendientes') {
            stats.withPendingSubjects++;
          } else if (evalStatus === 'reprobado') {
            stats.failed++;
          }

          const targetGradeId = evalPromotionGradeId || inscription.gradeId;
          const isRepeating = evalStatus === 'reprobado';

          const targetPeriodGrade = await PeriodGrade.findOne({
            where: {
              schoolPeriodId: nextPeriod.id,
              gradeId: targetGradeId
            },
            include: [{ model: Subject, as: 'subjects', through: { where: { active: true } } }],
            transaction
          });

          if (!targetPeriodGrade) {
            stats.skipped++;
            processLog.push({
              inscriptionId: inscription.id,
              studentId: inscription.personId,
              error: `No se encontró configuración para grado ${targetGradeId} en periodo ${nextPeriod.id}`,
              skipped: true
            });
            continue;
          }

          const targetSection = await PeriodGradeSection.findOne({
            where: {
              periodGradeId: targetPeriodGrade.id,
              sectionId: inscription.sectionId || 1
            },
            transaction
          });

          const finalSectionId = targetSection ? inscription.sectionId : undefined;

          const escolaridadStatus: 'regular' | 'repitiente' | 'materia_pendiente' = isRepeating ? 'repitiente' : 'regular';

          const newInscription = await Inscription.create(
            {
              schoolPeriodId: nextPeriod.id,
              gradeId: targetGradeId,
              sectionId: finalSectionId,
              personId: inscription.personId,
              escolaridad: escolaridadStatus,
              originPeriodId: schoolPeriodId,
              isRepeater: isRepeating
            },
            { transaction }
          );

          // Create the Matriculation record so the promoted student appears
          // in the matriculation list. The unique constraint on
          // (schoolPeriodId, personId) means we use findOrCreate to be safe.
          await Matriculation.findOrCreate({
            where: { schoolPeriodId: nextPeriod.id, personId: inscription.personId },
            defaults: {
              schoolPeriodId: nextPeriod.id,
              gradeId: targetGradeId,
              sectionId: finalSectionId ?? null,
              personId: inscription.personId,
              status: 'completed',
              escolaridad: escolaridadStatus,
              inscriptionId: newInscription.id,
            },
            transaction,
          });

          stats.newInscriptions++;

          // Enroll in regular subjects for the new grade
          if (targetPeriodGrade.subjects && targetPeriodGrade.subjects.length > 0) {
            const regularSubjects = targetPeriodGrade.subjects.map((s: any) => ({
              inscriptionId: newInscription.id,
              subjectId: s.id,
              schoolPeriodId: nextPeriod.id,
              gradeId: targetGradeId,
              sectionId: finalSectionId
            }));

            if (regularSubjects.length > 0) {
              await InscriptionSubject.bulkCreate(regularSubjects, { transaction });
            }
          }

          // Carry pending subjects into the next period. A pending subject is
          // always coursed in the grade where it belongs — never in the
          // student's new enrollment grade:
          //  - Promoted students (materias_pendientes): subjects failed in the
          //    just-finished grade get an MP inscription in that grade.
          //  - Repeaters (repitiente/rezagado): they retake the whole grade, so
          //    current-grade failures are NOT materia pendiente. Only
          //    unresolved pending subjects carried from previous periods, each
          //    into an MP inscription in its origin grade.
          const carriedByGrade = new Map<number, { subjectId: number; originPeriodId: number }[]>();
          const carrySubject = (subjectId: number, gradeId: number, originPeriodId: number) => {
            const list = carriedByGrade.get(gradeId) ?? [];
            if (!list.some(entry => entry.subjectId === subjectId)) {
              list.push({ subjectId, originPeriodId });
            }
            carriedByGrade.set(gradeId, list);
          };

          if (isRepeating) {
            for (const pending of unresolvedPendingSubjects) {
              carrySubject(pending.subjectId, pending.gradeId, pending.originPeriodId);
            }
          } else {
            for (const subject of pendingSubjects) {
              carrySubject(subject.subjectId, inscription.gradeId, schoolPeriodId);
            }
            for (const pending of unresolvedPendingSubjects) {
              carrySubject(pending.subjectId, pending.gradeId, pending.originPeriodId);
            }
          }

          if (carriedByGrade.size > 0) {
            // 1. Find/Create the "Materia Pendiente" Section — identified by
            // the isMateriaPendiente flag, not by name, so the display name can
            // be changed freely without breaking the lookup.
            const [mpSection] = await Section.findOrCreate({
              where: { isMateriaPendiente: true },
              defaults: { name: 'MATERIA PENDIENTE', isMateriaPendiente: true },
              transaction
            });

            for (const [mpGradeId, carriedSubjects] of carriedByGrade) {
              // If the carried subject belongs to the same grade the student
              // is enrolled in, it is already retaken inside the new
              // inscription — track the pending there instead of creating a
              // same-grade MP inscription (a student can never have a pending
              // subject of the grade he is coursing).
              if (mpGradeId === targetGradeId) {
                for (const carried of carriedSubjects) {
                  await PendingSubject.create({
                    newInscriptionId: newInscription.id,
                    subjectId: carried.subjectId,
                    originPeriodId: carried.originPeriodId,
                    status: 'pendiente'
                  }, { transaction });
                  stats.pendingSubjectsCreated++;
                }
                continue;
              }

              // 2. Ensure PeriodGrade exists for the ORIGIN grade in the new
              // period (the MP subject is coursed in that grade level)
              const [mpPeriodGrade] = await PeriodGrade.findOrCreate({
                where: { schoolPeriodId: nextPeriod.id, gradeId: mpGradeId },
                defaults: { schoolPeriodId: nextPeriod.id, gradeId: mpGradeId },
                transaction
              });

              if (mpPeriodGrade) {
                // Link MP Section to PeriodGrade
                await PeriodGradeSection.findOrCreate({
                  where: { periodGradeId: mpPeriodGrade.id, sectionId: mpSection.id },
                  defaults: { periodGradeId: mpPeriodGrade.id, sectionId: mpSection.id },
                  transaction
                });

                // 3. Create Separate Inscription for Materia Pendiente
                // This inscription is in the ORIGIN grade, in the MP section.
                const mpInscription = await Inscription.create({
                  schoolPeriodId: nextPeriod.id,
                  gradeId: mpGradeId,
                  sectionId: mpSection.id,
                  personId: inscription.personId,
                  escolaridad: 'materia_pendiente',
                  originPeriodId: schoolPeriodId,
                  isRepeater: false
                }, { transaction });

                stats.newInscriptions++;

                // 4. Enroll Pending Subjects in the MP Inscription
                for (const carried of carriedSubjects) {
                  await PendingSubject.create({
                    newInscriptionId: mpInscription.id,
                    subjectId: carried.subjectId,
                    originPeriodId: carried.originPeriodId,
                    status: 'pendiente'
                  }, { transaction });

                  await InscriptionSubject.create({
                    inscriptionId: mpInscription.id,
                    subjectId: carried.subjectId,
                    schoolPeriodId: nextPeriod.id,
                    gradeId: mpGradeId,
                    sectionId: mpSection.id
                  }, { transaction });

                  stats.pendingSubjectsCreated++;
                }
              }
            }
          }

          processLog.push({
            inscriptionId: inscription.id,
            studentId: inscription.personId,
            oldGrade: inscription.gradeId,
            newGrade: targetGradeId,
            status: evalStatus,
            finalAverage: evalFinalAverage,
            failedSubjects: evalFailedSubjects,
            newInscriptionId: newInscription.id,
            pendingSubjectsCount: pendingSubjects.length
          });
        } catch (error) {
          stats.skipped++;
          processLog.push({
            inscriptionId: inscription.id,
            studentId: inscription.personId,
            error: error instanceof Error ? error.message : 'Error desconocido',
            failed: true
          });
        }
      }

      await closure.update(
        {
          status: 'closed',
          finishedAt: new Date(),
          log: { processLog, stats, validation },
          snapshot: {
            minApproval,
            nextPeriodId: nextPeriod.id,
            totalStudents: studentGroups.length,
            totalInscriptions: studentGroups.reduce((total, group) => total + group.inscriptions.length, 0)
          }
        },
        { transaction }
      );

      // Rotate statuses: the closed period becomes historical, the preinscription
      // period takes over and a new preinscription period is generated.
      await SchoolPeriod.update(
        { status: 'historico' },
        { where: { id: schoolPeriodId }, transaction }
      );

      await nextPeriod.update({ status: 'activo' }, { transaction });

      await SchoolPeriodService.ensureNextPreinscriptionPeriod(nextPeriod, transaction);

      // Lock the revision period (status='closed') to prevent further edits.
      // This is separate from 'completed' which signals grades are ready.
      if (revisionPeriod && revisionPeriod.status !== 'closed') {
        await revisionPeriod.update({
          status: 'closed',
          closedAt: new Date(),
        }, { transaction });
      }

      await transaction.commit();

      return {
        success: true,
        closureId: closure.id,
        stats,
        errors: [],
        log: { processLog, validation }
      };
    } catch (error) {
      await transaction.rollback();

      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';

      return {
        success: false,
        closureId: 0,
        stats: {
          totalStudents: 0,
          approved: 0,
          withPendingSubjects: 0,
          failed: 0,
          newInscriptions: 0,
          pendingSubjectsCreated: 0,
          skipped: 0
        },
        errors: [errorMessage],
        log: { error: errorMessage, validation }
      };
    }
  }
}

export default PeriodClosureExecutor;
