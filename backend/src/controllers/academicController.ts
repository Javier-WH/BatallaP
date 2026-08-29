import { Request, Response } from 'express';
import { Op } from 'sequelize';
import {
  SchoolPeriod,
  Grade,
  Section,
  PeriodGrade,
  PeriodGradeSection,
  Subject,
  PeriodGradeSubject,
  Specialization,
  SubjectGroup,
  TeacherAssignment,
  Inscription,
  InscriptionSubject,
  PeriodClosure,
  CouncilChecklist,
  StudentPeriodOutcome,
  PendingSubject,
  Term,
  Matriculation,
  EnrollmentDocument,
  EvaluationPlan,
  Qualification,
  CouncilPoint
} from '@/models/index';

import sequelize from '@/config/database';
import { PeriodOutcomeService } from '@/services/periodOutcomeService';
import * as SchoolPeriodService from '@/services/schoolPeriodService';
import type { SchoolPeriodStatus } from '@/models/SchoolPeriod';

// --- School Periods ---

export const getPeriods = async (req: Request, res: Response) => {
  try {
    const periods = await SchoolPeriod.findAll({
      where: { status: { [Op.ne]: 'externo' } },
      order: [['startYear', 'DESC'], ['endYear', 'DESC']]
    });
    res.json(periods);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching periods' });
  }
};

export const getStudentPeriodOutcomes = async (req: Request, res: Response) => {
  try {
    const { periodId } = req.params;
    const outcomes = await PeriodOutcomeService.getOutcomesForPeriod(Number(periodId));
    res.json(outcomes);
  } catch (error) {
    console.error('Error fetching student period outcomes:', error);
    res.status(500).json({ error: 'Error fetching student period outcomes' });
  }
};

// Specializations

export const getSpecializations = async (req: Request, res: Response) => {
  const specializations = await Specialization.findAll();
  res.json(specializations);
};

export const createSpecialization = async (req: Request, res: Response) => {
  const { name } = req.body as { name: string };
  const specialization = await Specialization.create({ name });
  res.json(specialization);
};

export const updateSpecialization = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name } = req.body as { name: string };
    await Specialization.update({ name }, { where: { id } });
    res.json({ message: 'Specialization updated' });
  } catch (error) {
    res.status(500).json({ error: 'Error updating specialization' });
  }
};

export const deleteSpecialization = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    // Check if any PeriodGrade is using this specialization
    const inUseCount = await PeriodGrade.count({ where: { specializationId: id } });
    if (inUseCount > 0) {
      return res.status(400).json({ error: 'No se puede eliminar la especialización porque está siendo utilizada por uno o más grados' });
    }

    await Specialization.destroy({ where: { id } });
    res.json({ message: 'Specialization deleted' });
  } catch (error) {
    res.status(400).json({ error: 'No se puede eliminar porque está en uso' });
  }
};

export const getActivePeriod = async (req: Request, res: Response) => {
  try {
    const period = await SchoolPeriodService.getActivePeriod();
    res.json(period);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching active period' });
  }
};

export const getPreinscriptionPeriod = async (req: Request, res: Response) => {
  try {
    const period = await SchoolPeriodService.getPreinscriptionPeriod();
    res.json(period);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching preinscription period' });
  }
};

/**
 * Guarantee that the school year following the active one exists and is flagged
 * as 'preinscripcion'. Uses the same `ensureNextPreinscriptionPeriod` function
 * that the system uses when activating a period or creating a new one.
 *
 * Returns the preinscription period (created or already existing). Requires an
 * active period to exist, otherwise returns 400.
 */
export const ensurePreinscriptionPeriod = async (_req: Request, res: Response) => {
  const transaction = await sequelize.transaction();
  try {
    const activePeriod = await SchoolPeriodService.getActivePeriod(transaction);
    if (!activePeriod) {
      await transaction.rollback();
      return res.status(400).json({
        error: 'No hay un período escolar activo desde el cual crear el de preinscripción.',
      });
    }

    const preinscription = await SchoolPeriodService.ensureNextPreinscriptionPeriod(
      activePeriod,
      transaction
    );

    await transaction.commit();
    res.status(200).json(preinscription);
  } catch (error) {
    await transaction.rollback();
    console.error('[ensurePreinscriptionPeriod] Error:', error);
    res.status(500).json({ error: 'Error al crear el período de preinscripción' });
  }
};

