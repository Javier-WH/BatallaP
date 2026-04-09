import { QueryInterface, DataTypes } from 'sequelize';

export default {
  up: async (queryInterface: QueryInterface) => {
    // Allow NULL for phone1 and address in contacts table
    await queryInterface.changeColumn('contacts', 'phone1', {
      type: DataTypes.STRING,
      allowNull: true,
    });

    await queryInterface.changeColumn('contacts', 'address', {
      type: DataTypes.TEXT,
      allowNull: true,
    });
  },

  down: async (queryInterface: QueryInterface) => {
    // Revert to NOT NULL for phone1 and address
    await queryInterface.changeColumn('contacts', 'phone1', {
      type: DataTypes.STRING,
      allowNull: false,
    });

    await queryInterface.changeColumn('contacts', 'address', {
      type: DataTypes.TEXT,
      allowNull: false,
    });
  }
};
