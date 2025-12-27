import { Request, Response } from 'express';
import { PeriodClosureService } from '@/services/periodClosureService';

export const getClosureStatus = async (req: Request, res: Response) => {
  try {
    const { periodId } = req.params;
    const parsedId = Number(periodId);

    if (!parsedId || Number.isNaN(parsedId)) {
      return res.status(400).json({ message: 'periodId inválido' });
    }

    const status = await PeriodClosureService.getStatus(parsedId);
    return res.json(status);
  } catch (error) {
    console.error('Error getting closure status', error);
    return res.status(500).json({ message: 'Error al obtener estado del cierre' });
  }
};

export const upsertChecklistEntry = async (req: Request, res: Response) => {
  try {
    const { periodId } = req.params;
    const parsedId = Number(periodId);
    if (!parsedId || Number.isNaN(parsedId)) {
      return res.status(400).json({ message: 'periodId inválido' });
    }

    const { gradeId, sectionId, termId, status } = req.body as {
      gradeId?: number;
      sectionId?: number;
      termId?: number;
      status?: 'open' | 'in_review' | 'done';
    };

    if (!gradeId || !sectionId || !termId || !status) {
      return res.status(400).json({ message: 'gradeId, sectionId, termId y status son requeridos' });
    }

    const sessionUserId = (req.session as any)?.user?.id as number | undefined;

    const entry = await PeriodClosureService.upsertChecklistEntry({
      schoolPeriodId: parsedId,
      gradeId,
      sectionId,
      termId,
      status,
      completedBy: sessionUserId
    });

    return res.json(entry);
  } catch (error) {
    console.error('Error updating council checklist', error);
    return res.status(500).json({ message: 'Error al actualizar checklist del consejo' });
  }
};
