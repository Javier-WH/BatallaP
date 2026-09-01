/**
 * GradeCalculationService
 *
 * Single source of truth for calculating term scores, final scores per subject,
 * and general averages. All views, reports, Excel exports and PDFs MUST use
 * this service to ensure consistency.
 *
 * Key concepts (see R16 in rules/RULES.md):
 * - **Accumulated score**: real-time score before the council is completed.
 * - **Final score**: score after the council is marked as done
 *   (CouncilChecklist.status === 'done'). Same calculation, but official.
 *
 * Rules:
 * - Per-lapso scores are read from `SubjectTermGrade` (single source of truth).
 * - Final scores use `roundFinalGrade` (integer, min = MIN_FINAL_GRADE = 1).
 * - General averages use 2 decimals.
 * - `passing_grade` from settings decides aprobada/reprobada.
 * - External grades (transferencia/equivalencia) use SubjectFinalGrade directly.
 * - Closed historical periods use SubjectFinalGrade directly without checking
 *   CouncilChecklist.
 */

import { roundFinalGrade, MIN_FINAL_GRADE, resolveGradeStatus } from './gradeEvaluationService';

export interface TermScoreInput {
  termId: number;
  score: number; // from SubjectTermGrade
}

export interface LapsoResult {
  termId: number;
  termName: string;
  /** Accumulated score (always calculated, regardless of council status) */
  accumulatedScore: number;
  /** Final score (null if council not done for this term+section) */
  finalScore: number | null;
}

export interface SubjectWithFinalScore {
  finalScore: number | null;
  includeInAverage: boolean;
  gradeType?: string | null;
}

export class GradeCalculationService {
  /**
   * 1. Accumulated term score (always calculated, regardless of council status).
   * Reads from SubjectTermGrade (single source of truth).
   * Returns roundFinalGrade(score).
   */
  static calculateAccumulatedTermScore(
    termId: number,
    termGrades: { termId: number; score: number }[],
  ): number {
    const tg = termGrades.find((t) => t.termId === termId);
    const raw = tg ? Number(tg.score) : 0;
    return roundFinalGrade(raw);
  }

  /**
   * 2. Final term score (only if council is done, otherwise null).
   * Same calculation as accumulated, but returns null when council is not completed.
   */
  static calculateFinalTermScore(
    termId: number,
    termGrades: { termId: number; score: number }[],
    councilDone: boolean,
  ): number | null {
    if (!councilDone) return null;
    return this.calculateAccumulatedTermScore(termId, termGrades);
  }

  /**
   * 3. Final score for a subject (for official documents).
   *
   * - If SubjectFinalGrade exists AND all lapsos have council done → use SubjectFinalGrade.
   * - If some lapsos have council done → average of those lapsos (roundFinalGrade).
   * - If no lapsos have council done → null.
   * - External grades (transferencia/equivalencia) → use SubjectFinalGrade directly.
   * - Closed period (isClosedPeriod=true) → use SubjectFinalGrade directly.
   */
  static calculateFinalScore(
    lapsos: { termId: number; finalScore: number | null }[],
    subjectFinalGrade: { finalScore: number | null; gradeType?: string | null } | null,
    options: { isClosedPeriod?: boolean } = {},
  ): number | null {
    // External grades: use SubjectFinalGrade directly (always rounded)
    if (subjectFinalGrade?.gradeType === 'transferencia' || subjectFinalGrade?.gradeType === 'equivalencia') {
      if (subjectFinalGrade.finalScore != null) {
        return roundFinalGrade(Math.max(MIN_FINAL_GRADE, Number(subjectFinalGrade.finalScore)));
      }
      return null;
    }

    // Closed period: use SubjectFinalGrade directly (always rounded)
    if (options.isClosedPeriod && subjectFinalGrade?.finalScore != null) {
      return roundFinalGrade(Math.max(MIN_FINAL_GRADE, Number(subjectFinalGrade.finalScore)));
    }

    const completedLapsos = lapsos.filter((l) => l.finalScore !== null);
    const allDone = completedLapsos.length === lapsos.length && lapsos.length > 0;

    // All lapsos done → use stored SubjectFinalGrade if available (always rounded)
    if (allDone && subjectFinalGrade?.finalScore != null) {
      return roundFinalGrade(Math.max(MIN_FINAL_GRADE, Number(subjectFinalGrade.finalScore)));
    }

    // Some lapsos done → average of completed lapsos
    if (completedLapsos.length > 0) {
      const total = completedLapsos.reduce((sum, l) => sum + (l.finalScore || 0), 0);
      return roundFinalGrade(total / completedLapsos.length);
    }

    // No lapsos done → null
    return null;
  }

