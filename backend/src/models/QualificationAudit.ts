import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';
import Qualification from './Qualification';
import User from './User';

interface QualificationAuditAttributes {
  id: number;
  qualificationId: number;
  editedBy: number;
  previousScore: number | null;
  newScore: number;
  editedAt: Date;
}

interface QualificationAuditCreationAttributes extends Optional<QualificationAuditAttributes, 'id'> {}

class QualificationAudit
  extends Model<QualificationAuditAttributes, QualificationAuditCreationAttributes>
  implements QualificationAuditAttributes
{
  public id!: number;
  public qualificationId!: number;
  public editedBy!: number;
  public previousScore!: number | null;
  public newScore!: number;
  public editedAt!: Date;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

QualificationAudit.init(
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
    },
    editedBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: User, key: 'id' },
    },
    previousScore: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
    },
    newScore: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
    },
    editedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'qualification_audits',
  }
);

export default QualificationAudit;