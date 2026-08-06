import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';

interface ExpectedLearningAttributes {
  id: number;
  description: string;
  order: number;
}

type ExpectedLearningCreationAttributes = Optional<ExpectedLearningAttributes, 'id' | 'order'>;

class ExpectedLearning extends Model<ExpectedLearningAttributes, ExpectedLearningCreationAttributes> implements ExpectedLearningAttributes {
  public id!: number;
  public description!: string;
  public order!: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

ExpectedLearning.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    sequelize,
    tableName: 'expected_learnings',
  }
);

export default ExpectedLearning;
