import { QueryInterface } from 'sequelize';

export default {
  async up(queryInterface: QueryInterface) {
    // Make sectionId nullable (no longer used in the unique index)
    await queryInterface.sequelize.query(`
      ALTER TABLE revision_opportunity_dates MODIFY COLUMN sectionId INTEGER NULL
    `);

    // Create temporary indexes for FK columns so MySQL allows dropping the
    // composite unique index that currently serves as the FK index.
    await queryInterface.sequelize.query(`
      CREATE INDEX idx_rev_opp_date_period ON revision_opportunity_dates (revisionPeriodId)
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX idx_rev_opp_date_pgs ON revision_opportunity_dates (periodGradeSubjectId)
    `);

    // Drop the old unique index
    await queryInterface.removeIndex('revision_opportunity_dates', 'uq_revision_opportunity_date');

    // Consolidate duplicate rows that now share (revisionPeriodId, periodGradeSubjectId, opportunity)
    await queryInterface.sequelize.query(`
      DELETE r1 FROM revision_opportunity_dates r1
      INNER JOIN revision_opportunity_dates r2
      ON r1.revisionPeriodId = r2.revisionPeriodId
        AND r1.periodGradeSubjectId = r2.periodGradeSubjectId
        AND r1.opportunity = r2.opportunity
        AND r1.id < r2.id
    `);

    // Create new unique index without sectionId
    await queryInterface.addIndex('revision_opportunity_dates', {
      fields: ['revisionPeriodId', 'periodGradeSubjectId', 'opportunity'],
      unique: true,
      name: 'uq_revision_opportunity_date',
    });

    // Drop the temporary FK indexes (the new unique index covers the FK columns)
    await queryInterface.sequelize.query(`
      DROP INDEX idx_rev_opp_date_period ON revision_opportunity_dates
    `);
    await queryInterface.sequelize.query(`
      DROP INDEX idx_rev_opp_date_pgs ON revision_opportunity_dates
    `);
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.sequelize.query(`
      CREATE INDEX idx_rev_opp_date_period ON revision_opportunity_dates (revisionPeriodId)
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX idx_rev_opp_date_pgs ON revision_opportunity_dates (periodGradeSubjectId)
    `);
    await queryInterface.removeIndex('revision_opportunity_dates', 'uq_revision_opportunity_date');
    await queryInterface.addIndex('revision_opportunity_dates', {
      fields: ['revisionPeriodId', 'periodGradeSubjectId', 'sectionId', 'opportunity'],
      unique: true,
      name: 'uq_revision_opportunity_date',
    });
    await queryInterface.sequelize.query(`
      DROP INDEX idx_rev_opp_date_period ON revision_opportunity_dates
    `);
    await queryInterface.sequelize.query(`
      DROP INDEX idx_rev_opp_date_pgs ON revision_opportunity_dates
    `);
  },
};
