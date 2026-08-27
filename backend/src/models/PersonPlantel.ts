import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';
import Person from './Person';
import Plantel from './Plantel';

interface PersonPlantelAttributes {
  id: number;
  personId: number;
  plantelId: number;
  order: number;
  isSystem: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

type PersonPlantelCreationAttributes = Optional<PersonPlantelAttributes, 'id' | 'isSystem' | 'createdAt' | 'updatedAt'>;

class PersonPlantel extends Model<PersonPlantelAttributes, PersonPlantelCreationAttributes>
  implements PersonPlantelAttributes {
  public id!: number;
  public personId!: number;
  public plantelId!: number;
  public order!: number;
  public isSystem!: boolean;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

PersonPlantel.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    personId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: Person, key: 'id' },
    },
    plantelId: {
      type: DataTypes.INTEGER,
      allowNull: true,  // null for the system plantel (isSystem=true)
      references: { model: Plantel, key: 'id' },
    },
    order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    isSystem: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    sequelize,
    tableName: 'person_planteles',
    indexes: [
      {
        unique: true,
        fields: ['personId', 'plantelId'],
        name: 'uq_person_plantel',
      },
      {
        fields: ['personId'],
      },
    ],
  }
);

export default PersonPlantel;
