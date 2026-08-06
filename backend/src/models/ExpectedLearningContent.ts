import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';

interface ExpectedLearningContentAttributes {
  id: number;
  learningId: number;
  contentId: number;
}

type ExpectedLearningContentCreationAttributes = Optional<ExpectedLearningContentAttributes, 'id'>;

class ExpectedLearningContent extends Model<ExpectedLearningContentAttributes, ExpectedLearningContentCreationAttributes> implements ExpectedLearningContentAttributes {
  public id!: number;
  public learningId!: number;
  public contentId!: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

ExpectedLearningContent.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    learningId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    contentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'expected_learning_contents',
  }
);

export default ExpectedLearningContent;
