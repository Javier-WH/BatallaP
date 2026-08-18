import { Request, Response } from 'express';
import sequelize from '@/config/database';
import {
  StructurePreset,
  Grade,
  Subject,
  Section,
  PeriodGrade,
  PeriodGradeSubject,
  PeriodGradeSection,
  SchoolPeriod
} from '@/models/index';

// GET /api/structure-presets
export const listStructurePresets = async (_req: Request, res: Response) => {
  try {
    const presets = await StructurePreset.findAll({ order: [['isSystem', 'DESC'], ['name', 'ASC']] });
    return res.json(presets);
  } catch (error) {
    console.error('[listStructurePresets] Error:', error);
    return res.status(500).json({ message: 'Error al listar presets de estructura' });
  }
};

// POST /api/structure-presets
export const createStructurePreset = async (req: Request, res: Response) => {
  try {
    const { name, description, grades } = req.body;
    if (!name || !Array.isArray(grades) || grades.length === 0) {
      return res.status(400).json({ message: 'Nombre y grados son requeridos' });
    }
    const preset = await StructurePreset.create({ name, description: description || null, grades });
    return res.status(201).json(preset);
  } catch (error: any) {
    console.error('[createStructurePreset] Error:', error);
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'Ya existe un preset con ese nombre' });
    }
    return res.status(500).json({ message: 'Error al crear preset' });
  }
};

// DELETE /api/structure-presets/:id
export const deleteStructurePreset = async (req: Request, res: Response) => {
  try {
    const preset = await StructurePreset.findByPk(req.params.id);
    if (!preset) return res.status(404).json({ message: 'Preset no encontrado' });
    if (preset.isSystem) {
      return res.status(403).json({ message: 'Los presets del sistema no se pueden eliminar' });
    }
    await preset.destroy();
    return res.json({ message: 'Preset eliminado' });
  } catch (error) {
    console.error('[deleteStructurePreset] Error:', error);
    return res.status(500).json({ message: 'Error al eliminar preset' });
  }
};

// POST /api/structure-presets/:id/apply
export const applyStructurePreset = async (req: Request, res: Response) => {
  const t = await sequelize.transaction();
  try {
    const preset = await StructurePreset.findByPk(req.params.id);
    if (!preset) {
      await t.rollback();
      return res.status(404).json({ message: 'Preset no encontrado' });
    }

    const { schoolPeriodId } = req.body;
    if (!schoolPeriodId) {
      await t.rollback();
      return res.status(400).json({ message: 'schoolPeriodId es requerido' });
    }

    const period = await SchoolPeriod.findByPk(schoolPeriodId, { transaction: t });
    if (!period) {
      await t.rollback();
      return res.status(404).json({ message: 'Período no encontrado' });
    }

    const gradesData = preset.grades as { name: string; subjects: { name: string; abbreviation?: string | null }[] }[];
    const allSections = await Section.findAll({ transaction: t });

    const results: { grade: string; created: boolean; subjectsLinked: number; subjectsSkipped: number; sectionsLinked: number }[] = [];

    for (const gradeData of gradesData) {
      const gradeName = gradeData.name.toUpperCase().trim();
      // Find or create grade in catalog
      let grade = await Grade.findOne({ where: { name: gradeName }, transaction: t });
      if (!grade) {
        grade = await Grade.create({ name: gradeName, isDiversified: false }, { transaction: t });
      }

      // Check if grade is already linked to this period
      let periodGrade = await PeriodGrade.findOne({
        where: { schoolPeriodId, gradeId: grade.id },
        transaction: t,
      });

      const gradeCreated = !periodGrade;
      if (!periodGrade) {
        periodGrade = await PeriodGrade.create({
          schoolPeriodId,
          gradeId: grade.id,
          specializationId: null,
        }, { transaction: t });
      }

      // Link subjects to this grade
      let subjectsLinked = 0;
      let subjectsSkipped = 0;
      let order = 1;
      for (const subjData of gradeData.subjects) {
        // Find subject by name in catalog (normalized to uppercase)
        const subjectName = subjData.name.toUpperCase().trim();
        const subject = await Subject.findOne({ where: { name: subjectName }, transaction: t });
        if (!subject) {
          subjectsSkipped++;
          continue;
        }

        // Check if already linked
        const existing = await PeriodGradeSubject.findOne({
          where: { periodGradeId: periodGrade.id, subjectId: subject.id },
          transaction: t,
        });
        if (existing) {
          subjectsSkipped++;
          continue;
        }

        await PeriodGradeSubject.create({
          periodGradeId: periodGrade.id,
          subjectId: subject.id,
          order,
        }, { transaction: t });
        subjectsLinked++;
        order++;
      }

      // Link all sections from catalog to this grade
      let sectionsLinked = 0;
      for (const section of allSections) {
        const existingSection = await PeriodGradeSection.findOne({
          where: { periodGradeId: periodGrade.id, sectionId: section.id },
          transaction: t,
        });
        if (!existingSection) {
          await PeriodGradeSection.create({
            periodGradeId: periodGrade.id,
            sectionId: section.id,
          }, { transaction: t });
          sectionsLinked++;
        }
      }

      results.push({
        grade: gradeData.name,
        created: gradeCreated,
        subjectsLinked,
        subjectsSkipped,
        sectionsLinked,
      });
    }

    await t.commit();
    return res.json({
      message: 'Preset de estructura aplicado',
      results,
    });
  } catch (error: any) {
    await t.rollback();
    console.error('[applyStructurePreset] Error:', error);
    return res.status(500).json({ message: error.message || 'Error al aplicar preset de estructura' });
  }
};
