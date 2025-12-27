import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';
import Inscription from './Inscription';
import Grade from './Grade';

export type StudentPeriodOutcomeStatus = 'aprobado' | 'materias_pendientes' | 'reprobado';

interface StudentPeriodOutcomeAttributes {
  id: number;
  inscriptionId: number;
  finalAverage?: number | null;
  failedSubjects: number;
  status: StudentPeriodOutcomeStatus;
  promotionGradeId?: number | null;
  graduatedAt?: Date | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type StudentPeriodOutcomeCreationAttributes = Optional<
  StudentPeriodOutcomeAttributes,
  'id' | 'finalAverage' | 'promotionGradeId' | 'graduatedAt' | 'metadata'
>;

class StudentPeriodOutcome
  extends Model<StudentPeriodOutcomeAttributes, StudentPeriodOutcomeCreationAttributes>
  implements StudentPeriodOutcomeAttributes
{
  public id!: number;
  public inscriptionId!: number;
  public finalAverage!: number | null;
  public failedSubjects!: number;
  public status!: StudentPeriodOutcomeStatus;
  public promotionGradeId!: number | null;
  public graduatedAt!: Date | null;
  public metadata!: Record<string, unknown> | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

StudentPeriodOutcome.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    inscriptionId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Inscription,
        key: 'id'
      }
    },
    finalAverage: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true
    },
    failedSubjects: {
      type: DataTypes.TINYINT.UNSIGNED,
      allowNull: false,
      defaultValue: 0
    },
    status: {
      type: DataTypes.ENUM('aprobado', 'materias_pendientes', 'reprobado'),
      allowNull: false,
      defaultValue: 'aprobado'
    },
    promotionGradeId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: Grade,
        key: 'id'
      }
    },
    graduatedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true
    }
  },
  {
    sequelize,
    tableName: 'student_period_outcomes',
    indexes: [
      {
        unique: true,
        fields: ['inscriptionId']
      }
    ]
  }
);

export default StudentPeriodOutcome;
