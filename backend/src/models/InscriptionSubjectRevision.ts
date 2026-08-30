import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';
import RevisionPeriod from './RevisionPeriod';
import InscriptionSubject from './InscriptionSubject';
import Person from './Person';

export type RevisionStatus = 'pending' | 'approved' | 'failed';

interface InscriptionSubjectRevisionAttributes {
  id: number;
  revisionPeriodId: number;
  inscriptionSubjectId: number;
  opportunity: number;
  score?: number | null;
  status: RevisionStatus;
  isAbsent?: boolean;
  gradedBy?: number | null;
  gradedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type InscriptionSubjectRevisionCreationAttributes = Optional<
  InscriptionSubjectRevisionAttributes,
  'id' | 'score' | 'status' | 'isAbsent' | 'gradedBy' | 'gradedAt'
>;

class InscriptionSubjectRevision
  extends Model<InscriptionSubjectRevisionAttributes, InscriptionSubjectRevisionCreationAttributes>
  implements InscriptionSubjectRevisionAttributes
{
  public id!: number;
  public revisionPeriodId!: number;
  public inscriptionSubjectId!: number;
  public opportunity!: number;
  public score!: number | null;
  public status!: RevisionStatus;
  public isAbsent!: boolean;
  public gradedBy!: number | null;
  public gradedAt!: Date | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

InscriptionSubjectRevision.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    revisionPeriodId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: RevisionPeriod,
        key: 'id',
      },
    },
    inscriptionSubjectId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: InscriptionSubject,
        key: 'id',
      },
    },
    opportunity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    score: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('pending', 'approved', 'failed'),
      allowNull: false,
      defaultValue: 'pending',
    },
    isAbsent: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    gradedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: Person,
        key: 'id',
      },
    },
    gradedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'inscription_subject_revisions',
    indexes: [
      {
        unique: true,
        fields: ['revisionPeriodId', 'inscriptionSubjectId', 'opportunity'],
        name: 'uq_ins_subject_revision',
      },
    ],
  }
);

export default InscriptionSubjectRevision;
