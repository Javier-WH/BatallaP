/**
 * One-shot rollback of the PeriodClosure executed on 2026-09-17 for
 * schoolPeriodId=2 (2025-2026) into schoolPeriodId=3 (2026-2027).
 *
 * Reverts, in a single transaction:
 *  - Inscriptions created in the next period (originPeriodId=2) + their
 *    InscriptionSubjects, PendingSubjects and any grade rows.
 *  - Matriculations created by the closure in the next period; pre-existing
 *    pre-inscriptions are reset to 'pending' (no section, no inscription link).
 *  - StudentPeriodOutcome rows generated for period-2 inscriptions.
 *  - PendingSubjects marked 'aprobada' during the closure → back to 'pendiente'.
 *  - SubjectFinalGrade rows created (frozen) during the closure.
 *  - The PeriodClosure record itself (re-enables the closure UI).
 *  - RevisionPeriod back to 'closed' (required by validateClosure).
 *  - SchoolPeriod statuses (2=activo, 3=preinscripcion).
 *
 * Kept on purpose: cloned academic structure in period 3, the MP section,
 * term/council closures — all part of the normal pre-closure state.
 */
import sequelize from './src/config/database';
import './src/models/index';
import { Op } from 'sequelize';
import SchoolPeriod from './src/models/SchoolPeriod';
import Matriculation from './src/models/Matriculation';
import Inscription from './src/models/Inscription';
import InscriptionSubject from './src/models/InscriptionSubject';
import PendingSubject from './src/models/PendingSubject';
import PeriodClosure from './src/models/PeriodClosure';
import StudentPeriodOutcome from './src/models/StudentPeriodOutcome';
import SubjectFinalGrade from './src/models/SubjectFinalGrade';
import RevisionPeriod from './src/models/RevisionPeriod';
import Qualification from './src/models/Qualification';
import CouncilPoint from './src/models/CouncilPoint';
import EnrollmentDocument from './src/models/EnrollmentDocument';
import EnrollmentReport from './src/models/EnrollmentReport';

const PERIOD_ID = 2;
const NEXT_PERIOD_ID = 3;

