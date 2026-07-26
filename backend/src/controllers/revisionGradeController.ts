import { Request, Response } from 'express';
import {
  Grade,
  Inscription,
  InscriptionSubject,
  InscriptionSubjectRevision,
  PeriodGrade,
  PeriodGradeSubject,
  RevisionPeriod,
  SchoolPeriod,
  Section,
  Subject,
  TeacherAssignment,
} from '@/models/index';

export const getMyRevisionAssignments = async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any)?.user?.id;
    const personId = (req.session as any)?.user?.personId;
    if (!personId) {
      return res.status(400).json({ message: 'Perfil de profesor no encontrado' });
    }

    const activePeriod = await SchoolPeriod.findOne({ where: { isActive: true } });
    if (!activePeriod) {
      return res.status(404).json({ message: 'No hay un período activo' });
    }

    const revisionPeriod = await RevisionPeriod.findOne({
      where: { schoolPeriodId: activePeriod.id },
    });
    if (!revisionPeriod) {
      return res.json({ assignments: [] });
    }

    // Find teacher's assignments
    const assignments = await TeacherAssignment.findAll({
      where: { teacherId: personId },
      include: [
        {
          model: PeriodGradeSubject,
          as: 'periodGradeSubject',
          include: [
            { model: Subject, as: 'subject' },
            {
              model: PeriodGrade,
              as: 'periodGrade',
              include: [{ model: Grade, as: 'grade' }],
            },
          ],
        },
        { model: Section, as: 'section' },
      ],
    });

    const result = [];
    for (const assign of assignments) {
      const pgs = (assign as any).periodGradeSubject;
      if (!pgs || !pgs.subject) continue;

      // Find revision entries for this subject via InscriptionSubjectRevision
      const revisionEntries = await InscriptionSubjectRevision.findAll({
        where: { revisionPeriodId: revisionPeriod.id },
        include: [
          {
            model: InscriptionSubject,
            as: 'inscriptionSubject',
            required: true,
            include: [
              {
                model: Subject,
                as: 'subject',
                where: { id: pgs.subject.id },
              },
              {
                model: Inscription,
                as: 'inscription',
                where: {
                  schoolPeriodId: activePeriod.id,
                  sectionId: assign.sectionId,
                },
                include: [{ association: 'student' }],
              },
            ],
          },
        ],
      });

      if (revisionEntries.length === 0) continue;

      // Group revisions by inscriptionSubjectId
      const groupedMap = new Map<number, typeof revisionEntries>();
      for (const rev of revisionEntries) {
        if (!groupedMap.has(rev.inscriptionSubjectId)) {
          groupedMap.set(rev.inscriptionSubjectId, []);
        }
        groupedMap.get(rev.inscriptionSubjectId)!.push(rev);
      }

      const students = [];
      for (const [insSubId, revs] of groupedMap) {
        const firstRev = revs[0];
        const insSub = (firstRev as any).inscriptionSubject;
        const ins = insSub?.inscription;

        students.push({
          inscriptionSubjectId: insSubId,
          studentId: ins?.personId,
          studentName: ins?.student
            ? `${ins.student.lastName || ''} ${ins.student.firstName || ''}`.trim()
            : '',
          document: ins?.student?.document || '',
          originalScore: null,
          maxOpportunities: revisionPeriod.maxOpportunities,
          revisions: revs.map(r => ({
            id: r.id,
            opportunity: r.opportunity,
            score: r.score,
            status: r.status,
          })),
        });
      }

      result.push({
        periodGradeSubjectId: pgs.id,
        subjectName: pgs.subject.name,
        gradeName: (pgs as any).periodGrade?.grade?.name || '',
        sectionName: (assign as any).section?.name || '',
        sectionId: assign.sectionId,
        students,
      });
    }

    return res.json({ assignments: result });
  } catch (error: any) {
    console.error('[getMyRevisionAssignments] Error:', error);
    return res.status(500).json({ message: error.message || 'Error al obtener asignaciones' });
  }
};

export const getMyRevisionAssignmentDetail = async (req: Request, res: Response) => {
  try {
    const periodGradeSubjectId = parseInt(req.params.periodGradeSubjectId, 10);
    if (!periodGradeSubjectId) {
      return res.status(400).json({ message: 'periodGradeSubjectId es obligatorio' });
    }

    const activePeriod = await SchoolPeriod.findOne({ where: { isActive: true } });
    if (!activePeriod) {
      return res.status(404).json({ message: 'No hay un período activo' });
    }

    const revisionPeriod = await RevisionPeriod.findOne({
      where: { schoolPeriodId: activePeriod.id },
    });
    if (!revisionPeriod) {
      return res.status(404).json({ message: 'No hay período de reparación' });
    }

    const pgs = await PeriodGradeSubject.findByPk(periodGradeSubjectId, {
      include: [
        { model: Subject, as: 'subject' },
      ],
    });
    if (!pgs) {
      return res.status(404).json({ message: 'Asignación no encontrada' });
    }

    const revisionEntries = await InscriptionSubjectRevision.findAll({
      where: { revisionPeriodId: revisionPeriod.id },
      include: [
        {
          model: InscriptionSubject,
          as: 'inscriptionSubject',
          required: true,
          include: [
            {
              model: Subject,
              as: 'subject',
              where: { id: (pgs as any).subject?.id },
            },
            {
              model: Inscription,
              as: 'inscription',
              where: { schoolPeriodId: activePeriod.id },
              include: [
                { association: 'student' },
                { association: 'grade' },
                { association: 'section' },
              ],
            },
          ],
        },
      ],
      order: [['inscriptionSubjectId', 'ASC'], ['opportunity', 'ASC']],
    });

    // Group revisions by inscriptionSubjectId
    const groupedMap = new Map<number, any[]>();
    for (const rev of revisionEntries) {
      if (!groupedMap.has(rev.inscriptionSubjectId)) {
        groupedMap.set(rev.inscriptionSubjectId, []);
      }
      groupedMap.get(rev.inscriptionSubjectId)!.push(rev);
    }

    const students = [];
    for (const [insSubId, revs] of groupedMap) {
      const firstRev = revs[0];
      const insSub = (firstRev as any).inscriptionSubject;
      const ins = insSub?.inscription;

      students.push({
        inscriptionSubjectId: insSubId,
        studentId: ins?.personId,
        studentName: ins?.student
          ? `${ins.student.lastName || ''} ${ins.student.firstName || ''}`.trim()
          : '',
        grade: ins?.grade?.name || '',
        section: ins?.section?.name || '',
        originalScore: null,
        maxOpportunities: revisionPeriod.maxOpportunities,
        revisions: revs.map((r: any) => ({
          id: r.id,
          opportunity: r.opportunity,
          score: r.score,
          status: r.status,
        })),
      });
    }

    return res.json({
      periodGradeSubjectId,
      subjectName: (pgs as any).subject?.name || '',
      passingGrade: revisionPeriod.passingGrade,
      students,
    });
  } catch (error: any) {
    console.error('[getMyRevisionAssignmentDetail] Error:', error);
    return res.status(500).json({ message: error.message || 'Error al obtener detalle' });
  }
};
