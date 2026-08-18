import { Request, Response } from 'express';
import { SubjectPreset, Subject } from '@/models/index';

// GET /api/subject-presets
export const listPresets = async (_req: Request, res: Response) => {
  try {
    const presets = await SubjectPreset.findAll({ order: [['isSystem', 'DESC'], ['name', 'ASC']] });
    return res.json(presets);
  } catch (error) {
    console.error('[listPresets] Error:', error);
    return res.status(500).json({ message: 'Error al listar presets' });
  }
};

// GET /api/subject-presets/:id
export const getPreset = async (req: Request, res: Response) => {
  try {
    const preset = await SubjectPreset.findByPk(req.params.id);
    if (!preset) return res.status(404).json({ message: 'Preset no encontrado' });
    return res.json(preset);
  } catch (error) {
    console.error('[getPreset] Error:', error);
    return res.status(500).json({ message: 'Error al obtener preset' });
  }
};

// POST /api/subject-presets
export const createPreset = async (req: Request, res: Response) => {
  try {
    const { name, description, items } = req.body;
    if (!name || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Nombre y items son requeridos' });
    }
    const preset = await SubjectPreset.create({ name, description: description || null, items });
    return res.status(201).json(preset);
  } catch (error: any) {
    console.error('[createPreset] Error:', error);
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'Ya existe un preset con ese nombre' });
    }
    return res.status(500).json({ message: 'Error al crear preset' });
  }
};

// PUT /api/subject-presets/:id
export const updatePreset = async (req: Request, res: Response) => {
  try {
    const preset = await SubjectPreset.findByPk(req.params.id);
    if (!preset) return res.status(404).json({ message: 'Preset no encontrado' });
    if (preset.isSystem) {
      return res.status(403).json({ message: 'Los presets del sistema no se pueden editar' });
    }
    const { name, description, items } = req.body;
    await preset.update({ name, description, items });
    return res.json(preset);
  } catch (error: any) {
    console.error('[updatePreset] Error:', error);
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'Ya existe un preset con ese nombre' });
    }
    return res.status(500).json({ message: 'Error al actualizar preset' });
  }
};

// DELETE /api/subject-presets/:id
export const deletePreset = async (req: Request, res: Response) => {
  try {
    const preset = await SubjectPreset.findByPk(req.params.id);
    if (!preset) return res.status(404).json({ message: 'Preset no encontrado' });
    if (preset.isSystem) {
      return res.status(403).json({ message: 'Los presets del sistema no se pueden eliminar' });
    }
    await preset.destroy();
    return res.json({ message: 'Preset eliminado' });
  } catch (error) {
    console.error('[deletePreset] Error:', error);
    return res.status(500).json({ message: 'Error al eliminar preset' });
  }
};

// POST /api/subject-presets/:id/apply
export const applyPreset = async (req: Request, res: Response) => {
  try {
    const preset = await SubjectPreset.findByPk(req.params.id);
    if (!preset) return res.status(404).json({ message: 'Preset no encontrado' });

    const items = preset.items as { name: string; abbreviation?: string | null }[];
    const created: { name: string; abbreviation: string | null }[] = [];
    const skipped: { name: string; reason: string }[] = [];

    for (const item of items) {
      const trimmedName = item.name.trim();
      if (!trimmedName) continue;

      // Check if subject already exists (case-insensitive, normalized)
      const existing = await Subject.findOne({ where: { name: trimmedName } });
      if (existing) {
        skipped.push({ name: trimmedName, reason: 'Ya existe' });
        continue;
      }

      await Subject.create({
        name: trimmedName,
        abbreviation: item.abbreviation?.trim() || null,
      });
      created.push({ name: trimmedName, abbreviation: item.abbreviation?.trim() || null });
    }

    return res.json({
      message: `Preset aplicado: ${created.length} creadas, ${skipped.length} omitidas`,
      created,
      skipped,
    });
  } catch (error) {
    console.error('[applyPreset] Error:', error);
    return res.status(500).json({ message: 'Error al aplicar preset' });
  }
};
