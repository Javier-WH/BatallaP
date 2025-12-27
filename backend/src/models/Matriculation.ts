import { DataTypes, Model, Optional, Association } from 'sequelize';
import sequelize from '@/config/database';
import Person from './Person';
import SchoolPeriod from './SchoolPeriod';
import Grade from './Grade';
import Section from './Section';
import Inscription from './Inscription';
import { EscolaridadStatus } from '@/types/enrollment';

export type MatriculationStatus = 'pending' | 'completed';

interface MatriculationAttributes {
  id: number;
  personId: number;
  schoolPeriodId: number;
  gradeId: number;
  sectionId?: number | null;
  escolaridad: EscolaridadStatus;
  status: MatriculationStatus;
  inscriptionId?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

interface MatriculationCreationAttributes extends Optional<MatriculationAttributes, 'id' | 'sectionId' | 'status' | 'inscriptionId' | 'escolaridad'> {}

class Matriculation extends Model<MatriculationAttributes, MatriculationCreationAttributes> implements MatriculationAttributes {
  public id!: number;
  public personId!: number;
  public schoolPeriodId!: number;
  public gradeId!: number;
  public sectionId!: number | null;
  public escolaridad!: EscolaridadStatus;
  public status!: MatriculationStatus;
  public inscriptionId!: number | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public readonly student?: Person;
  public readonly period?: SchoolPeriod;
  public readonly grade?: Grade;
  public readonly section?: Section;
  public readonly inscription?: Inscription;

  public static associations: {
    student: Association<Matriculation, Person>;
    period: Association<Matriculation, SchoolPeriod>;
    grade: Association<Matriculation, Grade>;
    section: Association<Matriculation, Section>;
    inscription: Association<Matriculation, Inscription>;
  };
}

Matriculation.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    personId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: Person, key: 'id' }
    },
    schoolPeriodId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: SchoolPeriod, key: 'id' }
    },
    gradeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: Grade, key: 'id' }
    },
    sectionId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: Section, key: 'id' }
    },
    escolaridad: {
      type: DataTypes.ENUM('regular', 'repitiente', 'materia_pendiente'),
      allowNull: false,
      defaultValue: 'regular'
    },
    status: {
      type: DataTypes.ENUM('pending', 'completed'),
      allowNull: false,
      defaultValue: 'pending'
    },
    inscriptionId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: Inscription, key: 'id' }
    }
  },
  {
    sequelize,
    tableName: 'matriculations',
    indexes: [
      {
        unique: true,
        fields: ['schoolPeriodId', 'personId']
      }
    ]
  }
);

export default Matriculation;
