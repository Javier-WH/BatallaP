import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';
import Person from './Person';

export interface PersonResidenceAttributes {
  id: number;
  personId: number;
  birthState: string;
  birthMunicipality: string;
  birthParish: string;
  residenceState: string;
  residenceMunicipality: string;
  residenceParish: string;
  address?: string;
}

type PersonResidenceCreationAttributes = Optional<PersonResidenceAttributes, 'id'>;

class PersonResidence extends Model<PersonResidenceAttributes, PersonResidenceCreationAttributes>
  implements PersonResidenceAttributes {
  public id!: number;
  public personId!: number;
  public birthState!: string;
  public birthMunicipality!: string;
  public birthParish!: string;
  public residenceState!: string;
  public residenceMunicipality!: string;
  public residenceParish!: string;
  public address!: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

PersonResidence.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    personId: {
      field: 'people_id',
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      references: {
        model: Person,
        key: 'id'
      }
    },
    birthState: {
      field: 'birth_state',
      type: DataTypes.STRING,
      allowNull: false
    },
    birthMunicipality: {
      field: 'birth_municipality',
      type: DataTypes.STRING,
      allowNull: false
    },
    birthParish: {
      field: 'birth_parish',
      type: DataTypes.STRING,
      allowNull: false
    },
    residenceState: {
      field: 'residence_state',
      type: DataTypes.STRING,
      allowNull: false
    },
    residenceMunicipality: {
      field: 'residence_municipality',
      type: DataTypes.STRING,
      allowNull: false
    },
    residenceParish: {
      field: 'residence_parish',
      type: DataTypes.STRING,
      allowNull: false
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  },
  {
    sequelize,
    tableName: 'person_residences'
  }
);

export default PersonResidence;
