import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';
import SchoolPeriod from './SchoolPeriod';
import User from './User';

export type GradeEditPermissionScope = 'global' | 'specific';

interface GradeEditPermissionAttributes {
  id: number;
  schoolPeriodId: number | null;
  grantedBy: number;
  grantedTo: number;
  actCode: string;
  observations: string;
  isActive: boolean;
  grantedAt: Date;
  revokedAt: Date | null;
  revokedBy: number | null;
}

interface GradeEditPermissionCreationAttributes extends Optional<GradeEditPermissionAttributes, 'id' | 'schoolPeriodId' | 'revokedAt' | 'revokedBy'> {}

class GradeEditPermission extends Model<GradeEditPermissionAttributes, GradeEditPermissionCreationAttributes> implements GradeEditPermissionAttributes {
  public id!: number;
  public schoolPeriodId!: number | null;
  public grantedBy!: number;
  public grantedTo!: number;
  public actCode!: string;
  public observations!: string;
  public isActive!: boolean;
  public grantedAt!: Date;
  public revokedAt!: Date | null;
  public revokedBy!: number | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

GradeEditPermission.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    schoolPeriodId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: SchoolPeriod,
        key: 'id',
      },
      comment: 'Null = permiso global para todos los períodos',
    },
    grantedBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: User,
        key: 'id',
      },
      comment: 'Administrador que otorgó el permiso',
    },
    grantedTo: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: User,
        key: 'id',
      },
      comment: 'Usuario de Control de Estudios receptor del permiso',
    },
    actCode: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'Código de acta que justifica el permiso',
    },
    observations: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: 'Observaciones sobre el permiso otorgado',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
      comment: 'Indica si el permiso está activo',
    },
    grantedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'Fecha y hora cuando se otorgó el permiso',
    },
    revokedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha y hora cuando se revocó el permiso',
    },
    revokedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: User,
        key: 'id',
      },
      comment: 'Administrador que revocó el permiso',
    },
  },
  {
    sequelize,
    tableName: 'grade_edit_permissions',
    indexes: [
      {
        unique: false,
        fields: ['schoolPeriodId', 'grantedTo'],
      },
      {
        unique: false,
        fields: ['grantedTo'],
      },
      {
        unique: false,
        fields: ['isActive'],
      },
    ],
  }
);

export default GradeEditPermission;
