import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';

export type FeeKey = 'mensualidad' | 'matricula' | 'gastos_administrativos';

export const FEE_KEYS: FeeKey[] = ['mensualidad', 'matricula', 'gastos_administrativos'];

interface FeeAttributes {
  id: number;
  schoolPeriodId: number;
  key: FeeKey;
  name: string;
  amount: number;
  exchangeRateTypeId: number;
  active: boolean;
}

interface FeeCreationAttributes
  extends Optional<FeeAttributes, 'id' | 'active'> {}

class Fee extends Model<FeeAttributes, FeeCreationAttributes>
  implements FeeAttributes {
  public id!: number;
  public schoolPeriodId!: number;
  public key!: FeeKey;
  public name!: string;
  public amount!: number;
  public exchangeRateTypeId!: number;
  public active!: boolean;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Fee.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    schoolPeriodId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'school_periods', key: 'id' },
      onDelete: 'CASCADE',
    },
    key: {
      type: DataTypes.ENUM(...FEE_KEYS),
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
    },
    exchangeRateTypeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'exchange_rate_types', key: 'id' },
    },
    active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    sequelize,
    tableName: 'fees',
    indexes: [
      { unique: true, fields: ['schoolPeriodId', 'key'], name: 'uq_fees_period_key' },
      { fields: ['active'] },
    ],
  }
);

export default Fee;
