import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';

export type EnrollmentQuestionType = 'text' | 'select' | 'checkbox';

interface EnrollmentQuestionAttributes {
  id: number;
  prompt: string;
  description?: string | null;
  type: EnrollmentQuestionType;
  options?: string[] | null;
  isActive: boolean;
  required: boolean;
  order: number;
  createdAt?: Date;
  updatedAt?: Date;
}

interface EnrollmentQuestionCreationAttributes
  extends Optional<EnrollmentQuestionAttributes, 'id' | 'description' | 'options' | 'order'> {}

class EnrollmentQuestion
  extends Model<EnrollmentQuestionAttributes, EnrollmentQuestionCreationAttributes>
  implements EnrollmentQuestionAttributes
{
  public id!: number;
  public prompt!: string;
  public description!: string | null;
  public type!: EnrollmentQuestionType;
  public options!: string[] | null;
  public isActive!: boolean;
  public required!: boolean;
  public order!: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

EnrollmentQuestion.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    prompt: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    type: {
      type: DataTypes.ENUM('text', 'select', 'checkbox'),
      allowNull: false
    },
    options: {
      type: DataTypes.JSON,
      allowNull: true,
      validate: {
        isArrayOfStrings(value: unknown) {
          if (value === null || value === undefined) return;
          if (!Array.isArray(value) || !value.every((v) => typeof v === 'string')) {
            throw new Error('Options must be an array of strings');
          }
        }
      }
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    required: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    }
  },
  {
    sequelize,
    tableName: 'enrollment_questions',
    indexes: [
      {
        fields: ['isActive']
      },
      {
        fields: ['order']
      }
    ]
  }
);

export default EnrollmentQuestion;