export const createPeriod = async (req: Request, res: Response) => {
  const transaction = await sequelize.transaction();
  try {
    const { period, name } = req.body as { period?: string; name?: string };

    if (!period || !name) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Period and name are required' });
    }

    // Expected format: YYYY-YYYY
    const match = /^([0-9]{4})-([0-9]{4})$/.exec(period);
    if (!match) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Period must have format YYYY-YYYY (e.g. 2025-2026)' });
    }

    const startYear = parseInt(match[1], 10);
    const endYear = parseInt(match[2], 10);

    if (!(endYear > startYear)) {
      await transaction.rollback();
      return res.status(400).json({ error: 'End year must be greater than start year' });
    }

    const currentActivePeriod = await SchoolPeriodService.getActivePeriod(transaction);

    // Without an active period the new one takes over. Otherwise, the school year
    // right after the active one becomes the preinscription period; anything else
    // is stored as historical. We never auto-switch the active period here.
    let status: SchoolPeriodStatus = 'historico';
    if (!currentActivePeriod) {
      status = 'activo';
    } else if (startYear === currentActivePeriod.startYear + 1) {
      const existingPreinscription = await SchoolPeriodService.getPreinscriptionPeriod(transaction);
      if (!existingPreinscription) status = 'preinscripcion';
    }

    // Create the new period
    const created = await SchoolPeriod.create({
      period,
      name,
      startYear,
      endYear,
      status,
    }, { transaction });

    // Find the most recent previous period to copy structure from (exclude external periods)
    const previousPeriod = await SchoolPeriod.findOne({
      where: { id: { [Op.ne]: created.id }, status: { [Op.ne]: 'externo' } },
      order: [['startYear', 'DESC'], ['endYear', 'DESC']],
      transaction
    });

    if (previousPeriod) {
      await SchoolPeriodService.clonePeriodStructure(previousPeriod.id, created.id, transaction);
    }

    // A brand new active period must always have its preinscription counterpart
    if (status === 'activo') {
      await SchoolPeriodService.ensureNextPreinscriptionPeriod(created, transaction);
    }

    await transaction.commit();
    res.status(201).json(created);
  } catch (error: unknown) {
    await transaction.rollback();
    const err = error as { name?: string };
    if (err?.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'Period already exists' });
    }
    console.error('Error creating period:', error);
    res.status(500).json({ error: 'Error creating period' });
  }
};

export const togglePeriodActive = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const period = await SchoolPeriodService.activatePeriod(Number(id));
    res.json({ message: 'Period activated successfully', period });
  } catch (error) {
    console.error('[togglePeriodActive] Error:', error);
    res.status(500).json({ error: 'Error toggling period' });
  }
};

export const updatePeriod = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { period, name } = req.body as { period?: string; name?: string };

    if (!period || !name) {
      return res.status(400).json({ error: 'Period and name are required' });
    }

    const match = /^([0-9]{4})-([0-9]{4})$/.exec(period);
    if (!match) {
      return res.status(400).json({ error: 'Period must have format YYYY-YYYY (e.g. 2025-2026)' });
    }

    const startYear = parseInt(match[1], 10);
    const endYear = parseInt(match[2], 10);

    if (!(endYear > startYear)) {
      return res.status(400).json({ error: 'End year must be greater than start year' });
    }

    await SchoolPeriod.update(
      { period, name, startYear, endYear },
      { where: { id } }
    );

    res.json({ message: 'Period updated' });
  } catch (error) {
    res.status(500).json({ error: 'Error updating period' });
  }
};



// ... existing code ...

