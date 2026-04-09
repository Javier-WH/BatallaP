import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';
import SubjectFinalGrade from './SubjectFinalGrade';
import GradeEditPermission from './GradeEditPermission';
import User from './User';

interface GradeEditAuditAttributes {
  id: number;
  subjectFinalGradeId: number;
  permissionId: number;
  editedBy: number;
  previousScore: number | null;
  newScore: number | null;
  previousStatus: 'aprobada' | 'reprobada' | null;
  newStatus: 'aprobada' | 'reprobada';
  reason: string;
  editedAt: Date;
}

interface GradeEditAuditCreationAttributes extends Optional<GradeEditAuditAttributes, 'id' | 'editedAt' | 'previousStatus'> {}

class GradeEditAudit extends Model<GradeEditAuditAttributes, GradeEditAuditCreationAttributes> implements GradeEditAuditAttributes {
  public id!: number;
  public subjectFinalGradeId!: number;
  public permissionId!: number;
  public editedBy!: number;
  public previousScore!: number | null;
  public newScore!: number | null;
  public previousStatus!: 'aprobada' | 'reprobada' | null;
  public newStatus!: 'aprobada' | 'reprobada';
  public reason!: string;
  public editedAt!: Date;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

GradeEditAudit.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    subjectFinalGradeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: SubjectFinalGrade,
        key: 'id',
      },
      comment: 'Nota final que fue modificada',
    },
    permissionId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: GradeEditPermission,
        key: 'id',
      },
      comment: 'Permiso que autorizó la modificación',
    },
    editedBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: User,
        key: 'id',
      },
      comment: 'Usuario que realizó la modificación',
    },
    previousScore: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      comment: 'Valor de la nota antes de la modificación',
    },
    newScore: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      comment: 'Valor de la nota después de la modificación',
    },
    previousStatus: {
      type: DataTypes.ENUM('aprobada', 'reprobada'),
      allowNull: true,
      comment: 'Estado de la materia antes de la modificación',
    },
    newStatus: {
      type: DataTypes.ENUM('aprobada', 'reprobada'),
      allowNull: false,
      comment: 'Estado de la materia después de la modificación',
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: 'Razón de la modificación',
    },
    editedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'Fecha y hora de la modificación',
    },
  },
  {
    sequelize,
    tableName: 'grade_edit_audits',
    indexes: [
      {
        unique: false,
        fields: ['subjectFinalGradeId'],
      },
      {
        unique: false,
        fields: ['permissionId'],
      },
      {
        unique: false,
        fields: ['editedBy'],
      },
      {
        unique: false,
        fields: ['editedAt'],
      },
    ],
  }
);

export default GradeEditAudit;
