import { QueryInterface, DataTypes } from 'sequelize';

export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.addColumn('guardian_profiles', 'phone2', {
      type: DataTypes.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('guardian_profiles', 'whatsapp', {
      type: DataTypes.STRING,
      allowNull: true,
    });
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.removeColumn('guardian_profiles', 'whatsapp');
    await queryInterface.removeColumn('guardian_profiles', 'phone2');
  }
};
