import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';
import Matriculation from './Matriculation';
import Person from './Person';

interface EnrollmentReportAttributes {
  id: number;
  uuid: string;
  matriculationId: number;
  personId: number;
  snapshotData: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}

interface EnrollmentReportCreationAttributes extends Optional<EnrollmentReportAttributes, 'id'> {}

class EnrollmentReport
  extends Model<EnrollmentReportAttributes, EnrollmentReportCreationAttributes>
  implements EnrollmentReportAttributes
{
  public id!: number;
  public uuid!: string;
  public matriculationId!: number;
  public personId!: number;
  public snapshotData!: Record<string, unknown>;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public readonly matriculation?: Matriculation;
  public readonly student?: Person;
}

EnrollmentReport.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    uuid: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
      defaultValue: DataTypes.UUIDV4,
    },
    matriculationId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Matriculation,
        key: 'id',
      },
    },
    personId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Person,
        key: 'id',
      },
    },
    snapshotData: {
      type: DataTypes.JSON,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'enrollment_reports',
    indexes: [
      { unique: true, fields: ['uuid'] },
      { fields: ['personId'] },
      { fields: ['matriculationId'] },
    ],
  }
);

export default EnrollmentReport;
