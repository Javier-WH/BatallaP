import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';
import PeriodGradeSubject from './PeriodGradeSubject';
import Term from './Term';

interface EvaluationPlanAttributes {
  id: number;
  periodGradeSubjectId: number;
  sectionId: number;
  termId: number;
  description: string;
  objetivo: string;
  tecnica: string;
  identificador: string;
  percentage: number;
  date: Date;
  temaGenerador?: string;
  referentesTeoricos?: string;
  referentesEticos?: string;
  estrategiaEvaluacion?: string;
  tipoEvaluacion?: string;
  formaEvaluacion?: string;
  indicador?: string;
}

interface EvaluationPlanCreationAttributes extends Optional<EvaluationPlanAttributes, 'id'> { }

class EvaluationPlan extends Model<EvaluationPlanAttributes, EvaluationPlanCreationAttributes> implements EvaluationPlanAttributes {
  public id!: number;
  public periodGradeSubjectId!: number;
  public sectionId!: number;
  public termId!: number;
  public description!: string;
  public objetivo!: string;
  public tecnica!: string;
  public identificador!: string;
  public percentage!: number;
  public date!: Date;
  public temaGenerador?: string;
  public referentesTeoricos?: string;
  public referentesEticos?: string;
  public estrategiaEvaluacion?: string;
  public tipoEvaluacion?: string;
  public formaEvaluacion?: string;
  public indicador?: string;

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
    objetivo: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    tecnica: {
      type: DataTypes.STRING(30),
      allowNull: false
    },
    identificador: {
      type: DataTypes.STRING(15),
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
    temaGenerador: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    referentesTeoricos: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    referentesEticos: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    estrategiaEvaluacion: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    tipoEvaluacion: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    formaEvaluacion: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    indicador: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  },
  {
    sequelize,
    tableName: 'evaluation_plans',
    hooks: {
      beforeSave: async (plan: EvaluationPlan) => {
        const { Op } = require('sequelize');
        const currentSum = await EvaluationPlan.sum('percentage', {
          where: {
            periodGradeSubjectId: plan.periodGradeSubjectId,
            sectionId: plan.sectionId,
            termId: plan.termId,
            id: { [Op.ne]: plan.id || 0 }
          }
        }) || 0;

        if (Number(currentSum) + Number(plan.percentage) > 100) {
          throw new Error(`La suma de los porcentajes para este lapso no puede superar el 100%`);
        }
      }
    }
  }
);

export default EvaluationPlan;
