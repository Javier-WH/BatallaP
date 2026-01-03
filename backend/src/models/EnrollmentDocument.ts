import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';
import Matriculation from './Matriculation';

interface EnrollmentDocumentAttributes {
  id: number;
  matriculationId: number;
  // Checklist boolean items
  receivedCertificadoAprendizaje: boolean;
  receivedCartaBuenaConducta: boolean;
  receivedNotasCertificadas: boolean;
  receivedPartidaNacimiento: boolean;
  receivedCopiaCedulaEstudiante: boolean;
  receivedInformesMedicos: boolean;
  receivedFotoCarnetEstudiante: boolean;
  // Uploaded file paths
  pathCedulaRepresentante?: string;
  pathFotoRepresentante?: string;
  pathFotoEstudiante?: string;
  pathInformesMedicos?: string[]; // JSON array of paths
  createdAt?: Date;
  updatedAt?: Date;
}

interface EnrollmentDocumentCreationAttributes extends Optional<EnrollmentDocumentAttributes, 'id'> { }

class EnrollmentDocument extends Model<EnrollmentDocumentAttributes, EnrollmentDocumentCreationAttributes> implements EnrollmentDocumentAttributes {
  public id!: number;
  public matriculationId!: number;
  public receivedCertificadoAprendizaje!: boolean;
  public receivedCartaBuenaConducta!: boolean;
  public receivedNotasCertificadas!: boolean;
  public receivedPartidaNacimiento!: boolean;
  public receivedCopiaCedulaEstudiante!: boolean;
  public receivedInformesMedicos!: boolean;
  public receivedFotoCarnetEstudiante!: boolean;
  public pathCedulaRepresentante!: string;
  public pathFotoRepresentante!: string;
  public pathFotoEstudiante!: string;
  public pathInformesMedicos!: string[];

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

EnrollmentDocument.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    matriculationId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Matriculation,
        key: 'id',
      },
      unique: true // One document record per matriculation
    },
    receivedCertificadoAprendizaje: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    receivedCartaBuenaConducta: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    receivedNotasCertificadas: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    receivedPartidaNacimiento: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    receivedCopiaCedulaEstudiante: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    receivedInformesMedicos: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    receivedFotoCarnetEstudiante: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    pathCedulaRepresentante: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    pathFotoRepresentante: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    pathFotoEstudiante: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    pathInformesMedicos: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'enrollment_documents',
  }
);

export default EnrollmentDocument;
