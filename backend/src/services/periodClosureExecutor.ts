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
  Person
} from '@/models/index';
import { FinalGradeCalculator } from './finalGradeCalculator';
import { StudentPromotionEngine } from './studentPromotionEngine';

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
  };
  errors: string[];
  log: Record<string, unknown>;
}

export class PeriodClosureExecutor {
  static async validateClosure(schoolPeriodId: number): Promise<ClosureValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    const period = await SchoolPeriod.findByPk(schoolPeriodId);
    if (!period) {
      errors.push('Periodo escolar no encontrado');
      return { valid: false, errors, warnings };
    }

    if (!period.isActive) {
      errors.push('El periodo no está activo');
    }

    const nextPeriod = await SchoolPeriod.findOne({
      where: { 
        isActive: false,
        startYear: { [Op.gt]: period.startYear }
      },
      order: [['startYear', 'ASC'], ['endYear', 'ASC']]
    });

    if (!nextPeriod || nextPeriod.id === schoolPeriodId) {
      errors.push('Debe existir un periodo siguiente creado antes de cerrar el periodo actual');
    }

    const terms = await Term.findAll({
      where: { schoolPeriodId },
      attributes: ['id', 'isBlocked', 'name']
    });

    const unblockedTerms = terms.filter((t) => !t.isBlocked);
    if (unblockedTerms.length > 0) {
      errors.push(
        `Todos los lapsos deben estar bloqueados. Lapsos sin bloquear: ${unblockedTerms.map((t) => t.name).join(', ')}`
      );
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

    const inscriptions = await Inscription.findAll({
      where: { schoolPeriodId },
      include: [
        {
          model: InscriptionSubject,
          as: 'inscriptionSubjects',
          required: false
        }
      ]
    });


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
          pendingSubjectsCreated: 0
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

      const nextPeriod = await SchoolPeriod.findOne({
        where: { 
          isActive: false,
          startYear: { [Op.gt]: (await SchoolPeriod.findByPk(schoolPeriodId, { transaction }))!.startYear }
        },
        order: [['startYear', 'ASC'], ['endYear', 'ASC']],
        transaction
      });
      if (!nextPeriod) {
        throw new Error('No se encontró periodo siguiente');
      }

      const inscriptions = await Inscription.findAll({
        where: { schoolPeriodId },
        include: [
          { model: Person, as: 'student' },
          { model: Grade, as: 'grade' },
          { model: Section, as: 'section' }
        ],
        transaction
      });

      const stats = {
        totalStudents: inscriptions.length,
        approved: 0,
        withPendingSubjects: 0,
        failed: 0,
        newInscriptions: 0,
        pendingSubjectsCreated: 0
      };

      const processLog: Record<string, unknown>[] = [];

      for (const inscription of inscriptions) {
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

          const { outcome, pendingSubjects, promotionGrade } = evaluation;

          if (outcome.status === 'aprobado') {
            stats.approved++;
          } else if (outcome.status === 'materias_pendientes') {
            stats.withPendingSubjects++;
          } else if (outcome.status === 'reprobado') {
            stats.failed++;
          }

          const targetGradeId = outcome.promotionGradeId || inscription.gradeId;
          const isRepeating = outcome.status === 'reprobado';

          const targetPeriodGrade = await PeriodGrade.findOne({
            where: {
              schoolPeriodId: nextPeriod.id,
              gradeId: targetGradeId
            },
            transaction
          });

          if (!targetPeriodGrade) {
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

          let escolaridadStatus: 'regular' | 'repitiente' | 'materia_pendiente' = 'regular';
          if (isRepeating) {
            escolaridadStatus = 'repitiente';
          } else if (outcome.status === 'materias_pendientes') {
            escolaridadStatus = 'materia_pendiente';
          }

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

          stats.newInscriptions++;

          if (pendingSubjects.length > 0) {
            for (const pendingSubj of pendingSubjects) {
              await PendingSubject.create(
                {
                  newInscriptionId: newInscription.id,
                  subjectId: pendingSubj.subjectId,
                  originPeriodId: schoolPeriodId,
                  status: 'pendiente'
                },
                { transaction }
              );
              stats.pendingSubjectsCreated++;
            }
          }

          processLog.push({
            inscriptionId: inscription.id,
            studentId: inscription.personId,
            oldGrade: inscription.gradeId,
            newGrade: targetGradeId,
            status: outcome.status,
            finalAverage: outcome.finalAverage,
            failedSubjects: outcome.failedSubjects,
            newInscriptionId: newInscription.id,
            pendingSubjectsCount: pendingSubjects.length
          });
        } catch (error) {
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
            totalInscriptions: inscriptions.length
          }
        },
        { transaction }
      );

      await SchoolPeriod.update(
        { isActive: false },
        { where: { id: schoolPeriodId }, transaction }
      );

      await SchoolPeriod.update(
        { isActive: true },
        { where: { id: nextPeriod.id }, transaction }
      );

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
          pendingSubjectsCreated: 0
        },
        errors: [errorMessage],
        log: { error: errorMessage, validation }
      };
    }
  }
}

export default PeriodClosureExecutor;