async function run() {
  const t = await sequelize.transaction();
  try {
    const closure = await PeriodClosure.findOne({
      where: { schoolPeriodId: PERIOD_ID },
      order: [['id', 'DESC']],
      transaction: t,
    });
    if (!closure) throw new Error('No PeriodClosure record found for period 2 — nothing to roll back');
    const startedAt = closure.startedAt as Date;
    const finishedAt = (closure.finishedAt as Date) ?? new Date();
    console.log(`[rollback] closure id=${closure.id} window ${startedAt.toISOString()} → ${finishedAt.toISOString()}`);

    // 1) Inscriptions created by the closure in the next period
    const newInscriptions = await Inscription.findAll({
      where: { schoolPeriodId: NEXT_PERIOD_ID, originPeriodId: PERIOD_ID },
      attributes: ['id'],
      transaction: t,
    });
    const newInsIds = newInscriptions.map(i => i.id);
    console.log(`[rollback] next-period inscriptions created by closure: ${newInsIds.length}`);

    // 2) Their InscriptionSubjects (+ defensive dependents)
    const newInsSubjects = await InscriptionSubject.findAll({
      where: { inscriptionId: { [Op.in]: newInsIds } },
      attributes: ['id'],
      transaction: t,
    });
    const newIsIds = newInsSubjects.map(i => i.id);
    const [qDel, cpDel, sfgDel] = await Promise.all([
      Qualification.destroy({ where: { inscriptionSubjectId: { [Op.in]: newIsIds } }, transaction: t }),
      CouncilPoint.destroy({ where: { inscriptionSubjectId: { [Op.in]: newIsIds } }, transaction: t }),
      SubjectFinalGrade.destroy({ where: { inscriptionSubjectId: { [Op.in]: newIsIds } }, transaction: t }),
    ]);
    console.log(`[rollback] next-period grade rows removed: qualifications=${qDel} councilPoints=${cpDel} finalGrades=${sfgDel}`);

    // 3) PendingSubjects attached to the new inscriptions
    const psDel = await PendingSubject.destroy({
      where: { newInscriptionId: { [Op.in]: newInsIds } },
      transaction: t,
    });
    console.log(`[rollback] pending subjects on new inscriptions removed: ${psDel}`);

    // 4) InscriptionSubjects + Inscriptions of the next period
    const isDel = await InscriptionSubject.destroy({
      where: { inscriptionId: { [Op.in]: newInsIds } },
      transaction: t,
    });
    console.log(`[rollback] next-period inscription subjects removed: ${isDel}`);

    // 5) Matriculations in the next period
    const closureMatriculations = await Matriculation.findAll({
      where: { schoolPeriodId: NEXT_PERIOD_ID, createdAt: { [Op.gte]: startedAt } },
      transaction: t,
    });
    const closureMatIds = closureMatriculations.map(m => m.id);
    const [docs, reports] = await Promise.all([
      EnrollmentDocument.count({ where: { matriculationId: { [Op.in]: closureMatIds } }, transaction: t }),
      EnrollmentReport.count({ where: { matriculationId: { [Op.in]: closureMatIds } }, transaction: t }),
    ]);
    if (docs + reports > 0) {
      throw new Error(`Abort: ${docs} documents / ${reports} reports reference closure-created matriculations`);
    }
    const matDel = await Matriculation.destroy({
      where: { schoolPeriodId: NEXT_PERIOD_ID, createdAt: { [Op.gte]: startedAt } },
      transaction: t,
    });
    console.log(`[rollback] next-period matriculations created by closure removed: ${matDel}`);

    // Pre-inscriptions that were repointed to a now-deleted inscription → back to No Matriculados
    const repointed = await Matriculation.update(
      { status: 'pending', sectionId: null, inscriptionId: null, escolaridad: 'regular' },
      {
        where: {
          schoolPeriodId: NEXT_PERIOD_ID,
          createdAt: { [Op.lt]: startedAt },
          inscriptionId: { [Op.in]: newInsIds },
        },
        transaction: t,
      },
    );
    console.log(`[rollback] pre-inscriptions reset to pending: ${repointed[0]}`);

    // 6) Now delete the next-period inscriptions
    const insDel = await Inscription.destroy({
      where: { id: { [Op.in]: newInsIds } },
      transaction: t,
    });
    console.log(`[rollback] next-period inscriptions removed: ${insDel}`);

    // 7) Outcomes generated for period-2 inscriptions
    const period2Ins = await Inscription.findAll({
      where: { schoolPeriodId: PERIOD_ID },
      attributes: ['id'],
      transaction: t,
    });
    const p2InsIds = period2Ins.map(i => i.id);
    const outcomesDel = await StudentPeriodOutcome.destroy({
      where: { inscriptionId: { [Op.in]: p2InsIds } },
      transaction: t,
    });
    console.log(`[rollback] period-2 outcomes removed: ${outcomesDel}`);

    // 8) PendingSubjects resolved during the closure → back to pendiente
    const psReverted = await PendingSubject.update(
      { status: 'pendiente', resolvedAt: null },
      {
        where: {
          newInscriptionId: { [Op.in]: p2InsIds },
          status: 'aprobada',
          resolvedAt: { [Op.between]: [startedAt, finishedAt] },
        },
        transaction: t,
      },
    );
    console.log(`[rollback] pending subjects reverted to pendiente: ${psReverted[0]}`);

    // 9) SubjectFinalGrades frozen during the closure (only rows created then)
    const p2Is = await InscriptionSubject.findAll({
      where: { inscriptionId: { [Op.in]: p2InsIds } },
      attributes: ['id'],
      transaction: t,
    });
    const p2IsIds = p2Is.map(i => i.id);
    const frozenDel = await SubjectFinalGrade.destroy({
      where: {
        inscriptionSubjectId: { [Op.in]: p2IsIds },
        createdAt: { [Op.gte]: startedAt },
      },
      transaction: t,
    });
    console.log(`[rollback] frozen final grades created by closure removed: ${frozenDel}`);

    // 10) The closure record itself
    await closure.destroy({ transaction: t });
    console.log('[rollback] PeriodClosure record removed');

    // 11) Revision period → closed (required by validateClosure)
    const rev = await RevisionPeriod.findOne({ where: { schoolPeriodId: PERIOD_ID }, transaction: t });
    if (rev && rev.status !== 'closed') {
      await rev.update({ status: 'closed', closedAt: new Date() }, { transaction: t });
      console.log(`[rollback] revision period ${rev.status} → closed`);
    }

    // 12) Period statuses
    await SchoolPeriod.update({ status: 'activo' }, { where: { id: PERIOD_ID }, transaction: t });
    await SchoolPeriod.update({ status: 'preinscripcion' }, { where: { id: NEXT_PERIOD_ID }, transaction: t });
    console.log('[rollback] period statuses: 2=activo, 3=preinscripcion');

    await t.commit();
    console.log('[rollback] COMMITTED');
  } catch (err) {
    await t.rollback();
    console.error('[rollback] ROLLED BACK —', err);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

run();
