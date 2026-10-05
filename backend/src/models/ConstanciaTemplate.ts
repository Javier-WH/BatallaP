import { DataTypes, Model } from 'sequelize';
import sequelize from '@/config/database';

interface ConstanciaTemplateAttributes {
  id: number;
  name: string;
  content: string; // HTML content from Tiptap editor
  margin: string; // Page margin (CSS length, e.g. '1in') — defined in the editor, honored by preview and print
}

class ConstanciaTemplate extends Model<ConstanciaTemplateAttributes> implements ConstanciaTemplateAttributes {
  public id!: number;
  public name!: string;
  public content!: string;
  public margin!: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

ConstanciaTemplate.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT('long'),
      allowNull: false,
    },
    margin: {
      type: DataTypes.STRING(16),
      allowNull: false,
      defaultValue: '1in',
    },
  },
  {
    sequelize,
    tableName: 'constancia_templates',
  }
);

export default ConstanciaTemplate;