  /**
   * 4. General average (final or accumulated).
   *
   * mode='final': average of finalScore from subjects with includeInAverage=true.
   *   Only subjects with non-null finalScore are counted.
   *   Returns null if no subjects have a final score.
   *
   * mode='accumulated': average of accumulated term scores from subjects with
   *   includeInAverage=true. All terms are counted (regardless of council status).
   *   Returns null if no subjects have scores.
   *
   * Both modes apply Math.max(MIN_FINAL_GRADE, score) per subject and
   * return the average with 2 decimals.
   */
  static calculateGeneralAverage(
    subjects: SubjectWithFinalScore[],
    mode: 'final' | 'accumulated',
    accumulatedScores?: number[],
  ): number | null {
    if (mode === 'final') {
      const eligible = subjects.filter((s) => s.includeInAverage !== false);
      const scores = eligible
        .map((s) => {
          if (s.finalScore === null || s.finalScore === undefined) return null;
          // External grades: use directly
          if (s.gradeType === 'transferencia' || s.gradeType === 'equivalencia') {
            return Math.max(MIN_FINAL_GRADE, Number(s.finalScore));
          }
          return Math.max(MIN_FINAL_GRADE, Number(s.finalScore));
        })
        .filter((v): v is number => v !== null);

      if (scores.length === 0) return null;
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      return Number(avg.toFixed(2));
    }

    // mode === 'accumulated'
    if (!accumulatedScores || accumulatedScores.length === 0) return null;
    const scores = accumulatedScores.map((s) => Math.max(MIN_FINAL_GRADE, s));
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    return Number(avg.toFixed(2));
  }

  /**
   * Helper: resolve grade status (aprobada/reprobada) using passing_grade.
   */
  static resolveStatus(score: number | null, passingGrade: number): 'aprobada' | 'reprobada' {
    if (score === null || score === undefined) return 'reprobada';
    return resolveGradeStatus(score, passingGrade);
  }

  /**
   * Helper: build a map of council-done terms by section.
   * Returns a function isCouncilDone(termId, sectionId) => boolean.
   */
  static buildCouncilDoneChecker(
    councilChecklists: { termId: number; sectionId: number; status: string }[],
  ): (termId: number, sectionId: number) => boolean {
    const map = new Map<number, Set<number>>();
    for (const c of councilChecklists) {
      if (c.status !== 'done') continue;
      if (!map.has(c.sectionId)) map.set(c.sectionId, new Set());
      map.get(c.sectionId)!.add(c.termId);
    }
    return (termId: number, sectionId: number): boolean => {
      return map.get(sectionId)?.has(termId) || false;
    };
  }

  /**
   * Helper: build term grades array, using SubjectTermGrade as primary source
   * and falling back to calculating from qualifications + councilPoints when
   * SubjectTermGrade has no data or score is 0 for a given term.
   *
   * This handles the case where TermGradeSyncService hasn't synced yet or
   * SubjectTermGrade records are missing/stale.
   */
  static buildTermGradesWithFallback(
    termGrades: { termId: number; score: number }[],
    qualifications: any[],
    councilPoints: any[],
    termIds: number[],
  ): { termId: number; score: number }[] {
    // Build map of stored term grades
    const storedMap = new Map<number, number>();
    for (const tg of termGrades) {
      storedMap.set(tg.termId, Number(tg.score));
    }

    // Build fallback scores from qualifications + councilPoints
    const fallbackScores: Record<number, number> = {};
    termIds.forEach((id) => { fallbackScores[id] = 0; });

    for (const q of qualifications || []) {
      if (q.isAbsent) continue;
      const score = q.remedialScore != null && Number(q.remedialScore) > 0
        ? Number(q.remedialScore) : Number(q.score) || 0;
      const percentage = Number(q.evaluationPlan?.percentage) || 0;
      const termId = q.evaluationPlan?.termId;
      if (termId && fallbackScores[termId] !== undefined) {
        fallbackScores[termId] += score * (percentage / 100);
      }
    }

    for (const cp of councilPoints || []) {
      const pVal = Number(cp.points) || 0;
      if (cp.termId && fallbackScores[cp.termId] !== undefined) {
        fallbackScores[cp.termId] += pVal;
      }
    }

    // Use stored score if available and > 0, otherwise use fallback
    return termIds.map((termId) => ({
      termId,
      score: storedMap.has(termId) && storedMap.get(termId)! > 0
        ? storedMap.get(termId)!
        : fallbackScores[termId] || 0,
    }));
  }
}

export default GradeCalculationService;
