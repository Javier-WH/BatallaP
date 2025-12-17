import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';
import PeriodGradeSubject from './PeriodGradeSubject';

interface EvaluationPlanAttributes {
  id: number;
  periodGradeSubjectId: number;
  description: string;
  percentage: number;
  date: Date;
}

interface EvaluationPlanCreationAttributes extends Optional<EvaluationPlanAttributes, 'id'> { }

class EvaluationPlan extends Model<EvaluationPlanAttributes, EvaluationPlanCreationAttributes> implements EvaluationPlanAttributes {
  public id!: number;
  public periodGradeSubjectId!: number;
  public description!: string;
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
            id: { [Op.ne]: plan.id || 0 }
          }
        }) || 0;

        if (Number(currentSum) + Number(plan.percentage) > 100) {
          throw new Error('La suma de los porcentajes del plan de evaluación no puede superar el 100%');
        }
      }
    }
  }
);

export default EvaluationPlan;
