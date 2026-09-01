import { Request, Response } from 'express';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { Op } from 'sequelize';
import { Setting } from '@/models/index';

const templatesDir = path.join(__dirname, '../../templates');

function templateAssignmentKey(gradeId: number | string): string {
  // Templates are assigned strictly per grade (year). All sections of the
  // same grade share the same template.
  return `template_assignment:grade:${gradeId}`;
}

// Certified grades templates are assigned per "period" category.
// Two options: "pre2018" (students who started before 2018) and "actual".
function certifiedTemplateKey(periodKey: string): string {
  return `certified_template_assignment:period:${periodKey}`;
}

const CERTIFIED_PERIOD_KEYS = ['pre2018', 'actual'];

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

// Returns the template assigned to a given grade, or null if none.
// Templates are strictly per-grade (all sections share the same template).
export const getTemplateForGrade = async (req: Request, res: Response) => {
  try {
    const { gradeId } = req.params;
    if (!gradeId) {
      return res.status(400).json({ message: 'gradeId es requerido' });
    }
    const setting = await Setting.findOne({ where: { key: templateAssignmentKey(gradeId) } });
    if (!setting) {
      return res.json({ gradeId: Number(gradeId), templateName: null });
    }
    const targetPath = safeTemplatePath(setting.value);
    if (!targetPath || !fs.existsSync(targetPath)) {
      return res.json({ gradeId: Number(gradeId), templateName: null });
    }
    res.json({ gradeId: Number(gradeId), templateName: setting.value });
  } catch (error) {
    console.error('[getTemplateForGrade] Error:', error);
    res.status(500).json({ message: 'Error al obtener la plantilla del grado' });
  }
};

// Returns all template assignments keyed by `${gradeId}`.
export const listTemplateAssignments = async (_req: Request, res: Response) => {
  try {
    const settings = await Setting.findAll({
      where: { key: { [Op.like]: 'template_assignment:grade:%' } },
    });
    const assignments: Record<string, string> = {};
    for (const s of settings) {
      // Skip any legacy per-section keys (they contain ":section:")
      if (s.key.includes(':section:')) continue;
      // Strip the full prefix so the key is just the gradeId (e.g. "5").
      const key = s.key.replace('template_assignment:grade:', '');
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

// Assigns a template to a grade. Body: { gradeId, templateName }.
export const assignTemplateToGrade = async (req: Request, res: Response) => {
  try {
    const { gradeId, templateName } = req.body;
    if (!gradeId || !templateName) {
      return res.status(400).json({ message: 'gradeId y templateName son requeridos' });
    }
    const targetPath = safeTemplatePath(templateName);
    if (!targetPath || !fs.existsSync(targetPath)) {
      return res.status(404).json({ message: 'La plantilla no existe' });
    }
    await Setting.upsert({
      key: templateAssignmentKey(gradeId),
      value: templateName,
    });
    res.json({ gradeId: Number(gradeId), templateName });
  } catch (error) {
    console.error('[assignTemplateToGrade] Error:', error);
    res.status(500).json({ message: 'Error al asignar la plantilla' });
  }
};

// Removes a template assignment for a grade.
export const unassignTemplateFromGrade = async (req: Request, res: Response) => {
  try {
    const { gradeId } = req.params;
    if (!gradeId) {
      return res.status(400).json({ message: 'gradeId es requerido' });
    }
    await Setting.destroy({ where: { key: templateAssignmentKey(gradeId) } });
    res.json({ gradeId: Number(gradeId), templateName: null });
  } catch (error) {
    console.error('[unassignTemplateFromGrade] Error:', error);
    res.status(500).json({ message: 'Error al desasignar la plantilla' });
  }
};

// ── Certified grades template assignments (per period category) ────────

// Returns all certified template assignments keyed by period key.
export const listCertifiedTemplateAssignments = async (_req: Request, res: Response) => {
  try {
    const settings = await Setting.findAll({
      where: { key: { [Op.like]: 'certified_template_assignment:period:%' } },
    });
    const assignments: Record<string, string> = {};
    for (const s of settings) {
      const key = s.key.replace('certified_template_assignment:period:', '');
      const targetPath = safeTemplatePath(s.value);
      if (targetPath && fs.existsSync(targetPath)) {
        assignments[key] = s.value;
      }
    }
    res.json(assignments);
  } catch (error) {
    console.error('[listCertifiedTemplateAssignments] Error:', error);
    res.status(500).json({ message: 'Error al listar las asignaciones de plantillas certificadas' });
  }
};

// Assigns a template to a certified period category. Body: { periodKey, templateName }.
export const assignCertifiedTemplate = async (req: Request, res: Response) => {
  try {
    const { periodKey, templateName } = req.body;
    if (!periodKey || !CERTIFIED_PERIOD_KEYS.includes(periodKey)) {
      return res.status(400).json({ message: 'periodKey debe ser "pre2018" o "actual"' });
    }
    if (!templateName) {
      return res.status(400).json({ message: 'templateName es requerido' });
    }
    const targetPath = safeTemplatePath(templateName);
    if (!targetPath || !fs.existsSync(targetPath)) {
      return res.status(404).json({ message: 'La plantilla no existe' });
    }
    await Setting.upsert({
      key: certifiedTemplateKey(periodKey),
      value: templateName,
    });
    res.json({ periodKey, templateName });
  } catch (error) {
    console.error('[assignCertifiedTemplate] Error:', error);
    res.status(500).json({ message: 'Error al asignar la plantilla certificada' });
  }
};

// Removes a certified template assignment for a period category.
export const unassignCertifiedTemplate = async (req: Request, res: Response) => {
  try {
    const { periodKey } = req.params;
    if (!periodKey || !CERTIFIED_PERIOD_KEYS.includes(periodKey)) {
      return res.status(400).json({ message: 'periodKey debe ser "pre2018" o "actual"' });
    }
    await Setting.destroy({ where: { key: certifiedTemplateKey(periodKey) } });
    res.json({ periodKey, templateName: null });
  } catch (error) {
    console.error('[unassignCertifiedTemplate] Error:', error);
    res.status(500).json({ message: 'Error al desasignar la plantilla certificada' });
  }
};
