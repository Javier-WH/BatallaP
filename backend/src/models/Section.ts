import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';

interface SectionAttributes {
  id: number;
  name: string;
}

interface SectionCreationAttributes extends Optional<SectionAttributes, 'id'> { }

class Section extends Model<SectionAttributes, SectionCreationAttributes> implements SectionAttributes {
  public id!: number;
  public name!: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Section.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true // 'A', 'B', 'C' definition
    },
  },
  {
    sequelize,
    tableName: 'sections',
  }
);

export default Section;
