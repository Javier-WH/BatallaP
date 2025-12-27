import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';
import SchoolPeriod from './SchoolPeriod';
import Grade from './Grade';
import Section from './Section';
import Person from './Person';
import { EscolaridadStatus } from '@/types/enrollment';

interface InscriptionAttributes {
  id: number;
  schoolPeriodId: number;
  gradeId: number;
  sectionId?: number;
  personId: number;
  escolaridad: EscolaridadStatus;
  originPeriodId?: number | null;
  isRepeater: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

interface InscriptionCreationAttributes
  extends Optional<InscriptionAttributes, 'id' | 'sectionId' | 'originPeriodId' | 'isRepeater'> {}

class Inscription extends Model<InscriptionAttributes, InscriptionCreationAttributes> implements InscriptionAttributes {
  public id!: number;
  public schoolPeriodId!: number;
  public gradeId!: number;
  public sectionId!: number; // Can be null, types/nullability handled by Sequelize
  public personId!: number;
  public escolaridad!: EscolaridadStatus;
  public originPeriodId!: number | null;
  public isRepeater!: boolean;

  public readonly subjects?: import('./Subject').default[];

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Inscription.init(
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
    sectionId: {
      type: DataTypes.INTEGER,
      references: { model: Section, key: 'id' },
      allowNull: true
    },
    personId: {
      type: DataTypes.INTEGER,
      references: { model: Person, key: 'id' },
      allowNull: false
    },
    escolaridad: {
      type: DataTypes.ENUM('regular', 'repitiente', 'materia_pendiente'),
      allowNull: false,
      defaultValue: 'regular'
    },
    originPeriodId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: SchoolPeriod,
        key: 'id'
      }
    },
    isRepeater: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    }
  },
  {
    sequelize,
    tableName: 'inscriptions',
    indexes: [
      {
        unique: true,
        fields: ['schoolPeriodId', 'personId'] // Student can only be enrolled once per period
      }
    ]
  }
);

export default Inscription;
