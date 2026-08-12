import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';
import PeriodGradeSubject from './PeriodGradeSubject';
import Term from './Term';
import ThematicComponent from './ThematicComponent';

interface EvaluationPlanAttributes {
  id: number;
  periodGradeSubjectId: number;
  sectionId: number;
  termId: number;
  description: string;
  percentage: number;
  date: Date;
  thematicComponentId?: number | null;
  thematicContentIds?: number[] | null;
  evaluationType?: string | null;
  tecnica?: string | null;
  instrumento?: string | null;
  shortDescription?: string | null;
  tecnicaId?: number | null;
  instrumentoId?: number | null;
  estrategiaId?: number | null;
}

interface EvaluationPlanCreationAttributes extends Optional<EvaluationPlanAttributes, 'id' | 'thematicComponentId' | 'thematicContentIds' | 'evaluationType' | 'tecnica' | 'instrumento' | 'shortDescription' | 'tecnicaId' | 'instrumentoId' | 'estrategiaId'> { }

class EvaluationPlan extends Model<EvaluationPlanAttributes, EvaluationPlanCreationAttributes> implements EvaluationPlanAttributes {
  public id!: number;
  public periodGradeSubjectId!: number;
  public sectionId!: number;
  public termId!: number;
  public description!: string;
  public percentage!: number;
  public date!: Date;
  public thematicComponentId!: number | null;
  public thematicContentIds!: number[] | null;
  public evaluationType!: string | null;
  public tecnica!: string | null;
  public instrumento!: string | null;
  public shortDescription!: string | null;
  public tecnicaId!: number | null;
  public instrumentoId!: number | null;
  public estrategiaId!: number | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

EvaluationPlan.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    periodGradeSubjectId: {
      type: DataTypes.INTEGER,
      references: { model: PeriodGradeSubject, key: 'id' },
      allowNull: false
    },
    sectionId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    termId: {
      type: DataTypes.INTEGER,
      references: { model: Term, key: 'id' },
      allowNull: false
    },
    description: {
      type: DataTypes.STRING,
      allowNull: false
    },
    percentage: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      validate: {
        min: 0,
        max: 100
      }
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    thematicComponentId: {
      type: DataTypes.INTEGER,
      references: { model: ThematicComponent, key: 'id' },
      allowNull: true
    },
    thematicContentIds: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: null,
    },
    evaluationType: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null
    },
    tecnica: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null
    },
    instrumento: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null
    },
    shortDescription: {
      type: DataTypes.STRING(40),
      allowNull: true,
      defaultValue: null
    },
    tecnicaId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null
    },
    instrumentoId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null
    },
    estrategiaId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null
    }
  },
  {
    sequelize,
    tableName: 'evaluation_plans',
  }
);

export default EvaluationPlan;
