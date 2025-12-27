import {
  CouncilChecklist,
  PeriodClosure,
  SchoolPeriod,
  Term
} from '@/models/index';

interface ChecklistStatus {
  total: number;
  done: number;
}

interface ClosureStatusResponse {
  period: Pick<SchoolPeriod, 'id' | 'name' | 'period' | 'isActive'>;
  closure?: PeriodClosure | null;
  checklist: ChecklistStatus;
  blockedTerms: number;
  totalTerms: number;
}

export class PeriodClosureService {
  static async getStatus(schoolPeriodId: number): Promise<ClosureStatusResponse> {
    const period = await SchoolPeriod.findByPk(schoolPeriodId);
    if (!period) {
      throw new Error('Periodo escolar no encontrado');
    }

    const closure = await PeriodClosure.findOne({
      where: { schoolPeriodId },
      order: [['createdAt', 'DESC']]
    });

    const [totalChecklist, completedChecklist] = await Promise.all([
      CouncilChecklist.count({ where: { schoolPeriodId } }),
      CouncilChecklist.count({ where: { schoolPeriodId, status: 'done' } })
    ]);

    const checklist: ChecklistStatus = {
      total: totalChecklist,
      done: completedChecklist
    };

    const terms = await Term.findAll({
      where: { schoolPeriodId },
      attributes: ['id', 'isBlocked']
    });

    const blockedTerms = terms.filter((termRecord) => termRecord.isBlocked).length;

    return {
      period: {
        id: period.id,
        name: period.name,
        period: period.period,
        isActive: period.isActive
      },
      closure,
      checklist,
      blockedTerms,
      totalTerms: terms.length
    };
  }

  static async upsertChecklistEntry(params: {
    schoolPeriodId: number;
    gradeId: number;
    sectionId: number;
    termId: number;
    status: 'open' | 'in_review' | 'done';
    completedBy?: number;
  }) {
    const [entry] = await CouncilChecklist.findOrCreate({
      where: {
        schoolPeriodId: params.schoolPeriodId,
        gradeId: params.gradeId,
        sectionId: params.sectionId,
        termId: params.termId
      },
      defaults: params
    });

    await entry.update({
      status: params.status,
      completedBy: params.status === 'done' ? params.completedBy ?? null : null,
      completedAt: params.status === 'done' ? new Date() : null
    });

    return entry;
  }
}
