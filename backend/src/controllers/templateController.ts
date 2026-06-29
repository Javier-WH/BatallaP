import { Request, Response } from 'express';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { Op } from 'sequelize';
import { Setting } from '@/models/index';

const templatesDir = path.join(__dirname, '../../templates');

function templateAssignmentKey(gradeId: number | string, sectionId?: number | string | null): string {
  // Section is optional; when present the assignment is scoped to that
  // specific (grade, section) combination so different sections of the same
  // grade can use different templates.
  if (sectionId != null && sectionId !== '') {
    return `template_assignment:grade:${gradeId}:section:${sectionId}`;
  }
  return `template_assignment:grade:${gradeId}`;
}

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

// Returns the template assigned to a given grade (or grade+section), or null
// if none. Pass `?sectionId=...` to scope the lookup to a specific section.
export const getTemplateForGrade = async (req: Request, res: Response) => {
  try {
    const { gradeId } = req.params;
    const sectionId = (req.query.sectionId as string | undefined) || null;
    if (!gradeId) {
      return res.status(400).json({ message: 'gradeId es requerido' });
    }
    const setting = await Setting.findOne({ where: { key: templateAssignmentKey(gradeId, sectionId) } });
    if (!setting) {
      return res.json({ gradeId: Number(gradeId), sectionId: sectionId ? Number(sectionId) : null, templateName: null });
    }
    const targetPath = safeTemplatePath(setting.value);
    if (!targetPath || !fs.existsSync(targetPath)) {
      return res.json({ gradeId: Number(gradeId), sectionId: sectionId ? Number(sectionId) : null, templateName: null });
    }
    res.json({ gradeId: Number(gradeId), sectionId: sectionId ? Number(sectionId) : null, templateName: setting.value });
  } catch (error) {
    console.error('[getTemplateForGrade] Error:', error);
    res.status(500).json({ message: 'Error al obtener la plantilla del grado' });
  }
};

// Returns all template assignments keyed by `${gradeId}` or `${gradeId}:${sectionId}`.
export const listTemplateAssignments = async (_req: Request, res: Response) => {
  try {
    const settings = await Setting.findAll({
      where: { key: { [Op.like]: 'template_assignment:%' } },
    });
    const assignments: Record<string, string> = {};
    for (const s of settings) {
      const key = s.key.replace('template_assignment:', '');
      const targetPath = safeTemplatePath(s.value);
      if (targetPath && fs.existsSync(targetPath)) {
        assignments[key] = s.value;
      }
    }
    res.json(assignments);
  } catch (error) {
    console.error('[listTemplateAssignments] Error:', error);
    res.status(500).json({ message: 'Error al listar las asignaciones de plantillas' });
  }
};

// Assigns a template to a grade (or grade+section). Body:
// { gradeId, templateName, sectionId? }.
export const assignTemplateToGrade = async (req: Request, res: Response) => {
  try {
    const { gradeId, sectionId, templateName } = req.body;
    if (!gradeId || !templateName) {
      return res.status(400).json({ message: 'gradeId y templateName son requeridos' });
    }
    const targetPath = safeTemplatePath(templateName);
    if (!targetPath || !fs.existsSync(targetPath)) {
      return res.status(404).json({ message: 'La plantilla no existe' });
    }
    await Setting.upsert({
      key: templateAssignmentKey(gradeId, sectionId || null),
      value: templateName,
    });
    res.json({ gradeId: Number(gradeId), sectionId: sectionId ? Number(sectionId) : null, templateName });
  } catch (error) {
    console.error('[assignTemplateToGrade] Error:', error);
    res.status(500).json({ message: 'Error al asignar la plantilla' });
  }
};

// Removes a template assignment for a grade (or grade+section). The
// sectionId is taken from the query string (?sectionId=...).
export const unassignTemplateFromGrade = async (req: Request, res: Response) => {
  try {
    const { gradeId } = req.params;
    const sectionId = (req.query.sectionId as string | undefined) || null;
    if (!gradeId) {
      return res.status(400).json({ message: 'gradeId es requerido' });
    }
    await Setting.destroy({ where: { key: templateAssignmentKey(gradeId, sectionId) } });
    res.json({ gradeId: Number(gradeId), sectionId: sectionId ? Number(sectionId) : null, templateName: null });
  } catch (error) {
    console.error('[unassignTemplateFromGrade] Error:', error);
    res.status(500).json({ message: 'Error al desasignar la plantilla' });
  }
};