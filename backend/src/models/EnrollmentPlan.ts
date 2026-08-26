import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';

export type ConversionMode = 'exchange_rate' | 'same_amount';

export const CONVERSION_MODES: ConversionMode[] = ['exchange_rate', 'same_amount'];

interface EnrollmentPlanAttributes {
  id: number;
  name: string;
  description: string | null;
  targetExchangeRateTypeId: number; // currency in which the total is expressed
  conversionMode: ConversionMode;   // how to compute the total
  active: boolean;
}

interface EnrollmentPlanCreationAttributes
  extends Optional<EnrollmentPlanAttributes, 'id' | 'description' | 'active' | 'conversionMode'> {}

class EnrollmentPlan extends Model<EnrollmentPlanAttributes, EnrollmentPlanCreationAttributes>
  implements EnrollmentPlanAttributes {
  public id!: number;
  public name!: string;
  public description!: string | null;
  public targetExchangeRateTypeId!: number;
  public conversionMode!: ConversionMode;
  public active!: boolean;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

EnrollmentPlan.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    targetExchangeRateTypeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'exchange_rate_types', key: 'id' },
    },
    conversionMode: {
      type: DataTypes.ENUM(...CONVERSION_MODES),
      allowNull: false,
      defaultValue: 'exchange_rate',
    },
    active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    sequelize,
    tableName: 'enrollment_plans',
    indexes: [
      { fields: ['active'] },
    ],
  }
);

export default EnrollmentPlan;
