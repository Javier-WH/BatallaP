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
  phone2?: string;
  whatsapp?: string;
  email: string;
  residenceState: string;
  residenceMunicipality: string;
  residenceParish: string;
  address: string;
  occupation?: string;
  birthdate?: Date | null;
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
  public phone2!: string;
  public whatsapp!: string;
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
    phone2: {
      type: DataTypes.STRING,
      allowNull: true
    },
    whatsapp: {
      type: DataTypes.STRING,
      allowNull: true
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
    },
    birthdate: {
      type: DataTypes.DATEONLY,
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
    ],
    hooks: {
      beforeCreate: (instance: GuardianProfile) => {
        if (instance.firstName) instance.firstName = instance.firstName.toUpperCase().trim();
        if (instance.lastName) instance.lastName = instance.lastName.toUpperCase().trim();
        if (instance.occupation) instance.occupation = instance.occupation.toUpperCase().trim();
        if (instance.residenceState) instance.residenceState = instance.residenceState.toUpperCase().trim();
        if (instance.residenceMunicipality) instance.residenceMunicipality = instance.residenceMunicipality.toUpperCase().trim();
        if (instance.residenceParish) instance.residenceParish = instance.residenceParish.toUpperCase().trim();
        if (instance.address) instance.address = instance.address.toUpperCase().trim();
      },
      beforeUpdate: (instance: GuardianProfile) => {
        if (instance.changed('firstName') && instance.firstName) instance.firstName = instance.firstName.toUpperCase().trim();
        if (instance.changed('lastName') && instance.lastName) instance.lastName = instance.lastName.toUpperCase().trim();
        if (instance.changed('occupation') && instance.occupation) instance.occupation = instance.occupation.toUpperCase().trim();
        if (instance.changed('residenceState') && instance.residenceState) instance.residenceState = instance.residenceState.toUpperCase().trim();
        if (instance.changed('residenceMunicipality') && instance.residenceMunicipality) instance.residenceMunicipality = instance.residenceMunicipality.toUpperCase().trim();
        if (instance.changed('residenceParish') && instance.residenceParish) instance.residenceParish = instance.residenceParish.toUpperCase().trim();
        if (instance.changed('address') && instance.address) instance.address = instance.address.toUpperCase().trim();
      }
    }
  }
);

export default GuardianProfile;
