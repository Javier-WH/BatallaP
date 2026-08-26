import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';

interface ExchangeRateTypeAttributes {
  id: number;
  code: string;          // e.g. 'USD_BCV', 'USD_PARALLEL', 'EUR_BCV'
  name: string;          // e.g. 'Dólar BCV', 'Dólar Paralelo'
  currency: string;      // ISO 4217: 'USD', 'EUR', 'VES'
  isDefault: boolean;
  active: boolean;
}

interface ExchangeRateTypeCreationAttributes
  extends Optional<ExchangeRateTypeAttributes, 'id' | 'isDefault' | 'active'> {}

class ExchangeRateType extends Model<ExchangeRateTypeAttributes, ExchangeRateTypeCreationAttributes>
  implements ExchangeRateTypeAttributes {
  public id!: number;
  public code!: string;
  public name!: string;
  public currency!: string;
  public isDefault!: boolean;
  public active!: boolean;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

ExchangeRateType.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    code: {
      type: DataTypes.STRING(30),
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: 'USD',
    },
    isDefault: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    sequelize,
    tableName: 'exchange_rate_types',
    indexes: [
      { unique: true, fields: ['code'] },
      { fields: ['active'] },
    ],
  }
);

export default ExchangeRateType;
