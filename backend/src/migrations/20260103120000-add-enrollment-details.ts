
import { QueryInterface, DataTypes } from 'sequelize';

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // Add columns to people
      await queryInterface.addColumn('people', 'pathology', {
        type: DataTypes.TEXT,
        allowNull: true
      }, { transaction });

      await queryInterface.addColumn('people', 'livingWith', {
        type: DataTypes.STRING,
        allowNull: true
      }, { transaction });

      // Add columns to guardian_profiles
      await queryInterface.addColumn('guardian_profiles', 'occupation', {
        type: DataTypes.STRING,
        allowNull: true
      }, { transaction });

      // Add columns to person_residences
      await queryInterface.addColumn('person_residences', 'address', {
        type: DataTypes.TEXT,
        allowNull: true
      }, { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  down: async (queryInterface: QueryInterface) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.removeColumn('people', 'pathology', { transaction });
      await queryInterface.removeColumn('people', 'livingWith', { transaction });
      await queryInterface.removeColumn('guardian_profiles', 'occupation', { transaction });
      await queryInterface.removeColumn('person_residences', 'address', { transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
