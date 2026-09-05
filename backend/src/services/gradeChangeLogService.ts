import { Transaction } from 'sequelize';
import GradeChangeLog from '@/models/GradeChangeLog';

export interface LogGradeChangeParams {
  entityType: 'qualification' | 'subject_final_grade' | 'historical_grade' | 'inscription_subject_revision' | 'pending_subject_encounter';
  entityId: number;
  previousScore: number | null;
  newScore: number | null;
  previousStatus?: string | null;
  newStatus?: string | null;
  gradeType?: string | null;
  editedBy: number;
  editorRole?: string | null;
  reason?: string | null;
  actCode?: string | null;
  metadata?: Record<string, any> | null;
}

/**
 * Unified grade change logger.
 * Only logs when the score actually changed (previousScore !== newScore).
 * Never throws — if logging fails, the error is swallowed and printed to console
 * so the primary grade operation is not affected.
 */
export async function logGradeChange(
  params: LogGradeChangeParams,
  transaction?: Transaction,
): Promise<void> {
  // Skip if score didn't change
  if (Number(params.previousScore) === Number(params.newScore)) return;

  try {
    await GradeChangeLog.create(
      {
        entityType: params.entityType,
        entityId: params.entityId,
        previousScore: params.previousScore != null ? Number(params.previousScore) : null,
        newScore: params.newScore != null ? Number(params.newScore) : null,
        previousStatus: params.previousStatus ?? null,
        newStatus: params.newStatus ?? null,
        gradeType: params.gradeType ?? null,
        editedBy: params.editedBy,
        editorRole: params.editorRole ?? null,
        reason: params.reason ?? null,
        actCode: params.actCode ?? null,
        metadata: params.metadata ?? null,
        editedAt: new Date(),
      },
      transaction ? { transaction } : undefined,
    );
  } catch (error) {
    console.error('[gradeChangeLogService] Failed to log grade change:', error);
  }
}

export default { logGradeChange };
