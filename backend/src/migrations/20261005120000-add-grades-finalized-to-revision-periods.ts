import { QueryInterface, DataTypes } from 'sequelize';

module.exports = {
  async up(queryInterface: QueryInterface) {
    await queryInterface.addColumn('revision_periods', 'gradesFinalized', {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.addColumn('revision_periods', 'gradesFinalizedAt', {
      type: DataTypes.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('revision_periods', 'gradesFinalizedBy', {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onDelete: 'SET NULL',
    });
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.removeColumn('revision_periods', 'gradesFinalizedBy');
    await queryInterface.removeColumn('revision_periods', 'gradesFinalizedAt');
    await queryInterface.removeColumn('revision_periods', 'gradesFinalized');
  },
};