export const deletePeriod = async (req: Request, res: Response) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;

    // 0. Clean up direct SchoolPeriod dependencies
    await PeriodClosure.destroy({ where: { schoolPeriodId: id }, transaction: t });
    await CouncilChecklist.destroy({ where: { schoolPeriodId: id }, transaction: t });
    await PendingSubject.destroy({ where: { originPeriodId: id }, transaction: t });

    // 0.2 Clean up Matriculations (Fix for foreign key constraint)
    const matriculations = await Matriculation.findAll({
      where: { schoolPeriodId: id },
      attributes: ['id'],
      transaction: t
    });
    const matriculationIds = matriculations.map(m => m.id);
    if (matriculationIds.length > 0) {
      await EnrollmentDocument.destroy({ where: { matriculationId: { [Op.in]: matriculationIds } }, transaction: t });
      await Matriculation.destroy({ where: { id: { [Op.in]: matriculationIds } }, transaction: t });
    }

    // 0.3 Clean up Terms and linked Evaluation Data
    const terms = await Term.findAll({
      where: { schoolPeriodId: id },
      attributes: ['id'],
      transaction: t
    });
    const termIds = terms.map(te => te.id);
    if (termIds.length > 0) {
      // CouncilPoints linked to Terms
      await CouncilPoint.destroy({ where: { termId: { [Op.in]: termIds } }, transaction: t });

      // EvaluationPlans and Qualifications linked to Terms
      const evalPlans = await EvaluationPlan.findAll({
        where: { termId: { [Op.in]: termIds } },
        attributes: ['id'],
        transaction: t
      });
      const evalPlanIds = evalPlans.map(ep => ep.id);

      if (evalPlanIds.length > 0) {
        await Qualification.destroy({ where: { evaluationPlanId: { [Op.in]: evalPlanIds } }, transaction: t });
        await EvaluationPlan.destroy({ where: { id: { [Op.in]: evalPlanIds } }, transaction: t });
      }

      // Finally delete terms
      await Term.destroy({ where: { id: { [Op.in]: termIds } }, transaction: t });
    }

    // 0.1 Clean up Inscriptions and their child dependencies
    const inscriptions = await Inscription.findAll({
      where: { schoolPeriodId: id },
      attributes: ['id'],
      transaction: t
    });
    const inscriptionIds = inscriptions.map(i => i.id);

    if (inscriptionIds.length > 0) {
      await StudentPeriodOutcome.destroy({ where: { inscriptionId: { [Op.in]: inscriptionIds } }, transaction: t });
      await PendingSubject.destroy({ where: { newInscriptionId: { [Op.in]: inscriptionIds } }, transaction: t });
      await InscriptionSubject.destroy({ where: { inscriptionId: { [Op.in]: inscriptionIds } }, transaction: t });
      // Finally delete the inscriptions
      await Inscription.destroy({ where: { id: { [Op.in]: inscriptionIds } }, transaction: t });
    }

    // Find all PeriodGrades associated with this period
    const periodGrades = await PeriodGrade.findAll({ where: { schoolPeriodId: id }, transaction: t });
    const periodGradeIds = periodGrades.map(pg => pg.id);

    if (periodGradeIds.length > 0) {
      // 1. Delete TeacherAssignments linked to PeriodGradeSubjects of these PeriodGrades
      // First find PeriodGradeSubjects to get their IDs
      const periodGradeSubjects = await PeriodGradeSubject.unscoped().findAll({
        where: { periodGradeId: { [Op.in]: periodGradeIds } },
        transaction: t
      });
      const periodGradeSubjectIds = periodGradeSubjects.map(pgs => pgs.id);

      if (periodGradeSubjectIds.length > 0) {
        await TeacherAssignment.destroy({
          where: { periodGradeSubjectId: { [Op.in]: periodGradeSubjectIds } },
          transaction: t
        });
      }

      // 2. Delete PeriodGradeSubjects
      await PeriodGradeSubject.destroy({
        where: { periodGradeId: { [Op.in]: periodGradeIds } },
        transaction: t
      });

      // 3. Delete PeriodGradeSections
      await PeriodGradeSection.destroy({
        where: { periodGradeId: { [Op.in]: periodGradeIds } },
        transaction: t
      });

      // 4. Delete PeriodGrades
      await PeriodGrade.destroy({
        where: { id: { [Op.in]: periodGradeIds } },
        transaction: t
      });
    }

    // 5. Delete the SchoolPeriod
    await SchoolPeriod.destroy({ where: { id }, transaction: t });

    await t.commit();
    res.json({ message: 'Period deleted' });
  } catch (error) {
    await t.rollback();
    console.error('Error deletePeriod:', error);
    res.status(500).json({ error: 'Error al eliminar el periodo escolar, verifique que no posea datos vinculados.' });
  }
};

