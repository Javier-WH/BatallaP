import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';
import Person from './Person';

export interface ContactAttributes {
  id: number;
  phone1?: string;
  phone2?: string;
  email?: string;
  address?: string;
  whatsapp?: string;
  socialMedia?: object; // To store JSON data of social media
  personId: number;
}

export interface ContactCreationAttributes extends Optional<ContactAttributes, 'id' | 'phone1' | 'phone2' | 'email' | 'address' | 'whatsapp' | 'socialMedia'> { }

class Contact extends Model<ContactAttributes, ContactCreationAttributes> implements ContactAttributes {
  public id!: number;
  public phone1!: string;
  public phone2!: string;
  public email!: string;
  public address!: string;
  public whatsapp!: string;
  public socialMedia!: object;
  public personId!: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Contact.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    phone1: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    phone2: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isEmail: true
      }
    },
    address: {
      type: DataTypes.TEXT, // Could be long
      allowNull: true,
    },
    whatsapp: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    socialMedia: {
      type: DataTypes.JSON, // Use JSON for flexibility
      allowNull: true,
    },
    personId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Person,
        key: 'id'
      },
      unique: true // One-to-One
    }
  },
  {
    sequelize,
    tableName: 'contacts',
  }
);

export default Contact;
