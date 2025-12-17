import { DataTypes, Model } from 'sequelize';
import sequelize from '@/config/database';

interface SettingAttributes {
  key: string;
  value: string;
}

class Setting extends Model<SettingAttributes> implements SettingAttributes {
  public key!: string;
  public value!: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Setting.init(
  {
    key: {
      type: DataTypes.STRING,
      primaryKey: true,
    },
    value: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'settings',
  }
);

export default Setting;
