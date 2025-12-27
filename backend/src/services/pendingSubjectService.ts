import { Transaction } from 'sequelize';
import { PendingSubject } from '@/models/index';
import { SubjectResultSummary } from './finalGradeCalculator';

interface SyncOptions {
  transaction?: Transaction;
}

export class PendingSubjectService {
  static async syncPendingSubjects(
    newInscriptionId: number,
    originPeriodId: number,
    subjects: SubjectResultSummary[],
    options: SyncOptions = {}
  ) {
    const pending = subjects.filter((s) => s.status === 'reprobada');

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
