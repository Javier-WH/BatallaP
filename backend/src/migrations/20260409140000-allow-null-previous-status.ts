import { QueryInterface, DataTypes } from 'sequelize';

export default {
  up: async (queryInterface: QueryInterface) => {
    // Allow NULL for previousStatus in grade_edit_audits table
    await queryInterface.changeColumn('grade_edit_audits', 'previousStatus', {
      type: DataTypes.ENUM('aprobada', 'reprobada'),
      allowNull: true,
    });
  },

  down: async (queryInterface: QueryInterface) => {
    // Revert to NOT NULL for previousStatus
    await queryInterface.changeColumn('grade_edit_audits', 'previousStatus', {
      type: DataTypes.ENUM('aprobada', 'reprobada'),
      allowNull: false,
    });
  }
};
