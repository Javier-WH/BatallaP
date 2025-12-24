import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';
import Person from './Person';
import GuardianProfile from './GuardianProfile';

export type GuardianRelationship = 'mother' | 'father' | 'representative';

interface StudentGuardianAttributes {
  id: number;
  studentId: number;
  guardianId: number;
  relationship: GuardianRelationship;
  isRepresentative: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

type StudentGuardianCreationAttributes = Optional<StudentGuardianAttributes, 'id' | 'isRepresentative'>;

class StudentGuardian extends Model<StudentGuardianAttributes, StudentGuardianCreationAttributes>
  implements StudentGuardianAttributes {
  public id!: number;
  public studentId!: number;
  public guardianId!: number;
  public relationship!: GuardianRelationship;
  public isRepresentative!: boolean;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public readonly profile?: GuardianProfile;
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
    guardianId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: GuardianProfile,
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    relationship: {
      type: DataTypes.ENUM('mother', 'father', 'representative'),
      allowNull: false
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
