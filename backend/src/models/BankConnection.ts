import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';

interface BankConnectionAttributes {
  id: number;
  /** Provider key — 'bvc_natural' (scraping) today; jurídica providers will use bank APIs. */
  provider: string;
  accountType: 'natural' | 'juridica';
  label: string;
  username: string | null;
  password: string | null;
  active: boolean;
}

interface BankConnectionCreationAttributes extends Optional<BankConnectionAttributes, 'id' | 'username' | 'password' | 'active' | 'accountType'> { }

class BankConnection extends Model<BankConnectionAttributes, BankConnectionCreationAttributes> implements BankConnectionAttributes {
  public id!: number;
  public provider!: string;
  public accountType!: 'natural' | 'juridica';
  public label!: string;
  public username!: string | null;
  public password!: string | null;
  public active!: boolean;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

BankConnection.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    provider: { type: DataTypes.STRING(40), allowNull: false },
    accountType: { type: DataTypes.ENUM('natural', 'juridica'), allowNull: false, defaultValue: 'natural' },
    label: { type: DataTypes.STRING(120), allowNull: false },
    username: { type: DataTypes.STRING(120), allowNull: true },
    password: { type: DataTypes.STRING(255), allowNull: true },
    active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  { sequelize, tableName: 'bank_connections' }
);

export default BankConnection;
