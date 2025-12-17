import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';

interface GradeAttributes {
  id: number;
  name: string;
}

interface GradeCreationAttributes extends Optional<GradeAttributes, 'id'> { }

class Grade extends Model<GradeAttributes, GradeCreationAttributes> implements GradeAttributes {
  public id!: number;
  public name!: string;

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
  },
  {
    sequelize,
    tableName: 'grades',
  }
);

export default Grade;
