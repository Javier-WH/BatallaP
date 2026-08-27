import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';

interface PlantelAttributes {
  id: number;
  code: string;
  name: string;
  state: string;
  stateCode?: string;
  dependency?: string;
  municipality?: string;
  parish?: string;
}

interface PlantelCreationAttributes extends Optional<PlantelAttributes, 'id' | 'municipality' | 'parish'> { }

class Plantel extends Model<PlantelAttributes, PlantelCreationAttributes> implements PlantelAttributes {
  public id!: number;
  public code!: string;
  public name!: string;
  public state!: string;
  public stateCode!: string;
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
    stateCode: {
      type: DataTypes.STRING(5),
      allowNull: true,
    },
    dependency: {
      type: DataTypes.STRING(100),
      allowNull: true,
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
    ],
    hooks: {
      beforeCreate: (instance: Plantel) => {
        if (instance.name) instance.name = instance.name.toUpperCase().trim();
        if (instance.state) instance.state = instance.state.toUpperCase().trim();
        if (instance.dependency) instance.dependency = instance.dependency.toUpperCase().trim();
        if (instance.municipality) instance.municipality = instance.municipality.toUpperCase().trim();
        if (instance.parish) instance.parish = instance.parish.toUpperCase().trim();
        // Auto-generate stateCode from first 2 letters of state if not provided
        if (instance.state && !instance.stateCode) {
          instance.stateCode = instance.state.substring(0, 2).toUpperCase();
        }
      },
      beforeUpdate: (instance: Plantel) => {
        if (instance.changed('name') && instance.name) instance.name = instance.name.toUpperCase().trim();
        if (instance.changed('state') && instance.state) instance.state = instance.state.toUpperCase().trim();
        if (instance.changed('dependency') && instance.dependency) instance.dependency = instance.dependency.toUpperCase().trim();
        if (instance.changed('municipality') && instance.municipality) instance.municipality = instance.municipality.toUpperCase().trim();
        if (instance.changed('parish') && instance.parish) instance.parish = instance.parish.toUpperCase().trim();
        // Auto-regenerate stateCode when state changes
        if (instance.changed('state') && instance.state) {
          instance.stateCode = instance.state.substring(0, 2).toUpperCase();
        }
      }
    }
  }
);

export default Plantel;
