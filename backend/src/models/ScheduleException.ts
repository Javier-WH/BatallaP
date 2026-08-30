import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';
import Subject from './Subject';

interface ScheduleExceptionAttributes {
  id: number;
  subjectId: number;
  allowConsecutiveBlocks: number | null; // null = use Subject default, 0/1/2 = override
  weeklyBlocks: number | null; // null = use PeriodGradeSubject default
  maxHoursPerDay: number | null; // null = no limit
}

interface ScheduleExceptionCreationAttributes extends Optional<ScheduleExceptionAttributes, 'id' | 'allowConsecutiveBlocks' | 'weeklyBlocks' | 'maxHoursPerDay'> { }

class ScheduleException extends Model<ScheduleExceptionAttributes, ScheduleExceptionCreationAttributes> implements ScheduleExceptionAttributes {
  public id!: number;
  public subjectId!: number;
  public allowConsecutiveBlocks!: number | null;
  public weeklyBlocks!: number | null;
  public maxHoursPerDay!: number | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

ScheduleException.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    subjectId: {
      type: DataTypes.INTEGER,
      references: { model: Subject, key: 'id' },
      allowNull: false,
      unique: true,
    },
    allowConsecutiveBlocks: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
    },
    weeklyBlocks: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
    },
    maxHoursPerDay: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
    },
  },
  {
    sequelize,
    tableName: 'schedule_exceptions',
  }
);

export default ScheduleException;
