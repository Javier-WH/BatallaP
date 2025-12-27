import { Request, Response } from 'express';
import PeriodOutcomeService from '@/services/periodOutcomeService';
import PendingSubjectService from '@/services/pendingSubjectService';

const VALID_OUTCOME_STATUS = ['aprobado', 'materias_pendientes', 'reprobado'] as const;
type OutcomeStatus = (typeof VALID_OUTCOME_STATUS)[number];

const VALID_PENDING_STATUS = ['aprobada', 'convalidada'] as const;

export const getPeriodOutcomes = async (req: Request, res: Response) => {
  try {
    const periodId = Number(req.params.periodId);
    if (!Number.isFinite(periodId)) {
      return res.status(400).json({ message: 'periodId inválido' });
    }

    const status = req.query.status as OutcomeStatus | undefined;
    if (status && !VALID_OUTCOME_STATUS.includes(status)) {
      return res.status(400).json({ message: 'status inválido' });
    }

    const data = await PeriodOutcomeService.getOutcomesForPeriod(periodId, { status });
    return res.json(data);
  } catch (error) {
    console.error('Error fetching period outcomes', error);
    return res.status(500).json({ message: 'Error al obtener resultados del periodo' });
  }
};

export const getPendingSubjects = async (req: Request, res: Response) => {
  try {
    const periodId = Number(req.params.periodId);
    if (!Number.isFinite(periodId)) {
      return res.status(400).json({ message: 'periodId inválido' });
    }

    const pending = await PeriodOutcomeService.getPendingSubjectsByPeriod(periodId);
    return res.json(pending);
  } catch (error) {
    console.error('Error fetching pending subjects', error);
    return res.status(500).json({ message: 'Error al obtener materias pendientes' });
  }
};

export const resolvePendingSubject = async (req: Request, res: Response) => {
  try {
    const pendingSubjectId = Number(req.params.pendingSubjectId);
    if (!Number.isFinite(pendingSubjectId)) {
      return res.status(400).json({ message: 'pendingSubjectId inválido' });
    }

    const { status } = req.body as { status?: (typeof VALID_PENDING_STATUS)[number] };
    if (!status || !VALID_PENDING_STATUS.includes(status)) {
      return res.status(400).json({ message: 'status inválido' });
    }

    const pending = await PendingSubjectService.resolvePendingSubject(pendingSubjectId, status);
    return res.json(pending);
  } catch (error) {
    console.error('Error resolving pending subject', error);
    return res.status(500).json({ message: 'Error al actualizar materia pendiente' });
  }
};
