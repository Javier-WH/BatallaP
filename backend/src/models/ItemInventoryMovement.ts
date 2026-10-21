import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';

export type InventoryMovementType = 'ingreso' | 'ajuste';
export const INVENTORY_MOVEMENT_TYPES: InventoryMovementType[] = ['ingreso', 'ajuste'];

interface ItemInventoryMovementAttributes {
  id: number;
  sellableItemId: number;
  size: string | null;            // null for items without sizes
  quantity: number;               // signed: + stock in, − write-off / correction
  type: InventoryMovementType;
  note: string | null;
  createdByPersonId: number | null; // administrator who recorded the movement
}

interface ItemInventoryMovementCreationAttributes
  extends Optional<ItemInventoryMovementAttributes, 'id' | 'size' | 'note' | 'createdByPersonId'> {}

class ItemInventoryMovement extends Model<ItemInventoryMovementAttributes, ItemInventoryMovementCreationAttributes>
  implements ItemInventoryMovementAttributes {
  public id!: number;
  public sellableItemId!: number;
  public size!: string | null;
  public quantity!: number;
  public type!: InventoryMovementType;
  public note!: string | null;
  public createdByPersonId!: number | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

ItemInventoryMovement.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    sellableItemId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'sellable_items', key: 'id' },
      onDelete: 'CASCADE',
    },
    size: { type: DataTypes.STRING(30), allowNull: true },
    quantity: { type: DataTypes.INTEGER, allowNull: false },
    type: { type: DataTypes.ENUM(...INVENTORY_MOVEMENT_TYPES), allowNull: false },
    note: { type: DataTypes.STRING(500), allowNull: true },
    createdByPersonId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'people', key: 'id' },
      onDelete: 'SET NULL',
    },
  },
  {
    sequelize,
    tableName: 'item_inventory_movements',
    indexes: [{ fields: ['sellableItemId'] }],
  }
);

export default ItemInventoryMovement;
