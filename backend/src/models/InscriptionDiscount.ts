import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';
import type { DiscountKind, DiscountScope } from '@/services/discountService';

export const DISCOUNT_KINDS: DiscountKind[] = ['percent', 'fixed'];
export const DISCOUNT_SCOPES: DiscountScope[] = ['mensualidad', 'matricula', 'todo'];

interface InscriptionDiscountAttributes {
  id: number;
  inscriptionId: number;
  reasonId: number;
  kind: DiscountKind;          // 'percent' of each affected charge, or 'fixed' amount per affected charge
  value: number;
  appliesTo: DiscountScope;
  fromMonth: string | null;    // first month it applies (null = from the start)
  toMonth: string | null;      // last month it applies (null = until the end)
  note: string | null;
  active: boolean;
  createdByPersonId: number | null;
}

interface InscriptionDiscountCreationAttributes
  extends Optional<InscriptionDiscountAttributes, 'id' | 'fromMonth' | 'toMonth' | 'note' | 'active' | 'createdByPersonId'> {}

class InscriptionDiscount extends Model<InscriptionDiscountAttributes, InscriptionDiscountCreationAttributes>
  implements InscriptionDiscountAttributes {
  public id!: number;
  public inscriptionId!: number;
  public reasonId!: number;
  public kind!: DiscountKind;
  public value!: number;
  public appliesTo!: DiscountScope;
  public fromMonth!: string | null;
  public toMonth!: string | null;
  public note!: string | null;
  public active!: boolean;
  public createdByPersonId!: number | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

InscriptionDiscount.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    inscriptionId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'inscriptions', key: 'id' },
      onDelete: 'CASCADE',
    },
    reasonId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'discount_reasons', key: 'id' },
    },
    kind: { type: DataTypes.ENUM(...DISCOUNT_KINDS), allowNull: false },
    value: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      get() {
        return Number(this.getDataValue('value'));
      },
    },
    appliesTo: { type: DataTypes.ENUM(...DISCOUNT_SCOPES), allowNull: false, defaultValue: 'todo' },
    fromMonth: { type: DataTypes.STRING(3), allowNull: true },
    toMonth: { type: DataTypes.STRING(3), allowNull: true },
    note: { type: DataTypes.TEXT, allowNull: true },
    active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    createdByPersonId: { type: DataTypes.INTEGER, allowNull: true },
  },
  {
    sequelize,
    tableName: 'inscription_discounts',
    indexes: [{ fields: ['inscriptionId'] }, { fields: ['reasonId'] }, { fields: ['active'] }],
  }
);

export default InscriptionDiscount;
