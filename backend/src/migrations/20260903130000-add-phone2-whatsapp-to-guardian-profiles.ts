import { QueryInterface, DataTypes } from 'sequelize';

export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    // Guard: columns may already exist if created by sequelize.sync() before
    // migrations ran.
    const tableDesc: any = await queryInterface.describeTable('guardian_profiles');
    if (!tableDesc.phone2) {
      await queryInterface.addColumn('guardian_profiles', 'phone2', {
        type: DataTypes.STRING,
        allowNull: true,
      });
    }
    if (!tableDesc.whatsapp) {
      await queryInterface.addColumn('guardian_profiles', 'whatsapp', {
        type: DataTypes.STRING,
        allowNull: true,
      });
    }
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.removeColumn('guardian_profiles', 'whatsapp');
    await queryInterface.removeColumn('guardian_profiles', 'phone2');
  }
};
