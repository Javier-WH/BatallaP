import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';
import ThematicContent from './ThematicContent';

interface ExpectedLearningAttributes {
  id: number;
  thematicContentId: number;
  description: string;
  order: number;
}

type ExpectedLearningCreationAttributes = Optional<ExpectedLearningAttributes, 'id' | 'order'>;

class ExpectedLearning extends Model<ExpectedLearningAttributes, ExpectedLearningCreationAttributes> implements ExpectedLearningAttributes {
  public id!: number;
  public thematicContentId!: number;
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
    thematicContentId: {
      type: DataTypes.INTEGER,
      references: { model: ThematicContent, key: 'id' },
      allowNull: false,
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
