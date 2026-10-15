import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';

export type ConversionMode = 'exchange_rate' | 'same_amount';

export const CONVERSION_MODES: ConversionMode[] = ['exchange_rate', 'same_amount'];

interface EnrollmentPlanAttributes {
  id: number;
  name: string;
  description: string | null;
  schoolPeriodId: number;
  targetExchangeRateTypeId: number; // currency in which the total is expressed
  conversionMode: ConversionMode;   // how to compute the total
  active: boolean;
  effectiveMonth: string; // month code from which this plan version applies
}

interface EnrollmentPlanCreationAttributes
  extends Optional<EnrollmentPlanAttributes, 'id' | 'description' | 'active' | 'conversionMode' | 'effectiveMonth'> {}

class EnrollmentPlan extends Model<EnrollmentPlanAttributes, EnrollmentPlanCreationAttributes>
  implements EnrollmentPlanAttributes {
  public id!: number;
  public name!: string;
  public description!: string | null;
  public schoolPeriodId!: number;
  public targetExchangeRateTypeId!: number;
  public conversionMode!: ConversionMode;
  public active!: boolean;
  public effectiveMonth!: string;

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
    schoolPeriodId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'school_periods', key: 'id' },
      onDelete: 'CASCADE',
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
    effectiveMonth: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: 'Sep',
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
