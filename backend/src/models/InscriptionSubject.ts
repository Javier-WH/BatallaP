import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';
import Inscription from './Inscription';
import Subject from './Subject';

interface InscriptionSubjectAttributes {
  id: number;
  inscriptionId: number;
  subjectId: number;
  schoolPeriodId?: number | null;
  gradeId?: number | null;
  sectionId?: number | null;
  subject?: any;
  inscription?: any;
  finalGrade?: any;
}

interface InscriptionSubjectCreationAttributes extends Optional<InscriptionSubjectAttributes, 'id' | 'schoolPeriodId' | 'gradeId' | 'sectionId'> { }

class InscriptionSubject extends Model<InscriptionSubjectAttributes, InscriptionSubjectCreationAttributes> implements InscriptionSubjectAttributes {
  public id!: number;
  public inscriptionId!: number;
  public subjectId!: number;
  public schoolPeriodId!: number | null;
  public gradeId!: number | null;
  public sectionId!: number | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public subject?: any;
  public inscription?: any;
  public finalGrade?: any;
}

InscriptionSubject.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    inscriptionId: {
      type: DataTypes.INTEGER,
      references: { model: Inscription, key: 'id' },
      allowNull: false
    },
    subjectId: {
      type: DataTypes.INTEGER,
      references: { model: Subject, key: 'id' },
      allowNull: false
    },
    schoolPeriodId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Denormalizado desde Inscription.schoolPeriodId',
    },
    gradeId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Denormalizado desde Inscription.gradeId',
    },
    sectionId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Denormalizado desde Inscription.sectionId',
    }
  },
  {
    sequelize,
    tableName: 'inscription_subjects',
    indexes: [
      {
        unique: true,
        fields: ['inscriptionId', 'subjectId']
      },
      {
        fields: ['schoolPeriodId', 'gradeId', 'subjectId'],
        name: 'idx_inscription_subjects_context',
      }
    ]
  }
);

export default InscriptionSubject;
