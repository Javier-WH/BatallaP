import { Transaction } from 'sequelize';
import { Term, TermSectionClosure, Section, PeriodGrade, PeriodGradeSection, SchoolPeriod, Grade } from '@/models/index';
import sequelize from '@/config/database';

export class TermSectionClosureService {
  /**
   * Returns true if the given (termId, sectionId, gradeId) combination is closed.
   * A section is closed if either:
   *  - the term is globally blocked (term.isBlocked === true), OR
   *  - a TermSectionClosure record exists for this (termId, sectionId, gradeId).
   */
  static async isSectionClosed(termId: number, sectionId: number, gradeId?: number, transaction?: Transaction): Promise<boolean> {
    const term = await Term.findByPk(termId, { attributes: ['id', 'isBlocked'], transaction });
    if (!term) return false;
    if (term.isBlocked) return true;
    if (!gradeId) return false;

    const closure = await TermSectionClosure.findOne({
      where: { termId, sectionId, gradeId },
      transaction,
    });
    return !!closure;
  }

  /**
   * Returns the list of closed section-grade pairs for the given term.
   * Returns null if the term is globally blocked (meaning ALL sections are closed).
   */
  static async getClosedSections(termId: number, transaction?: Transaction): Promise<{ sectionId: number; gradeId: number }[] | null> {
    const term = await Term.findByPk(termId, { attributes: ['id', 'isBlocked'], transaction });
    if (!term) return [];
    if (term.isBlocked) return null; // null = all closed

    const closures = await TermSectionClosure.findAll({
      where: { termId },
      attributes: ['sectionId', 'gradeId'],
      transaction,
    });
    return closures.map(c => ({ sectionId: c.sectionId, gradeId: c.gradeId }));
  }

  /**
   * Close a single section for a term (scoped by grade).
   */
  static async closeSection(params: {
    termId: number;
    sectionId: number;
    gradeId: number;
    closedBy?: number;
  }, transaction?: Transaction): Promise<TermSectionClosure> {
    const [closure] = await TermSectionClosure.findOrCreate({
      where: { termId: params.termId, sectionId: params.sectionId, gradeId: params.gradeId },
      defaults: {
        termId: params.termId,
        sectionId: params.sectionId,
        gradeId: params.gradeId,
        closedAt: new Date(),
        closedBy: params.closedBy ?? null,
      },
      transaction,
    });
    return closure;
  }

  /**
   * Reopen a single section for a term (scoped by grade).
   */
  static async reopenSection(termId: number, sectionId: number, gradeId: number, transaction?: Transaction): Promise<void> {
    await TermSectionClosure.destroy({
      where: { termId, sectionId, gradeId },
      transaction,
    });
  }

  /**
   * Returns the total number of sections (across all grades) for a school period.
   */
  static async getTotalSectionsForPeriod(schoolPeriodId: number, transaction?: Transaction): Promise<number> {
    const periodGrades = await PeriodGrade.findAll({
      where: { schoolPeriodId },
      attributes: ['id'],
      transaction,
    });
    const periodGradeIds = periodGrades.map(pg => pg.id);
    if (periodGradeIds.length === 0) return 0;

    const count = await PeriodGradeSection.count({
      where: { periodGradeId: periodGradeIds },
      transaction,
    });
    return count;
  }

  /**
   * Returns true if ALL sections of the school period are closed for the given term.
   */
  static async areAllSectionsClosed(termId: number, schoolPeriodId: number, transaction?: Transaction): Promise<boolean> {
    const term = await Term.findByPk(termId, { attributes: ['id', 'isBlocked'], transaction });
    if (!term) return false;
    if (term.isBlocked) return true;

    const [closedSections, totalSections] = await Promise.all([
      this.getClosedSections(termId, transaction),
      this.getTotalSectionsForPeriod(schoolPeriodId, transaction),
    ]);

    if (!closedSections) return true; // all closed (term globally blocked)
    if (totalSections === 0) return true; // no sections = vacuously true
    return closedSections.length >= totalSections;
  }

  /**
   * Returns true if ALL terms of the school period have all their sections closed.
   */
  static async areAllTermsFullyClosed(schoolPeriodId: number, transaction?: Transaction): Promise<boolean> {
    const terms = await Term.findAll({
      where: { schoolPeriodId },
      attributes: ['id', 'isBlocked'],
      transaction,
    });

    if (terms.length === 0) return true;

    for (const term of terms) {
      if (term.isBlocked) continue;
      const allClosed = await this.areAllSectionsClosed(term.id, schoolPeriodId, transaction);
      if (!allClosed) return false;
    }
    return true;
  }

  /**
   * Returns a summary of closure status for a term.
   */
  static async getClosureStatus(termId: number, schoolPeriodId: number, transaction?: Transaction): Promise<{
    closedSections: { sectionId: number; gradeId: number }[] | null;
    totalSections: number;
    allClosed: boolean;
    termGloballyBlocked: boolean;
  }> {
    const term = await Term.findByPk(termId, { attributes: ['id', 'isBlocked'], transaction });
    if (!term) {
      return { closedSections: [], totalSections: 0, allClosed: false, termGloballyBlocked: false };
    }

    const [closedSections, totalSections] = await Promise.all([
      this.getClosedSections(termId, transaction),
      this.getTotalSectionsForPeriod(schoolPeriodId, transaction),
    ]);

    const allClosed = closedSections === null || (totalSections > 0 && closedSections.length >= totalSections);

    return {
      closedSections,
      totalSections,
      allClosed,
      termGloballyBlocked: term.isBlocked,
    };
  }
}
