import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';

interface SchoolPeriodAttributes {
  id: number;
  period: string; // e.g. "2025-2026"
  name: string;   // descriptive name for the period
  startYear: number;
  endYear: number;
  isActive: boolean;
}

interface SchoolPeriodCreationAttributes extends Optional<SchoolPeriodAttributes, 'id' | 'startYear' | 'endYear' | 'isActive'> { }

class SchoolPeriod extends Model<SchoolPeriodAttributes, SchoolPeriodCreationAttributes> implements SchoolPeriodAttributes {
  public id!: number;
  public period!: string;
  public name!: string;
  public startYear!: number;
  public endYear!: number;
  public isActive!: boolean;

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
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: false, // User logic will handle "only one active"
    },
  },
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
    ],
  }
);

export default SchoolPeriod;
