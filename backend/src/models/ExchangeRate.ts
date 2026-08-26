import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';

interface ExchangeRateAttributes {
  id: number;
  exchangeRateTypeId: number;
  rate: number;          // value in VES per 1 unit of the currency
  date: string;          // DATEONLY — the date this rate applies to
}

interface ExchangeRateCreationAttributes
  extends Optional<ExchangeRateAttributes, 'id'> {}

class ExchangeRate extends Model<ExchangeRateAttributes, ExchangeRateCreationAttributes>
  implements ExchangeRateAttributes {
  public id!: number;
  public exchangeRateTypeId!: number;
  public rate!: number;
  public date!: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

ExchangeRate.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    exchangeRateTypeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'exchange_rate_types', key: 'id' },
      onDelete: 'CASCADE',
    },
    rate: {
      type: DataTypes.DECIMAL(18, 4),
      allowNull: false,
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'exchange_rates',
    indexes: [
      { unique: true, fields: ['exchangeRateTypeId', 'date'], name: 'uq_exchange_rate_type_date' },
      { fields: ['date'] },
    ],
  }
);

export default ExchangeRate;
