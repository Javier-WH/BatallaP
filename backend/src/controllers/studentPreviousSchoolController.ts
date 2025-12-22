import { Request, Response } from 'express';
import sequelize from '@/config/database';
import { Person, StudentPreviousSchool } from '@/models/index';

type PreviousSchoolPayload = {
  plantelCode?: string | null;
  plantelName?: string;
  state?: string | null;
  municipality?: string | null;
  parish?: string | null;
  dependency?: string | null;
  gradeFrom?: string | null;
  gradeTo?: string | null;
  notes?: string | null;
};

const serialize = (record: StudentPreviousSchool) => ({
  id: record.id,
  personId: record.personId,
  plantelCode: record.plantelCode,
  plantelName: record.plantelName,
  state: record.state,
  municipality: record.municipality,
  parish: record.parish,
  dependency: record.dependency,
  gradeFrom: record.gradeFrom,
  gradeTo: record.gradeTo,
  notes: record.notes,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt
});

export const listStudentPreviousSchools = async (req: Request, res: Response) => {
  try {
    const { personId } = req.query;
    const where = personId ? { personId: Number(personId) } : undefined;

    const records = await StudentPreviousSchool.findAll({
      where,
      order: [['createdAt', 'DESC']]
    });

    res.json(records.map(serialize));
  } catch (error) {
    console.error('Error listing previous schools:', error);
    res.status(500).json({ error: 'Error al listar planteles previos' });
  }
};

export const getStudentPreviousSchool = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const record = await StudentPreviousSchool.findByPk(id);

    if (!record) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }

    res.json(serialize(record));
  } catch (error) {
    console.error('Error fetching previous school:', error);
    res.status(500).json({ error: 'Error obteniendo plantel previo' });
  }
};

const ensurePersonExists = async (personId?: number) => {
  if (!personId) return null;
  return Person.findByPk(personId);
};

const isValidPayload = (item: PreviousSchoolPayload) =>
  Boolean(item.plantelName && item.plantelName.trim().length > 0);

export const createStudentPreviousSchool = async (req: Request, res: Response) => {
  try {
    const { personId, plantelName } = req.body;

    if (!personId || !plantelName) {
      return res.status(400).json({ error: 'personId y plantelName son obligatorios' });
    }

    const person = await ensurePersonExists(personId);
    if (!person) {
      return res.status(404).json({ error: 'Estudiante no encontrado' });
    }

    const record = await StudentPreviousSchool.create({
      personId,
      plantelCode: req.body.plantelCode ?? null,
      plantelName: plantelName.trim(),
      state: req.body.state ?? null,
      municipality: req.body.municipality ?? null,
      parish: req.body.parish ?? null,
      dependency: req.body.dependency ?? null,
      gradeFrom: req.body.gradeFrom ?? null,
      gradeTo: req.body.gradeTo ?? null,
      notes: req.body.notes ?? null
    });

    res.status(201).json(serialize(record));
  } catch (error) {
    console.error('Error creating previous school:', error);
    res.status(500).json({ error: 'Error creando plantel previo' });
  }
};

export const updateStudentPreviousSchool = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      plantelCode,
      plantelName,
      state,
      municipality,
      parish,
      dependency,
      gradeFrom,
      gradeTo,
      notes
    } = req.body;

    if (!plantelName || !plantelName.trim()) {
      return res.status(400).json({ error: 'El nombre del plantel es requerido' });
    }

    const record = await StudentPreviousSchool.findByPk(id);
    if (!record) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }

    await record.update({
      plantelCode: plantelCode || null,
      plantelName: plantelName.trim(),
      state: state || null,
      municipality: municipality || null,
      parish: parish || null,
      dependency: dependency || null,
      gradeFrom: gradeFrom || null,
      gradeTo: gradeTo || null,
      notes: notes || null
    });

    res.json(serialize(record));
  } catch (error) {
    console.error('Error actualizando plantel previo:', error);
    res.status(500).json({ error: 'Error actualizando plantel previo' });
  }
};

export const deleteStudentPreviousSchool = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const record = await StudentPreviousSchool.findByPk(id);
    if (!record) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }

    await record.destroy();
    res.json({ message: 'Plantel previo eliminado correctamente' });
  } catch (error) {
    console.error('Error eliminando plantel previo:', error);
    res.status(500).json({ error: 'Error eliminando plantel previo' });
  }
};

export const replaceStudentPreviousSchools = async (req: Request, res: Response) => {
  const t = await sequelize.transaction();
  try {
    const { personId } = req.params;
    if (!personId) {
      await t.rollback();
      return res.status(400).json({ error: 'Debe indicar el estudiante' });
    }

    const person = await Person.findByPk(personId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!person) {
      await t.rollback();
      return res.status(404).json({ error: 'Estudiante no encontrado' });
    }

    const payload = Array.isArray(req.body) ? (req.body as PreviousSchoolPayload[]) : [];
    const sanitized = payload.filter(isValidPayload).map((item) => ({
      personId: Number(personId),
      plantelCode: item.plantelCode ?? null,
      plantelName: item.plantelName?.trim() ?? '',
      state: item.state ?? null,
      municipality: item.municipality ?? null,
      parish: item.parish ?? null,
      dependency: item.dependency ?? null,
      gradeFrom: item.gradeFrom ?? null,
      gradeTo: item.gradeTo ?? null,
      notes: item.notes ?? null
    }));

    await StudentPreviousSchool.destroy({ where: { personId }, transaction: t });
    if (sanitized.length > 0) {
      await StudentPreviousSchool.bulkCreate(sanitized, { transaction: t });
    }

    await t.commit();
    const updated = await StudentPreviousSchool.findAll({
      where: { personId },
      order: [['createdAt', 'ASC']]
    });

    res.json(updated.map(serialize));
  } catch (error) {
    if (t) await t.rollback();
    console.error('Error actualizando planteles previos:', error);
    res.status(500).json({ error: 'Error actualizando planteles previos' });
  }
};
