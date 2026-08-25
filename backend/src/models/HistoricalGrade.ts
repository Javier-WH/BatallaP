import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';
import Person from './Person';
import Grade from './Grade';
import Subject from './Subject';
import SchoolPeriod from './SchoolPeriod';
import Plantel from './Plantel';
import User from './User';

export type HistoricalGradeStatus = 'aprobada' | 'reprobada';
export type HistoricalGradeType = 'regular' | 'revision' | 'materia_pendiente' | 'transferencia' | 'equivalencia';

interface HistoricalGradeAttributes {
  id: number;
  personId: number;
  gradeId: number;
  subjectId: number;
  schoolPeriodId?: number | null;
  finalScore: number | null;
  status: HistoricalGradeStatus;
  gradeType: HistoricalGradeType;
  plantelId?: number | null;
  date?: string | null;
  notes?: string | null;
  createdBy?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type HistoricalGradeCreationAttributes = Optional<
  HistoricalGradeAttributes,
  'id' | 'schoolPeriodId' | 'finalScore' | 'status' | 'gradeType' | 'plantelId' | 'date' | 'notes' | 'createdBy' | 'createdAt' | 'updatedAt'
>;

class HistoricalGrade
  extends Model<HistoricalGradeAttributes, HistoricalGradeCreationAttributes>
  implements HistoricalGradeAttributes
{
  public id!: number;
  public personId!: number;
  public gradeId!: number;
  public subjectId!: number;
  public schoolPeriodId!: number | null;
  public finalScore!: number | null;
  public status!: HistoricalGradeStatus;
  public gradeType!: HistoricalGradeType;
  public plantelId!: number | null;
  public date!: string | null;
  public notes!: string | null;
  public createdBy!: number | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

HistoricalGrade.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    personId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: Person, key: 'id' },
      onDelete: 'CASCADE',
    },
    gradeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: Grade, key: 'id' },
    },
    subjectId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: Subject, key: 'id' },
    },
    schoolPeriodId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: SchoolPeriod, key: 'id' },
    },
    finalScore: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('aprobada', 'reprobada'),
      allowNull: false,
      defaultValue: 'reprobada',
    },
    gradeType: {
      type: DataTypes.ENUM('regular', 'revision', 'materia_pendiente', 'transferencia', 'equivalencia'),
      allowNull: false,
      defaultValue: 'regular',
    },
    plantelId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: Plantel, key: 'id' },
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: User, key: 'id' },
      onDelete: 'SET NULL',
    },
  },
  {
    sequelize,
    tableName: 'historical_grades',
    indexes: [
      {
        unique: true,
        fields: ['personId', 'gradeId', 'subjectId'],
        name: 'uq_historical_grades_person_grade_subject',
      },
    ],
  }
);

export default HistoricalGrade;
