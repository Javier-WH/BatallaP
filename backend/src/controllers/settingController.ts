import { Request, Response } from 'express';
import { Setting } from '../models';

export const getSettings = async (req: Request, res: Response) => {
  try {
    const settings = await Setting.findAll();
    const settingsMap = settings.reduce((acc: any, curr: any) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {});
    res.json(settingsMap);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener configuraciones' });
  }
};

export const updateSettings = async (req: Request, res: Response) => {
  try {
    const { settings } = req.body; // Expecting an object { key: value, ... }

    for (const [key, value] of Object.entries(settings)) {
      const [setting, created] = await Setting.findOrCreate({
        where: { key },
        defaults: { key, value: String(value) }
      });

      if (!created) {
        await setting.update({ value: String(value) });
      }
    }

    res.json({ message: 'Configuraciones actualizadas' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al actualizar configuraciones' });
  }
};

export const getSettingByKey = async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const setting = await Setting.findByPk(key);
    if (!setting) return res.status(404).json({ message: 'Configuración no encontrada' });
    res.json(setting);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener configuración' });
  }
};
