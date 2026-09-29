import { Request, Response } from 'express';
import { Op } from 'sequelize';
import sequelize from '@/config/database';
import {
  ThematicComponent,
  ThematicContent,
  ExpectedLearning,
  ExpectedLearningContent,
} from '@/models/index';
import { resolveContentTeacherId } from '@/services/thematicScopeService';

// ── Thematic Components ──────────────────────────────────────────

// Double-submit guard: an identical create arriving within this window is
// treated as a duplicate (e.g. user clicked twice during network lag) and the
// already-created record is returned instead of inserting a second row.
const DUP_WINDOW_MS = 5000;

const STAFF_ROLES = ['Master', 'Administrador', 'Director', 'Control de Estudios'];

// Teachers may only modify their own content; staff may modify any.
const canEditComponents = (req: Request, components: ThematicComponent[]): boolean => {
  const user = (req.session as any)?.user;
  const roles: string[] = user?.roles || [];
  if (roles.some(r => STAFF_ROLES.includes(r))) return true;
  return components.every(c => c.teacherId === user?.personId);
};

const componentsOfContents = async (contentIds: number[]): Promise<ThematicComponent[]> => {
  if (contentIds.length === 0) return [];
  const contents = await ThematicContent.findAll({ where: { id: contentIds }, attributes: ['thematicComponentId'] });
  const componentIds = [...new Set(contents.map(c => c.thematicComponentId))];
  return ThematicComponent.findAll({ where: { id: componentIds } });
};

const linkedContentIds = async (learningId: number): Promise<number[]> =>
  (await ExpectedLearningContent.findAll({ where: { learningId }, attributes: ['contentId'] })).map(l => l.contentId);

const FORBIDDEN = { message: 'Este contenido pertenece a otro profesor' };

export const getThematicComponents = async (req: Request, res: Response) => {
  try {
    const { pgsId, termId, sectionId } = req.query;
    if (!pgsId || !termId || !sectionId) {
      return res.status(400).json({ message: 'pgsId, termId y sectionId son requeridos' });
    }

    const teacherId = await resolveContentTeacherId(Number(pgsId), Number(sectionId));
    if (!teacherId) return res.json([]);

    const components = await ThematicComponent.findAll({
      where: {
        periodGradeSubjectId: Number(pgsId),
        termId: Number(termId),
        teacherId,
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
    const { periodGradeSubjectId, termId, sectionId, title } = req.body;
    if (!periodGradeSubjectId || !termId || !sectionId || !title) {
      return res.status(400).json({ message: 'Faltan campos requeridos' });
    }

    const teacherId = await resolveContentTeacherId(Number(periodGradeSubjectId), Number(sectionId));
    if (!teacherId) {
      return res.status(400).json({ message: 'La sección no tiene un profesor asignado para esta materia' });
    }
    const user = (req.session as any)?.user;
    const roles: string[] = user?.roles || [];
    if (!roles.some(r => STAFF_ROLES.includes(r)) && teacherId !== user?.personId) {
      return res.status(403).json(FORBIDDEN);
    }

    const duplicate = await ThematicComponent.findOne({
      where: {
        periodGradeSubjectId,
        termId,
        teacherId,
        title,
        createdAt: { [Op.gte]: new Date(Date.now() - DUP_WINDOW_MS) },
      },
    });
    if (duplicate) return res.json(duplicate);

    const maxOrder = await ThematicComponent.max('order', {
      where: { periodGradeSubjectId, termId, teacherId },
    }) as number || 0;

    const component = await ThematicComponent.create({
      periodGradeSubjectId,
      termId,
      teacherId,
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
    if (!canEditComponents(req, [component])) return res.status(403).json(FORBIDDEN);

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
    if (!canEditComponents(req, [component])) return res.status(403).json(FORBIDDEN);

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

    // All components must belong to the same periodGradeSubject+term+teacher
    const keys = new Set(components.map((c) => `${c.periodGradeSubjectId}-${c.termId}-${c.teacherId}`));
    if (keys.size !== 1) {
      throw new Error('Los componentes deben pertenecer al mismo lapso y asignación.');
    }
    if (!canEditComponents(req, components)) {
      await transaction.rollback();
      return res.status(403).json(FORBIDDEN);
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

    const { periodGradeSubjectId, termId, teacherId } = components[0];
    const refreshed = await ThematicComponent.findAll({
      where: { periodGradeSubjectId, termId, teacherId },
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
    if (!canEditComponents(req, [component])) return res.status(403).json(FORBIDDEN);

    const duplicate = await ThematicContent.findOne({
      where: {
        thematicComponentId: Number(id),
        title,
        createdAt: { [Op.gte]: new Date(Date.now() - DUP_WINDOW_MS) },
      },
    });
    if (duplicate) return res.json(duplicate);

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
    if (!canEditComponents(req, await componentsOfContents([content.id]))) return res.status(403).json(FORBIDDEN);

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
    if (!canEditComponents(req, await componentsOfContents([content.id]))) return res.status(403).json(FORBIDDEN);

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
    const parent = await ThematicComponent.findByPk([...componentIds][0], { transaction });
    if (!parent || !canEditComponents(req, [parent])) {
      await transaction.rollback();
      return res.status(403).json(FORBIDDEN);
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
    if (!canEditComponents(req, await componentsOfContents(contentIds))) return res.status(403).json(FORBIDDEN);

    const duplicate = await ExpectedLearning.findOne({
      where: {
        description,
        createdAt: { [Op.gte]: new Date(Date.now() - DUP_WINDOW_MS) },
      },
      include: [{ association: 'contents', where: { id: contentIds }, attributes: ['id'], required: true }],
    });
    if (duplicate) return res.json(duplicate);

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
    const linkedIds = await linkedContentIds(learning.id);
    const touched = Array.isArray(contentIds) ? [...linkedIds, ...contentIds] : linkedIds;
    if (!canEditComponents(req, await componentsOfContents(touched))) return res.status(403).json(FORBIDDEN);

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
    if (!canEditComponents(req, await componentsOfContents(await linkedContentIds(learning.id)))) {
      return res.status(403).json(FORBIDDEN);
    }

    await learning.destroy();
    return res.json({ message: 'Aprendizaje eliminado' });
  } catch (error: any) {
    console.error('[deleteExpectedLearning] Error:', error);
    return res.status(500).json({ message: error.message || 'Error al eliminar' });
  }
};
