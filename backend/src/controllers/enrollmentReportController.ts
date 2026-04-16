import { Request, Response } from 'express';
import {
  generateEnrollmentReport,
  getReportsByPerson,
  getReportByUuid,
} from '@/services/enrollmentReportService';

export const generate = async (req: Request, res: Response) => {
  try {
    const { matriculationId } = req.params;
    const report = await generateEnrollmentReport(Number(matriculationId));
    res.status(201).json(report);
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[enrollmentReportController.generate] Error:', err.message);
    res.status(500).json({ error: err.message || 'Error al generar reporte de inscripción' });
  }
};

export const listByPerson = async (req: Request, res: Response) => {
  try {
    const { personId } = req.params;
    const reports = await getReportsByPerson(Number(personId));
    res.json(reports);
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[enrollmentReportController.listByPerson] Error:', err.message);
    res.status(500).json({ error: 'Error al obtener reportes de inscripción' });
  }
};

export const getByUuid = async (req: Request, res: Response) => {
  try {
    const { uuid } = req.params;
    const report = await getReportByUuid(uuid);
    if (!report) {
      return res.status(404).json({ error: 'Reporte no encontrado' });
    }
    res.json(report);
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[enrollmentReportController.getByUuid] Error:', err.message);
    res.status(500).json({ error: 'Error al obtener reporte de inscripción' });
  }
};
