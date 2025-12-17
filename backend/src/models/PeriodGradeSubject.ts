import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';
import PeriodGrade from './PeriodGrade';
import Subject from './Subject';

interface PeriodGradeSubjectAttributes {
  id: number;
  periodGradeId: number;
  subjectId: number;
}

interface PeriodGradeSubjectCreationAttributes extends Optional<PeriodGradeSubjectAttributes, 'id'> { }

class PeriodGradeSubject extends Model<PeriodGradeSubjectAttributes, PeriodGradeSubjectCreationAttributes> implements PeriodGradeSubjectAttributes {
  public id!: number;
  public periodGradeId!: number;
  public subjectId!: number;

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
    }
  },
  {
    sequelize,
    tableName: 'period_grade_subjects',
    indexes: [
      {
        unique: true,
        fields: ['periodGradeId', 'subjectId']
      }
    ]
  }
);

export default PeriodGradeSubject;
