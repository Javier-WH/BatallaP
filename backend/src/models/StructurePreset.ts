import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';

interface StructurePresetSubject {
  name: string;
  abbreviation?: string | null;
}

interface StructurePresetGrade {
  name: string;
  subjects: StructurePresetSubject[];
}

interface StructurePresetAttributes {
  id: number;
  name: string;
  description?: string | null;
  grades: StructurePresetGrade[];
  isSystem?: boolean;
}

interface StructurePresetCreationAttributes extends Optional<StructurePresetAttributes, 'id' | 'description' | 'isSystem'> { }

class StructurePreset extends Model<StructurePresetAttributes, StructurePresetCreationAttributes> implements StructurePresetAttributes {
  public id!: number;
  public name!: string;
  public description!: string | null;
  public grades!: StructurePresetGrade[];
  public isSystem!: boolean;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

StructurePreset.init(
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
    description: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    grades: {
      type: DataTypes.JSON,
      allowNull: false,
    },
    isSystem: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    sequelize,
    tableName: 'structure_presets',
  }
);

export default StructurePreset;
