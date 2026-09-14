import { DataTypes, Model, Optional, UUID } from 'sequelize';
import sequelize from '@/config/database';
import AttendanceRecord from './AttendanceRecord';
import Person from './Person';

export type AttendanceAuditAction = 'marked' | 'blocked' | 'cleared' | 'status_changed';

interface AttendanceAuditLogAttributes {
  id: number;
  attendanceRecordId: number;
  action: AttendanceAuditLogAction;
  performedBy: number | null; // Person.id
  reasonCode: string | null;
  reasonNote: string | null;
  previousValue: object | null;
  newValue: object | null;
  timestamp: Date;
  clientRecordId: string | null; // idempotency key for future offline sync
  createdAt?: Date;
  updatedAt?: Date;
}

// Alias kept for readability inside this file
type AttendanceAuditLogAction = AttendanceAuditAction;

type AttendanceAuditLogCreationAttributes = Optional<
  AttendanceAuditLogAttributes,
  'id' | 'performedBy' | 'reasonCode' | 'reasonNote' | 'previousValue' | 'newValue' | 'clientRecordId' | 'createdAt' | 'updatedAt'
>;

/**
 * Append-only audit trail for attendance changes. Rows are never updated or
 * deleted — every mark, block, clear and status change inserts a new row so
 * the school can review patterns and make decisions later.
 */
class AttendanceAuditLog
  extends Model<AttendanceAuditLogAttributes, AttendanceAuditLogCreationAttributes>
  implements AttendanceAuditLogAttributes
{
  public id!: number;
  public attendanceRecordId!: number;
  public action!: AttendanceAuditAction;
  public performedBy!: number | null;
  public reasonCode!: string | null;
  public reasonNote!: string | null;
  public previousValue!: object | null;
  public newValue!: object | null;
  public timestamp!: Date;
  public clientRecordId!: string | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

AttendanceAuditLog.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    attendanceRecordId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: AttendanceRecord, key: 'id' },
      onDelete: 'CASCADE',
    },
    action: {
      type: DataTypes.ENUM('marked', 'blocked', 'cleared', 'status_changed'),
      allowNull: false,
    },
    performedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: Person, key: 'id' },
      onDelete: 'SET NULL',
    },
    reasonCode: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    reasonNote: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    previousValue: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    newValue: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    timestamp: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    clientRecordId: {
      type: UUID,
      allowNull: true,
      unique: true,
    },
  },
  {
    sequelize,
    tableName: 'attendance_audit_log',
    indexes: [
      {
        fields: ['attendanceRecordId'],
      },
      {
        fields: ['performedBy'],
      },
    ],
  }
);

export default AttendanceAuditLog;