// --- Catalogs (Grades & Sections) ---

export const getGrades = async (req: Request, res: Response) => {
  const grades = await Grade.findAll({
    order: [
      ['order', 'ASC'],
      ['name', 'ASC'],
    ],
  });
  res.json(grades);
};

export const createGrade = async (req: Request, res: Response) => {
  const { name, isDiversified } = req.body as { name: string; isDiversified?: boolean };
  const maxOrder = await Grade.max('order');
  const nextOrder = Number.isFinite(maxOrder as number) ? (Number(maxOrder) || 0) + 1 : 1;
  const grade = await Grade.create({ name, isDiversified: !!isDiversified, order: nextOrder } as any);
  res.json(grade);
};

export const updateGrade = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, isDiversified } = req.body as { name?: string; isDiversified?: boolean };
    await Grade.update({ name, isDiversified }, { where: { id } });
    res.json({ message: 'Grade updated' });
  } catch (error) {
    res.status(500).json({ error: 'Error updating grade' });
  }
};

export const updateGradeOrder = async (req: Request, res: Response) => {
  try {
    const { gradeIds } = req.body as { gradeIds: number[] };

    if (!Array.isArray(gradeIds) || gradeIds.length === 0) {
      return res.status(400).json({ error: 'gradeIds must be a non-empty array' });
    }

    const updates = gradeIds.map((gradeId, index) =>
      Grade.update({ order: index + 1 } as any, { where: { id: gradeId } }),
    );

    await Promise.all(updates);

    res.json({ message: 'Grade order updated' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error updating grade order' });
  }
};

export const deleteGrade = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await Grade.destroy({ where: { id } });
    res.json({ message: 'Grade deleted' });
  } catch (error) {
    res.status(400).json({ error: 'No se puede eliminar porque está en uso' });
  }
};

export const getSections = async (req: Request, res: Response) => {
  const sections = await Section.findAll();
  res.json(sections);
};

export const createSection = async (req: Request, res: Response) => {
  const { name } = req.body;
  const section = await Section.create({ name });
  res.json(section);
};

export const updateSection = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    await Section.update({ name }, { where: { id } });
    res.json({ message: 'Section updated' });
  } catch (error) {
    res.status(500).json({ error: 'Error updating section' });
  }
};

export const deleteSection = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await Section.destroy({ where: { id } });
    res.json({ message: 'Section deleted' });
  } catch (error) {
    res.status(400).json({ error: 'No se puede eliminar porque está en uso' });
  }
};

// ... (Grades & Sections) ...

export const getSubjects = async (req: Request, res: Response) => {
  const subjects = await Subject.findAll({ include: [{ model: SubjectGroup, as: 'subjectGroup' }] });
  res.json(subjects);
};

export const createSubject = async (req: Request, res: Response) => {
  const { name, subjectGroupId, usesLiteralGrades, abbreviation, icon, color, allowConsecutiveBlocks } = req.body as { name: string; subjectGroupId?: number | null; usesLiteralGrades?: boolean; abbreviation?: string | null; icon?: string | null; color?: string | null; allowConsecutiveBlocks?: boolean };
  const subject = await Subject.create({ name, subjectGroupId: subjectGroupId ?? null, usesLiteralGrades: usesLiteralGrades ?? false, abbreviation: abbreviation ?? null, icon: icon ?? null, color: color ?? null, allowConsecutiveBlocks: allowConsecutiveBlocks ?? false });
  res.json(subject);
};

