import { QueryInterface, DataTypes } from 'sequelize';

// The benefactor is whoever pays for the student when that is not (only) the
// legal representative: a parent/representative flagged `isBenefactor`, or a
// third person linked with relationship 'benefactor'.
export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    const columns = await queryInterface.describeTable('student_guardians');
    if (!columns.isBenefactor) {
      await queryInterface.addColumn('student_guardians', 'isBenefactor', {
        type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false,
      });
    }
    if (queryInterface.sequelize.getDialect() === 'mysql') {
      await queryInterface.sequelize.query(
        "ALTER TABLE `student_guardians` MODIFY COLUMN `relationship` ENUM('mother','father','sibling','grandparent','uncle_aunt','representative','benefactor') NOT NULL"
      );
    }
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.sequelize.query("DELETE FROM `student_guardians` WHERE `relationship` = 'benefactor'");
    if (queryInterface.sequelize.getDialect() === 'mysql') {
      await queryInterface.sequelize.query(
        "ALTER TABLE `student_guardians` MODIFY COLUMN `relationship` ENUM('mother','father','sibling','grandparent','uncle_aunt','representative') NOT NULL"
      );
    }
    await queryInterface.removeColumn('student_guardians', 'isBenefactor');
  },
};
