import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';
import SchoolPeriod from './SchoolPeriod';
import User from './User';

export type PeriodClosureStatus = 'draft' | 'validating' | 'closed' | 'failed';

interface PeriodClosureAttributes {
  id: number;
  schoolPeriodId: number;
  status: PeriodClosureStatus;
  initiatedBy?: number | null;
  startedAt?: Date | null;
  finishedAt?: Date | null;
  log?: Record<string, unknown> | null;
  snapshot?: Record<string, unknown> | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type PeriodClosureCreationAttributes = Optional<
  PeriodClosureAttributes,
  'id' | 'status' | 'initiatedBy' | 'startedAt' | 'finishedAt' | 'log' | 'snapshot'
>;

class PeriodClosure
  extends Model<PeriodClosureAttributes, PeriodClosureCreationAttributes>
  implements PeriodClosureAttributes
{
  public id!: number;
  public schoolPeriodId!: number;
  public status!: PeriodClosureStatus;
  public initiatedBy?: number | null;
  public startedAt?: Date | null;
  public finishedAt?: Date | null;
  public log?: Record<string, unknown> | null;
  public snapshot?: Record<string, unknown> | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

PeriodClosure.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    schoolPeriodId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: SchoolPeriod,
        key: 'id'
      }
    },
    status: {
      type: DataTypes.ENUM('draft', 'validating', 'closed', 'failed'),
      allowNull: false,
      defaultValue: 'draft'
    },
    initiatedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: User,
        key: 'id'
      }
    },
    startedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    finishedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    log: {
      type: DataTypes.JSON,
      allowNull: true
    },
    snapshot: {
      type: DataTypes.JSON,
      allowNull: true
    }
  },
  {
    sequelize,
    tableName: 'period_closures'
  }
);

export default PeriodClosure;
