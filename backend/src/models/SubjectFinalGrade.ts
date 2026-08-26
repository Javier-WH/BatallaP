import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';
import InscriptionSubject from './InscriptionSubject';
import Plantel from './Plantel';

export type SubjectFinalGradeStatus = 'aprobada' | 'reprobada';
export type GradeType = 'regular' | 'revision' | 'materia_pendiente' | 'revision_materia_pendiente' | 'transferencia' | 'equivalencia';

interface SubjectFinalGradeAttributes {
  id: number;
  inscriptionSubjectId: number;
  finalScore?: number | null;
  originalScore?: number | null;
  originalStatus?: string | null;
  rawScore?: number | null;
  councilPoints?: number | null;
  status: SubjectFinalGradeStatus;
  calculatedAt: Date;
  plantelId?: number | null;
  gradeType?: GradeType | null;
  schoolPeriodId?: number | null;
  subjectId?: number | null;
  gradeId?: number | null;
  termId?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
  inscriptionSubject?: any;
}

type SubjectFinalGradeCreationAttributes = Optional<
  SubjectFinalGradeAttributes,
  'id' | 'finalScore' | 'rawScore' | 'councilPoints' | 'status' | 'calculatedAt' | 'plantelId' | 'gradeType' | 'schoolPeriodId' | 'subjectId' | 'gradeId' | 'termId'
>;

class SubjectFinalGrade
  extends Model<SubjectFinalGradeAttributes, SubjectFinalGradeCreationAttributes>
  implements SubjectFinalGradeAttributes
{
  public id!: number;
  public inscriptionSubjectId!: number;
  public finalScore!: number | null;
  public originalScore!: number | null;
  public originalStatus!: string | null;
  public rawScore!: number | null;
  public councilPoints!: number | null;
  public status!: SubjectFinalGradeStatus;
  public calculatedAt!: Date;
  public plantelId!: number | null;
  public gradeType!: GradeType | null;
  public schoolPeriodId!: number | null;
  public subjectId!: number | null;
  public gradeId!: number | null;
  public termId!: number | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public inscriptionSubject?: any;
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
    originalScore: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true
    },
    originalStatus: {
      type: DataTypes.ENUM('aprobada', 'reprobada'),
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
    },
    plantelId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: Plantel,
        key: 'id'
      }
    },
    gradeType: {
      type: DataTypes.ENUM('regular', 'revision', 'materia_pendiente', 'revision_materia_pendiente', 'transferencia', 'equivalencia'),
      allowNull: true,
      defaultValue: 'regular'
    },
    schoolPeriodId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Denormalizado desde Inscription.schoolPeriodId via InscriptionSubject',
    },
    subjectId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Denormalizado desde InscriptionSubject.subjectId',
    },
    gradeId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Denormalizado desde Inscription.gradeId via InscriptionSubject',
    },
    termId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Lapso al que pertenece la nota (solo para revisiones; NULL para notas finales regulares)',
    }
  },
  {
    sequelize,
    tableName: 'subject_final_grades',
    indexes: [
      {
        unique: true,
        fields: ['inscriptionSubjectId']
      },
      {
        fields: ['schoolPeriodId', 'gradeId', 'subjectId'],
        name: 'idx_subject_final_grades_context',
      }
    ]
  }
);

export default SubjectFinalGrade;
