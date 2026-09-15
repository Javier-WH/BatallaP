/**
 * One-off backfill: re-evaluate existing Materia Pendiente SubjectFinalGrade
 * rows and re-tag them as 'revision_materia_pendiente' (M) when the grade was
 * obtained in the LAST established encounter (pending_subject_max_encounters).
 *
 * Rules:
 *  - PendingSubject approved: if the approving encounter (first passing,
 *    non-absent) is the last one -> gradeType='revision_materia_pendiente'.
 *  - PendingSubject never approved but the LAST encounter has a score
 *    (definitive failure) -> gradeType='revision_materia_pendiente'.
 *  - Otherwise -> 'materia_pendiente'.
 *
 * Run: npx ts-node -r tsconfig-paths/register fix_mp_revision_grades.ts
 */
import sequelize from './src/config/database';
import {
  PendingSubject,
  PendingSubjectEncounter,
  SubjectFinalGrade,
  Setting,
} from './src/models/index';
import { Op } from 'sequelize';

async function getSettingNumber(key: string, fallback: number): Promise<number> {
  const setting = await Setting.findOne({ where: { key } });
  if (setting) {
    const n = parseInt(String(setting.value), 10);
    if (Number.isFinite(n) && n >= 1) return n;
  }
  return fallback;
}

async function backfill() {
  const maxEnc = await getSettingNumber('pending_subject_max_encounters', 4);
  const passingGrade = await getSettingNumber('passing_grade', 10);
  console.log(`maxEncounters=${maxEnc}, passingGrade=${passingGrade}`);

  const pendings = await PendingSubject.findAll();
  console.log(`PendingSubjects: ${pendings.length}`);

  let toM = 0;
  let toP = 0;
  let unchanged = 0;
  let withoutGrade = 0;

  for (const pending of pendings) {
    const encounters = await PendingSubjectEncounter.findAll({
      where: { pendingSubjectId: pending.id },
      order: [['encounterNumber', 'ASC']],
    });

    // Determine the encounter the final grade came from
    let fromLastEncounter = false;
    if (pending.status === 'aprobada') {
      const approvedEnc = encounters.find(
        e => e.score != null && Number(e.score) >= passingGrade && !e.isAbsent
      );
      fromLastEncounter = !!approvedEnc && approvedEnc.encounterNumber === maxEnc;
    } else {
      // Never approved: if the last encounter was scored, the definitive
      // failure grade comes from it.
      const lastEnc = encounters.find(e => e.encounterNumber === maxEnc);
      fromLastEncounter = !!lastEnc && lastEnc.score != null;
    }

    const targetType = fromLastEncounter ? 'revision_materia_pendiente' : 'materia_pendiente';

    // Find the InscriptionSubject for this pending subject
    const { InscriptionSubject } = await import('./src/models/index');
    const insSubj = await InscriptionSubject.findOne({
      where: { inscriptionId: pending.newInscriptionId, subjectId: pending.subjectId },
    });
    if (!insSubj) {
      withoutGrade++;
      continue;
    }

    const mpGrade = await SubjectFinalGrade.findOne({
      where: {
        inscriptionSubjectId: insSubj.id,
        gradeType: { [Op.in]: ['materia_pendiente', 'revision_materia_pendiente'] },
      },
    });
    if (!mpGrade) {
      withoutGrade++;
      continue;
    }

    if (mpGrade.gradeType === targetType) {
      unchanged++;
      continue;
    }

    await mpGrade.update({ gradeType: targetType });
    if (targetType === 'revision_materia_pendiente') toM++;
    else toP++;
  }

  console.log(`\nResult:`);
  console.log(`  -> M (revision_materia_pendiente): ${toM}`);
  console.log(`  -> P (materia_pendiente): ${toP}`);
  console.log(`  unchanged: ${unchanged}`);
  console.log(`  without grade/inscriptionSubject: ${withoutGrade}`);

  await sequelize.close();
}

backfill().catch(err => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
