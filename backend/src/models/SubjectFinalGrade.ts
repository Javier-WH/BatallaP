import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';
import InscriptionSubject from './InscriptionSubject';

export type SubjectFinalGradeStatus = 'aprobada' | 'reprobada';

interface SubjectFinalGradeAttributes {
  id: number;
  inscriptionSubjectId: number;
  finalScore?: number | null;
  rawScore?: number | null;
  councilPoints?: number | null;
  status: SubjectFinalGradeStatus;
  calculatedAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

type SubjectFinalGradeCreationAttributes = Optional<
  SubjectFinalGradeAttributes,
  'id' | 'finalScore' | 'rawScore' | 'councilPoints' | 'status' | 'calculatedAt'
>;

class SubjectFinalGrade
  extends Model<SubjectFinalGradeAttributes, SubjectFinalGradeCreationAttributes>
  implements SubjectFinalGradeAttributes
{
  public id!: number;
  public inscriptionSubjectId!: number;
  public finalScore!: number | null;
  public rawScore!: number | null;
  public councilPoints!: number | null;
  public status!: SubjectFinalGradeStatus;
  public calculatedAt!: Date;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

SubjectFinalGrade.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    inscriptionSubjectId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: InscriptionSubject,
        key: 'id'
      }
    },
    finalScore: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true
    },
    rawScore: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true
    },
    councilPoints: {
      type: DataTypes.DECIMAL(4, 2),
      allowNull: true,
      defaultValue: 0
    },
    status: {
      type: DataTypes.ENUM('aprobada', 'reprobada'),
      allowNull: false,
      defaultValue: 'aprobada'
    },
    calculatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  },
  {
    sequelize,
    tableName: 'subject_final_grades',
    indexes: [
      {
        unique: true,
        fields: ['inscriptionSubjectId']
      }
    ]
  }
);

export default SubjectFinalGrade;
