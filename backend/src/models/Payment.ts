import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';

export type PaymentMethod = 'pago_movil' | 'efectivo' | 'transferencia' | 'zelle' | 'tarjeta' | 'otro';

export const PAYMENT_METHODS: PaymentMethod[] = [
  'pago_movil', 'efectivo', 'transferencia', 'zelle', 'tarjeta', 'otro',
];

interface PaymentAttributes {
  id: number;
  inscriptionId: number;       // student in a period
  schoolPeriodId: number;
  feeId: number | null;        // which Fee this payment covers (null = custom)
  sellableItemId: number | null; // which SellableItem this payment covers
  chargeId: number | null;     // which Charge this payment settles (null = direct)
  month: string | null;        // 'Sep', 'Oct', ... (null = non-monthly, e.g. uniform)
  amount: number;              // amount in original currency
  currency: string;            // 'USD', 'EUR', 'VES'
  amountVES: number | null;    // amount converted to VES at time of payment
  exchangeRate: number | null; // rate used for VES conversion
  method: PaymentMethod;
  reference: string | null;    // transaction reference
  bank: string | null;
  paymentDate: Date;           // when the payment was made
  notes: string | null;
}

interface PaymentCreationAttributes
  extends Optional<PaymentAttributes, 'id' | 'feeId' | 'sellableItemId' | 'chargeId' | 'month' | 'amountVES' | 'exchangeRate' | 'reference' | 'bank' | 'notes'> {}

class Payment extends Model<PaymentAttributes, PaymentCreationAttributes>
  implements PaymentAttributes {
  public id!: number;
  public inscriptionId!: number;
  public schoolPeriodId!: number;
  public feeId!: number | null;
  public sellableItemId!: number | null;
  public chargeId!: number | null;
  public month!: string | null;
  public amount!: number;
  public currency!: string;
  public amountVES!: number | null;
  public exchangeRate!: number | null;
  public method!: PaymentMethod;
  public reference!: string | null;
  public bank!: string | null;
  public paymentDate!: Date;
  public notes!: string | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Payment.init(
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
    chargeId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'charges', key: 'id' },
    },
    month: {
      type: DataTypes.STRING(10),
      allowNull: true,
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
    exchangeRate: {
      type: DataTypes.DECIMAL(18, 6),
      allowNull: true,
    },
    method: {
      type: DataTypes.ENUM(...PAYMENT_METHODS),
      allowNull: false,
      defaultValue: 'efectivo',
    },
    reference: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    bank: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    paymentDate: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'payments',
    indexes: [
      { fields: ['inscriptionId'] },
      { fields: ['schoolPeriodId'] },
      { fields: ['chargeId'] },
      { fields: ['month'] },
    ],
  }
);

export default Payment;
