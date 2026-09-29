/**
 * cleanGroupSubjects.ts
 *
 * Limpieza única de materias de grupo duplicadas. El cierre de período
 * inscribía a los promovidos en TODAS las materias de cada SubjectGroup, así
 * que los profesores de materias de grupo veían la sección completa.
 *
 * Para cada inscripción del período, y cada grupo de materias que toca:
 *   - Si existe InscriptionGroupTermChoice, se conserva la materia elegida
 *     (la del lapso más reciente) y se garantiza su InscriptionSubject.
 *   - Sin elección, se conserva la inscripción que tenga notas
 *     (qualifications / finalGrades / councilPoints).
 *   - Las demás InscriptionSubject del grupo se eliminan, siempre que no
 *     tengan notas ni una PendingSubject que las referencie. Las que tengan
 *     datos se conservan y se reportan para revisión manual.
 *
 * Sin elección ni notas, el estudiante queda sin materia de grupo — el mismo
 * estado en que queda al cerrar un período — hasta que se le asigne una.
 *
 * Uso:
 *   npx ts-node -r tsconfig-paths/register src/scripts/cleanGroupSubjects.ts            → dry-run del período activo
 *   npx ts-node -r tsconfig-paths/register src/scripts/cleanGroupSubjects.ts --apply    → aplica los cambios
 *   npx ts-node -r tsconfig-paths/register src/scripts/cleanGroupSubjects.ts --period=3 --apply
 */
import sequelize from '@/config/database';
import {
  Inscription,
  InscriptionSubject,
  InscriptionGroupTermChoice,
  PendingSubject,
  Qualification,
  Subject,
  SubjectFinalGrade,
  CouncilPoint,
  SchoolPeriod,
  Term,
} from '@/models/index';

const APPLY = process.argv.includes('--apply');
const periodArg = process.argv.find(a => a.startsWith('--period='));
const PERIOD_ID = periodArg ? Number(periodArg.split('=')[1]) : null;

async function main() {
  await sequelize.authenticate();

  const period = PERIOD_ID
    ? await SchoolPeriod.findByPk(PERIOD_ID)
    : await SchoolPeriod.findOne({ where: { status: 'activo' } });
  if (!period) {
    console.error('No se encontró el período (activo o --period=N).');
    process.exit(1);
  }
  console.log(`Período: ${period.id} ${(period as any).name ?? ''} | modo: ${APPLY ? 'APLICAR' : 'DRY-RUN'}`);

  const terms = await Term.findAll({
    where: { schoolPeriodId: period.id },
    attributes: ['id', 'order'],
    raw: true,
  });
  const termOrder = new Map<number, number>((terms as any[]).map(t => [t.id, t.order]));

  const inscriptions = await Inscription.findAll({
    where: { schoolPeriodId: period.id },
    attributes: ['id', 'personId', 'schoolPeriodId', 'gradeId', 'sectionId', 'escolaridad'],
  });
  console.log(`Inscripciones: ${inscriptions.length}`);

  const t = await sequelize.transaction();
  try {
    let deleted = 0;
    let created = 0;
    let keptWithGrades = 0;
    let cleanedGroups = 0;

    for (const ins of inscriptions as any[]) {
      const enrollments = await InscriptionSubject.findAll({
        where: { inscriptionId: ins.id },
        include: [
          { model: Subject, as: 'subject', attributes: ['id', 'name', 'subjectGroupId'] },
          { model: Qualification, as: 'qualifications', attributes: ['id'], required: false },
          { model: SubjectFinalGrade, as: 'finalGrades', attributes: ['id'], required: false },
          { model: CouncilPoint, as: 'councilPoints', attributes: ['id'], required: false },
        ],
        transaction: t,
      });
      const groupEnrollments = (enrollments as any[]).filter(e => e.subject?.subjectGroupId != null);

      const choices = await InscriptionGroupTermChoice.findAll({
        where: { inscriptionId: ins.id },
        attributes: ['subjectGroupId', 'termId', 'subjectId'],
        transaction: t,
      });

      const groupIds = new Set<number>();
      for (const e of groupEnrollments) groupIds.add(e.subject.subjectGroupId);
      for (const c of choices as any[]) groupIds.add(c.subjectGroupId);

      for (const gid of groupIds) {
        const rows = groupEnrollments.filter(e => e.subject.subjectGroupId === gid);

        // Latest-term explicit choice wins; otherwise an enrollment holding
        // grades; otherwise nothing (student keeps no group subject).
        const groupChoices = (choices as any[])
          .filter(c => c.subjectGroupId === gid)
          .sort((a, b) => (termOrder.get(b.termId) ?? 0) - (termOrder.get(a.termId) ?? 0));
        let keptSubjectId: number | null = groupChoices[0]?.subjectId ?? null;
        if (keptSubjectId == null) {
          const withGrades = rows.find(e =>
            (e.qualifications?.length ?? 0) > 0 ||
            (e.finalGrades?.length ?? 0) > 0 ||
            (e.councilPoints?.length ?? 0) > 0
          );
          keptSubjectId = withGrades?.subjectId ?? null;
        }

        if (keptSubjectId != null && !rows.some(e => e.subjectId === keptSubjectId)) {
          created++;
          if (APPLY) {
            await InscriptionSubject.create({
              inscriptionId: ins.id,
              subjectId: keptSubjectId,
              schoolPeriodId: ins.schoolPeriodId,
              gradeId: ins.gradeId,
              sectionId: ins.sectionId,
            } as any, { transaction: t });
          }
        }

        const pendingRefs = await PendingSubject.findAll({
          where: { newInscriptionId: ins.id, subjectId: rows.map(e => e.subjectId) },
          attributes: ['subjectId'],
          transaction: t,
        });
        const pendingSubjectIds = new Set((pendingRefs as any[]).map(p => p.subjectId));

        for (const e of rows) {
          if (e.subjectId === keptSubjectId) continue;
          const hasGrades =
            (e.qualifications?.length ?? 0) > 0 ||
            (e.finalGrades?.length ?? 0) > 0 ||
            (e.councilPoints?.length ?? 0) > 0;
          if (hasGrades || pendingSubjectIds.has(e.subjectId)) {
            keptWithGrades++;
            console.log(
              `   ⚠️ conservada (tiene datos): inscripción ${ins.id} → ${e.subject.name}` +
              ` (grupo ${gid}${hasGrades ? ', notas' : ''}${pendingSubjectIds.has(e.subjectId) ? ', pendiente' : ''})`
            );
            continue;
          }
          deleted++;
          if (APPLY) await e.destroy({ transaction: t });
        }

        if (rows.length > 1 || (keptSubjectId == null && rows.length > 0)) cleanedGroups++;
      }
    }

    if (APPLY) {
      await t.commit();
      console.log(`\n✅ Aplicado: ${deleted} inscripciones de grupo eliminadas, ${created} creadas, ${keptWithGrades} conservadas por tener datos (${cleanedGroups} grupos revisados).`);
    } else {
      await t.rollback();
      console.log(`\nDRY-RUN: se eliminarían ${deleted} inscripciones de grupo, se crearían ${created}, se conservarían ${keptWithGrades} por tener datos (${cleanedGroups} grupos).`);
      console.log('Ejecuta con --apply para aplicar.');
    }
  } catch (error) {
    await t.rollback();
    throw error;
  } finally {
    await sequelize.close();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
