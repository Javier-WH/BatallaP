import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';
import Inscription from './Inscription';
import Subject from './Subject';
import SchoolPeriod from './SchoolPeriod';

export type PendingSubjectStatus = 'pendiente' | 'aprobada' | 'convalidada';

interface PendingSubjectAttributes {
  id: number;
  newInscriptionId: number;
  subjectId: number;
  originPeriodId: number;
  status: PendingSubjectStatus;
  resolvedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type PendingSubjectCreationAttributes = Optional<
  PendingSubjectAttributes,
  'id' | 'status' | 'resolvedAt'
>;

class PendingSubject
  extends Model<PendingSubjectAttributes, PendingSubjectCreationAttributes>
  implements PendingSubjectAttributes
{
  public id!: number;
  public newInscriptionId!: number;
  public subjectId!: number;
  public originPeriodId!: number;
  public status!: PendingSubjectStatus;
  public resolvedAt!: Date | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

PendingSubject.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    newInscriptionId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Inscription,
        key: 'id'
      }
    },
    subjectId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Subject,
        key: 'id'
      }
    },
    originPeriodId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: SchoolPeriod,
        key: 'id'
      }
    },
    status: {
      type: DataTypes.ENUM('pendiente', 'aprobada', 'convalidada'),
      allowNull: false,
      defaultValue: 'pendiente'
    },
    resolvedAt: {
      type: DataTypes.DATE,
      allowNull: true
    }
  },
  {
    sequelize,
    tableName: 'pending_subjects',
    indexes: [
      {
        unique: true,
        fields: ['newInscriptionId', 'subjectId']
      }
    ]
  }
);

export default PendingSubject;
