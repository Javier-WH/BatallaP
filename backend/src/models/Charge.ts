import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';

export type ChargeType = 'mensualidad' | 'matricula' | 'gastos_administrativos' | 'item' | 'otro';

export const CHARGE_TYPES: ChargeType[] = [
  'mensualidad', 'matricula', 'gastos_administrativos', 'item', 'otro',
];

interface ChargeAttributes {
  id: number;
  inscriptionId: number;        // student in a period
  schoolPeriodId: number;
  feeId: number | null;         // linked Fee (for monthly fees, etc.)
  sellableItemId: number | null; // linked SellableItem
  type: ChargeType;
  month: string | null;         // 'Sep', 'Oct', ... (null = one-time charge)
  description: string;
  amount: number;               // amount owed in original currency
  currency: string;             // 'USD', 'EUR', 'VES'
  amountVES: number | null;     // amount in VES (for comparison)
  dueDate: Date | null;         // when the charge is due
  active: boolean;
}

interface ChargeCreationAttributes
  extends Optional<ChargeAttributes, 'id' | 'feeId' | 'sellableItemId' | 'month' | 'amountVES' | 'dueDate' | 'active'> {}

class Charge extends Model<ChargeAttributes, ChargeCreationAttributes>
  implements ChargeAttributes {
  public id!: number;
  public inscriptionId!: number;
  public schoolPeriodId!: number;
  public feeId!: number | null;
  public sellableItemId!: number | null;
  public type!: ChargeType;
  public month!: string | null;
  public description!: string;
  public amount!: number;
  public currency!: string;
  public amountVES!: number | null;
  public dueDate!: Date | null;
  public active!: boolean;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Charge.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    inscriptionId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'inscriptions', key: 'id' },
      onDelete: 'CASCADE',
    },
    schoolPeriodId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'school_periods', key: 'id' },
    },
    feeId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'fees', key: 'id' },
    },
    sellableItemId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'sellable_items', key: 'id' },
    },
    type: {
      type: DataTypes.ENUM(...CHARGE_TYPES),
      allowNull: false,
    },
    month: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    description: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
    },
    currency: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: 'USD',
    },
    amountVES: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: true,
    },
    dueDate: {
      type: DataTypes.DATE,
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
    tableName: 'charges',
    indexes: [
      { fields: ['inscriptionId'] },
      { fields: ['schoolPeriodId'] },
      { fields: ['month'] },
      { fields: ['type'] },
    ],
  }
);

export default Charge;
