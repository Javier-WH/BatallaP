import { Request, Response } from 'express';
import { Setting } from '@/models';
import { generateDiarios } from '@/services/diarioService';
import { generateDiariosHtml } from '@/services/diarioHtmlService';

// GET /api/diarios/export?schoolPeriodId=X&sectionIds=1,2,3
export const exportDiarios = async (req: Request, res: Response) => {
  try {
    const schoolPeriodId = Number(req.query.schoolPeriodId);
    const sectionIdsRaw = req.query.sectionIds as string | undefined;

    if (!schoolPeriodId) {
      return res.status(400).json({ message: 'schoolPeriodId es requerido' });
    }
    if (!sectionIdsRaw) {
      return res.status(400).json({ message: 'sectionIds es requerido (lista separada por comas)' });
    }

    const sectionIds = sectionIdsRaw
      .split(',')
      .map(s => Number(s.trim()))
      .filter(n => n > 0);

    if (sectionIds.length === 0) {
      return res.status(400).json({ message: 'Debe seleccionar al menos una sección' });
    }

    // Load all settings (key-value pairs)
    const settingsRows = await Setting.findAll();
    const settings: Record<string, string> = {};
    for (const s of settingsRows) {
      settings[s.key] = s.value;
    }

    const buffer = await generateDiarios(schoolPeriodId, sectionIds, settings);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="diarios-de-clases.xlsx"');
    res.send(buffer);
  } catch (error: any) {
    console.error('[exportDiarios] Error:', error);
    res.status(500).json({ message: error.message || 'Error al generar los diarios' });
  }
};

// GET /api/diarios/html?schoolPeriodId=X&sectionIds=1,2,3
export const exportDiariosHtml = async (req: Request, res: Response) => {
  try {
    const schoolPeriodId = Number(req.query.schoolPeriodId);
    const sectionIdsRaw = req.query.sectionIds as string | undefined;

    if (!schoolPeriodId) {
      return res.status(400).json({ message: 'schoolPeriodId es requerido' });
    }
    if (!sectionIdsRaw) {
      return res.status(400).json({ message: 'sectionIds es requerido (lista separada por comas)' });
    }

    const sectionIds = sectionIdsRaw
      .split(',')
      .map(s => Number(s.trim()))
      .filter(n => n > 0);

    if (sectionIds.length === 0) {
      return res.status(400).json({ message: 'Debe seleccionar al menos una sección' });
    }

    // Load all settings (key-value pairs)
    const settingsRows = await Setting.findAll();
    const settings: Record<string, string> = {};
    for (const s of settingsRows) {
      settings[s.key] = s.value;
    }

    const html = await generateDiariosHtml(schoolPeriodId, sectionIds, settings);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error: any) {
    console.error('[exportDiariosHtml] Error:', error);
    res.status(500).json({ message: error.message || 'Error al generar los diarios' });
  }
};
