import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';
import ScheduleEntry from './ScheduleEntry';
import SchoolPeriod from './SchoolPeriod';

export type AttendanceSessionStatus = 'pending' | 'completed' | 'cancelled';

interface AttendanceSessionAttributes {
  id: number;
  scheduleEntryId: number;
  schoolPeriodId: number;
  sessionDate: string; // DATEONLY (YYYY-MM-DD)
  status: AttendanceSessionStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

type AttendanceSessionCreationAttributes = Optional<
  AttendanceSessionAttributes,
  'id' | 'status' | 'createdAt' | 'updatedAt'
>;

/**
 * A concrete attendance session: one scheduled class (ScheduleEntry) on a
 * specific calendar date. Created on demand when a teacher opens the module
 * for a date (today or a past date for paper backfill).
 */
class AttendanceSession
  extends Model<AttendanceSessionAttributes, AttendanceSessionCreationAttributes>
  implements AttendanceSessionAttributes
{
  public id!: number;
  public scheduleEntryId!: number;
  public schoolPeriodId!: number;
  public sessionDate!: string;
  public status!: AttendanceSessionStatus;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

AttendanceSession.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    scheduleEntryId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: ScheduleEntry, key: 'id' },
      onDelete: 'CASCADE',
    },
    schoolPeriodId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: SchoolPeriod, key: 'id' },
      onDelete: 'CASCADE',
    },
    sessionDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('pending', 'completed', 'cancelled'),
      allowNull: false,
      defaultValue: 'pending',
    },
  },
  {
    sequelize,
    tableName: 'attendance_sessions',
    indexes: [
      {
        unique: true,
        fields: ['scheduleEntryId', 'sessionDate'],
        name: 'uq_attendance_sessions_entry_date',
      },
      {
        fields: ['schoolPeriodId', 'sessionDate'],
      },
    ],
  }
);

export default AttendanceSession;
