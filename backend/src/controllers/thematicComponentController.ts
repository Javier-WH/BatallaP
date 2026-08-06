import { Request, Response } from 'express';
import { Op } from 'sequelize';
import {
  ThematicComponent,
  ThematicContent,
  ExpectedLearning,
} from '@/models/index';

// ── Thematic Components ──────────────────────────────────────────

export const getThematicComponents = async (req: Request, res: Response) => {
  try {
    const { pgsId, sectionId, termId } = req.query;
    if (!pgsId || !sectionId || !termId) {
      return res.status(400).json({ message: 'pgsId, sectionId, termId son requeridos' });
    }

    const components = await ThematicComponent.findAll({
      where: {
        periodGradeSubjectId: Number(pgsId),
        sectionId: Number(sectionId),
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
    const { periodGradeSubjectId, sectionId, termId, title } = req.body;
    if (!periodGradeSubjectId || !sectionId || !termId || !title) {
      return res.status(400).json({ message: 'Faltan campos requeridos' });
    }

    const maxOrder = await ThematicComponent.max('order', {
      where: { periodGradeSubjectId, sectionId, termId },
    }) as number || 0;

    const component = await ThematicComponent.create({
      periodGradeSubjectId,
      sectionId,
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

    // Cascade delete: contents will be deleted by DB cascade or manually
    const contents = await ThematicContent.findAll({ where: { thematicComponentId: Number(id) } });
    for (const content of contents) {
      await ExpectedLearning.destroy({ where: { thematicContentId: content.id } });
    }
    await ThematicContent.destroy({ where: { thematicComponentId: Number(id) } });
    await component.destroy();

    return res.json({ message: 'Componente eliminado' });
  } catch (error: any) {
    console.error('[deleteThematicComponent] Error:', error);
    return res.status(500).json({ message: error.message || 'Error al eliminar' });
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

    await ExpectedLearning.destroy({ where: { thematicContentId: Number(id) } });
    await content.destroy();

    return res.json({ message: 'Contenido eliminado' });
  } catch (error: any) {
    console.error('[deleteThematicContent] Error:', error);
    return res.status(500).json({ message: error.message || 'Error al eliminar' });
  }
};

// ── Expected Learnings ───────────────────────────────────────────

export const createExpectedLearning = async (req: Request, res: Response) => {
  try {
    const { id } = req.params; // thematicContentId
    const { description } = req.body;
    if (!description) {
      return res.status(400).json({ message: 'description es requerido' });
    }

    const content = await ThematicContent.findByPk(Number(id));
    if (!content) {
      return res.status(404).json({ message: 'Contenido no encontrado' });
    }

    const maxOrder = await ExpectedLearning.max('order', {
      where: { thematicContentId: Number(id) },
    }) as number || 0;

    const learning = await ExpectedLearning.create({
      thematicContentId: Number(id),
      description,
      order: maxOrder + 1,
    });

    return res.status(201).json(learning);
  } catch (error: any) {
    console.error('[createExpectedLearning] Error:', error);
    return res.status(500).json({ message: error.message || 'Error al crear aprendizaje' });
  }
};

export const updateExpectedLearning = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { description, order } = req.body;

    const learning = await ExpectedLearning.findByPk(Number(id));
    if (!learning) {
      return res.status(404).json({ message: 'Aprendizaje no encontrado' });
    }

    await learning.update({
      ...(description !== undefined && { description }),
      ...(order !== undefined && { order }),
    });

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
