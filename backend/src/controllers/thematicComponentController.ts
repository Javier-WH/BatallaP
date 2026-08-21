import { Request, Response } from 'express';
import { Op } from 'sequelize';
import sequelize from '@/config/database';
import {
  ThematicComponent,
  ThematicContent,
  ExpectedLearning,
  ExpectedLearningContent,
} from '@/models/index';

// ── Thematic Components ──────────────────────────────────────────

export const getThematicComponents = async (req: Request, res: Response) => {
  try {
    const { pgsId, termId } = req.query;
    if (!pgsId || !termId) {
      return res.status(400).json({ message: 'pgsId, termId son requeridos' });
    }

    const components = await ThematicComponent.findAll({
      where: {
        periodGradeSubjectId: Number(pgsId),
        termId: Number(termId),
      },
      include: [
        {
          association: 'contents',
          include: [{ association: 'learnings' }],
        },
      ],
      order: [['order', 'ASC'], ['id', 'ASC']],
    });

    return res.json(components);
  } catch (error: any) {
    console.error('[getThematicComponents] Error:', error);
    return res.status(500).json({ message: error.message || 'Error al obtener componentes' });
  }
};

export const createThematicComponent = async (req: Request, res: Response) => {
  try {
    const { periodGradeSubjectId, termId, title } = req.body;
    if (!periodGradeSubjectId || !termId || !title) {
      return res.status(400).json({ message: 'Faltan campos requeridos' });
    }

    const maxOrder = await ThematicComponent.max('order', {
      where: { periodGradeSubjectId, termId },
    }) as number || 0;

    const component = await ThematicComponent.create({
      periodGradeSubjectId,
      termId,
      title,
      order: maxOrder + 1,
    });

    return res.status(201).json(component);
  } catch (error: any) {
    console.error('[createThematicComponent] Error:', error);
    return res.status(500).json({ message: error.message || 'Error al crear componente' });
  }
};

export const updateThematicComponent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, order } = req.body;

    const component = await ThematicComponent.findByPk(Number(id));
    if (!component) {
      return res.status(404).json({ message: 'Componente no encontrado' });
    }

    await component.update({
      ...(title !== undefined && { title }),
      ...(order !== undefined && { order }),
    });

    return res.json(component);
  } catch (error: any) {
    console.error('[updateThematicComponent] Error:', error);
    return res.status(500).json({ message: error.message || 'Error al actualizar' });
  }
};

export const deleteThematicComponent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const component = await ThematicComponent.findByPk(Number(id));
    if (!component) {
      return res.status(404).json({ message: 'Componente no encontrado' });
    }

    // Cascade delete: contents and their learning associations
    const contents = await ThematicContent.findAll({ where: { thematicComponentId: Number(id) } });
    const contentIds = contents.map(c => c.id);
    if (contentIds.length > 0) {
      await ExpectedLearningContent.destroy({ where: { contentId: contentIds } });
    }
    await ThematicContent.destroy({ where: { thematicComponentId: Number(id) } });
    await component.destroy();

    return res.json({ message: 'Componente eliminado' });
  } catch (error: any) {
    console.error('[deleteThematicComponent] Error:', error);
    return res.status(500).json({ message: error.message || 'Error al eliminar' });
  }
};

export const reorderThematicComponents = async (req: Request, res: Response) => {
  const { componentIds } = req.body as { componentIds?: number[] };

  if (!Array.isArray(componentIds) || componentIds.length === 0 || componentIds.some((id) => typeof id !== 'number')) {
    return res.status(400).json({ message: 'Debe enviar un arreglo de IDs de componentes en el orden deseado.' });
  }

  const transaction = await sequelize.transaction();
  try {
    const components = await ThematicComponent.findAll({
      where: { id: { [Op.in]: componentIds } },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (components.length !== componentIds.length) {
      throw new Error('Alguno de los componentes no existe.');
    }

    // All components must belong to the same periodGradeSubject+term
    const keys = new Set(components.map((c) => `${c.periodGradeSubjectId}-${c.termId}`));
    if (keys.size !== 1) {
      throw new Error('Los componentes deben pertenecer al mismo lapso y asignación.');
    }

    const sortPosition = new Map(componentIds.map((componentId, index) => [componentId, index + 1]));

    for (const component of components) {
      const nextOrder = sortPosition.get(component.id);
      if (nextOrder !== undefined) {
        component.order = nextOrder;
        await component.save({ transaction });
      }
    }

    await transaction.commit();

    const { periodGradeSubjectId, termId } = components[0];
    const refreshed = await ThematicComponent.findAll({
      where: { periodGradeSubjectId, termId },
      include: [
        {
          association: 'contents',
          include: [{ association: 'learnings' }],
        },
      ],
      order: [['order', 'ASC'], ['id', 'ASC']],
    });

    return res.json(refreshed);
  } catch (error: any) {
    await transaction.rollback();
    console.error('[reorderThematicComponents] Error:', error);
    return res.status(400).json({ message: error.message || 'No se pudo reordenar' });
  }
};

// ── Thematic Contents ────────────────────────────────────────────

export const createThematicContent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params; // thematicComponentId
    const { title } = req.body;
    if (!title) {
      return res.status(400).json({ message: 'title es requerido' });
    }

    const component = await ThematicComponent.findByPk(Number(id));
    if (!component) {
      return res.status(404).json({ message: 'Componente no encontrado' });
    }

    const maxOrder = await ThematicContent.max('order', {
      where: { thematicComponentId: Number(id) },
    }) as number || 0;

    const content = await ThematicContent.create({
      thematicComponentId: Number(id),
      title,
      order: maxOrder + 1,
    });

    return res.status(201).json(content);
  } catch (error: any) {
    console.error('[createThematicContent] Error:', error);
    return res.status(500).json({ message: error.message || 'Error al crear contenido' });
  }
};

