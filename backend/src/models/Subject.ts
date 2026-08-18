import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';

interface SubjectAttributes {
  id: number;
  name: string;
  abbreviation?: string | null;
  subjectGroupId?: number | null;
  usesLiteralGrades?: boolean;
  icon?: string | null;
  color?: string | null;
}

interface SubjectCreationAttributes extends Optional<SubjectAttributes, 'id'> { }

class Subject extends Model<SubjectAttributes, SubjectCreationAttributes> implements SubjectAttributes {
  public id!: number;
  public name!: string;
  public abbreviation!: string | null;
  public subjectGroupId?: number | null;
  public usesLiteralGrades?: boolean;
  public icon?: string | null;
  public color?: string | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Subject.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    subjectGroupId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    usesLiteralGrades: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    abbreviation: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    icon: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    color: {
      type: DataTypes.STRING(7),
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'subjects',
    hooks: {
      beforeCreate: (instance: Subject) => {
        if (instance.name) instance.name = instance.name.toUpperCase().trim();
        if (instance.abbreviation) instance.abbreviation = instance.abbreviation.toUpperCase().trim();
      },
      beforeUpdate: (instance: Subject) => {
        if (instance.changed('name') && instance.name) instance.name = instance.name.toUpperCase().trim();
        if (instance.changed('abbreviation') && instance.abbreviation) instance.abbreviation = instance.abbreviation.toUpperCase().trim();
      }
    }
  }
);

export default Subject;
