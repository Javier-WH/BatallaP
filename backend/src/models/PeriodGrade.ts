import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';
import SchoolPeriod from './SchoolPeriod';
import Grade from './Grade';
import Specialization from './Specialization';

interface PeriodGradeAttributes {
  id: number;
  schoolPeriodId: number;
  gradeId: number;
  specializationId?: number | null;
}

interface PeriodGradeCreationAttributes extends Optional<PeriodGradeAttributes, 'id'> { }

class PeriodGrade extends Model<PeriodGradeAttributes, PeriodGradeCreationAttributes> implements PeriodGradeAttributes {
  public id!: number;
  public schoolPeriodId!: number;
  public gradeId!: number;
  public specializationId?: number | null;

  public readonly subjects?: import('./Subject').default[];

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

PeriodGrade.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    schoolPeriodId: {
      type: DataTypes.INTEGER,
      references: { model: SchoolPeriod, key: 'id' },
      allowNull: false
    },
    gradeId: {
      type: DataTypes.INTEGER,
      references: { model: Grade, key: 'id' },
      allowNull: false
    },
    specializationId: {
      type: DataTypes.INTEGER,
      references: { model: Specialization, key: 'id' },
      allowNull: true,
    }
  },
  {
    sequelize,
    tableName: 'period_grades',
    indexes: [
      {
        unique: true,
        fields: ['schoolPeriodId', 'gradeId', 'specializationId']
      }
    ]
  }
);

export default PeriodGrade;
