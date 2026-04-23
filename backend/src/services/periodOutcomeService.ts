import {
  Grade,
  Inscription,
  PendingSubject,
  Person,
  Section,
  StudentPeriodOutcome,
  Subject
} from '@/models/index';

interface OutcomeFilters {
  status?: 'aprobado' | 'materias_pendientes' | 'reprobado';
}

export class PeriodOutcomeService {
  static async getOutcomesForPeriod(periodId: number, filters: OutcomeFilters = {}) {
    const outcomes = await StudentPeriodOutcome.findAll({
      where: {
        ...(filters.status ? { status: filters.status } : {})
      },
      include: [
        {
          model: Inscription,
          as: 'inscription',
          where: { schoolPeriodId: periodId },
          include: [
            { model: Person, as: 'student' },
            { model: Grade, as: 'grade' },
            { model: Section, as: 'section' },
            {
              model: PendingSubject,
              as: 'pendingSubjects',
              include: [{ model: Subject, as: 'subject' }]
            }
          ]
        },
        { model: Grade, as: 'promotionGrade' }
      ],
      order: [['failedSubjects', 'DESC']]
    });

    // Pending subjects within each outcome: sort alphabetically by subject.name
    // (cross-grade collection; canonical PeriodGrade order doesn't apply directly).
    outcomes.forEach((o: any) => {
      if (Array.isArray(o.inscription?.pendingSubjects)) {
        o.inscription.pendingSubjects.sort((a: any, b: any) =>
          (a.subject?.name ?? '').localeCompare(b.subject?.name ?? '', 'es', { sensitivity: 'base' })
        );
      }
    });

    return outcomes;
  }

  static async getPendingSubjectsByPeriod(periodId: number) {
    const pending = await PendingSubject.findAll({
      include: [
        {
          model: Inscription,
          as: 'inscription',
          where: { schoolPeriodId: periodId },
          include: [
            { model: Person, as: 'student' },
            { model: Grade, as: 'grade' },
            { model: Section, as: 'section' }
          ]
        },
        { model: Subject, as: 'subject' }
      ],
      order: [['status', 'ASC'], ['updatedAt', 'DESC']]
    });

    return pending;
  }
}

export default PeriodOutcomeService;
