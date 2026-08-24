import { QueryInterface, DataTypes } from 'sequelize';

// Records which subject (within a SubjectGroup) a student is taking during a
// specific Term. Only applies to grouped subjects (Subject.subjectGroupId != null).
//
// Source of truth for "Música in L1, Danza in L2-L3" without losing L1 notes.
// The data is backfilled by seedChoicesForPeriod() after the table is created.

export async function up(queryInterface: QueryInterface) {
  // Guard: table may already exist if created by sequelize.sync() before
  // migrations ran. Skip createTable if so, but still run the backfill.
  const tables: any = await queryInterface.showAllTables();
  if (!tables.includes('inscription_group_term_choices')) {
    await queryInterface.createTable('inscription_group_term_choices', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    inscriptionId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'inscriptions', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    subjectGroupId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'subject_groups', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    termId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'terms', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    subjectId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'subjects', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  });

    await queryInterface.addIndex(
      'inscription_group_term_choices',
      ['inscriptionId', 'subjectGroupId', 'termId'],
      { unique: true, name: 'inscription_group_term_choices_unique_choice' }
    );
  } // end if (!tables.includes)

  // Backfill: for every existing InscriptionSubject with a subjectGroupId,
  // create a choice record for every term of the inscription's school period.
  // The subject the student is currently enrolled in is the one we assign to
  // all terms (per the agreed migration policy: "asigna la materia actual").
  const [inscriptions]: any = await queryInterface.sequelize.query(`
    SELECT i.id AS inscriptionId, i.schoolPeriodId, isub.subjectId, s.subjectGroupId
    FROM inscriptions i
    JOIN inscription_subjects isub ON isub.inscriptionId = i.id
    JOIN subjects s ON s.id = isub.subjectId
    WHERE s.subjectGroupId IS NOT NULL
  `);

  const rows: any[] = [];
  for (const ins of inscriptions) {
    const [terms]: any = await queryInterface.sequelize.query(
      `SELECT id FROM terms WHERE schoolPeriodId = ? ORDER BY \`order\` ASC`,
      { replacements: [ins.schoolPeriodId] }
    );
    for (const term of terms) {
      rows.push({
        inscriptionId: ins.inscriptionId,
        subjectGroupId: ins.subjectGroupId,
        termId: term.id,
        subjectId: ins.subjectId,
      });
    }
  }

  if (rows.length > 0) {
    // Insert in chunks to avoid MySQL max_allowed_packet issues on large datasets.
    // Include timestamps explicitly because MySQL strict mode rejects NULL on
    // NOT NULL columns without a DEFAULT clause.
    const now = new Date();
    const chunkSize = 500;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize).map(r => ({
        ...r,
        createdAt: now,
        updatedAt: now,
      }));
      await queryInterface.bulkInsert('inscription_group_term_choices', chunk);
    }
  }
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.dropTable('inscription_group_term_choices');
}
