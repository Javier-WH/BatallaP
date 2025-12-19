import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';

interface GradeAttributes {
  id: number;
  name: string;
  isDiversified: boolean;
  order?: number | null;
}

interface GradeCreationAttributes extends Optional<GradeAttributes, 'id'> { }

class Grade extends Model<GradeAttributes, GradeCreationAttributes> implements GradeAttributes {
  public id!: number;
  public name!: string;
  public isDiversified!: boolean;
  public order?: number | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Grade.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    isDiversified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    order: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'grades',
  }
);

export default Grade;
