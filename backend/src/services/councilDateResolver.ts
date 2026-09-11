import { CouncilChecklist, Term } from '@/models/index';

/**
 * Timezone used across the app for calendar-date semantics (Venezuela, UTC-4).
 */
export const SCHOOL_TIMEZONE = 'America/Caracas';

/**
 * Format any date-like value as 'YYYY-MM-DD' interpreted in the school
 * timezone (America/Caracas), NOT in UTC. Using toISOString() would shift
 * the calendar day for instants after 20:00 Caracas (00:00 UTC next day).
 *
 * - Date            -> formatted in America/Caracas
 * - 'YYYY-MM-DD...' -> returned as-is (already a calendar date)
 * - null/undefined  -> null
 */
export function formatDateInCaracas(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === 'string') {
    return value.split('T')[0].split(' ')[0] || null;
  }
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SCHOOL_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
  return parts || null;
}

/**
 * Resolve the official council completion date for certified documents.
 *
 * Priority:
 *  1. Term.councilCompletedAtOverride — Master override for the whole lapso
 *     (applies to every section in that term).
 *  2. CouncilChecklist.completedAt of the term + section, when status='done'.
 *  3. null — caller falls back to SubjectFinalGrade.calculatedAt.
 *
 * When `termId` is omitted, the LAST term of the period (highest `order`) is
 * used, since final grades derive from the last lapso's council.
 *
 * Returns a 'YYYY-MM-DD' string or null.
 */
export async function resolveCouncilDate(params: {
  schoolPeriodId: number;
  sectionId?: number | null;
  termId?: number | null;
}): Promise<string | null> {
  const { schoolPeriodId, sectionId } = params;

  const term = params.termId
    ? await Term.findByPk(params.termId, { attributes: ['id', 'councilCompletedAtOverride'] })
    : await Term.findOne({
        where: { schoolPeriodId },
        order: [['order', 'DESC']],
        attributes: ['id', 'councilCompletedAtOverride'],
      });

  if (!term) return null;

  // 1. Master override wins over everything else
  if (term.councilCompletedAtOverride) {
    return term.councilCompletedAtOverride;
  }

  // 2. Checklist completion date for this term + section
  if (sectionId) {
    const checklist = await CouncilChecklist.findOne({
      where: {
        schoolPeriodId,
        sectionId,
        termId: term.id,
        status: 'done',
      },
      attributes: ['completedAt'],
    });
    if (checklist?.completedAt) {
      return formatDateInCaracas(checklist.completedAt as Date);
    }
  }

  return null;
}
