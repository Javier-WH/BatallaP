import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';
import Inscription from './Inscription';
import Term from './Term';
import SchoolPeriod from './SchoolPeriod';
import Person from './Person';

interface StudentObservationAttributes {
  id: number;
  inscriptionId: number;
  termId: number;
  schoolPeriodId: number;
  teacherId: number;
  text: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface StudentObservationCreationAttributes extends Optional<StudentObservationAttributes, 'id'> {}

class StudentObservation extends Model<StudentObservationAttributes, StudentObservationCreationAttributes> implements StudentObservationAttributes {
  public id!: number;
  public inscriptionId!: number;
  public termId!: number;
  public schoolPeriodId!: number;
  public teacherId!: number;
  public text!: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

StudentObservation.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    inscriptionId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: Inscription, key: 'id' },
    },
    termId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: Term, key: 'id' },
    },
    schoolPeriodId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: SchoolPeriod, key: 'id' },
    },
    teacherId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: Person, key: 'id' },
    },
    text: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '',
    },
  },
  {
    sequelize,
    tableName: 'student_observations',
    indexes: [
      {
        unique: true,
        fields: ['inscriptionId', 'termId'],
        name: 'unique_observation_per_inscription_term',
      },
    ],
  }
);

export default StudentObservation;
