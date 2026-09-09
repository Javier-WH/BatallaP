import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';
import Qualification from './Qualification';
import User from './User';

export type QualificationEditRequestStatus = 'pending' | 'approved' | 'rejected';

interface QualificationEditRequestAttributes {
  id: number;
  qualificationId: number;
  requestedBy: number;
  justification: string;
  status: QualificationEditRequestStatus;
  reviewedBy: number | null;
  reviewedAt: Date | null;
  reviewNote: string | null;
  grantedAt: Date | null;
}

interface QualificationEditRequestCreationAttributes
  extends Optional<QualificationEditRequestAttributes, 'id' | 'status' | 'reviewedBy' | 'reviewedAt' | 'reviewNote' | 'grantedAt'> {}

class QualificationEditRequest
  extends Model<QualificationEditRequestAttributes, QualificationEditRequestCreationAttributes>
  implements QualificationEditRequestAttributes
{
  public id!: number;
  public qualificationId!: number;
  public requestedBy!: number;
  public justification!: string;
  public status!: QualificationEditRequestStatus;
  public reviewedBy!: number | null;
  public reviewedAt!: Date | null;
  public reviewNote!: string | null;
  public grantedAt!: Date | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

QualificationEditRequest.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    qualificationId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: Qualification, key: 'id' },
      comment: 'Qualification whose timer expired and teacher wants to edit',
    },
    requestedBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: User, key: 'id' },
      comment: 'Teacher who requested permission to edit',
    },
    justification: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: 'Reason the teacher provides for needing to edit the locked grade',
    },
    status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected'),
      allowNull: false,
      defaultValue: 'pending',
    },
    reviewedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: User, key: 'id' },
      comment: 'Control de Estudios user who reviewed the request',
    },
    reviewedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    reviewNote: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Optional note from the reviewer',
    },
    grantedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'When the edit permission was granted (upon approval)',
    },
  },
  {
    sequelize,
    tableName: 'qualification_edit_requests',
    indexes: [
      { unique: false, fields: ['qualificationId'] },
      { unique: false, fields: ['requestedBy'] },
      { unique: false, fields: ['status'] },
    ],
  }
);

export default QualificationEditRequest;
