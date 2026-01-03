import { QueryInterface, DataTypes } from 'sequelize';

export default {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable('enrollment_documents', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      matriculationId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'matriculations',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      receivedCertificadoAprendizaje: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      receivedCartaBuenaConducta: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      receivedNotasCertificadas: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      receivedPartidaNacimiento: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      receivedCopiaCedulaEstudiante: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      receivedInformesMedicos: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      receivedFotoCarnetEstudiante: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      pathCedulaRepresentante: {
        type: DataTypes.STRING,
        allowNull: true
      },
      pathFotoRepresentante: {
        type: DataTypes.STRING,
        allowNull: true
      },
      pathFotoEstudiante: {
        type: DataTypes.STRING,
        allowNull: true
      },
      createdAt: {
        allowNull: false,
        type: DataTypes.DATE
      },
      updatedAt: {
        allowNull: false,
        type: DataTypes.DATE
      }
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable('enrollment_documents');
  }
};
