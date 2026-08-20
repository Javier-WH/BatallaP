import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';
import InscriptionSubject from './InscriptionSubject';
import Term from './Term';

interface SubjectTermGradeAttributes {
  id: number;
  inscriptionSubjectId: number;
  termId: number;
  score: number;
  calculatedAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

type SubjectTermGradeCreationAttributes = Optional<
  SubjectTermGradeAttributes,
  'id' | 'calculatedAt'
>;

class SubjectTermGrade
  extends Model<SubjectTermGradeAttributes, SubjectTermGradeCreationAttributes>
  implements SubjectTermGradeAttributes
{
  public id!: number;
  public inscriptionSubjectId!: number;
  public termId!: number;
  public score!: number;
  public calculatedAt!: Date;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

SubjectTermGrade.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    inscriptionSubjectId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: InscriptionSubject,
        key: 'id',
      },
    },
    termId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Term,
        key: 'id',
      },
    },
    score: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0,
    },
    calculatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'subject_term_grades',
    indexes: [
      {
        unique: true,
        fields: ['inscriptionSubjectId', 'termId'],
      },
    ],
  }
);

export default SubjectTermGrade;
