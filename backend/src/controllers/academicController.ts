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

// --- School Periods ---

export const getPeriods = async (req: Request, res: Response) => {
  try {
    const periods = await SchoolPeriod.findAll({ order: [['startYear', 'DESC'], ['endYear', 'DESC']] });
    res.json(periods);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching periods' });
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
    const period = await SchoolPeriod.findOne({ where: { isActive: true } });
    res.json(period);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching active period' });
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

    // Find the current active period to determine if new one should be active
    const currentActivePeriod = await SchoolPeriod.findOne({
      where: { isActive: true },
      transaction
    });

    // New period is active if it's more recent than the current active period (or if there's no active period)
    // New period is active ONLY if there is no current active period.
    // We do not want to auto-switch to a future period just because it's created.
    const shouldBeActive = !currentActivePeriod;



    // Create the new period
    const created = await SchoolPeriod.create({
      period,
      name,
      startYear,
      endYear,
      isActive: shouldBeActive,
    }, { transaction });

    // Find the most recent previous period to copy structure from
    const previousPeriod = await SchoolPeriod.findOne({
      where: { id: { [Op.ne]: created.id } },
      order: [['startYear', 'DESC'], ['endYear', 'DESC']],
      transaction
    });

    if (previousPeriod) {
      // Copy Terms (Lapsos) structure
      const previousTerms = await Term.findAll({
        where: { schoolPeriodId: previousPeriod.id },
        order: [['order', 'ASC']],
        transaction
      });

      for (const term of previousTerms) {
        await Term.create({
          schoolPeriodId: created.id,
          name: term.name,
          order: term.order,
          isBlocked: false
        }, { transaction });
      }

      // Get all PeriodGrades from the previous period with their sections and subjects
      const previousPeriodGrades = await PeriodGrade.findAll({
        where: { schoolPeriodId: previousPeriod.id },
        transaction
      });

      // Map old PeriodGrade IDs to new ones for TeacherAssignment copying
      const periodGradeIdMap = new Map<number, number>();
      const periodGradeSubjectIdMap = new Map<number, number>();

      for (const pg of previousPeriodGrades) {
        // Create new PeriodGrade for the new period
        const newPg = await PeriodGrade.create({
          schoolPeriodId: created.id,
          gradeId: pg.gradeId,
          specializationId: pg.specializationId
        }, { transaction });

        periodGradeIdMap.set(pg.id, newPg.id);

        // Copy sections for this PeriodGrade
        const previousSections = await PeriodGradeSection.findAll({
          where: { periodGradeId: pg.id },
          transaction
        });

        for (const pgs of previousSections) {
          await PeriodGradeSection.create({
            periodGradeId: newPg.id,
            sectionId: pgs.sectionId
          }, { transaction });
        }

        // Copy subjects for this PeriodGrade
        const previousSubjects = await PeriodGradeSubject.findAll({
          where: { periodGradeId: pg.id },
          transaction
        });

        for (const pgsub of previousSubjects) {
          const newPgSub = await PeriodGradeSubject.create({
            periodGradeId: newPg.id,
            subjectId: pgsub.subjectId,
            order: pgsub.order
          }, { transaction });

          periodGradeSubjectIdMap.set(pgsub.id, newPgSub.id);
        }
      }

      // Copy TeacherAssignments
      const previousAssignments = await TeacherAssignment.findAll({
        where: {
          periodGradeSubjectId: { [Op.in]: Array.from(periodGradeSubjectIdMap.keys()) }
        },
        transaction
      });

      for (const ta of previousAssignments) {
        const newPgSubId = periodGradeSubjectIdMap.get(ta.periodGradeSubjectId);
        if (newPgSubId) {
          await TeacherAssignment.create({
            teacherId: ta.teacherId,
            periodGradeSubjectId: newPgSubId,
            sectionId: ta.sectionId
          }, { transaction });
        }
      }
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
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;

    // Deactivate all
    await SchoolPeriod.update({ isActive: false }, { where: {}, transaction: t });

    // Activate target
    await SchoolPeriod.update({ isActive: true }, { where: { id }, transaction: t });

    await t.commit();
    res.json({ message: 'Period activated successfully' });
  } catch (error) {
    await t.rollback();
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
      const periodGradeSubjects = await PeriodGradeSubject.findAll({
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
  const { name, subjectGroupId } = req.body as { name: string; subjectGroupId?: number | null };
  const subject = await Subject.create({ name, subjectGroupId: subjectGroupId ?? null });
  res.json(subject);
};

export const updateSubject = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, subjectGroupId } = req.body as { name?: string; subjectGroupId?: number | null };
    await Subject.update({ name, subjectGroupId: subjectGroupId ?? null }, { where: { id } });
    res.json({ message: 'Subject updated' });
  } catch (error) {
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

    const group = await SubjectGroup.create({ name });
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

    await SubjectGroup.update({ name }, { where: { id } });
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
          through: { attributes: ['id'] }
        },
        {
          model: Subject,
          as: 'subjects',
          through: { attributes: ['id', 'order'] },
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
    const pgs = await PeriodGradeSubject.create({ periodGradeId, subjectId, order: nextOrder });
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

export const removeSubjectFromGrade = async (req: Request, res: Response) => {
  try {
    const { periodGradeId, subjectId } = req.body;
    await PeriodGradeSubject.destroy({ where: { periodGradeId, subjectId } });
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
    const { periodGradeId, sectionId } = req.body; // or ID of the relation
    // If we receive the pair
    await PeriodGradeSection.destroy({ where: { periodGradeId, sectionId } });
    res.json({ message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Error removing section' });
  }
};
