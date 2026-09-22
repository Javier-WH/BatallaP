import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';
import PeriodGrade from './PeriodGrade';
import PeriodGradeSection from './PeriodGradeSection';
import Subject from './Subject';

interface ScheduleDayTurnExceptionAttributes {
  id: number;
  periodGradeId: number; // scope: all sections of this grade
  periodGradeSectionId: number | null; // null = whole grade; set = this one class only
  subjectId: number;
  day: string; // 'Lunes' | 'Martes' | 'Miércoles' | 'Jueves' | 'Viernes'
  turn: string; // 'manana' | 'tarde'
  mode: string; // 'soft' = strong preference, 'hard' = absolute rule
  weight: number | null; // soft-mode penalty override; null = solver default
}

interface ScheduleDayTurnExceptionCreationAttributes extends Optional<ScheduleDayTurnExceptionAttributes, 'id' | 'periodGradeSectionId' | 'mode' | 'weight'> { }

class ScheduleDayTurnException extends Model<ScheduleDayTurnExceptionAttributes, ScheduleDayTurnExceptionCreationAttributes> implements ScheduleDayTurnExceptionAttributes {
  public id!: number;
  public periodGradeId!: number;
  public periodGradeSectionId!: number | null;
  public subjectId!: number;
  public day!: string;
  public turn!: string;
  public mode!: string;
  public weight!: number | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

ScheduleDayTurnException.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    periodGradeId: {
      type: DataTypes.INTEGER,
      references: { model: PeriodGrade, key: 'id' },
      allowNull: false,
    },
    periodGradeSectionId: {
      type: DataTypes.INTEGER,
      references: { model: PeriodGradeSection, key: 'id' },
      allowNull: true,
      defaultValue: null,
    },
    subjectId: {
      type: DataTypes.INTEGER,
      references: { model: Subject, key: 'id' },
      allowNull: false,
    },
    day: {
      type: DataTypes.STRING(15),
      allowNull: false,
    },
    turn: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },
    mode: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: 'hard',
    },
    weight: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
    },
  },
  {
    sequelize,
    tableName: 'schedule_day_turn_exceptions',
    indexes: [
      {
        unique: true,
        fields: ['periodGradeId', 'periodGradeSectionId', 'subjectId'],
        name: 'schedule_day_turn_exceptions_pg_section_subject_unique',
      },
    ],
  }
);

export default ScheduleDayTurnException;
