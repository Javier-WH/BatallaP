import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';

export const CURRENCY_DISCOUNT_KINDS = ['percent', 'fixed'] as const;
export type CurrencyDiscountKind = typeof CURRENCY_DISCOUNT_KINDS[number];

interface CurrencyDiscountAttributes {
  id: number;
  schoolPeriodId: number;
  name: string;
  /** Currency the payment must be made in for the discount to apply (USD, EUR, VES, USDT). */
  currency: string;
  kind: CurrencyDiscountKind;
  /** percent: 0-100 less to pay; fixed: amount, in each debt's own currency, taken off every debt a payment settles in full. */
  value: number;
  validFrom: string | null;
  validTo: string | null;
  active: boolean;
  note: string | null;
  createdByPersonId: number | null;
}

type CurrencyDiscountCreationAttributes = Optional<
  CurrencyDiscountAttributes, 'id' | 'validFrom' | 'validTo' | 'active' | 'note' | 'createdByPersonId'
>;

/**
 * Discount for paying in a given currency (e.g. 20% for USDT payments). It
 * applies to every payment of the period made in that currency inside its
 * validity window — it is not assigned per student.
 */
class CurrencyDiscount
  extends Model<CurrencyDiscountAttributes, CurrencyDiscountCreationAttributes>
  implements CurrencyDiscountAttributes
{
  public id!: number;
  public schoolPeriodId!: number;
  public name!: string;
  public currency!: string;
  public kind!: CurrencyDiscountKind;
  public value!: number;
  public validFrom!: string | null;
  public validTo!: string | null;
  public active!: boolean;
  public note!: string | null;
  public createdByPersonId!: number | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

CurrencyDiscount.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    schoolPeriodId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'school_periods', key: 'id' } },
    name: { type: DataTypes.STRING(100), allowNull: false },
    currency: { type: DataTypes.STRING(8), allowNull: false },
    kind: { type: DataTypes.ENUM(...CURRENCY_DISCOUNT_KINDS), allowNull: false },
    value: { type: DataTypes.DECIMAL(18, 2), allowNull: false },
    validFrom: { type: DataTypes.DATEONLY, allowNull: true },
    validTo: { type: DataTypes.DATEONLY, allowNull: true },
    active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    note: { type: DataTypes.TEXT, allowNull: true },
    createdByPersonId: { type: DataTypes.INTEGER, allowNull: true },
  },
  {
    sequelize,
    tableName: 'currency_discounts',
    indexes: [{ fields: ['schoolPeriodId', 'currency', 'active'] }],
  }
);

export default CurrencyDiscount;
