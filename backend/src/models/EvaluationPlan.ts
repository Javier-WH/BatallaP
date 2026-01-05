import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';
import PeriodGradeSubject from './PeriodGradeSubject';
import Term from './Term';

interface EvaluationPlanAttributes {
  id: number;
  periodGradeSubjectId: number;
  sectionId: number;
  termId: number; // Reference to Term model instead of hardcoded numbers
  description: string;
  objetivo: string;
  percentage: number;
  date: Date;
}

interface EvaluationPlanCreationAttributes extends Optional<EvaluationPlanAttributes, 'id'> { }

class EvaluationPlan extends Model<EvaluationPlanAttributes, EvaluationPlanCreationAttributes> implements EvaluationPlanAttributes {
  public id!: number;
  public periodGradeSubjectId!: number;
  public sectionId!: number;
  public termId!: number; // Reference to Term model
  public description!: string;
  public objetivo!: string;
  public percentage!: number;
  public date!: Date;

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
