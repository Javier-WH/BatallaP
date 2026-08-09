import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';
import EvaluationCriteria from './EvaluationCriteria';

interface EvaluationIndicatorAttributes {
  id: number;
  evaluationCriteriaId: number;
  name: string;
  points: number;
}

type EvaluationIndicatorCreationAttributes = Optional<EvaluationIndicatorAttributes, 'id'>;

class EvaluationIndicator extends Model<EvaluationIndicatorAttributes, EvaluationIndicatorCreationAttributes> implements EvaluationIndicatorAttributes {
  public id!: number;
  public evaluationCriteriaId!: number;
  public name!: string;
  public points!: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

EvaluationIndicator.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    evaluationCriteriaId: {
      type: DataTypes.INTEGER,
      references: { model: EvaluationCriteria, key: 'id' },
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
    tableName: 'evaluation_indicators',
  }
);

export default EvaluationIndicator;
