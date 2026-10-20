import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';

interface ChargeDeliveryAttributes {
  id: number;
  chargeId: number;
  quantity: number;               // units handed over in this event
  note: string | null;
  deliveredByPersonId: number | null; // staff member who delivered
}

interface ChargeDeliveryCreationAttributes
  extends Optional<ChargeDeliveryAttributes, 'id' | 'note' | 'deliveredByPersonId'> {}

class ChargeDelivery extends Model<ChargeDeliveryAttributes, ChargeDeliveryCreationAttributes>
  implements ChargeDeliveryAttributes {
  public id!: number;
  public chargeId!: number;
  public quantity!: number;
  public note!: string | null;
  public deliveredByPersonId!: number | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

ChargeDelivery.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    chargeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'charges', key: 'id' },
      onDelete: 'CASCADE',
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    note: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    deliveredByPersonId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'people', key: 'id' },
      onDelete: 'SET NULL',
    },
  },
  {
    sequelize,
    tableName: 'charge_deliveries',
    indexes: [
      { fields: ['chargeId'] },
    ],
  }
);

export default ChargeDelivery;
