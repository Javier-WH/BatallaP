import { Request, Response } from 'express';
import { saveEnrollmentAnswers, EnrollmentAnswerPayload } from '@/services/enrollmentAnswerService';
import EnrollmentAnswer from '@/models/EnrollmentAnswer';
import EnrollmentQuestion from '@/models/EnrollmentQuestion';

export const saveAnswersController = async (req: Request, res: Response) => {
  try {
    const { personId, answers } = req.body as {
      personId?: number;
      answers?: EnrollmentAnswerPayload[];
    };

    const targetPersonId =
      typeof personId === 'number'
        ? personId
        : typeof req.params.personId === 'string'
          ? Number(req.params.personId)
          : undefined;

    if (!targetPersonId || Number.isNaN(targetPersonId)) {
      return res.status(400).json({ message: 'Debe indicar el ID del estudiante.' });
    }

    const normalizedAnswers = Array.isArray(answers) ? answers : [];

    await saveEnrollmentAnswers(targetPersonId, normalizedAnswers);

    res.json({ message: 'Respuestas guardadas correctamente.' });
  } catch (error: any) {
    console.error('Error guardando respuestas de inscripción:', error);
    res.status(400).json({ message: error.message || 'No se pudieron guardar las respuestas' });
  }
};

export const getAnswersByPerson = async (req: Request, res: Response) => {
  try {
    const { personId } = req.params;
    const parsedId = Number(personId);
    if (Number.isNaN(parsedId)) {
      return res.status(400).json({ message: 'personId inválido.' });
    }

    const answers = await EnrollmentAnswer.findAll({
      where: { personId: parsedId },
      include: [
        {
          model: EnrollmentQuestion,
          as: 'question'
        }
      ],
      order: [['questionId', 'ASC']]
    });

    res.json(answers);
  } catch (error: any) {
    console.error('Error obteniendo respuestas de inscripción:', error);
    res.status(500).json({ message: 'Error obteniendo respuestas', details: error.message || error });
  }
};
