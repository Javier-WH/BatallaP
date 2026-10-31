import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';

import { PAYMENT_METHOD_LIST, type PaymentMethodCode } from '@/services/paymentRulesService';

export type PaymentMethod = PaymentMethodCode;

export const PAYMENT_METHODS: PaymentMethod[] = [...PAYMENT_METHOD_LIST];

interface PaymentAttributes {
  id: number;
  inscriptionId: number;       // student in a period
  schoolPeriodId: number;
  feeId: number | null;        // which Fee this payment covers (null = custom)
  sellableItemId: number | null; // which SellableItem this payment covers
  chargeId: number | null;     // which Charge this payment settles (null = direct)
  month: string | null;        // 'Sep', 'Oct', ... (null = non-monthly, e.g. uniform)
  amount: number;              // amount in original currency
  currency: string;            // 'USD', 'EUR', 'VES', 'USDT'
  amountVES: number | null;    // amount converted to VES at time of payment
  exchangeRate: number | null; // rate used for VES conversion
  debtPeriodId: number | null; // period whose debt this settles (null = schoolPeriodId)
  equivalent: number | null;   // amount in the debt bucket's currency at the payment-date rate
  equivalentCurrency: string | null;
  atPar: boolean;              // USD/USDT credited 1:1 against a EUR debt (period setting usdAtPar)
  method: PaymentMethod;
  reference: string | null;    // transaction reference
  bank: string | null;
  account: string | null;      // payer's user/email on platforms (Binance, Zelle, ...)
  registeredByPersonId: number | null; // administrator who recorded the payment
  clientRequestId: string | null;      // idempotency key of the form submission
  dedupeKey: string | null;            // fingerprint of the operation (unique) — blocks duplicates
  paymentGroupId: string | null;       // rows of one physical payment shared by several students
  paymentDate: Date;           // when the payment was made
  allocationScope: string | null;      // how the payment was targeted: auto|tuition|item|charge|month|oneTime
  notes: string | null;
}

interface PaymentCreationAttributes
  extends Optional<PaymentAttributes, 'id' | 'feeId' | 'sellableItemId' | 'chargeId' | 'month' | 'amountVES' | 'exchangeRate' | 'debtPeriodId' | 'equivalent' | 'equivalentCurrency' | 'atPar' | 'reference' | 'bank' | 'account' | 'registeredByPersonId' | 'clientRequestId' | 'dedupeKey' | 'paymentGroupId' | 'allocationScope' | 'notes'> {}

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
  public debtPeriodId!: number | null;
  public equivalent!: number | null;
  public equivalentCurrency!: string | null;
  public atPar!: boolean;
  public method!: PaymentMethod;
  public reference!: string | null;
  public bank!: string | null;
  public account!: string | null;
  public registeredByPersonId!: number | null;
  public clientRequestId!: string | null;
  public dedupeKey!: string | null;
  public paymentGroupId!: string | null;
  public paymentDate!: Date;
  public allocationScope!: string | null;
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
    debtPeriodId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'school_periods', key: 'id' },
    },
    equivalent: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: true,
    },
    equivalentCurrency: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    atPar: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    method: {
      type: DataTypes.STRING(20),
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
    account: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    registeredByPersonId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'people', key: 'id' },
    },
    clientRequestId: {
      type: DataTypes.STRING(64),
      allowNull: true,
      unique: true,
    },
    dedupeKey: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: true,
    },
    paymentGroupId: {
      type: DataTypes.STRING(36),
      allowNull: true,
    },
    paymentDate: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    allocationScope: {
      type: DataTypes.STRING(20),
      allowNull: true,
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
      { fields: ['paymentGroupId'] },
    ],
  }
);

export default Payment;
