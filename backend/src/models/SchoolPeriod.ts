import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';

export type SchoolPeriodStatus = 'preinscripcion' | 'activo' | 'historico' | 'externo';

export const SCHOOL_PERIOD_STATUSES: SchoolPeriodStatus[] = [
  'preinscripcion',
  'activo',
  'historico',
  'externo',
];

interface SchoolPeriodAttributes {
  id: number;
  period: string; // e.g. "2025-2026"
  name: string;   // descriptive name for the period
  startYear: number;
  endYear: number;
  status: SchoolPeriodStatus;
  billingStartMonth: number; // 1–12, first month billed (default 9 = September)
  billingEndMonth: number;   // 1–12, last month billed (default 8 = August)
}

interface SchoolPeriodCreationAttributes extends Optional<SchoolPeriodAttributes, 'id' | 'startYear' | 'endYear' | 'status' | 'billingStartMonth' | 'billingEndMonth'> { }

class SchoolPeriod extends Model<SchoolPeriodAttributes, SchoolPeriodCreationAttributes> implements SchoolPeriodAttributes {
  public id!: number;
  public period!: string;
  public name!: string;
  public startYear!: number;
  public endYear!: number;
  public status!: SchoolPeriodStatus;
  public billingStartMonth!: number;
  public billingEndMonth!: number;

  // Virtual, derived from status. Kept for backwards compatibility with existing
  // consumers. Cannot be used inside a Sequelize `where` clause: filter by `status`.
  public readonly isActive!: boolean;
  public readonly isExternal!: boolean;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

SchoolPeriod.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    period: {
      type: DataTypes.STRING(9),
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    startYear: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    endYear: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM(...SCHOOL_PERIOD_STATUSES),
      allowNull: false,
      defaultValue: 'historico', // Only one 'activo' and one 'preinscripcion' at a time
    },
    billingStartMonth: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 9,
    },
    billingEndMonth: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 8,
    },
    isActive: {
      type: DataTypes.VIRTUAL,
      get(this: SchoolPeriod) {
        return this.getDataValue('status') === 'activo';
      },
    },
    isExternal: {
      type: DataTypes.VIRTUAL,
      get(this: SchoolPeriod) {
        return this.getDataValue('status') === 'externo';
      },
    },
  } as never,
  {
    sequelize,
    tableName: 'school_periods',
    indexes: [
      {
        unique: true,
        fields: ['period'],
      },
      {
        fields: ['startYear', 'endYear'],
      },
      {
        fields: ['status'],
      },
    ],
  }
);

export default SchoolPeriod;
