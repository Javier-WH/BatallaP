import { Request, Response } from 'express';
import sequelize from '@/config/database';

export const getHealth = async (req: Request, res: Response) => {
  try {
    // Try to authenticate with the database
    await sequelize.authenticate();
    
    res.status(200).json({
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    res.status(503).json({
      status: 'error',
      database: 'disconnected',
      error: err.code || 'ECONNREFUSED',
      message: 'No se pudo conectar a la base de datos',
      timestamp: new Date().toISOString()
    });
  }
};
