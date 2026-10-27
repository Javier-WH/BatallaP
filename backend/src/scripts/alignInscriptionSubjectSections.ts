/**
 * alignInscriptionSubjectSections.ts
 *
 * One-off repair: every active inscription with a section gets its subjects
 * (`inscription_subjects.sectionId`) moved to that section. Fixes students that
 * changed section and vanished from the grade lists / "Acta de Notas" of the new
 * one. Grades follow their student (they hang from the subject row).
 * Safe to re-run (idempotent). Pass --dry-run to only count.
 *
 *   node dist/scripts/alignInscriptionSubjectSections.js [--dry-run]
 *   npx ts-node -r tsconfig-paths/register src/scripts/alignInscriptionSubjectSections.ts [--dry-run]
 */
import sequelize from '@/config/database';
import { Op } from 'sequelize';
import { Inscription, InscriptionSubject } from '@/models/index';
import { alignSubjectSections } from '@/services/inscriptionSubjectSectionService';

(async () => {
  if (process.argv.includes('--dry-run')) {
    const activeWithSection: Record<string, unknown> = { withdrawnAt: null, sectionId: { [Op.ne]: null } };
    const inscriptions = await Inscription.findAll({ where: activeWithSection, attributes: ['id', 'sectionId'] });
    let stale = 0;
    const affected = new Set<number>();
    for (const ins of inscriptions) {
      const count = await InscriptionSubject.count({
        where: { inscriptionId: ins.id, [Op.or]: [{ sectionId: null }, { sectionId: { [Op.ne]: ins.sectionId as number } }] },
      });
      if (count > 0) { stale += count; affected.add(ins.id); }
    }
    console.log(`[align-sections] dry run: ${stale} subject row(s) out of section, ${affected.size} inscription(s)`);
  } else {
    const changed = await alignSubjectSections();
    console.log(`[align-sections] ${changed} subject row(s) moved to their inscription's section`);
  }
  await sequelize.close();
})().catch(e => { console.error(e); process.exit(1); });
