import { Request, Response } from 'express';
import { Plantel } from '@/models/index';
import { Op } from 'sequelize';
import sequelize from '@/config/database';

// Function to normalize text for search (remove accents, lowercase, remove special chars and spaces)
const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics (accents)
    .replace(/[^a-z0-9]/g, '') // Remove special characters and spaces
    .trim();
};

export const listPlanteles = async (req: Request, res: Response) => {
  try {
    const { q, state, municipality, limit } = req.query;
    const parsedLimit = typeof limit === 'string' ? Number(limit) : undefined;

    const whereClause: any = {};
    if (q && typeof q === 'string') {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${q}%` } },
        { code: { [Op.like]: `%${q}%` } }
      ];
    }
    if (state && typeof state === 'string') {
      whereClause.state = { [Op.like]: `%${state}%` };
    }
    if (municipality && typeof municipality === 'string') {
      whereClause.municipality = { [Op.like]: `%${municipality}%` };
    }

    const planteles = await Plantel.findAll({
      where: whereClause,
      limit: parsedLimit,
      order: [['name', 'ASC']]
    });

    res.json(planteles);
  } catch (error) {
    console.error('Error listing planteles:', error);
    res.status(500).json({ error: 'Error obteniendo planteles' });
  }
};

export const getPlantel = async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    if (!code) {
      return res.status(400).json({ error: 'Debe indicar el código o nombre del plantel' });
    }

    const plantel = await Plantel.findOne({
      where: {
        [Op.or]: [
          { code: code },
          { name: code }
        ]
      }
    });

    if (!plantel) {
      return res.status(404).json({ error: 'Plantel no encontrado' });
    }

    res.json(plantel);
  } catch (error) {
    console.error('Error retrieving plantel:', error);
    res.status(500).json({ error: 'Error obteniendo el plantel' });
  }
};

export const searchPlanteles = async (req: Request, res: Response) => {
  try {
    const { q, limit = 10 } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Se requiere parámetro de búsqueda "q"' });
    }

    const normalizedQuery = normalizeText(q);
    const searchConditions = [];

    // Primary search: case-insensitive matches
    searchConditions.push(
      sequelize.literal(`LOWER(name) LIKE LOWER('%${q}%')`)
    );
    searchConditions.push(
      sequelize.literal(`LOWER(code) LIKE LOWER('%${q}%')`)
    );
    searchConditions.push(
      sequelize.literal(`LOWER(state) LIKE LOWER('%${q}%')`)
    );

    // If we have a normalized query different from the original, add normalized search
    if (normalizedQuery && normalizedQuery !== q.toLowerCase()) {
      searchConditions.push(
        sequelize.literal(`REPLACE(REPLACE(REPLACE(REPLACE(LOWER(name), 'á', 'a'), 'é', 'e'), 'í', 'i'), 'ó', 'o') LIKE '%${normalizedQuery}%'`)
      );
      searchConditions.push(
        sequelize.literal(`REPLACE(REPLACE(REPLACE(REPLACE(LOWER(code), 'á', 'a'), 'é', 'e'), 'í', 'i'), 'ó', 'o') LIKE '%${normalizedQuery}%'`)
      );
      searchConditions.push(
        sequelize.literal(`REPLACE(REPLACE(REPLACE(REPLACE(LOWER(state), 'á', 'a'), 'é', 'e'), 'í', 'i'), 'ó', 'o') LIKE '%${normalizedQuery}%'`)
      );
    }

    const planteles = await Plantel.findAll({
      where: {
        [Op.or]: searchConditions
      },
      limit: Number(limit),
      order: [['name', 'ASC']]
    });

    res.json(planteles);
  } catch (error) {
    console.error('Error searching planteles:', error);
    res.status(500).json({ error: 'Error buscando planteles' });
  }
};

export const createPlantel = async (req: Request, res: Response) => {
  try {
    const { code, name, state, dependency, municipality, parish } = req.body;

    const plantel = await Plantel.create({
      code,
      name,
      state,
      dependency,
      municipality,
      parish
    });

    res.status(201).json(plantel);
  } catch (error) {
    console.error('Error creating plantel:', error);
    res.status(500).json({ error: 'Error creando plantel' });
  }
};

export const updatePlantel = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { code, name, state, dependency, municipality, parish } = req.body;

    const plantel = await Plantel.findByPk(id);
    if (!plantel) {
      return res.status(404).json({ error: 'Plantel no encontrado' });
    }

    await plantel.update({
      code,
      name,
      state,
      dependency,
      municipality,
      parish
    });

    res.json(plantel);
  } catch (error) {
    console.error('Error updating plantel:', error);
    res.status(500).json({ error: 'Error actualizando plantel' });
  }
};

export const deletePlantel = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const plantel = await Plantel.findByPk(id);
    if (!plantel) {
      return res.status(404).json({ error: 'Plantel no encontrado' });
    }

    await plantel.destroy();
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting plantel:', error);
    res.status(500).json({ error: 'Error eliminando plantel' });
  }
};
