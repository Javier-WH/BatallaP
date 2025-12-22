import { Request, Response } from 'express';
import {
  searchPlanteles,
  findPlantelByCode
} from '@/services/plantelCatalog';

export const listPlanteles = (req: Request, res: Response) => {
  try {
    const { q, state, municipality, limit } = req.query;
    const parsedLimit = typeof limit === 'string' ? Number(limit) : undefined;
    const result = searchPlanteles({
      q: typeof q === 'string' ? q : undefined,
      state: typeof state === 'string' ? state : undefined,
      municipality: typeof municipality === 'string' ? municipality : undefined,
      limit: parsedLimit
    });
    res.json(result);
  } catch (error) {
    console.error('Error listing planteles:', error);
    res.status(500).json({ error: 'Error obteniendo planteles' });
  }
};

export const getPlantel = (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    if (!code) {
      return res.status(400).json({ error: 'Debe indicar el código o nombre del plantel' });
    }
    const plantel = findPlantelByCode(code);
    if (!plantel) {
      return res.status(404).json({ error: 'Plantel no encontrado' });
    }
    res.json(plantel);
  } catch (error) {
    console.error('Error retrieving plantel:', error);
    res.status(500).json({ error: 'Error obteniendo el plantel' });
  }
};
