import { Request, Response } from 'express';
import { EvaluationCatalog } from '@/models/index';

export const getCatalogs = async (req: Request, res: Response) => {
  try {
    const { type } = req.query;
    const where: any = {};
    if (type && ['tecnica', 'instrumento', 'estrategia'].includes(type as string)) {
      where.type = type;
    }
    const catalogs = await EvaluationCatalog.findAll({ where, order: [['name', 'ASC']] });
    res.json(catalogs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener catálogos' });
  }
};

export const createCatalog = async (req: Request, res: Response) => {
  try {
    const { type, name } = req.body;
    if (!type || !['tecnica', 'instrumento', 'estrategia'].includes(type)) {
      return res.status(400).json({ message: 'Tipo inválido (debe ser "tecnica", "instrumento" o "estrategia")' });
    }
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'El nombre es requerido' });
    }
    const existing = await EvaluationCatalog.findOne({ where: { type, name: name.trim() } });
    if (existing) {
      return res.status(409).json({ message: 'Ya existe un registro con ese nombre' });
    }
    const catalog = await EvaluationCatalog.create({ type, name: name.trim() });
    res.status(201).json(catalog);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al crear catálogo' });
  }
};

export const updateCatalog = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'El nombre es requerido' });
    }
    const catalog = await EvaluationCatalog.findByPk(Number(id));
    if (!catalog) {
      return res.status(404).json({ message: 'Catálogo no encontrado' });
    }
    const existing = await EvaluationCatalog.findOne({
      where: { type: catalog.type, name: name.trim(), id: { $ne: Number(id) } as any }
    });
    if (existing) {
      return res.status(409).json({ message: 'Ya existe un registro con ese nombre' });
    }
    catalog.name = name.trim();
    await catalog.save();
    res.json(catalog);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al actualizar catálogo' });
  }
};

export const deleteCatalog = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const catalog = await EvaluationCatalog.findByPk(Number(id));
    if (!catalog) {
      return res.status(404).json({ message: 'Catálogo no encontrado' });
    }
    await catalog.destroy();
    res.json({ message: 'Catálogo eliminado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al eliminar catálogo' });
  }
};
