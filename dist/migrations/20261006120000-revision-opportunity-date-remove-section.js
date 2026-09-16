"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    up(queryInterface) {
        return __awaiter(this, void 0, void 0, function* () {
            // Make sectionId nullable (no longer used in the unique index)
            yield queryInterface.sequelize.query(`
      ALTER TABLE revision_opportunity_dates MODIFY COLUMN sectionId INTEGER NULL
    `);
            // Create temporary indexes for FK columns so MySQL allows dropping the
            // composite unique index that currently serves as the FK index.
            yield queryInterface.sequelize.query(`
      CREATE INDEX idx_rev_opp_date_period ON revision_opportunity_dates (revisionPeriodId)
    `);
            yield queryInterface.sequelize.query(`
      CREATE INDEX idx_rev_opp_date_pgs ON revision_opportunity_dates (periodGradeSubjectId)
    `);
            // Drop the old unique index
            yield queryInterface.removeIndex('revision_opportunity_dates', 'uq_revision_opportunity_date');
            // Consolidate duplicate rows that now share (revisionPeriodId, periodGradeSubjectId, opportunity)
            yield queryInterface.sequelize.query(`
      DELETE r1 FROM revision_opportunity_dates r1
      INNER JOIN revision_opportunity_dates r2
      ON r1.revisionPeriodId = r2.revisionPeriodId
        AND r1.periodGradeSubjectId = r2.periodGradeSubjectId
        AND r1.opportunity = r2.opportunity
        AND r1.id < r2.id
    `);
            // Create new unique index without sectionId
            yield queryInterface.addIndex('revision_opportunity_dates', {
                fields: ['revisionPeriodId', 'periodGradeSubjectId', 'opportunity'],
                unique: true,
                name: 'uq_revision_opportunity_date',
            });
            // Drop the temporary FK indexes (the new unique index covers the FK columns)
            yield queryInterface.sequelize.query(`
      DROP INDEX idx_rev_opp_date_period ON revision_opportunity_dates
    `);
            yield queryInterface.sequelize.query(`
      DROP INDEX idx_rev_opp_date_pgs ON revision_opportunity_dates
    `);
        });
    },
    down(queryInterface) {
        return __awaiter(this, void 0, void 0, function* () {
            yield queryInterface.sequelize.query(`
      CREATE INDEX idx_rev_opp_date_period ON revision_opportunity_dates (revisionPeriodId)
    `);
            yield queryInterface.sequelize.query(`
      CREATE INDEX idx_rev_opp_date_pgs ON revision_opportunity_dates (periodGradeSubjectId)
    `);
            yield queryInterface.removeIndex('revision_opportunity_dates', 'uq_revision_opportunity_date');
            yield queryInterface.addIndex('revision_opportunity_dates', {
                fields: ['revisionPeriodId', 'periodGradeSubjectId', 'sectionId', 'opportunity'],
                unique: true,
                name: 'uq_revision_opportunity_date',
            });
            yield queryInterface.sequelize.query(`
      DROP INDEX idx_rev_opp_date_period ON revision_opportunity_dates
    `);
            yield queryInterface.sequelize.query(`
      DROP INDEX idx_rev_opp_date_pgs ON revision_opportunity_dates
    `);
        });
    },
};
