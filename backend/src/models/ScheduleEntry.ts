import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';

interface ScheduleEntryAttributes {
  id: number;
  scheduleId: number;
  day: string;          // Lunes, Martes, etc.
  periodId: string;     // m1, m2, t1, etc. (matches teacher_availability periodId)
  subjectId: number | null;   // the subject being taught
  teacherId: number | null;    // the personId of the teacher
  isGroupSubject: boolean;     // true if multiple sections share this slot
}

interface ScheduleEntryCreationAttributes extends Optional<ScheduleEntryAttributes, 'id' | 'isGroupSubject'> {}

class ScheduleEntry extends Model<ScheduleEntryAttributes, ScheduleEntryCreationAttributes> implements ScheduleEntryAttributes {
  public id!: number;
  public scheduleId!: number;
  public day!: string;
  public periodId!: string;
  public subjectId!: number | null;
  public teacherId!: number | null;
  public isGroupSubject!: boolean;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

ScheduleEntry.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  scheduleId: {
    type: DataTypes.INTEGER, allowNull: false,
    references: { model: 'schedules', key: 'id' }, onDelete: 'CASCADE',
  },
  day: { type: DataTypes.STRING(20), allowNull: false },
  periodId: { type: DataTypes.STRING(20), allowNull: false, field: 'period_id' },
  subjectId: {
    type: DataTypes.INTEGER, allowNull: true,
    references: { model: 'subjects', key: 'id' }, onDelete: 'SET NULL',
  },
  teacherId: {
    type: DataTypes.INTEGER, allowNull: true,
    references: { model: 'people', key: 'id' }, onDelete: 'SET NULL',
  },
  isGroupSubject: {
    type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false,
  },
}, {
  sequelize,
  tableName: 'schedule_entries',
  indexes: [
    // Prevent exact duplicate (same subject in same slot) but allow multiple group subjects
    { unique: true, fields: ['scheduleId', 'day', 'period_id', 'subjectId'] },
  ],
});

export default ScheduleEntry;
