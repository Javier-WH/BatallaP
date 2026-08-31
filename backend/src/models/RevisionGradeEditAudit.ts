import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';
import InscriptionSubjectRevision from './InscriptionSubjectRevision';
import Person from './Person';

interface RevisionGradeEditAuditAttributes {
  id: number;
  revisionId: number;
  editedBy: number;
  previousScore: number | null;
  newScore: number | null;
  previousStatus: 'pending' | 'approved' | 'failed';
  newStatus: 'pending' | 'approved' | 'failed';
  previousIsAbsent: boolean;
  newIsAbsent: boolean;
  reason?: string | null;
  editedAt: Date;
}

interface RevisionGradeEditAuditCreationAttributes extends Optional<RevisionGradeEditAuditAttributes, 'id' | 'editedAt' | 'reason'> {}

class RevisionGradeEditAudit extends Model<RevisionGradeEditAuditAttributes, RevisionGradeEditAuditCreationAttributes> implements RevisionGradeEditAuditAttributes {
  public id!: number;
  public revisionId!: number;
  public editedBy!: number;
  public previousScore!: number | null;
  public newScore!: number | null;
  public previousStatus!: 'pending' | 'approved' | 'failed';
  public newStatus!: 'pending' | 'approved' | 'failed';
  public previousIsAbsent!: boolean;
  public newIsAbsent!: boolean;
  public reason!: string | null;
  public editedAt!: Date;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

RevisionGradeEditAudit.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    revisionId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: InscriptionSubjectRevision,
        key: 'id',
      },
      comment: 'Revisión cuya nota fue modificada',
    },
    editedBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Person,
        key: 'id',
      },
      comment: 'Usuario de Control de Estudios que realizó la modificación',
    },
    previousScore: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      comment: 'Nota antes de la modificación',
    },
    newScore: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      comment: 'Nota después de la modificación',
    },
    previousStatus: {
      type: DataTypes.ENUM('pending', 'approved', 'failed'),
      allowNull: false,
      comment: 'Estado antes de la modificación',
    },
    newStatus: {
      type: DataTypes.ENUM('pending', 'approved', 'failed'),
      allowNull: false,
      comment: 'Estado después de la modificación',
    },
    previousIsAbsent: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    newIsAbsent: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Motivo opcional de la modificación extraordinaria',
    },
    editedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'revision_grade_edit_audits',
    indexes: [
      { unique: false, fields: ['revisionId'] },
      { unique: false, fields: ['editedBy'] },
      { unique: false, fields: ['editedAt'] },
    ],
  }
);

export default RevisionGradeEditAudit;
