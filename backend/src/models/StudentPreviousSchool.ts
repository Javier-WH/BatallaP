import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';
import Person from './Person';

interface StudentPreviousSchoolAttributes {
  id: number;
  personId: number;
  plantelCode?: string | null;
  plantelName: string;
  state?: string | null;
  municipality?: string | null;
  parish?: string | null;
  dependency?: string | null;
  gradeFrom?: string | null;
  gradeTo?: string | null;
  notes?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type StudentPreviousSchoolCreationAttributes = Optional<StudentPreviousSchoolAttributes, 'id' | 'plantelCode' | 'state' | 'municipality' | 'parish' | 'dependency' | 'gradeFrom' | 'gradeTo' | 'notes'>;

class StudentPreviousSchool
  extends Model<StudentPreviousSchoolAttributes, StudentPreviousSchoolCreationAttributes>
  implements StudentPreviousSchoolAttributes {
  public id!: number;
  public personId!: number;
  public plantelCode!: string | null;
  public plantelName!: string;
  public state!: string | null;
  public municipality!: string | null;
  public parish!: string | null;
  public dependency!: string | null;
  public gradeFrom!: string | null;
  public gradeTo!: string | null;
  public notes!: string | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

StudentPreviousSchool.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    personId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Person,
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    plantelCode: {
      type: DataTypes.STRING,
      allowNull: true
    },
    plantelName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    state: {
      type: DataTypes.STRING,
      allowNull: true
    },
    municipality: {
      type: DataTypes.STRING,
      allowNull: true
    },
    parish: {
      type: DataTypes.STRING,
      allowNull: true
    },
    dependency: {
      type: DataTypes.STRING,
      allowNull: true
    },
    gradeFrom: {
      type: DataTypes.STRING,
      allowNull: true
    },
    gradeTo: {
      type: DataTypes.STRING,
      allowNull: true
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  },
  {
    sequelize,
    tableName: 'student_previous_schools',
    indexes: [
      {
        fields: ['personId']
      },
      {
        fields: ['plantelCode']
      }
    ]
  }
);

export default StudentPreviousSchool;
