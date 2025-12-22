import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

let cachedVenezuelaData: any[] | null = null;

const loadVenezuelaData = () => {
  if (cachedVenezuelaData) return cachedVenezuelaData;

  const filePath = path.resolve(process.cwd(), 'src/assets/venezuela.json');
  const raw = fs.readFileSync(filePath, 'utf-8');
  cachedVenezuelaData = JSON.parse(raw);
  return cachedVenezuelaData;
};

export const getVenezuelaLocations = (_req: Request, res: Response) => {
  try {
    const data = loadVenezuelaData();
    res.json(data);
  } catch (error) {
    console.error('Error cargando datos de Venezuela:', error);
    res.status(500).json({ message: 'No se pudieron cargar los datos de ubicación' });
  }
};
