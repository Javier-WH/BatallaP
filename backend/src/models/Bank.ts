import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';

// Catalog of Venezuelan banks (Sudeban 4-digit codes). Seeded from
// src/assets/banks.json by the create-banks migration; admins may add
// custom banks or deactivate unused ones.
interface BankAttributes {
  id: number;
  code: string;        // 4-digit Sudeban code, e.g. '0134'
  name: string;        // official name
  shortName: string;   // display name used in selects/ledger
  rif: string | null;
  icon: string | null; // URL path under /uploads/banks/
  active: boolean;
}

interface BankCreationAttributes
  extends Optional<BankAttributes, 'id' | 'rif' | 'icon' | 'active'> {}

class Bank extends Model<BankAttributes, BankCreationAttributes>
  implements BankAttributes {
  public id!: number;
  public code!: string;
  public name!: string;
  public shortName!: string;
  public rif!: string | null;
  public icon!: string | null;
  public active!: boolean;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Bank.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    code: {
      type: DataTypes.STRING(4),
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    shortName: {
      type: DataTypes.STRING(60),
      allowNull: false,
    },
    rif: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    icon: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    sequelize,
    tableName: 'banks',
  }
);

export default Bank;
