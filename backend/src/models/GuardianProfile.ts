import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';

export type GuardianDocumentType = 'Venezolano' | 'Extranjero' | 'Pasaporte';

interface GuardianProfileAttributes {
  id: number;
  firstName: string;
  lastName: string;
  documentType: GuardianDocumentType;
  document: string;
  phone: string;
  email: string;
  residenceState: string;
  residenceMunicipality: string;
  residenceParish: string;
  address: string;
  occupation?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type GuardianProfileCreationAttributes = Optional<GuardianProfileAttributes, 'id'>;

class GuardianProfile extends Model<GuardianProfileAttributes, GuardianProfileCreationAttributes>
  implements GuardianProfileAttributes {
  public id!: number;
  public firstName!: string;
  public lastName!: string;
  public documentType!: GuardianDocumentType;
  public document!: string;
  public phone!: string;
  public email!: string;
  public residenceState!: string;
  public residenceMunicipality!: string;
  public residenceParish!: string;
  public address!: string;
  public occupation!: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

GuardianProfile.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    firstName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    lastName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    documentType: {
      type: DataTypes.ENUM('Venezolano', 'Extranjero', 'Pasaporte'),
      allowNull: false
    },
    document: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: 'guardian_document_unique'
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: false
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false
    },
    residenceState: {
      type: DataTypes.STRING,
      allowNull: false
    },
    residenceMunicipality: {
      type: DataTypes.STRING,
      allowNull: false
    },
    residenceParish: {
      type: DataTypes.STRING,
      allowNull: false
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    occupation: {
      type: DataTypes.STRING,
      allowNull: true
    }
  },
  {
    sequelize,
    tableName: 'guardian_profiles',
    indexes: [
      {
        unique: true,
        fields: ['documentType', 'document'],
        name: 'guardian_profiles_document_unique'
      }
    ]
  }
);

export default GuardianProfile;
