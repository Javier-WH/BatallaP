import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';

interface PaymentAllocationAttributes {
  id: number;
  paymentId: number;
  chargeId: number;
  amount: number;      // credited to the charge, in the CHARGE's currency
  amountVES: number;   // value of that credit in bolívares (payment-date rate), WITHOUT the bonus
  bonus: number;       // part of `amount` granted by a currency discount (not paid in cash), in the charge's currency
  currencyDiscountId: number | null;
}

type PaymentAllocationCreationAttributes = Optional<PaymentAllocationAttributes, 'id' | 'bonus' | 'currencyDiscountId'>;

/**
 * The part of a payment that settles one charge. A single payment may be split
 * across several charges in different currencies (e.g. Bs. 69,000 = 40 EUR of
 * enrollment + the rest in USD for a uniform). Payments without allocations
 * (registered before this existed) keep the old bucket-level semantics.
 */
class PaymentAllocation
  extends Model<PaymentAllocationAttributes, PaymentAllocationCreationAttributes>
  implements PaymentAllocationAttributes
{
  public id!: number;
  public paymentId!: number;
  public chargeId!: number;
  public amount!: number;
  public amountVES!: number;
  public bonus!: number;
  public currencyDiscountId!: number | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

PaymentAllocation.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    paymentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'payments', key: 'id' },
      onDelete: 'CASCADE',
    },
    chargeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'charges', key: 'id' },
      onDelete: 'CASCADE',
    },
    amount: { type: DataTypes.DECIMAL(18, 2), allowNull: false },
    amountVES: { type: DataTypes.DECIMAL(18, 2), allowNull: false },
    bonus: { type: DataTypes.DECIMAL(18, 2), allowNull: false, defaultValue: 0 },
    currencyDiscountId: { type: DataTypes.INTEGER, allowNull: true },
  },
  {
    sequelize,
    tableName: 'payment_allocations',
    indexes: [{ fields: ['paymentId'] }, { fields: ['chargeId'] }],
  }
);

export default PaymentAllocation;