export const updateSubject = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, subjectGroupId, usesLiteralGrades, abbreviation, icon, color, allowConsecutiveBlocks } = req.body as { name?: string; subjectGroupId?: number | null; usesLiteralGrades?: boolean; abbreviation?: string | null; icon?: string | null; color?: string | null; allowConsecutiveBlocks?: boolean };
    await Subject.update({ name, subjectGroupId: subjectGroupId ?? null, usesLiteralGrades: usesLiteralGrades ?? false, abbreviation: abbreviation ?? null, icon: icon ?? null, color: color ?? null, allowConsecutiveBlocks: allowConsecutiveBlocks ?? false }, { where: { id } });
    res.json({ message: 'Subject updated' });
  } catch (error) {
    console.error('[updateSubject] Error:', error);
    res.status(500).json({ error: 'Error updating subject' });
  }
};

export const deleteSubject = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await Subject.destroy({ where: { id } });
    res.json({ message: 'Subject deleted' });
  } catch (error) {
    res.status(400).json({ error: 'No se puede eliminar porque está en uso' });
  }
};

// Subject Groups

export const getSubjectGroups = async (req: Request, res: Response) => {
  const groups = await SubjectGroup.findAll();
  res.json(groups);
};

export const createSubjectGroup = async (req: Request, res: Response) => {
  try {
    const rawName = (req.body as { name: string }).name;
    const name = rawName.trim();
    if (!name) {
      return res.status(400).json({ error: 'El nombre del grupo es requerido' });
    }

    const existing = await SubjectGroup.findOne({
      where: sequelize.where(
        sequelize.fn('LOWER', sequelize.col('name')),
        sequelize.fn('LOWER', name),
      )
    });

    if (existing) {
      return res.status(400).json({ error: 'Ya existe un grupo de materias con ese nombre' });
    }

    const { bulletinAbbreviation, longAbbreviation, shortAbbreviation } = req.body as {
      bulletinAbbreviation?: string | null;
      longAbbreviation?: string | null;
      shortAbbreviation?: string | null;
    };

    const group = await SubjectGroup.create({
      name,
      bulletinAbbreviation: bulletinAbbreviation?.trim() || null,
      longAbbreviation: longAbbreviation?.trim() || null,
      shortAbbreviation: shortAbbreviation?.trim() || null,
    });
    res.json(group);
  } catch (error) {
    res.status(500).json({ error: 'Error creando grupo de materias' });
  }
};

export const updateSubjectGroup = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const rawName = (req.body as { name: string }).name;
    const name = rawName.trim();
    if (!name) {
      return res.status(400).json({ error: 'El nombre del grupo es requerido' });
    }

    const existing = await SubjectGroup.findOne({
      where: {
        name,
        id: { [Op.ne]: id },
      } as any,
    });

    if (existing) {
      return res.status(400).json({ error: 'Ya existe un grupo de materias con ese nombre' });
    }

    const { bulletinAbbreviation, longAbbreviation, shortAbbreviation } = req.body as {
      bulletinAbbreviation?: string | null;
      longAbbreviation?: string | null;
      shortAbbreviation?: string | null;
    };

    await SubjectGroup.update(
      {
        name,
        bulletinAbbreviation: bulletinAbbreviation?.trim() || null,
        longAbbreviation: longAbbreviation?.trim() || null,
        shortAbbreviation: shortAbbreviation?.trim() || null,
      },
      { where: { id } }
    );
    res.json({ message: 'Subject group updated' });
  } catch (error) {
    res.status(500).json({ error: 'Error updating subject group' });
  }
};

export const deleteSubjectGroup = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await SubjectGroup.destroy({ where: { id } });
    res.json({ message: 'Subject group deleted' });
  } catch (error) {
    res.status(400).json({ error: 'No se puede eliminar porque está en uso' });
  }
};

// --- Structure Management ---

export const getPeriodStructure = async (req: Request, res: Response) => {
  try {
    const { periodId } = req.params;

    const structure = await PeriodGrade.findAll({
      where: { schoolPeriodId: periodId },
      include: [
        { model: Grade, as: 'grade' },
        { model: Specialization, as: 'specialization' },
        {
          model: Section,
          as: 'sections',
          through: { attributes: ['id', 'color'] }
        },
        {
          model: Subject,
          as: 'subjects',
          through: { attributes: ['id', 'order', 'includeInAverage', 'weeklyBlocks'], where: { active: true } },
          include: [{ model: SubjectGroup, as: 'subjectGroup' }]
        }
      ],
      order: [
        // Order subjects within each PeriodGrade by the join-table "order" column
        [{ model: Subject, as: 'subjects' }, PeriodGradeSubject, 'order', 'ASC'],
      ],
    });

    res.json(structure);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error fetching structure' });
  }
};

