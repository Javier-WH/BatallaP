import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';
import User from './User';

export interface PersonAttributes {
  id: number;
  firstName: string;
  lastName: string;
  documentType: 'Venezolano' | 'Extranjero' | 'Pasaporte' | 'Cedula Escolar';
  document: string;
  gender: 'M' | 'F';
  birthdate: Date;
  pathology?: string;
  livingWith?: string;
  hireDate?: Date | null;
  userId?: number | null;
}

export interface PersonCreationAttributes extends Optional<PersonAttributes, 'id' | 'userId'> { }

class Person extends Model<PersonAttributes, PersonCreationAttributes> implements PersonAttributes {
  public id!: number;
  public firstName!: string;
  public lastName!: string;
  public documentType!: 'Venezolano' | 'Extranjero' | 'Pasaporte' | 'Cedula Escolar';
  public document!: string;
  public gender!: 'M' | 'F';
  public birthdate!: Date;
  public pathology!: string;
  public livingWith!: string;
  public hireDate!: Date | null;
  public userId!: number | null;

  public readonly roles?: import('./Role').default[];
  public readonly contact?: import('./Contact').default;
  public readonly residence?: import('./PersonResidence').default;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Person.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    firstName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    lastName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    documentType: {
      type: DataTypes.ENUM('Venezolano', 'Extranjero', 'Pasaporte', 'Cedula Escolar'),
      allowNull: false,
    },
    document: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true, // Assuming document numbers are unique when provided
    },
    gender: {
      type: DataTypes.ENUM('M', 'F'),
      allowNull: false,
    },
    birthdate: {
      type: DataTypes.DATEONLY, // Use DATEONLY for birthdates usually
      allowNull: false,
    },
    pathology: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    livingWith: {
      type: DataTypes.STRING,
      allowNull: true
    },
    hireDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: User,
        key: 'id',
      },
      unique: true, // One user per person, if assigned
    },
  },
  {
    sequelize,
    tableName: 'people',
    hooks: {
      beforeCreate: (instance: Person) => {
        if (instance.firstName) instance.firstName = instance.firstName.toUpperCase().trim();
        if (instance.lastName) instance.lastName = instance.lastName.toUpperCase().trim();
        if (instance.pathology) instance.pathology = instance.pathology.toUpperCase().trim();
        if (instance.livingWith) instance.livingWith = instance.livingWith.toUpperCase().trim();
      },
      beforeUpdate: (instance: Person) => {
        if (instance.changed('firstName') && instance.firstName) instance.firstName = instance.firstName.toUpperCase().trim();
        if (instance.changed('lastName') && instance.lastName) instance.lastName = instance.lastName.toUpperCase().trim();
        if (instance.changed('pathology') && instance.pathology) instance.pathology = instance.pathology.toUpperCase().trim();
        if (instance.changed('livingWith') && instance.livingWith) instance.livingWith = instance.livingWith.toUpperCase().trim();
      }
    }
  }
);

export default Person;
