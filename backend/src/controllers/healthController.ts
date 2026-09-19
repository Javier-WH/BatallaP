import { Request, Response } from 'express';
import sequelize from '@/config/database';
import path from 'path';
import fs from 'fs';

// App version — read once at startup.
// dev:  src/controllers/../../package.json  -> backend/package.json
// prod: dist/controllers/../../package.json -> build/package.json (auto-bumped by build-production.js)
const APP_VERSION = (() => {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf-8'));
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
})();

export const getHealth = async (req: Request, res: Response) => {
  try {
    // Try to authenticate with the database
    await sequelize.authenticate();
    
    res.status(200).json({
      status: 'ok',
      database: 'connected',
      version: APP_VERSION,
      timestamp: new Date().toISOString()
    });
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    res.status(503).json({
      status: 'error',
      database: 'disconnected',
      version: APP_VERSION,
      error: err.code || 'ECONNREFUSED',
      message: 'No se pudo conectar a la base de datos',
      timestamp: new Date().toISOString()
    });
  }
};
