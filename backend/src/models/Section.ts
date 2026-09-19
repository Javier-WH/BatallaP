import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';

interface SectionAttributes {
  id: number;
  name: string;
  isMateriaPendiente: boolean; // true = auxiliary "Materia Pendiente" section (not a regular grade section)
}

interface SectionCreationAttributes extends Optional<SectionAttributes, 'id' | 'isMateriaPendiente'> { }

class Section extends Model<SectionAttributes, SectionCreationAttributes> implements SectionAttributes {
  public id!: number;
  public name!: string;
  public isMateriaPendiente!: boolean;

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
      unique: true
    },
    isMateriaPendiente: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
  },
  {
    sequelize,
    tableName: 'sections',
    hooks: {
      beforeCreate: (instance: Section) => {
        if (instance.name) instance.name = instance.name.toUpperCase().trim();
      },
      beforeUpdate: (instance: Section) => {
        if (instance.changed('name') && instance.name) instance.name = instance.name.toUpperCase().trim();
      }
    }
  }
);

export default Section;
