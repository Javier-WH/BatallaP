import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';

export type PaymentAuditAction = 'deleted' | 'moved';

interface PaymentAuditLogAttributes {
  id: number;
  paymentId: number;            // not a foreign key: a deleted payment no longer exists
  action: PaymentAuditAction;
  fromInscriptionId: number;    // student the payment belonged to
  toInscriptionId: number | null; // destination student (moves only)
  performedByPersonId: number | null;
  reason: string;
  snapshot: string;             // JSON of the payment before the change
}

type PaymentAuditLogCreationAttributes = Optional<PaymentAuditLogAttributes, 'id' | 'toInscriptionId' | 'performedByPersonId'>;

/**
 * Append-only trail of corrections to payments (deleted or moved to another
 * student), with who did it, why, and what the payment looked like.
 */
class PaymentAuditLog
  extends Model<PaymentAuditLogAttributes, PaymentAuditLogCreationAttributes>
  implements PaymentAuditLogAttributes
{
  public id!: number;
  public paymentId!: number;
  public action!: PaymentAuditAction;
  public fromInscriptionId!: number;
  public toInscriptionId!: number | null;
  public performedByPersonId!: number | null;
  public reason!: string;
  public snapshot!: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

PaymentAuditLog.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    paymentId: { type: DataTypes.INTEGER, allowNull: false },
    action: { type: DataTypes.STRING(20), allowNull: false },
    fromInscriptionId: { type: DataTypes.INTEGER, allowNull: false },
    toInscriptionId: { type: DataTypes.INTEGER, allowNull: true },
    performedByPersonId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'people', key: 'id' },
    },
    reason: { type: DataTypes.STRING(500), allowNull: false },
    snapshot: { type: DataTypes.TEXT, allowNull: false },
  },
  {
    sequelize,
    tableName: 'payment_audit_logs',
    indexes: [
      { fields: ['paymentId'] },
      { fields: ['fromInscriptionId'] },
      { fields: ['toInscriptionId'] },
    ],
  }
);

export default PaymentAuditLog;
