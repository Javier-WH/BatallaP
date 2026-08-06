import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';
import ThematicComponent from './ThematicComponent';

interface ThematicContentAttributes {
  id: number;
  thematicComponentId: number;
  title: string;
  order: number;
}

type ThematicContentCreationAttributes = Optional<ThematicContentAttributes, 'id' | 'order'>;

class ThematicContent extends Model<ThematicContentAttributes, ThematicContentCreationAttributes> implements ThematicContentAttributes {
  public id!: number;
  public thematicComponentId!: number;
  public title!: string;
  public order!: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

ThematicContent.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    thematicComponentId: {
      type: DataTypes.INTEGER,
      references: { model: ThematicComponent, key: 'id' },
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(500),
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
    tableName: 'thematic_contents',
  }
);

export default ThematicContent;
