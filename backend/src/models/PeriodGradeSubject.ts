import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';
import PeriodGrade from './PeriodGrade';
import Subject from './Subject';

interface PeriodGradeSubjectAttributes {
  id: number;
  periodGradeId: number;
  subjectId: number;
  order?: number | null;
  active: boolean;
  includeInAverage: boolean;
  weeklyBlocks: number;
}

interface PeriodGradeSubjectCreationAttributes extends Optional<PeriodGradeSubjectAttributes, 'id' | 'active' | 'includeInAverage' | 'weeklyBlocks'> { }

class PeriodGradeSubject extends Model<PeriodGradeSubjectAttributes, PeriodGradeSubjectCreationAttributes> implements PeriodGradeSubjectAttributes {
  public id!: number;
  public periodGradeId!: number;
  public subjectId!: number;
  public order?: number | null;
  public active!: boolean;
  public includeInAverage!: boolean;
  public weeklyBlocks!: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

PeriodGradeSubject.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    periodGradeId: {
      type: DataTypes.INTEGER,
      references: { model: PeriodGrade, key: 'id' },
      allowNull: false
    },
    subjectId: {
      type: DataTypes.INTEGER,
      references: { model: Subject, key: 'id' },
      allowNull: false
    },
    order: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    includeInAverage: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    weeklyBlocks: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 2,
    },
  },
  {
    sequelize,
    tableName: 'period_grade_subjects',
    defaultScope: {
      where: { active: true },
    },
    indexes: [
      {
        unique: true,
        fields: ['periodGradeId', 'subjectId']
      }
    ]
  }
);

export default PeriodGradeSubject;
