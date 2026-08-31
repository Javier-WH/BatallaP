import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';
import SchoolPeriod from './SchoolPeriod';

export type RevisionPeriodStatus = 'pending' | 'open' | 'completed' | 'closed';

interface RevisionPeriodAttributes {
  id: number;
  schoolPeriodId: number;
  status: RevisionPeriodStatus;
  maxOpportunities: number;
  passingGrade: number;
  currentOpportunity: number;
  openedAt?: Date | null;
  completedAt?: Date | null;
  completedBy?: number | null;
  closedAt?: Date | null;
  gradesFinalized?: boolean;
  gradesFinalizedAt?: Date | null;
  gradesFinalizedBy?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type RevisionPeriodCreationAttributes = Optional<
  RevisionPeriodAttributes,
  'id' | 'status' | 'maxOpportunities' | 'passingGrade' | 'currentOpportunity' | 'openedAt' | 'completedAt' | 'completedBy' | 'closedAt' | 'gradesFinalized' | 'gradesFinalizedAt' | 'gradesFinalizedBy'
>;

class RevisionPeriod
  extends Model<RevisionPeriodAttributes, RevisionPeriodCreationAttributes>
  implements RevisionPeriodAttributes
{
  public id!: number;
  public schoolPeriodId!: number;
  public status!: RevisionPeriodStatus;
  public maxOpportunities!: number;
  public passingGrade!: number;
  public currentOpportunity!: number;
  public openedAt!: Date | null;
  public completedAt!: Date | null;
  public completedBy!: number | null;
  public closedAt!: Date | null;
  public gradesFinalized!: boolean;
  public gradesFinalizedAt!: Date | null;
  public gradesFinalizedBy!: number | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

RevisionPeriod.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    schoolPeriodId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: SchoolPeriod,
        key: 'id',
      },
    },
    status: {
      type: DataTypes.ENUM('pending', 'open', 'completed', 'closed'),
      allowNull: false,
      defaultValue: 'pending',
    },
    maxOpportunities: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 3,
    },
    passingGrade: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 10.0,
    },
    currentOpportunity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    openedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    completedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onDelete: 'SET NULL',
    },
    closedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    gradesFinalized: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    gradesFinalizedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    gradesFinalizedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onDelete: 'SET NULL',
    },
  },
  {
    sequelize,
    tableName: 'revision_periods',
    indexes: [
      {
        unique: true,
        fields: ['schoolPeriodId'],
      },
    ],
  }
);

export default RevisionPeriod;
