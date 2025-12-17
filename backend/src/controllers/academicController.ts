import { Request, Response } from 'express';
import { SchoolPeriod, Grade, Section, PeriodGrade, PeriodGradeSection } from '@/models/index';
import sequelize from '@/config/database';

// --- School Periods ---

export const getPeriods = async (req: Request, res: Response) => {
  try {
    const periods = await SchoolPeriod.findAll({ order: [['id', 'DESC']] });
    res.json(periods);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching periods' });
  }
};

export const createPeriod = async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    const period = await SchoolPeriod.create({ name, isActive: false });
    res.status(201).json(period);
  } catch (error) {
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

// --- Catalogs (Grades & Sections) ---

export const getGrades = async (req: Request, res: Response) => {
  const grades = await Grade.findAll();
  res.json(grades);
};

export const createGrade = async (req: Request, res: Response) => {
  const { name } = req.body;
  const grade = await Grade.create({ name });
  res.json(grade);
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

// --- Structure Management ---

export const getPeriodStructure = async (req: Request, res: Response) => {
  try {
    const { periodId } = req.params;

    const structure = await PeriodGrade.findAll({
      where: { schoolPeriodId: periodId },
      include: [
        { model: Grade, as: 'grade' },
        {
          model: Section,
          as: 'sections',
          through: { attributes: ['id'] } // Get PeriodGradeSection ID if needed
        }
      ]
    });

    // Transform for easier frontend consumption if needed, or send as is
    res.json(structure);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error fetching structure' });
  }
};

export const addGradeToPeriod = async (req: Request, res: Response) => {
  try {
    const { schoolPeriodId, gradeId } = req.body;
    const pg = await PeriodGrade.create({ schoolPeriodId, gradeId });
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
