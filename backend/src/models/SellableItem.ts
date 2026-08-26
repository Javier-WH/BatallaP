import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';

interface SellableItemAttributes {
  id: number;
  name: string;
  description: string | null;
  amount: number;
  exchangeRateTypeId: number;
  category: string | null;
  active: boolean;
}

interface SellableItemCreationAttributes
  extends Optional<SellableItemAttributes, 'id' | 'description' | 'category' | 'active'> {}

class SellableItem extends Model<SellableItemAttributes, SellableItemCreationAttributes>
  implements SellableItemAttributes {
  public id!: number;
  public name!: string;
  public description!: string | null;
  public amount!: number;
  public exchangeRateTypeId!: number;
  public category!: string | null;
  public active!: boolean;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

SellableItem.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
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
    category: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    sequelize,
    tableName: 'sellable_items',
    indexes: [
      { fields: ['active'] },
      { fields: ['category'] },
    ],
  }
);

export default SellableItem;
