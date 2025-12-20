import { QueryInterface, DataTypes } from 'sequelize';

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.changeColumn('roles', 'name', {
      type: DataTypes.STRING(30), // Increased from default length to accommodate longer role names
      allowNull: false,
      unique: true
    });
  },

  down: async (queryInterface: QueryInterface) => {
    // Revert to the original column definition if needed
    await queryInterface.changeColumn('roles', 'name', {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    });
  }
};
