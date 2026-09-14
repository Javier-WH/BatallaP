import { DataTypes, Model, Optional, UUID } from 'sequelize';
import sequelize from '@/config/database';
import AttendanceSession from './AttendanceSession';
import Inscription from './Inscription';
import Person from './Person';

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused' | 'kicked';

interface AttendanceRecordAttributes {
  id: number;
  sessionId: number;
  inscriptionId: number;
  teacherId: number | null; // who marked the record
  status: AttendanceStatus;
  reason: string | null; // required for absent/kicked
  blocked: boolean; // flagged as blocked at session start (prior absence/kick today)
  clearedBy: number | null; // teacher who cleared the block
  clearedAt: Date | null;
  clearanceReasonCode: string | null;
  clearanceReasonNote: string | null;
  markedAt: Date;
  recordedOffline: boolean;
  syncedAt: Date | null;
  clientRecordId: string | null; // idempotency key for future offline sync
  createdAt?: Date;
  updatedAt?: Date;
}

type AttendanceRecordCreationAttributes = Optional<
  AttendanceRecordAttributes,
  'id' | 'teacherId' | 'reason' | 'blocked' | 'clearedBy' | 'clearedAt' | 'clearanceReasonCode' | 'clearanceReasonNote' | 'recordedOffline' | 'syncedAt' | 'clientRecordId' | 'createdAt' | 'updatedAt'
>;

/**
 * Attendance of one student in one session. Upserted by (sessionId, inscriptionId).
 * Every status change is mirrored in AttendanceAuditLog (append-only).
 */
class AttendanceRecord
  extends Model<AttendanceRecordAttributes, AttendanceRecordCreationAttributes>
  implements AttendanceRecordAttributes
{
  public id!: number;
  public sessionId!: number;
  public inscriptionId!: number;
  public teacherId!: number | null;
  public status!: AttendanceStatus;
  public reason!: string | null;
  public blocked!: boolean;
  public clearedBy!: number | null;
  public clearedAt!: Date | null;
  public clearanceReasonCode!: string | null;
  public clearanceReasonNote!: string | null;
  public markedAt!: Date;
  public recordedOffline!: boolean;
  public syncedAt!: Date | null;
  public clientRecordId!: string | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

AttendanceRecord.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    sessionId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: AttendanceSession, key: 'id' },
      onDelete: 'CASCADE',
    },
    inscriptionId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: Inscription, key: 'id' },
      onDelete: 'CASCADE',
    },
    teacherId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: Person, key: 'id' },
      onDelete: 'SET NULL',
    },
    status: {
      type: DataTypes.ENUM('present', 'absent', 'late', 'excused', 'kicked'),
      allowNull: false,
      defaultValue: 'present',
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    blocked: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    clearedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: Person, key: 'id' },
      onDelete: 'SET NULL',
    },
    clearedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    clearanceReasonCode: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    clearanceReasonNote: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    markedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    recordedOffline: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    syncedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    clientRecordId: {
      type: UUID,
      allowNull: true,
      unique: true,
    },
  },
  {
    sequelize,
    tableName: 'attendance_records',
    indexes: [
      {
        unique: true,
        fields: ['sessionId', 'inscriptionId'],
        name: 'uq_attendance_records_session_inscription',
      },
      {
        fields: ['inscriptionId'],
      },
    ],
  }
);

export default AttendanceRecord;
