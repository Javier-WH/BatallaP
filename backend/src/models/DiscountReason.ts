import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';

interface DiscountReasonAttributes {
  id: number;
  name: string;
  description: string | null;
  active: boolean;
}

interface DiscountReasonCreationAttributes
  extends Optional<DiscountReasonAttributes, 'id' | 'description' | 'active'> {}

class DiscountReason extends Model<DiscountReasonAttributes, DiscountReasonCreationAttributes>
  implements DiscountReasonAttributes {
  public id!: number;
  public name!: string;
  public description!: string | null;
  public active!: boolean;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

DiscountReason.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    description: { type: DataTypes.TEXT, allowNull: true },
    active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  {
    sequelize,
    tableName: 'discount_reasons',
    indexes: [{ fields: ['active'] }],
  }
);

export default DiscountReason;
