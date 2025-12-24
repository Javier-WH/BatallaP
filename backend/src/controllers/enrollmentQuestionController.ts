import { Request, Response } from 'express';
import { WhereOptions } from 'sequelize';
import sequelize from '@/config/database';
import EnrollmentQuestion, { EnrollmentQuestionType } from '@/models/EnrollmentQuestion';
import EnrollmentAnswer from '@/models/EnrollmentAnswer';

const QUESTION_TYPES: EnrollmentQuestionType[] = ['text', 'select', 'checkbox'];

const parseBoolean = (value: unknown): boolean =>
  value === true || value === 'true' || value === 1 || value === '1';

const normalizeOptions = (type: EnrollmentQuestionType, rawOptions: unknown): string[] | null => {
  if (type === 'text') {
    return null;
  }

  if (!Array.isArray(rawOptions)) {
    throw new Error('Debe proporcionar una lista de opciones.');
  }

  const cleaned = Array.from(
    new Set(
      rawOptions
        .map((option) => (typeof option === 'string' ? option.trim() : ''))
        .filter((value) => value.length > 0)
    )
  );

  if (cleaned.length === 0) {
    throw new Error('Debe proporcionar al menos una opción válida.');
  }

  return cleaned;
};

const ensureQuestionType = (value: unknown): EnrollmentQuestionType => {
  if (typeof value !== 'string') {
    throw new Error('Tipo de pregunta inválido.');
  }
  const normalized = value.toLowerCase() as EnrollmentQuestionType;
  if (!QUESTION_TYPES.includes(normalized)) {
    throw new Error('Tipo de pregunta no soportado.');
  }
  return normalized;
};

export const listEnrollmentQuestions = async (req: Request, res: Response) => {
  try {
    const includeInactive = parseBoolean(req.query.includeInactive);
    const personIdQuery = req.query.personId;

    let personId: number | null = null;
    if (personIdQuery !== undefined) {
      const parsedId = Number(personIdQuery);
      if (Number.isNaN(parsedId)) {
        return res.status(400).json({ message: 'personId debe ser un número' });
      }
      personId = parsedId;
    }

    const where: WhereOptions = includeInactive ? {} : { isActive: true };
    const questions = await EnrollmentQuestion.findAll({
      where,
      order: [
        ['order', 'ASC'],
        ['id', 'ASC']
      ]
    });

    if (personId === null) {
      return res.json(questions);
    }

    const answers = await EnrollmentAnswer.findAll({
      where: { personId }
    });

    const answerMap = new Map<number, string | string[]>(
      answers.map((answer) => [answer.questionId, answer.answer as string | string[]])
    );

    const response = questions.map((question) => ({
      ...question.toJSON(),
      answer: answerMap.get(question.id) ?? null
    }));

    res.json(response);
  } catch (error: any) {
    console.error('Error listando preguntas de inscripción:', error);
    res.status(500).json({ message: 'Error obteniendo preguntas', details: error.message || error });
  }
};

export const createEnrollmentQuestion = async (req: Request, res: Response) => {
  try {
    const { prompt, description, type, options, required } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ message: 'El texto de la pregunta es obligatorio.' });
    }

    const normalizedType = ensureQuestionType(type);
    const normalizedOptions = normalizeOptions(
      normalizedType,
      normalizedType === 'text' ? null : options
    );

    const currentMaxOrder = (await EnrollmentQuestion.max('order')) as number | null;
    const nextOrder = (currentMaxOrder ?? 0) + 1;

    const question = await EnrollmentQuestion.create({
      prompt: prompt.trim(),
      description: typeof description === 'string' && description.trim() !== '' ? description.trim() : null,
      type: normalizedType,
      options: normalizedOptions,
      required: Boolean(required),
      order: nextOrder,
      isActive: true
    });

    res.status(201).json(question);
  } catch (error: any) {
    console.error('Error creando pregunta de inscripción:', error);
    res.status(400).json({ message: error.message || 'No se pudo crear la pregunta' });
  }
};

export const updateEnrollmentQuestion = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { prompt, description, type, options, required } = req.body;

    const question = await EnrollmentQuestion.findByPk(id);
    if (!question) {
      return res.status(404).json({ message: 'Pregunta no encontrada' });
    }

    let targetType = question.type;
    if (type !== undefined) {
      targetType = ensureQuestionType(type);
    }

    let normalizedOptions: string[] | null | undefined;
    if (targetType === 'text') {
      normalizedOptions = null;
    } else if (options !== undefined) {
      normalizedOptions = normalizeOptions(targetType, options);
    } else if (type !== undefined) {
      // Cambió el tipo a select/checkbox pero no se enviaron opciones
      if (!question.options || question.options.length === 0) {
        return res.status(400).json({ message: 'Debe definir opciones para este tipo de pregunta.' });
      }
    }

    question.prompt = typeof prompt === 'string' && prompt.trim() !== '' ? prompt.trim() : question.prompt;
    if (description !== undefined) {
      question.description =
        typeof description === 'string' && description.trim() !== '' ? description.trim() : null;
    }
    question.type = targetType;

    if (normalizedOptions !== undefined) {
      question.options = normalizedOptions;
    }

    if (required !== undefined) {
      question.required = Boolean(required);
    }

    await question.save();
    res.json(question);
  } catch (error: any) {
    console.error('Error actualizando pregunta de inscripción:', error);
    res.status(400).json({ message: error.message || 'No se pudo actualizar la pregunta' });
  }
};

export const reorderEnrollmentQuestions = async (req: Request, res: Response) => {
  const { order } = req.body as { order?: number[] };

  if (!Array.isArray(order) || order.length === 0 || order.some((id) => typeof id !== 'number')) {
    return res.status(400).json({ message: 'Debe enviar un arreglo de IDs en el orden deseado.' });
  }

  const transaction = await sequelize.transaction();
  try {
    const questions = await EnrollmentQuestion.findAll({
      where: { id: order },
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (questions.length !== order.length) {
      throw new Error('Alguna de las preguntas no existe.');
    }

    const sortPosition = new Map(order.map((questionId, index) => [questionId, index + 1]));

    for (const question of questions) {
      const nextOrder = sortPosition.get(question.id);
      if (nextOrder !== undefined) {
        question.order = nextOrder;
        await question.save({ transaction });
      }
    }

    await transaction.commit();

    const refreshed = await EnrollmentQuestion.findAll({
      order: [
        ['order', 'ASC'],
        ['id', 'ASC']
      ]
    });
    res.json(refreshed);
  } catch (error: any) {
    if (transaction) await transaction.rollback();
    console.error('Error reordenando preguntas de inscripción:', error);
    res.status(400).json({ message: error.message || 'No se pudo reordenar' });
  }
};

export const setEnrollmentQuestionStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ message: 'Debe indicar el estado activo/inactivo.' });
    }

    const question = await EnrollmentQuestion.findByPk(id);
    if (!question) {
      return res.status(404).json({ message: 'Pregunta no encontrada' });
    }

    question.isActive = isActive;
    await question.save();

    res.json(question);
  } catch (error: any) {
    console.error('Error cambiando estado de pregunta de inscripción:', error);
    res.status(400).json({ message: error.message || 'No se pudo actualizar el estado' });
  }
};

export const deactivateEnrollmentQuestion = async (req: Request, res: Response) => {
  req.body.isActive = false;
  return setEnrollmentQuestionStatus(req, res);
};
