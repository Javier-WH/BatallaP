import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';

interface SchoolPeriodAttributes {
  id: number;
  name: string;
  isActive: boolean;
}

interface SchoolPeriodCreationAttributes extends Optional<SchoolPeriodAttributes, 'id'> { }

class SchoolPeriod extends Model<SchoolPeriodAttributes, SchoolPeriodCreationAttributes> implements SchoolPeriodAttributes {
  public id!: number;
  public name!: string;
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
    name: {
      type: DataTypes.STRING,
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
  }
);

export default SchoolPeriod;
