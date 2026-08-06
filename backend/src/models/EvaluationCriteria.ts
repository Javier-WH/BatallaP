import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';
import EvaluationPlan from './EvaluationPlan';

interface EvaluationCriteriaAttributes {
  id: number;
  evaluationPlanId: number;
  name: string;
  points: number;
}

type EvaluationCriteriaCreationAttributes = Optional<EvaluationCriteriaAttributes, 'id'>;

class EvaluationCriteria extends Model<EvaluationCriteriaAttributes, EvaluationCriteriaCreationAttributes> implements EvaluationCriteriaAttributes {
  public id!: number;
  public evaluationPlanId!: number;
  public name!: string;
  public points!: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

EvaluationCriteria.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    evaluationPlanId: {
      type: DataTypes.INTEGER,
      references: { model: EvaluationPlan, key: 'id' },
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    points: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    sequelize,
    tableName: 'evaluation_criteria',
  }
);

export default EvaluationCriteria;