export const updateThematicContent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, order } = req.body;

    const content = await ThematicContent.findByPk(Number(id));
    if (!content) {
      return res.status(404).json({ message: 'Contenido no encontrado' });
    }

    await content.update({
      ...(title !== undefined && { title }),
      ...(order !== undefined && { order }),
    });

    return res.json(content);
  } catch (error: any) {
    console.error('[updateThematicContent] Error:', error);
    return res.status(500).json({ message: error.message || 'Error al actualizar' });
  }
};

export const deleteThematicContent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const content = await ThematicContent.findByPk(Number(id));
    if (!content) {
      return res.status(404).json({ message: 'Contenido no encontrado' });
    }

    await ExpectedLearningContent.destroy({ where: { contentId: Number(id) } });
    await content.destroy();

    return res.json({ message: 'Contenido eliminado' });
  } catch (error: any) {
    console.error('[deleteThematicContent] Error:', error);
    return res.status(500).json({ message: error.message || 'Error al eliminar' });
  }
};

export const reorderThematicContents = async (req: Request, res: Response) => {
  const { contentIds } = req.body as { contentIds?: number[] };

  if (!Array.isArray(contentIds) || contentIds.length === 0 || contentIds.some((id) => typeof id !== 'number')) {
    return res.status(400).json({ message: 'Debe enviar un arreglo de IDs de contenidos en el orden deseado.' });
  }

  const transaction = await sequelize.transaction();
  try {
    const contents = await ThematicContent.findAll({
      where: { id: { [Op.in]: contentIds } },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (contents.length !== contentIds.length) {
      throw new Error('Alguno de los contenidos no existe.');
    }

    // All contents must belong to the same thematic component
    const componentIds = new Set(contents.map((c) => c.thematicComponentId));
    if (componentIds.size !== 1) {
      throw new Error('Los contenidos deben pertenecer al mismo componente temático.');
    }

    const sortPosition = new Map(contentIds.map((contentId, index) => [contentId, index + 1]));

    for (const content of contents) {
      const nextOrder = sortPosition.get(content.id);
      if (nextOrder !== undefined) {
        content.order = nextOrder;
        await content.save({ transaction });
      }
    }

    await transaction.commit();

    const componentId = contents[0].thematicComponentId;
    const refreshed = await ThematicContent.findAll({
      where: { thematicComponentId: componentId },
      order: [['order', 'ASC'], ['id', 'ASC']],
    });

    return res.json(refreshed);
  } catch (error: any) {
    await transaction.rollback();
    console.error('[reorderThematicContents] Error:', error);
    return res.status(400).json({ message: error.message || 'No se pudo reordenar' });
  }
};

// ── Expected Learnings ───────────────────────────────────────────

export const createExpectedLearning = async (req: Request, res: Response) => {
  try {
    const { contentIds, description } = req.body;
    if (!description) {
      return res.status(400).json({ message: 'description es requerido' });
    }
    if (!contentIds || !Array.isArray(contentIds) || contentIds.length === 0) {
      return res.status(400).json({ message: 'contentIds es requerido' });
    }

    const maxOrder = await ExpectedLearning.max('order') as number || 0;

    const learning = await ExpectedLearning.create({
      description,
      order: maxOrder + 1,
    });

    await (learning as any).setContents(contentIds);

    return res.status(201).json(learning);
  } catch (error: any) {
    console.error('[createExpectedLearning] Error:', error);
    return res.status(500).json({ message: error.message || 'Error al crear aprendizaje' });
  }
};

export const updateExpectedLearning = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { description, order, contentIds } = req.body;

    const learning = await ExpectedLearning.findByPk(Number(id));
    if (!learning) {
      return res.status(404).json({ message: 'Aprendizaje no encontrado' });
    }

    await learning.update({
      ...(description !== undefined && { description }),
      ...(order !== undefined && { order }),
    });

    if (contentIds !== undefined && Array.isArray(contentIds)) {
      await (learning as any).setContents(contentIds);
    }

    return res.json(learning);
  } catch (error: any) {
    console.error('[updateExpectedLearning] Error:', error);
    return res.status(500).json({ message: error.message || 'Error al actualizar' });
  }
};

export const deleteExpectedLearning = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const learning = await ExpectedLearning.findByPk(Number(id));
    if (!learning) {
      return res.status(404).json({ message: 'Aprendizaje no encontrado' });
    }

    await learning.destroy();
    return res.json({ message: 'Aprendizaje eliminado' });
  } catch (error: any) {
    console.error('[deleteExpectedLearning] Error:', error);
    return res.status(500).json({ message: error.message || 'Error al eliminar' });
  }
};
