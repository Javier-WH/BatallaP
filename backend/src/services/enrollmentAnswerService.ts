import { Transaction, Op } from 'sequelize';
import sequelize from '@/config/database';
import EnrollmentAnswer from '@/models/EnrollmentAnswer';
import EnrollmentQuestion from '@/models/EnrollmentQuestion';

export type EnrollmentAnswerPayload = {
  questionId: number;
  answer: string | string[];
};

const normalizeAnswer = (type: string, rawAnswer: unknown, options?: string[] | null) => {
  if (type === 'text') {
    if (typeof rawAnswer !== 'string') {
      throw new Error('La respuesta debe ser texto.');
    }
    return rawAnswer.trim();
  }

  if (type === 'select') {
    if (!options || options.length === 0) {
      throw new Error('La pregunta no tiene opciones configuradas.');
    }
    if (typeof rawAnswer !== 'string') {
      throw new Error('Seleccione una opción válida.');
    }
    if (!options.includes(rawAnswer)) {
      throw new Error('La respuesta no coincide con ninguna opción válida.');
    }
    return rawAnswer;
  }

  if (type === 'checkbox') {
    if (!options || options.length === 0) {
      throw new Error('La pregunta no tiene opciones configuradas.');
    }
    let values: string[];
    if (Array.isArray(rawAnswer)) {
      values = rawAnswer.filter((v): v is string => typeof v === 'string');
    } else if (typeof rawAnswer === 'string') {
      values = [rawAnswer];
    } else {
      throw new Error('La respuesta debe ser una lista de opciones.');
    }

    const cleaned = Array.from(new Set(values.map((v) => v.trim()).filter(Boolean)));
    if (cleaned.length === 0) {
      throw new Error('Debe seleccionar al menos una opción.');
    }
    const invalid = cleaned.filter((value) => !options.includes(value));
    if (invalid.length > 0) {
      throw new Error(`Las siguientes opciones no son válidas: ${invalid.join(', ')}`);
    }
    return cleaned;
  }

  throw new Error('Tipo de pregunta no soportado.');
};

const sanitizePayload = (answers?: EnrollmentAnswerPayload[]) => {
  if (!Array.isArray(answers)) {
    return [];
  }
  const seen = new Set<number>();
  const sanitized: EnrollmentAnswerPayload[] = [];
  for (const entry of answers) {
    if (!entry || typeof entry.questionId !== 'number' || seen.has(entry.questionId)) {
      continue;
    }
    seen.add(entry.questionId);
    sanitized.push(entry);
  }
  return sanitized;
};

export const saveEnrollmentAnswers = async (
  personId: number,
  answers?: EnrollmentAnswerPayload[],
  options?: { transaction?: Transaction }
) => {
  const sanitizedAnswers = sanitizePayload(answers);
  const transaction = options?.transaction ?? await sequelize.transaction();

  try {
    if (sanitizedAnswers.length === 0) {
      await EnrollmentAnswer.destroy({
        where: { personId },
        transaction
      });
      if (!options?.transaction) await transaction.commit();
      return;
    }

    const questionIds = sanitizedAnswers.map((entry) => entry.questionId);
    const questions = await EnrollmentQuestion.findAll({
      where: { id: questionIds },
      transaction
    });

    if (questions.length !== questionIds.length) {
      throw new Error('Una o más preguntas no existen.');
    }

    const questionMap = new Map<number, EnrollmentQuestion>();
    questions.forEach((question: EnrollmentQuestion) => questionMap.set(question.id, question));

    const normalized = sanitizedAnswers.map(({ questionId, answer }) => {
      const question = questionMap.get(questionId);
      if (!question) throw new Error('Pregunta no encontrada.');
      const normalizedAnswer = normalizeAnswer(question.type, answer, question.options ?? undefined);
      return { questionId, answer: normalizedAnswer };
    });

    await EnrollmentAnswer.destroy({
      where: {
        personId,
        questionId: { [Op.notIn]: questionIds }
      },
      transaction
    });

    for (const entry of normalized) {
      await EnrollmentAnswer.upsert(
        {
          personId,
          questionId: entry.questionId,
          answer: entry.answer
        },
        { transaction }
      );
    }

    if (!options?.transaction) await transaction.commit();
  } catch (error) {
    if (!options?.transaction) await transaction.rollback();
    throw error;
  }
};
