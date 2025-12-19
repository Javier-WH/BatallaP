import { Request, Response } from 'express';
import { SchoolPeriod, Grade, Section, PeriodGrade, PeriodGradeSection, Subject, PeriodGradeSubject, Specialization, SubjectGroup } from '@/models/index';
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
  try {
    const { period, name } = req.body as { period?: string; name?: string };

    if (!period || !name) {
      return res.status(400).json({ error: 'Period and name are required' });
    }

    // Expected format: YYYY-YYYY
    const match = /^([0-9]{4})-([0-9]{4})$/.exec(period);
    if (!match) {
      return res.status(400).json({ error: 'Period must have format YYYY-YYYY (e.g. 2025-2026)' });
    }

    const startYear = parseInt(match[1], 10);
    const endYear = parseInt(match[2], 10);

    if (!(endYear > startYear)) {
      return res.status(400).json({ error: 'End year must be greater than start year' });
    }

    const created = await SchoolPeriod.create({
      period,
      name,
      startYear,
      endYear,
      isActive: false,
    });

    res.status(201).json(created);
  } catch (error: any) {
    if (error?.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'Period already exists' });
    }
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

export const deletePeriod = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await SchoolPeriod.destroy({ where: { id } });
    res.json({ message: 'Period deleted' });
  } catch (error) {
    res.status(400).json({ error: 'No se puede eliminar porque está en uso' });
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
  const { name } = req.body as { name: string };
  const group = await SubjectGroup.create({ name });
  res.json(group);
};

export const updateSubjectGroup = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name } = req.body as { name: string };
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
