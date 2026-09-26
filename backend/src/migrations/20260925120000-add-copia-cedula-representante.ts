import { QueryInterface, DataTypes } from 'sequelize';

export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    const desc: any = await queryInterface.describeTable('enrollment_documents');
    if (!desc.receivedCopiaCedulaRepresentante) {
      await queryInterface.addColumn('enrollment_documents', 'receivedCopiaCedulaRepresentante', {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    const desc: any = await queryInterface.describeTable('enrollment_documents');
    if (desc.receivedCopiaCedulaRepresentante) {
      await queryInterface.removeColumn('enrollment_documents', 'receivedCopiaCedulaRepresentante');
    }
  },
};
