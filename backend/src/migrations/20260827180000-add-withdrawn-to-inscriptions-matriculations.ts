import { QueryInterface, DataTypes } from 'sequelize';

export default {
  up: async (queryInterface: QueryInterface) => {
    // 1. Add withdrawnAt to inscriptions
    await queryInterface.addColumn('inscriptions', 'withdrawnAt', {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null
    });

    // 2. Add 'withdrawn' to matriculations status ENUM
    // MySQL requires re-specifying the full ENUM
    await queryInterface.changeColumn('matriculations', 'status', {
      type: DataTypes.ENUM('pending', 'completed', 'withdrawn'),
      allowNull: false,
      defaultValue: 'pending'
    });
  },

  down: async (queryInterface: QueryInterface) => {
    // Revert matriculations status ENUM (remove 'withdrawn')
    await queryInterface.changeColumn('matriculations', 'status', {
      type: DataTypes.ENUM('pending', 'completed'),
      allowNull: false,
      defaultValue: 'pending'
    });

    await queryInterface.removeColumn('inscriptions', 'withdrawnAt');
  }
};
