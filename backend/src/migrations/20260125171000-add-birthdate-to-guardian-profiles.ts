import { QueryInterface, DataTypes } from 'sequelize';

export default {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn('guardian_profiles', 'birthdate', {
      type: DataTypes.DATEONLY,
      allowNull: true,
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn('guardian_profiles', 'birthdate');
  },
};
