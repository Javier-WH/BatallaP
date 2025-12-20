import { Request, Response } from 'express';
import { Setting } from '../models';
import { Op } from 'sequelize';

export const getSetting = async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const setting = await Setting.findOne({ where: { key } });
    
    if (!setting) {
      // Return a default value for max_grade if not found
      if (key === 'max_grade') {
        return res.json({ key: 'max_grade', value: '20' });
      }
      return res.status(404).json({ message: 'Configuración no encontrada' });
    }
    
    res.json(setting);
  } catch (error) {
    console.error('Error al obtener configuración:', error);
    res.status(500).json({ message: 'Error al obtener configuración' });
  }
};

export const updateSetting = async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    
    const [setting] = await Setting.upsert({
      key,
      value: value.toString()
    }, {
      returning: true
    });
    
    res.json(setting);
  } catch (error) {
    console.error('Error al actualizar configuración:', error);
    res.status(500).json({ message: 'Error al actualizar configuración' });
  }
};

export const getSettings = async (req: Request, res: Response) => {
  try {
    const { keys } = req.query;
    
    if (!keys) {
      return res.status(400).json({ message: 'Se requieren claves de configuración' });
    }
    
    const keysArray = (Array.isArray(keys) ? keys : [keys]) as string[];
    
    const settings = await Setting.findAll({
      where: {
        key: {
          [Op.in]: keysArray
        }
      }
    });
    
    // Add default values for any missing keys
    const result = keysArray.map(key => {
      const setting = settings.find(s => s.key === key);
      if (!setting) {
        // Return default for max_grade if not found
        if (key === 'max_grade') {
          return { key: 'max_grade', value: '20' };
        }
        return { key, value: '' };
      }
      return setting;
    });
    
    res.json(result);
  } catch (error) {
    console.error('Error al obtener configuraciones:', error);
    res.status(500).json({ message: 'Error al obtener configuraciones' });
  }
};