// ... (Grade/Section assignment) ...

export const addSubjectToGrade = async (req: Request, res: Response) => {
  try {
    const { periodGradeId, subjectId } = req.body;
    // Determine next order for this periodGrade
    const maxExisting = await PeriodGradeSubject.max('order', { where: { periodGradeId } });
    const nextOrder = Number.isFinite(maxExisting as number) ? (Number(maxExisting) || 0) + 1 : 1;

    // Check if a soft-deleted record already exists (reactivate instead of create)
    const existing = await PeriodGradeSubject.unscoped().findOne({
      where: { periodGradeId, subjectId },
    });
    let pgs;
    if (existing) {
      await existing.update({ active: true, order: nextOrder });
      pgs = existing;
    } else {
      pgs = await PeriodGradeSubject.create({ periodGradeId, subjectId, order: nextOrder });
    }

    // For core subjects (no subjectGroupId), auto-create InscriptionSubject
    // records so existing students get the new subject immediately.
    const subject = await Subject.findByPk(subjectId);
    if (subject && !subject.subjectGroupId) {
      const periodGrade = await PeriodGrade.findByPk(periodGradeId);
      if (periodGrade) {
        const inscriptions = await Inscription.findAll({
          where: {
            schoolPeriodId: periodGrade.schoolPeriodId,
            gradeId: periodGrade.gradeId,
          },
          attributes: ['id', 'schoolPeriodId', 'gradeId', 'sectionId'],
        });
        const toCreate = inscriptions.map((ins: any) => ({
          inscriptionId: ins.id,
          subjectId,
          schoolPeriodId: ins.schoolPeriodId,
          gradeId: ins.gradeId,
          sectionId: ins.sectionId,
        }));
        if (toCreate.length > 0) {
          await InscriptionSubject.bulkCreate(toCreate, { ignoreDuplicates: true });
        }
      }
    }

    res.json(pgs);
  } catch (error) {
    res.status(500).json({ error: 'Error adding subject' });
  }
};

