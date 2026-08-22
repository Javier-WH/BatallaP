import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { Term, SchoolPeriod } from '@/models/index';

export const getTerms = async (req: Request, res: Response) => {
  try {
    const { schoolPeriodId } = req.query;

    let whereClause: any = {};
    if (schoolPeriodId) {
      whereClause.schoolPeriodId = Number(schoolPeriodId);
    }

    const terms = await Term.findAll({
      where: whereClause,
      include: [
        {
          model: SchoolPeriod,
          as: 'schoolPeriod',
          attributes: ['id', 'name', 'period']
        }
      ],
      order: [['order', 'ASC']]
    });

    res.json(terms);
  } catch (error) {
    console.error('Error fetching terms:', error);
    res.status(500).json({ message: 'Error al obtener los lapsos' });
  }
};

export const getTerm = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const term = await Term.findByPk(id, {
      include: [
        {
          model: SchoolPeriod,
          as: 'schoolPeriod',
          attributes: ['id', 'name', 'period']
        }
      ]
    });

    if (!term) {
      return res.status(404).json({ message: 'Lapso no encontrado' });
    }

    res.json(term);
  } catch (error) {
    console.error('Error fetching term:', error);
    res.status(500).json({ message: 'Error al obtener el lapso' });
  }
};

export const createTerm = async (req: Request, res: Response) => {
  try {
    const { name, isBlocked, isActive, openDate, closeDate, schoolPeriodId } = req.body;

    if (!name || !schoolPeriodId) {
      return res.status(400).json({ message: 'Nombre y periodo escolar son requeridos' });
    }

    // Get the highest order for this school period
    const maxOrderResult = await Term.max('order', {
      where: { schoolPeriodId }
    });
    const maxOrder = typeof maxOrderResult === 'number' ? maxOrderResult : 0;
    const newOrder = maxOrder + 1;

    const transaction = await Term.sequelize?.transaction();
    try {
      // If creating an active term, deactivate the others in the same school period
      if (isActive) {
        await Term.update(
          { isActive: false },
          { where: { schoolPeriodId, isActive: true }, transaction }
        );
      }

      const term = await Term.create({
        name,
        isBlocked: isBlocked || false,
        isActive: isActive || false,
        openDate: openDate ? new Date(openDate) : undefined,
        closeDate: closeDate ? new Date(closeDate) : undefined,
        schoolPeriodId,
        order: newOrder
      }, { transaction });

      await transaction?.commit();
      res.status(201).json(term);
    } catch (error) {
      await transaction?.rollback();
      throw error;
    }
  } catch (error) {
    console.error('Error creating term:', error);
    res.status(500).json({ message: 'Error al crear el lapso' });
  }
};

export const updateTerm = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, isBlocked, isActive, openDate, closeDate, order } = req.body;

    const term = await Term.findByPk(id);
    if (!term) {
      return res.status(404).json({ message: 'Lapso no encontrado' });
    }

    const transaction = await Term.sequelize?.transaction();
    try {
      // If activating this term, deactivate the others in the same school period
      if (isActive === true && !term.isActive) {
        await Term.update(
          { isActive: false },
          { where: { schoolPeriodId: term.schoolPeriodId, isActive: true, id: { [Op.ne]: term.id } }, transaction }
        );
      }

      await term.update({
        name: name || term.name,
        isBlocked: isBlocked !== undefined ? isBlocked : term.isBlocked,
        isActive: isActive !== undefined ? isActive : term.isActive,
        openDate: openDate ? new Date(openDate) : term.openDate,
        closeDate: closeDate ? new Date(closeDate) : term.closeDate,
        order: order || term.order
      }, { transaction });

      await transaction?.commit();
      res.json(term);
    } catch (error) {
      await transaction?.rollback();
      throw error;
    }
  } catch (error) {
    console.error('Error updating term:', error);
    res.status(500).json({ message: 'Error al actualizar el lapso' });
  }
};

export const deleteTerm = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const term = await Term.findByPk(id);

    if (!term) {
      return res.status(404).json({ message: 'Lapso no encontrado' });
    }

    // Check if term has associated data (evaluations, qualifications, etc.)
    // This is a simplified check - in a real app you'd check for dependencies
    await term.destroy();

    res.json({ message: 'Lapso eliminado correctamente' });
  } catch (error) {
    console.error('Error deleting term:', error);
    res.status(500).json({ message: 'Error al eliminar el lapso' });
  }
};

export const reorderTerms = async (req: Request, res: Response) => {
  try {
    const { schoolPeriodId, termOrders } = req.body;

    if (!schoolPeriodId || !Array.isArray(termOrders)) {
      return res.status(400).json({ message: 'Datos inválidos' });
    }

    // Update orders in transaction
    const transaction = await Term.sequelize?.transaction();

    try {
      for (let i = 0; i < termOrders.length; i++) {
        const { id, order } = termOrders[i];
        await Term.update(
          { order },
          { where: { id, schoolPeriodId }, transaction }
        );
      }

      await transaction?.commit();
      res.json({ message: 'Orden de lapsos actualizado correctamente' });
    } catch (error) {
      await transaction?.rollback();
      throw error;
    }
  } catch (error) {
    console.error('Error reordering terms:', error);
    res.status(500).json({ message: 'Error al reordenar los lapsos' });
  }
};
