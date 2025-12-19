import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';

interface SpecializationAttributes {
  id: number;
  name: string;
}

interface SpecializationCreationAttributes extends Optional<SpecializationAttributes, 'id'> {}

class Specialization
  extends Model<SpecializationAttributes, SpecializationCreationAttributes>
  implements SpecializationAttributes {
  public id!: number;
  public name!: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Specialization.init(
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
    tableName: 'specializations',
  }
);

export default Specialization;
