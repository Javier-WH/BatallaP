import { DataTypes, Model } from 'sequelize';
import sequelize from '@/config/database';

interface ConstanciaTemplateAttributes {
  id: number;
  name: string;
  content: string; // HTML content from Tiptap editor
}

class ConstanciaTemplate extends Model<ConstanciaTemplateAttributes> implements ConstanciaTemplateAttributes {
  public id!: number;
  public name!: string;
  public content!: string;

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
  },
  {
    sequelize,
    tableName: 'constancia_templates',
  }
);

export default ConstanciaTemplate;