export const updateSubjectOrderForGrade = async (req: Request, res: Response) => {
  try {
    const { periodGradeId, subjectIds } = req.body as { periodGradeId: number; subjectIds: number[] };

    if (!Array.isArray(subjectIds) || subjectIds.length === 0) {
      return res.status(400).json({ error: 'subjectIds must be a non-empty array' });
    }

    // Update order sequentially based on array index
    const updates = subjectIds.map((subjectId, index) =>
      PeriodGradeSubject.update(
        { order: index + 1 },
        { where: { periodGradeId, subjectId } },
      ),
    );

    await Promise.all(updates);

    res.json({ message: 'Order updated' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error updating subject order' });
  }
};

export const toggleSubjectIncludeInAverage = async (req: Request, res: Response) => {
  try {
    const { periodGradeId, subjectId, includeInAverage } = req.body as {
      periodGradeId: number;
      subjectId: number;
      includeInAverage: boolean;
    };

    const pgs = await PeriodGradeSubject.unscoped().findOne({
      where: { periodGradeId, subjectId },
    });

    if (!pgs) {
      return res.status(404).json({ error: 'Materia no vinculada a este grado' });
    }

    await pgs.update({ includeInAverage });
    res.json({ message: 'Updated', includeInAverage });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error updating includeInAverage' });
  }
};

export const updateSubjectWeeklyBlocks = async (req: Request, res: Response) => {
  try {
    const { periodGradeId, subjectId, weeklyBlocks } = req.body as {
      periodGradeId: number;
      subjectId: number;
      weeklyBlocks: number;
    };

    if (!Number.isFinite(weeklyBlocks) || weeklyBlocks < 1 || weeklyBlocks > 20) {
      return res.status(400).json({ error: 'weeklyBlocks debe ser un número entre 1 y 20' });
    }

    const pgs = await PeriodGradeSubject.unscoped().findOne({
      where: { periodGradeId, subjectId },
    });

    if (!pgs) {
      return res.status(404).json({ error: 'Materia no vinculada a este grado' });
    }

    await pgs.update({ weeklyBlocks });
    res.json({ message: 'Updated', weeklyBlocks });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error updating weeklyBlocks' });
  }
};

export const removeSubjectFromGrade = async (req: Request, res: Response) => {
  try {
    const { periodGradeId, subjectId } = req.body;
    // Soft-delete: mark as inactive instead of destroying. This preserves
    // InscriptionSubject, EvaluationPlan, TeacherAssignment, and Qualification
    // records for historical data. If the subject is re-added later, all data
    // reappears because the PeriodGradeSubject record is reactivated.
    await PeriodGradeSubject.unscoped().update(
      { active: false },
      { where: { periodGradeId, subjectId } },
    );
    res.json({ message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Error removing subject' });
  }
};

export const getPeriodGradeSubject = async (req: Request, res: Response) => {
  try {
    const { periodGradeId, subjectId } = req.params;
    const pgs = await PeriodGradeSubject.findOne({
      where: {
        periodGradeId: Number(periodGradeId),
        subjectId: Number(subjectId)
      }
    });

    if (!pgs) {
      return res.status(404).json({ error: 'PeriodGradeSubject not found' });
    }

    res.json(pgs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error fetching PeriodGradeSubject' });
  }
};

export const addGradeToPeriod = async (req: Request, res: Response) => {
  try {
    const { schoolPeriodId, gradeId, specializationId } = req.body as {
      schoolPeriodId: number;
      gradeId: number;
      specializationId?: number | null;
    };
    const pg = await PeriodGrade.create({ schoolPeriodId, gradeId, specializationId: specializationId ?? null });
    res.json(pg);
  } catch (error) {
    res.status(500).json({ error: 'Error adding grade to period' });
  }
};

export const removeGradeFromPeriod = async (req: Request, res: Response) => {
  try {
    const { id } = req.params; // PeriodGrade ID
    // Should cascade delete sections? PeriodGradeSection has cascade usually if configured, 
    // strictly sequelize default might restrict. Let's delete manually or rely on DB.
    // For safety/simplicity:
    await PeriodGradeSection.destroy({ where: { periodGradeId: id } });
    await PeriodGrade.destroy({ where: { id } });
    res.json({ message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Error removing grade' });
  }
};

export const addSectionToGrade = async (req: Request, res: Response) => {
  try {
    const { periodGradeId, sectionId } = req.body;
    const pgs = await PeriodGradeSection.create({ periodGradeId, sectionId });
    res.json(pgs);
  } catch (error) {
    res.status(500).json({ error: 'Error adding section' });
  }
};

export const removeSectionFromGrade = async (req: Request, res: Response) => {
  try {
    const periodGradeId = Number(req.params.periodGradeId || req.body.periodGradeId);
    const sectionId = Number(req.params.sectionId || req.body.sectionId);
    await PeriodGradeSection.destroy({ where: { periodGradeId, sectionId } });
    res.json({ message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Error removing section' });
  }
};

export const updateSectionColor = async (req: Request, res: Response) => {
  try {
    const { periodGradeId, sectionId } = req.params;
    const { color } = req.body;
    const pgs = await PeriodGradeSection.findOne({ where: { periodGradeId: Number(periodGradeId), sectionId: Number(sectionId) } });
    if (!pgs) return res.status(404).json({ error: 'Relación grado-sección no encontrada' });
    pgs.color = color;
    await pgs.save();
    res.json(pgs);
  } catch (error) {
    res.status(500).json({ error: 'Error updating section color' });
  }
};

export const updateGradeColor = async (req: Request, res: Response) => {
  try {
    const { periodGradeId } = req.params;
    const { color } = req.body;
    const pg = await PeriodGrade.findByPk(Number(periodGradeId));
    if (!pg) return res.status(404).json({ error: 'PeriodGrade no encontrado' });
    pg.color = color;
    await pg.save();
    res.json(pg);
  } catch (error) {
    res.status(500).json({ error: 'Error updating grade color' });
  }
};
