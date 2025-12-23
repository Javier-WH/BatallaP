import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';

interface PlantelAttributes {
  id: number;
  code: string;
  name: string;
  state: string;
  dependency: string;
  municipality?: string;
  parish?: string;
}

interface PlantelCreationAttributes extends Optional<PlantelAttributes, 'id' | 'municipality' | 'parish'> { }

class Plantel extends Model<PlantelAttributes, PlantelCreationAttributes> implements PlantelAttributes {
  public id!: number;
  public code!: string;
  public name!: string;
  public state!: string;
  public dependency!: string;
  public municipality?: string;
  public parish?: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Plantel.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    code: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    state: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    dependency: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    municipality: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    parish: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'planteles',
    indexes: [
      {
        fields: ['code']
      },
      {
        fields: ['name']
      },
      {
        fields: ['state']
      },
      {
        fields: ['name', 'state']
      }
    ]
  }
);

export default Plantel;
