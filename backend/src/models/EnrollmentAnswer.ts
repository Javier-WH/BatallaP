import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';
import EnrollmentQuestion from './EnrollmentQuestion';
import Person from './Person';

interface EnrollmentAnswerAttributes {
  id: number;
  questionId: number;
  personId: number;
  answer: string | string[];
  createdAt?: Date;
  updatedAt?: Date;
}

interface EnrollmentAnswerCreationAttributes extends Optional<EnrollmentAnswerAttributes, 'id'> {}

class EnrollmentAnswer
  extends Model<EnrollmentAnswerAttributes, EnrollmentAnswerCreationAttributes>
  implements EnrollmentAnswerAttributes
{
  public id!: number;
  public questionId!: number;
  public personId!: number;
  public answer!: string | string[];

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

EnrollmentAnswer.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    questionId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'enrollment_questions',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    personId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'people',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    answer: {
      type: DataTypes.JSON,
      allowNull: false
    }
  },
  {
    sequelize,
    tableName: 'enrollment_answers',
    indexes: [
      {
        fields: ['questionId']
      },
      {
        fields: ['personId']
      },
      {
        unique: true,
        fields: ['questionId', 'personId']
      }
    ]
  }
);

export default EnrollmentAnswer;
