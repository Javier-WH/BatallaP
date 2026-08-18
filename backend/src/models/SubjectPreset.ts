import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';

interface SubjectPresetItem {
  name: string;
  abbreviation?: string | null;
}

interface SubjectPresetAttributes {
  id: number;
  name: string;
  description?: string | null;
  items: SubjectPresetItem[];
  isSystem?: boolean;
}

interface SubjectPresetCreationAttributes extends Optional<SubjectPresetAttributes, 'id' | 'description' | 'isSystem'> { }

class SubjectPreset extends Model<SubjectPresetAttributes, SubjectPresetCreationAttributes> implements SubjectPresetAttributes {
  public id!: number;
  public name!: string;
  public description!: string | null;
  public items!: SubjectPresetItem[];
  public isSystem!: boolean;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

SubjectPreset.init(
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
    items: {
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
    tableName: 'subject_presets',
  }
);

export default SubjectPreset;
