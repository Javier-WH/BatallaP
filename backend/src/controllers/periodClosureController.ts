import { Request, Response } from 'express';
import { PeriodClosureService } from '@/services/periodClosureService';
import { PeriodClosureExecutor } from '@/services/periodClosureExecutor';
import { PeriodClosurePreview } from '@/services/periodClosurePreview';

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

export const validateClosure = async (req: Request, res: Response) => {
  try {
    const { periodId } = req.params;
    const parsedId = Number(periodId);

    if (!parsedId || Number.isNaN(parsedId)) {
      return res.status(400).json({ message: 'periodId inválido' });
    }

    const validation = await PeriodClosureExecutor.validateClosure(parsedId);
    return res.json(validation);
  } catch (error) {
    console.error('Error validating closure', error);
    return res.status(500).json({ message: 'Error al validar el cierre del periodo' });
  }
};

export const executeClosure = async (req: Request, res: Response) => {
  try {
    const { periodId } = req.params;
    const parsedId = Number(periodId);

    if (!parsedId || Number.isNaN(parsedId)) {
      return res.status(400).json({ message: 'periodId inválido' });
    }

    const sessionUserId = (req.session as any)?.user?.id as number | undefined;

    const result = await PeriodClosureExecutor.executeClosure(parsedId, sessionUserId);

    if (!result.success) {
      return res.status(400).json({
        message: 'No se pudo completar el cierre del periodo',
        errors: result.errors,
        log: result.log
      });
    }

    return res.json(result);
  } catch (error) {
    console.error('Error executing closure', error);
    return res.status(500).json({ message: 'Error al ejecutar el cierre del periodo' });
  }
};

export const getPreviewOutcomes = async (req: Request, res: Response) => {
  try {
    const { periodId } = req.params;
    const parsedId = Number(periodId);

    if (!parsedId || Number.isNaN(parsedId)) {
      return res.status(400).json({ message: 'periodId inválido' });
    }

    const preview = await PeriodClosurePreview.calculatePreview(parsedId);
    return res.json(preview);
  } catch (error) {
    console.error('Error calculating preview', error);
    return res.status(500).json({ message: 'Error al calcular vista previa' });
  }
};
