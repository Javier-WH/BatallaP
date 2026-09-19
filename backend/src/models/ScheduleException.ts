import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';
import Subject from './Subject';

interface ScheduleExceptionAttributes {
  id: number;
  subjectId: number;
  allowConsecutiveBlocks: number | null; // null = use Subject default, 0/1/2 = override
  weeklyBlocks: number | null; // null = use PeriodGradeSubject default
  maxHoursPerDay: number | null; // null = no limit
  difficulty: string | null; // null = use Subject default, 'heavy'/'medium'/'light' = override
  forcedSlot: string | null; // null = none, 'first_morning' | 'last_afternoon' = strongly prefer that slot each day
}

interface ScheduleExceptionCreationAttributes extends Optional<ScheduleExceptionAttributes, 'id' | 'allowConsecutiveBlocks' | 'weeklyBlocks' | 'maxHoursPerDay' | 'difficulty' | 'forcedSlot'> { }

class ScheduleException extends Model<ScheduleExceptionAttributes, ScheduleExceptionCreationAttributes> implements ScheduleExceptionAttributes {
  public id!: number;
  public subjectId!: number;
  public allowConsecutiveBlocks!: number | null;
  public weeklyBlocks!: number | null;
  public maxHoursPerDay!: number | null;
  public difficulty!: string | null;
  public forcedSlot!: string | null;

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
    difficulty: {
      type: DataTypes.STRING(10),
      allowNull: true,
      defaultValue: null,
    },
    forcedSlot: {
      type: DataTypes.STRING(20),
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
