import { Request, Response } from 'express';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';

const templatesDir = path.join(__dirname, '../../templates');

function ensureTemplatesDir() {
  if (!fs.existsSync(templatesDir)) {
    fs.mkdirSync(templatesDir, { recursive: true });
  }
}

function safeTemplatePath(name: string): string | null {
  if (!name || typeof name !== 'string') return null;
  // Prevent path traversal: only allow filename without directory separators
  const base = path.basename(name);
  if (!base || base.includes('..')) return null;
  const ext = path.extname(base).toLowerCase();
  if (ext !== '.xlsx' && ext !== '.xls') return null;
  return path.join(templatesDir, base);
}

export const listTemplates = async (_req: Request, res: Response) => {
  try {
    ensureTemplatesDir();
    const files = await fsPromises.readdir(templatesDir);
    const templates = files
      .filter(f => f.toLowerCase().endsWith('.xlsx') || f.toLowerCase().endsWith('.xls'))
      .map(f => {
        const fullPath = path.join(templatesDir, f);
        const stat = fs.statSync(fullPath);
        return {
          name: f,
          size: stat.size,
          updatedAt: stat.mtime.toISOString(),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    res.json(templates);
  } catch (error) {
    console.error('[listTemplates] Error:', error);
    res.status(500).json({ message: 'Error al listar las plantillas' });
  }
};

export const uploadTemplate = async (req: Request, res: Response) => {
  try {
    ensureTemplatesDir();
    if (!req.file) {
      return res.status(400).json({ message: 'No se ha enviado ningún archivo' });
    }
    res.json({
      message: 'Plantilla subida exitosamente',
      name: req.file.filename,
      size: req.file.size,
    });
  } catch (error) {
    console.error('[uploadTemplate] Error:', error);
    res.status(500).json({ message: 'Error al subir la plantilla' });
  }
};

export const deleteTemplate = async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const targetPath = safeTemplatePath(name);
    if (!targetPath) {
      return res.status(400).json({ message: 'Nombre de plantilla inválido' });
    }
    if (!fs.existsSync(targetPath)) {
      return res.status(404).json({ message: 'La plantilla no existe' });
    }
    await fsPromises.unlink(targetPath);
    res.json({ message: 'Plantilla eliminada exitosamente' });
  } catch (error) {
    console.error('[deleteTemplate] Error:', error);
    res.status(500).json({ message: 'Error al eliminar la plantilla' });
  }
};