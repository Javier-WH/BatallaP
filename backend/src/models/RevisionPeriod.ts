import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';
import SchoolPeriod from './SchoolPeriod';

export type RevisionPeriodStatus = 'pending' | 'open' | 'closed';

interface RevisionPeriodAttributes {
  id: number;
  schoolPeriodId: number;
  status: RevisionPeriodStatus;
  maxOpportunities: number;
  passingGrade: number;
  openedAt?: Date | null;
  closedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type RevisionPeriodCreationAttributes = Optional<
  RevisionPeriodAttributes,
  'id' | 'status' | 'maxOpportunities' | 'passingGrade' | 'openedAt' | 'closedAt'
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
  public openedAt!: Date | null;
  public closedAt!: Date | null;

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
      type: DataTypes.ENUM('pending', 'open', 'closed'),
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
    openedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    closedAt: {
      type: DataTypes.DATE,
      allowNull: true,
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
