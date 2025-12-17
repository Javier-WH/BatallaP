import { Request, Response } from 'express';
import { Inscription, Person, Role, Subject, PeriodGrade, InscriptionSubject, SchoolPeriod, Grade, Section } from '../models';
import sequelize from '../config/database';

export const getInscriptions = async (req: Request, res: Response) => {
  try {
    const { schoolPeriodId, gradeId, sectionId } = req.query;
    const where: any = {};
    if (schoolPeriodId) where.schoolPeriodId = schoolPeriodId;
    if (gradeId) where.gradeId = gradeId;
    if (sectionId) where.sectionId = sectionId;

    const inscriptions = await Inscription.findAll({
      where,
      include: [
        { model: Person, as: 'student' },
        { model: SchoolPeriod, as: 'period' },
        { model: Grade, as: 'grade' },
        { model: Section, as: 'section' },
        { model: Subject, as: 'subjects', through: { attributes: [] } }
      ],
      order: [['createdAt', 'DESC']]
    });
    res.json(inscriptions);
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo inscripciones', details: error });
  }
};

export const getInscriptionById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const inscription = await Inscription.findByPk(id, {
      include: [
        { model: Person, as: 'student' },
        { model: SchoolPeriod, as: 'period' },
        { model: Grade, as: 'grade' },
        { model: Section, as: 'section' },
        { model: Subject, as: 'subjects', through: { attributes: [] } }
      ]
    });
    if (!inscription) return res.status(404).json({ error: 'Inscripción no encontrada' });
    res.json(inscription);
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo inscripción', details: error });
  }
};

export const createInscription = async (req: Request, res: Response) => {
  const t = await sequelize.transaction();
  try {
    const { schoolPeriodId, gradeId, personId, sectionId } = req.body;

    // 1. Verify Role Student
    const person = await Person.findByPk(personId, {
      include: [{ model: Role, as: 'roles' }]
    });

    if (!person) {
      await t.rollback();
      return res.status(404).json({ error: 'Persona no encontrada' });
    }

    // Check if user has 'student' role (case insensitive)
    const isStudent = person.roles?.some((r: any) =>
      r.name.toLowerCase() === 'student' ||
      r.name.toLowerCase() === 'estudiante' ||
      r.name.toLowerCase() === 'alumno'
    );

    if (!isStudent) {
      await t.rollback();
      return res.status(400).json({ error: 'La persona seleccionada no tiene el rol de estudiante' });
    }

    // 2. Check existence
    const existing = await Inscription.findOne({
      where: { schoolPeriodId, gradeId, personId },
      transaction: t
    });

    if (existing) {
      await t.rollback();
      return res.status(400).json({ error: 'El estudiante ya está inscrito en este grado y periodo' });
    }

    // 3. Create Inscription
    const inscription = await Inscription.create({
      schoolPeriodId,
      gradeId,
      sectionId: sectionId || null,
      personId
    }, { transaction: t });

    // 4. Auto-assign subjects from PeriodGrade structure
    const periodGrade = await PeriodGrade.findOne({
      where: { schoolPeriodId, gradeId },
      include: [{ model: Subject, as: 'subjects' }],
      transaction: t
    });

    if (periodGrade && periodGrade.subjects && periodGrade.subjects.length > 0) {
      const subjectsToAdd = periodGrade.subjects.map((s: any) => ({
        inscriptionId: inscription.id,
        subjectId: s.id
      }));

      await InscriptionSubject.bulkCreate(subjectsToAdd, { transaction: t });
    }

    await t.commit();

    // Refetch to return full data
    const result = await Inscription.findByPk(inscription.id, {
      include: [{ model: Subject, as: 'subjects' }]
    });

    res.status(201).json(result);
  } catch (error: any) {
    await t.rollback();
    res.status(500).json({ error: 'Error al inscribir', details: error.message || error });
  }
};

export const updateInscription = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { sectionId } = req.body;

    const inscription = await Inscription.findByPk(id);
    if (!inscription) return res.status(404).json({ error: 'Inscripción no encontrada' });

    // Usually we only update sectionId here. Changing period/grade/student is tricky and implies a new inscription logically.
    if (sectionId !== undefined) {
      inscription.sectionId = sectionId;
      await inscription.save();
    }

    res.json(inscription);
  } catch (error) {
    res.status(500).json({ error: 'Error actualizando inscripción', details: error });
  }
};

export const deleteInscription = async (req: Request, res: Response) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const inscription = await Inscription.findByPk(id);
    if (!inscription) {
      await t.rollback();
      return res.status(404).json({ error: 'Inscripción no encontrada' });
    }

    // Remove subjects first (cascade might handle this, but explicit is safe)
    await InscriptionSubject.destroy({ where: { inscriptionId: id }, transaction: t });
    await inscription.destroy({ transaction: t });

    await t.commit();
    res.json({ message: 'Inscripción eliminada' });
  } catch (error) {
    await t.rollback();
    res.status(500).json({ error: 'Error eliminando inscripción', details: error });
  }
};

// Additional methods for manual subject management
export const addSubjectToInscription = async (req: Request, res: Response) => {
  try {
    const { id } = req.params; // inscription id
    const { subjectId } = req.body;

    const inscription = await Inscription.findByPk(id);
    if (!inscription) return res.status(404).json({ error: 'Inscripción no encontrada' });

    await InscriptionSubject.create({ inscriptionId: Number(id), subjectId });
    res.json({ message: 'Materia agregada a la inscripción' });
  } catch (error: any) {
    res.status(500).json({ error: 'Error agregando materia', details: error.message });
  }
};

export const removeSubjectFromInscription = async (req: Request, res: Response) => {
  try {
    const { id, subjectId } = req.params; // inscription id, subject id

    const deleted = await InscriptionSubject.destroy({
      where: { inscriptionId: id, subjectId }
    });

    if (!deleted) return res.status(404).json({ error: 'Materia no encontrada en esta inscripción' });

    res.json({ message: 'Materia removida de la inscripción' });
  } catch (error: any) {
    res.status(500).json({ error: 'Error removiendo materia', details: error.message });
  }
};
