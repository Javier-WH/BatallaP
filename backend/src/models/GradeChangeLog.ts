import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';
import User from './User';

export type GradeChangeEntityType =
  | 'qualification'
  | 'subject_final_grade'
  | 'historical_grade'
  | 'inscription_subject_revision'
  | 'pending_subject_encounter';

interface GradeChangeLogAttributes {
  id: number;
  entityType: GradeChangeEntityType;
  entityId: number;
  previousScore: number | null;
  newScore: number | null;
  previousStatus: string | null;
  newStatus: string | null;
  gradeType: string | null;
  editedBy: number;
  editorRole: string | null;
  reason: string | null;
  actCode: string | null;
  metadata: Record<string, any> | null;
  editedAt: Date;
}

interface GradeChangeLogCreationAttributes extends Optional<
  GradeChangeLogAttributes,
  'id' | 'previousStatus' | 'newStatus' | 'gradeType' | 'editorRole' | 'reason' | 'actCode' | 'metadata' | 'editedAt'
> {}

class GradeChangeLog extends Model<GradeChangeLogAttributes, GradeChangeLogCreationAttributes> implements GradeChangeLogAttributes {
  public id!: number;
  public entityType!: GradeChangeEntityType;
  public entityId!: number;
  public previousScore!: number | null;
  public newScore!: number | null;
  public previousStatus!: string | null;
  public newStatus!: string | null;
  public gradeType!: string | null;
  public editedBy!: number;
  public editorRole!: string | null;
  public reason!: string | null;
  public actCode!: string | null;
  public metadata!: Record<string, any> | null;
  public editedAt!: Date;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

GradeChangeLog.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    entityType: {
      type: DataTypes.ENUM(
        'qualification',
        'subject_final_grade',
        'historical_grade',
        'inscription_subject_revision',
        'pending_subject_encounter',
      ),
      allowNull: false,
      comment: 'Type of grade entity that was modified',
    },
    entityId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'ID of the modified record',
    },
    previousScore: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      comment: 'Score before the edit',
    },
    newScore: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      comment: 'Score after the edit',
    },
    previousStatus: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Status before the edit (aprobada/reprobada/pending/approved/failed)',
    },
    newStatus: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Status after the edit',
    },
    gradeType: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Grade type (regular/revision/materia_pendiente/transferencia/equivalencia)',
    },
    editedBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: User, key: 'id' },
      comment: 'User who made the change',
    },
    editorRole: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Role context of the editor (teacher/control_estudios/admin/master)',
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Reason for the edit, if provided',
    },
    actCode: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Act code associated with the edit, if any',
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Additional context (personId, subjectId, gradeId, schoolPeriodId, sectionId, etc.)',
    },
    editedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'When the edit occurred',
    },
  },
  {
    sequelize,
    tableName: 'grade_change_logs',
    indexes: [
      { unique: false, fields: ['entityType', 'entityId'] },
      { unique: false, fields: ['editedBy'] },
      { unique: false, fields: ['editedAt'] },
      { unique: false, fields: ['gradeType'] },
    ],
  }
);

export default GradeChangeLog;
