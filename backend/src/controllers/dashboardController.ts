import { Request, Response } from 'express';
import { Op, fn, col, literal } from 'sequelize';
import SchoolPeriod from '@/models/SchoolPeriod';
import Inscription from '@/models/Inscription';
import Matriculation from '@/models/Matriculation';
import Term from '@/models/Term';
import TeacherAssignment from '@/models/TeacherAssignment';
import PeriodGradeSubject from '@/models/PeriodGradeSubject';
import PeriodGrade from '@/models/PeriodGrade';
import Grade from '@/models/Grade';
import Section from '@/models/Section';
import Person from '@/models/Person';
import Subject from '@/models/Subject';
import EvaluationPlan from '@/models/EvaluationPlan';
import Qualification from '@/models/Qualification';
import { PeriodClosureService } from '@/services/periodClosureService';

interface TeacherAssignmentWithRelations extends TeacherAssignment {
  teacher?: Person;
  section?: Section;
  periodGradeSubject?: PeriodGradeSubject & {
    periodGrade?: PeriodGrade & { grade?: Grade };
    subject?: Subject;
  };
}

const assignmentKey = (pgsId: number, sectionId: number) => `${pgsId}:${sectionId}`;

export const getControlPanelMetrics = async (req: Request, res: Response) => {
  try {
    const activePeriod = await SchoolPeriod.findOne({ where: { isActive: true } });

    if (!activePeriod) {
      return res.json({ period: null });
    }

    const [matriculatedCount, pendingMatriculations, terms] = await Promise.all([
      Inscription.count({ where: { schoolPeriodId: activePeriod.id } }),
      Matriculation.count({ where: { schoolPeriodId: activePeriod.id, status: 'pending' } }),
      Term.findAll({
        where: { schoolPeriodId: activePeriod.id },
        order: [['order', 'ASC']],
        attributes: ['id', 'name', 'order', 'isBlocked', 'openDate', 'closeDate']
      })
    ]);

    const closureStatus = await PeriodClosureService.getStatus(activePeriod.id);

    const assignments = (await TeacherAssignment.findAll({
      include: [
        {
          model: PeriodGradeSubject,
          as: 'periodGradeSubject',
          required: true,
          include: [
            {
              model: PeriodGrade,
              as: 'periodGrade',
              required: true,
              where: { schoolPeriodId: activePeriod.id },
              include: [{ model: Grade, as: 'grade', attributes: ['id', 'name'] }]
            },
            { model: Subject, as: 'subject', attributes: ['id', 'name'] }
          ]
        },
        { model: Section, as: 'section', attributes: ['id', 'name'] },
        { model: Person, as: 'teacher', attributes: ['id', 'firstName', 'lastName'] }
      ]
    })) as TeacherAssignmentWithRelations[];

    const termIds = terms.map(term => term.id);

    const periodGradeSubjectIds = assignments.map(a => a.periodGradeSubjectId);
    const sectionIds = assignments.map(a => a.sectionId);

    const evaluationPlanCountsRaw = await EvaluationPlan.findAll({
      attributes: [
        'periodGradeSubjectId',
        'sectionId',
        [fn('COUNT', literal('*')), 'planCount']
      ],
      where: {
        periodGradeSubjectId: { [Op.in]: periodGradeSubjectIds },
        sectionId: { [Op.in]: sectionIds }
      },
      group: ['periodGradeSubjectId', 'sectionId'],
      raw: true
    });
    const evaluationPlanCounts = evaluationPlanCountsRaw as unknown as {
      periodGradeSubjectId: number;
      sectionId: number;
      planCount: number;
    }[];

    const qualificationCountsRaw = await Qualification.findAll({
      attributes: [
        [col('evaluationPlan.periodGradeSubjectId'), 'periodGradeSubjectId'],
        [col('evaluationPlan.sectionId'), 'sectionId'],
        [fn('COUNT', literal('*')), 'qualificationCount']
      ],
      include: [
        {
          model: EvaluationPlan,
          as: 'evaluationPlan',
          attributes: [],
          required: true,
          where: termIds.length > 0 ? { termId: { [Op.in]: termIds } } : {}
        }
      ],
      group: ['evaluationPlan.periodGradeSubjectId', 'evaluationPlan.sectionId'],
      raw: true
    });
    const qualificationCounts = qualificationCountsRaw as unknown as {
      periodGradeSubjectId: number;
      sectionId: number;
      qualificationCount: number;
    }[];

    const planMap = new Map<string, number>();
    evaluationPlanCounts.forEach(record => {
      const key = assignmentKey(record.periodGradeSubjectId, record.sectionId);
      planMap.set(key, record.planCount);
    });

    const qualificationMap = new Map<string, number>();
    qualificationCounts.forEach(record => {
      const key = assignmentKey(record.periodGradeSubjectId, record.sectionId);
      qualificationMap.set(key, record.qualificationCount);
    });

    const assignmentsWithoutPlan: any[] = [];
    const assignmentsWithoutGrades: any[] = [];

    assignments.forEach(assignment => {
      const key = assignmentKey(assignment.periodGradeSubjectId, assignment.sectionId);
      const baseInfo = {
        teacher: assignment.teacher ? `${assignment.teacher.firstName} ${assignment.teacher.lastName}` : 'Sin asignar',
        subject: assignment.periodGradeSubject?.subject?.name || 'Materia',
        grade: assignment.periodGradeSubject?.periodGrade?.grade?.name || 'Grado',
        section: assignment.section?.name || '—'
      };

      if (!planMap.get(key)) {
        assignmentsWithoutPlan.push(baseInfo);
      }

      if (!qualificationMap.get(key)) {
        assignmentsWithoutGrades.push(baseInfo);
      }
    });

    const responsePayload = {
      period: {
        id: activePeriod.id,
        name: activePeriod.name,
        period: activePeriod.period
      },
      students: {
        matriculated: matriculatedCount,
        pending: pendingMatriculations,
        total: matriculatedCount + pendingMatriculations
      },
      lapses: {
        total: terms.length,
        blocked: terms.filter(term => term.isBlocked).length,
        terms: terms.map(term => ({
          id: term.id,
          name: term.name,
          order: term.order,
          isBlocked: term.isBlocked,
          openDate: term.openDate,
          closeDate: term.closeDate
        }))
      },
      council: {
        checklist: closureStatus.checklist,
        blockedTerms: closureStatus.blockedTerms,
        totalTerms: closureStatus.totalTerms
      },
      teachers: {
        totalAssignments: assignments.length,
        withoutPlans: assignmentsWithoutPlan.length,
        withoutGrades: assignmentsWithoutGrades.length,
        sampleWithoutPlans: assignmentsWithoutPlan.slice(0, 6),
        sampleWithoutGrades: assignmentsWithoutGrades.slice(0, 6)
      }
    };

    return res.json(responsePayload);
  } catch (error) {
    console.error('Error fetching control panel metrics:', error);
    return res.status(500).json({ message: 'Error obteniendo métricas del panel de control' });
  }
};
