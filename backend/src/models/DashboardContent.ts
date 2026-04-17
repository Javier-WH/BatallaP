import { DataTypes, Model } from 'sequelize';
import sequelize from '@/config/database';

interface DashboardContentAttributes {
  id: number;
  content: string;
  updatedBy?: number;
}

class DashboardContent extends Model<DashboardContentAttributes> implements DashboardContentAttributes {
  public id!: number;
  public content!: string;
  public updatedBy?: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

DashboardContent.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    content: {
      type: DataTypes.TEXT('long'),
      allowNull: true,
      defaultValue: null,
    },
    updatedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'dashboard_contents',
  }
);

export default DashboardContent;
