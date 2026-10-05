import { QueryInterface, DataTypes } from 'sequelize';

export default {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn('constancia_templates', 'margin', {
      type: DataTypes.STRING(16),
      allowNull: false,
      defaultValue: '1in',
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn('constancia_templates', 'margin');
  },
};
