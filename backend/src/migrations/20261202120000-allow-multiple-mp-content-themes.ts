import { QueryInterface, DataTypes } from 'sequelize';

export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    // Add ordering column for multiple themes per pending subject
    const tableDesc: any = await queryInterface.describeTable('pending_subject_contents');
    if (!tableDesc.order) {
      await queryInterface.addColumn('pending_subject_contents', 'order', {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      });
    }

    // A pending subject may now have several themes — drop the old UNIQUE index
    // on pendingSubjectId (created by sequelize.sync before this migration).
    const dialect = queryInterface.sequelize.getDialect();

    if (dialect === 'mysql' || dialect === 'mariadb') {
      const [rows]: any = await queryInterface.sequelize.query(
        'SHOW INDEX FROM pending_subject_contents'
      );
      const uniqueNames = new Set<string>(
        (rows as any[])
          .filter((r) => r.Column_name === 'pendingSubjectId' && r.Non_unique === 0 && r.Key_name !== 'PRIMARY')
          .map((r) => r.Key_name)
      );
      if (uniqueNames.size > 0) {
        // MySQL requires an index backing the FK — create a non-unique one first
        const hasNonUnique = (rows as any[]).some(
          (r) => r.Column_name === 'pendingSubjectId' && r.Non_unique === 1
        );
        if (!hasNonUnique) {
          await queryInterface.addIndex('pending_subject_contents', {
            name: 'psc_pending_subject_id_idx',
            fields: ['pendingSubjectId'],
          });
        }
        for (const name of uniqueNames) {
          await queryInterface.removeIndex('pending_subject_contents', name);
        }
      }
    } else {
      // SQLite: inspect named indexes and drop the unique one
      const [idxRows]: any = await queryInterface.sequelize.query(
        'PRAGMA index_list("pending_subject_contents")'
      );
      for (const r of idxRows || []) {
        if (!r.unique) continue;
        const [cols]: any = await queryInterface.sequelize.query(
          `PRAGMA index_info("${r.name}")`
        );
        const colNames = (cols || []).map((c: any) => c.name);
        if (colNames.length === 1 && colNames[0] === 'pendingSubjectId') {
          await queryInterface.sequelize.query(`DROP INDEX IF EXISTS "${r.name}"`);
        }
      }
      // Ensure a plain index exists for lookups
      const [idxAfter]: any = await queryInterface.sequelize.query(
        'PRAGMA index_list("pending_subject_contents")'
      );
      let hasIdx = false;
      for (const r of idxAfter || []) {
        const [cols]: any = await queryInterface.sequelize.query(
          `PRAGMA index_info("${r.name}")`
        );
        if ((cols || []).some((c: any) => c.name === 'pendingSubjectId')) {
          hasIdx = true;
          break;
        }
      }
      if (!hasIdx) {
        await queryInterface.addIndex('pending_subject_contents', {
          name: 'psc_pending_subject_id_idx',
          fields: ['pendingSubjectId'],
        });
      }
    }
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    const tableDesc: any = await queryInterface.describeTable('pending_subject_contents');
    if (tableDesc.order) {
      await queryInterface.removeColumn('pending_subject_contents', 'order');
    }
    // Note: the UNIQUE index on pendingSubjectId is intentionally not restored —
    // rows may already contain multiple themes per subject.
  }
};
