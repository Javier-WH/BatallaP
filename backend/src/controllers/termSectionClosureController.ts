import { Request, Response } from 'express';
import { TermSectionClosureService } from '@/services/termSectionClosureService';
import { Term } from '@/models/index';

export const getClosedSections = async (req: Request, res: Response) => {
  try {
    const { termId } = req.params;
    const parsedTermId = Number(termId);
    if (!parsedTermId || Number.isNaN(parsedTermId)) {
      return res.status(400).json({ message: 'termId inválido' });
    }

    const term = await Term.findByPk(parsedTermId, { attributes: ['id', 'isBlocked', 'schoolPeriodId'] });
    if (!term) {
      return res.status(404).json({ message: 'Lapso no encontrado' });
    }

    const closedSections = await TermSectionClosureService.getClosedSections(parsedTermId);

    return res.json({
      termId: parsedTermId,
      termGloballyBlocked: term.isBlocked,
      closedSections, // null = all closed, array of { sectionId, gradeId } = specific
    });
  } catch (error) {
    console.error('[getClosedSections] Error:', error);
    return res.status(500).json({ message: 'Error al obtener secciones cerradas' });
  }
};

export const getClosureStatus = async (req: Request, res: Response) => {
  try {
    const { termId } = req.params;
    const parsedTermId = Number(termId);
    if (!parsedTermId || Number.isNaN(parsedTermId)) {
      return res.status(400).json({ message: 'termId inválido' });
    }

    const { schoolPeriodId } = req.query as { schoolPeriodId?: string };
    if (!schoolPeriodId) {
      return res.status(400).json({ message: 'schoolPeriodId es requerido' });
    }

    const status = await TermSectionClosureService.getClosureStatus(parsedTermId, Number(schoolPeriodId));
    return res.json(status);
  } catch (error) {
    console.error('[getClosureStatus] Error:', error);
    return res.status(500).json({ message: 'Error al obtener estado de cierre' });
  }
};

export const closeSection = async (req: Request, res: Response) => {
  try {
    const { termId } = req.params;
    const parsedTermId = Number(termId);
    if (!parsedTermId || Number.isNaN(parsedTermId)) {
      return res.status(400).json({ message: 'termId inválido' });
    }

    const { sectionId, gradeId } = req.body as { sectionId?: number; gradeId?: number };
    if (!sectionId || !gradeId) {
      return res.status(400).json({ message: 'sectionId y gradeId son requeridos' });
    }

    const sessionUserId = (req.session as any)?.user?.id as number | undefined;

    const closure = await TermSectionClosureService.closeSection({
      termId: parsedTermId,
      sectionId,
      gradeId,
      closedBy: sessionUserId,
    });

    return res.json(closure);
  } catch (error) {
    console.error('[closeSection] Error:', error);
    return res.status(500).json({ message: 'Error al cerrar sección' });
  }
};

export const reopenSection = async (req: Request, res: Response) => {
  try {
    const { termId, sectionId, gradeId } = req.params;
    const parsedTermId = Number(termId);
    const parsedSectionId = Number(sectionId);
    const parsedGradeId = Number(gradeId);

    if (!parsedTermId || Number.isNaN(parsedTermId)) {
      return res.status(400).json({ message: 'termId inválido' });
    }
    if (!parsedSectionId || Number.isNaN(parsedSectionId)) {
      return res.status(400).json({ message: 'sectionId inválido' });
    }
    if (!parsedGradeId || Number.isNaN(parsedGradeId)) {
      return res.status(400).json({ message: 'gradeId inválido' });
    }

    await TermSectionClosureService.reopenSection(parsedTermId, parsedSectionId, parsedGradeId);
    return res.json({ message: 'Sección reabierta correctamente' });
  } catch (error) {
    console.error('[reopenSection] Error:', error);
    return res.status(500).json({ message: 'Error al reabrir sección' });
  }
};
