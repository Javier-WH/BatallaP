/**
 * rosterNumberService — keeps `Inscription.rosterNumber` in sync.
 *
 * The roster number is the student's 1-based position in their section under
 * the canonical nomina order (compareStudents: document type → document
 * number → surname → name). It is recomputed on every roster change:
 * enrollment, withdrawal, section/grade moves and student data edits that
 * can shift the order. Withdrawn inscriptions keep NULL — they are off the
 * list, so every number is free to change when the roster changes.
 */
import { Transaction } from 'sequelize';
import { Inscription, Person } from '@/models';
import { compareStudents } from '@/services/studentSortService';

export interface RosterScope {
  schoolPeriodId: number;
  gradeId: number;
  sectionId: number | null;
}

/** Recompute rosterNumber for one section (canonical order, actives only). */
export async function renumberSectionRoster(
  schoolPeriodId: number,
  gradeId: number,
  sectionId: number | null,
  t?: Transaction
): Promise<void> {
  if (!sectionId) return;
  const list = await Inscription.findAll({
    where: { schoolPeriodId, gradeId, sectionId },
    include: [{ model: Person, as: 'student' }],
    transaction: t,
  });
  (list as any[]).sort((a, b) => compareStudents(a.student ?? {}, b.student ?? {}));
  let n = 0;
  for (const ins of list as any[]) {
    const target: number | null = ins.withdrawnAt ? null : ++n;
    if ((ins.rosterNumber ?? null) !== target) {
      await ins.update({ rosterNumber: target }, { transaction: t });
    }
  }
}

/** Renumber several sections at once (deduplicated). */
export async function renumberRosters(scopes: RosterScope[], t?: Transaction): Promise<void> {
  const seen = new Set<string>();
  for (const s of scopes) {
    if (!s.sectionId) continue;
    const key = `${s.schoolPeriodId}|${s.gradeId}|${s.sectionId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    await renumberSectionRoster(s.schoolPeriodId, s.gradeId, s.sectionId, t);
  }
}

/** Snapshot of an inscription's roster scope — capture BEFORE mutating it. */
export const rosterScopeOf = (ins: {
  schoolPeriodId: number;
  gradeId: number;
  sectionId: number | null;
}): RosterScope => ({
  schoolPeriodId: ins.schoolPeriodId,
  gradeId: ins.gradeId,
  sectionId: ins.sectionId,
});

/**
 * Renumber every section where a person holds an inscription — needed when
 * name/document edits change their canonical position.
 */
export async function renumberSectionsForPerson(personId: number, t?: Transaction): Promise<void> {
  const list = await Inscription.findAll({
    where: { personId },
    attributes: ['schoolPeriodId', 'gradeId', 'sectionId'],
    transaction: t,
  });
  await renumberRosters(
    (list as any[])
      .filter(i => i.sectionId != null)
      .map(i => ({ schoolPeriodId: i.schoolPeriodId, gradeId: i.gradeId, sectionId: i.sectionId })),
    t
  );
}
