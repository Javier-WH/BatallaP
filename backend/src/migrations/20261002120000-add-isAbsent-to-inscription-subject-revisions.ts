import { QueryInterface, DataTypes } from 'sequelize';

export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    // Guard: column may already exist if created by sequelize.sync() before
    // migrations ran.
    const tableDesc: any = await queryInterface.describeTable('inscription_subject_revisions');
    if (!tableDesc.isAbsent) {
      await queryInterface.addColumn('inscription_subject_revisions', 'isAbsent', {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    const tableDesc: any = await queryInterface.describeTable('inscription_subject_revisions');
    if (tableDesc.isAbsent) {
      await queryInterface.removeColumn('inscription_subject_revisions', 'isAbsent');
    }
  }
};
