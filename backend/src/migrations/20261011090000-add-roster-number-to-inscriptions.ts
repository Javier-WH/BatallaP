import { QueryInterface, DataTypes } from 'sequelize';

// Mirrors compareStudents() in studentSortService — keep in sync.
const DOC_TYPE_PRIORITY: Record<string, number> = {
  Venezolano: 0,
  'Cedula Escolar': 1,
  Pasaporte: 2,
  Extranjero: 3,
};
const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true });
const numDoc = (doc?: string | null) => {
  const n = parseInt((doc ?? '').replace(/\D/g, ''), 10);
  return Number.isNaN(n) ? 0 : n;
};
const cmpStr = (a?: string | null, b?: string | null) =>
  collator.compare((a ?? '').trim(), (b ?? '').trim());

export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    const desc: any = await queryInterface.describeTable('inscriptions');
    if (!desc.rosterNumber) {
      await queryInterface.addColumn('inscriptions', 'rosterNumber', {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      });
    }

    // Backfill: rosterNumber = canonical position within each section's
    // ACTIVE inscriptions (withdrawn keep NULL — they are off the list).
    const [rows]: any = await queryInterface.sequelize.query(
      `SELECT i.id, i.schoolPeriodId, i.gradeId, i.sectionId, i.withdrawnAt,
              p.documentType, p.document, p.firstName, p.lastName
       FROM inscriptions i
       JOIN people p ON p.id = i.personId
       WHERE i.sectionId IS NOT NULL`
    );

    const groups = new Map<string, any[]>();
    for (const r of rows as any[]) {
      const key = `${r.schoolPeriodId}|${r.gradeId}|${r.sectionId}`;
      (groups.get(key) ?? groups.set(key, []).get(key)!).push(r);
    }

    for (const members of groups.values()) {
      members.sort((a, b) =>
        ((DOC_TYPE_PRIORITY[a.documentType] ?? 99) - (DOC_TYPE_PRIORITY[b.documentType] ?? 99))
        || (numDoc(a.document) - numDoc(b.document))
        || cmpStr(a.lastName, b.lastName)
        || cmpStr(a.firstName, b.firstName)
        || (a.id - b.id));
      let n = 0;
      for (const m of members) {
        const target = m.withdrawnAt ? null : ++n;
        await queryInterface.sequelize.query(
          `UPDATE inscriptions SET rosterNumber = ${target === null ? 'NULL' : target} WHERE id = ${m.id}`
        );
      }
    }
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.removeColumn('inscriptions', 'rosterNumber');
  },
};
