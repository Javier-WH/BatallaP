import { QueryInterface, DataTypes } from 'sequelize';

const ENUM_VALUES = ['regular', 'repitiente', 'materia_pendiente'];

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn('matriculations', 'escolaridad', {
      type: DataTypes.ENUM(...ENUM_VALUES),
      allowNull: false,
      defaultValue: 'regular'
    });

    await queryInterface.addColumn('inscriptions', 'escolaridad', {
      type: DataTypes.ENUM(...ENUM_VALUES),
      allowNull: false,
      defaultValue: 'regular'
    });

    await queryInterface.sequelize.query(
      `UPDATE matriculations SET escolaridad = 'regular' WHERE escolaridad IS NULL OR escolaridad = ''`
    );

    await queryInterface.sequelize.query(
      `UPDATE inscriptions SET escolaridad = 'regular' WHERE escolaridad IS NULL OR escolaridad = ''`
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn('inscriptions', 'escolaridad');
    await queryInterface.removeColumn('matriculations', 'escolaridad');

    await queryInterface.sequelize.query("DROP TYPE IF EXISTS \"enum_matriculations_escolaridad\" CASCADE;");
    await queryInterface.sequelize.query("DROP TYPE IF EXISTS \"enum_inscriptions_escolaridad\" CASCADE;");
  }
};
