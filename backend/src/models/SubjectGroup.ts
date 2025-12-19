import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';

interface SubjectGroupAttributes {
  id: number;
  name: string;
}

interface SubjectGroupCreationAttributes extends Optional<SubjectGroupAttributes, 'id'> { }

class SubjectGroup extends Model<SubjectGroupAttributes, SubjectGroupCreationAttributes> implements SubjectGroupAttributes {
  public id!: number;
  public name!: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

SubjectGroup.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
  },
  {
    sequelize,
    tableName: 'subject_groups',
  }
);

export default SubjectGroup;
