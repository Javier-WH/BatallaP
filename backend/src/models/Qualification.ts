import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';
import EvaluationPlan from './EvaluationPlan';
import InscriptionSubject from './InscriptionSubject';

interface QualificationAttributes {
  id: number;
  evaluationPlanId: number;
  inscriptionSubjectId: number;
  score: number;
  observations?: string;
  remedialScore?: number;
  isAbsent: boolean;
  schoolPeriodId?: number | null;
  termId?: number | null;
  subjectId?: number | null;
  gradeId?: number | null;
  sectionId?: number | null;
  date?: Date | null;
}

interface QualificationCreationAttributes extends Optional<QualificationAttributes, 'id' | 'observations' | 'remedialScore' | 'isAbsent' | 'schoolPeriodId' | 'termId' | 'subjectId' | 'gradeId' | 'sectionId' | 'date'> { }

class Qualification extends Model<QualificationAttributes, QualificationCreationAttributes> implements QualificationAttributes {
  public id!: number;
  public evaluationPlanId!: number;
  public inscriptionSubjectId!: number;
  public score!: number;
  public observations!: string;
  public remedialScore!: number;
  public isAbsent!: boolean;
  public schoolPeriodId!: number | null;
  public termId!: number | null;
  public subjectId!: number | null;
  public gradeId!: number | null;
  public sectionId!: number | null;
  public date!: Date | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Qualification.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    evaluationPlanId: {
      type: DataTypes.INTEGER,
      references: { model: EvaluationPlan, key: 'id' },
      allowNull: false
    },
    inscriptionSubjectId: {
      type: DataTypes.INTEGER,
      references: { model: InscriptionSubject, key: 'id' },
      allowNull: false
    },
    score: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      validate: {
        min: 0
      }
    },
    remedialScore: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      validate: {
        min: 0
      }
    },
    isAbsent: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    observations: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    schoolPeriodId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Denormalizado desde PeriodGrade.schoolPeriodId via EvaluationPlan',
    },
    termId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Denormalizado desde EvaluationPlan.termId',
    },
    subjectId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Denormalizado desde PeriodGradeSubject.subjectId via EvaluationPlan',
    },
    gradeId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Denormalizado desde PeriodGrade.gradeId via EvaluationPlan',
    },
    sectionId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Denormalizado desde EvaluationPlan.sectionId',
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: 'Denormalizado desde EvaluationPlan.date',
    }
  },
  {
    sequelize,
    tableName: 'qualifications',
    indexes: [
      {
        unique: true,
        fields: ['evaluationPlanId', 'inscriptionSubjectId'] // A student gets one score per evaluation item
      },
      {
        fields: ['schoolPeriodId', 'gradeId', 'subjectId', 'termId'],
        name: 'idx_qualifications_context',
      }
    ]
  }
);

export default Qualification;
