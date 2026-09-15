import { Transaction } from 'sequelize';
import { PendingSubject } from '@/models/index';
import { SubjectResultSummary } from './finalGradeCalculator';
import { getSubjectNotRepairableMapByGradeAndPeriod } from './subjectOrderService';

interface SyncOptions {
  transaction?: Transaction;
  gradeId?: number | null;
  schoolPeriodId?: number | null;
}

export class PendingSubjectService {
  static async syncPendingSubjects(
    newInscriptionId: number,
    originPeriodId: number,
    subjects: SubjectResultSummary[],
    options: SyncOptions = {}
  ) {
    // Exclude subjects flagged as "No Reparable" — they cannot go to Materia Pendiente.
    let notRepairableSubjectIds = new Set<number>();
    if (options.gradeId && options.schoolPeriodId) {
      const map = await getSubjectNotRepairableMapByGradeAndPeriod(
        options.gradeId,
        options.schoolPeriodId,
        options.transaction
      );
      for (const [subjectId, notRepairable] of map.entries()) {
        if (notRepairable) notRepairableSubjectIds.add(subjectId);
      }
    }

    const pending = subjects.filter(
      (s) => s.status === 'reprobada' && !notRepairableSubjectIds.has(s.subjectId)
    );

    for (const subject of pending) {
      await PendingSubject.upsert(
        {
          newInscriptionId,
          originPeriodId,
          subjectId: subject.subjectId,
          status: 'pendiente',
          resolvedAt: null
        },
        {
          transaction: options.transaction,
          conflictFields: ['newInscriptionId', 'subjectId']
        } as any // conflictFields supported on mysql? fallback
      );
    }

    if (pending.length === 0) {
      await PendingSubject.destroy({
        where: { newInscriptionId },
        transaction: options.transaction
      });
    }

    return pending.length;
  }

  static async resolvePendingSubject(
    pendingSubjectId: number,
    status: 'aprobada' | 'convalidada'
  ) {
    const pending = await PendingSubject.findByPk(pendingSubjectId);
    if (!pending) {
      throw new Error('Materia pendiente no encontrada');
    }
    await pending.update({
      status,
      resolvedAt: new Date()
    });
    return pending;
  }
}

export default PendingSubjectService;
