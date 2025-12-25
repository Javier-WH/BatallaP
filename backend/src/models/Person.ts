import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';
import User from './User';

interface PersonAttributes {
  id: number;
  firstName: string;
  lastName: string;
  documentType: 'Venezolano' | 'Extranjero' | 'Pasaporte' | 'Cedula Escolar';
  document: string;
  gender: 'M' | 'F';
  birthdate: Date;
  userId?: number | null;
}

interface PersonCreationAttributes extends Optional<PersonAttributes, 'id' | 'userId'> { }

class Person extends Model<PersonAttributes, PersonCreationAttributes> implements PersonAttributes {
  public id!: number;
  public firstName!: string;
  public lastName!: string;
  public documentType!: 'Venezolano' | 'Extranjero' | 'Pasaporte' | 'Cedula Escolar';
  public document!: string;
  public gender!: 'M' | 'F';
  public birthdate!: Date;
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
  }
);

export default Person;
