import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';
import Person from './Person';

export type GuardianRelationship = 'mother' | 'father' | 'representative';

interface StudentGuardianAttributes {
  id: number;
  studentId: number;
  relationship: GuardianRelationship;
  firstName: string;
  lastName: string;
  document: string;
  residenceState: string;
  residenceMunicipality: string;
  residenceParish: string;
  address: string;
  phone: string;
  email: string;
  isRepresentative: boolean;
}

type StudentGuardianCreationAttributes = Optional<StudentGuardianAttributes, 'id' | 'isRepresentative'>;

class StudentGuardian extends Model<StudentGuardianAttributes, StudentGuardianCreationAttributes>
  implements StudentGuardianAttributes {
  public id!: number;
  public studentId!: number;
  public relationship!: GuardianRelationship;
  public firstName!: string;
  public lastName!: string;
  public document!: string;
  public residenceState!: string;
  public residenceMunicipality!: string;
  public residenceParish!: string;
  public address!: string;
  public phone!: string;
  public email!: string;
  public isRepresentative!: boolean;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

StudentGuardian.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    studentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Person,
        key: 'id'
      }
    },
    relationship: {
      type: DataTypes.ENUM('mother', 'father', 'representative'),
      allowNull: false
    },
    firstName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    lastName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    document: {
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
    phone: {
      type: DataTypes.STRING,
      allowNull: false
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isEmail: true
      }
    },
    isRepresentative: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    }
  },
  {
    sequelize,
    tableName: 'student_guardians',
    indexes: [
      {
        unique: true,
        fields: ['studentId', 'relationship']
      }
    ]
  }
);

export default StudentGuardian;
