import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';

interface ClearanceReasonAttributes {
  id: number;
  code: string;
  label: string;
  requiresNote: boolean;
  active: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

type ClearanceReasonCreationAttributes = Optional<
  ClearanceReasonAttributes,
  'id' | 'requiresNote' | 'active' | 'createdAt' | 'updatedAt'
>;

/**
 * Admin-editable catalog of preset reasons used when clearing a blocked
 * student. 'other' requires a free-text note.
 */
class ClearanceReason
  extends Model<ClearanceReasonAttributes, ClearanceReasonCreationAttributes>
  implements ClearanceReasonAttributes
{
  public id!: number;
  public code!: string;
  public label!: string;
  public requiresNote!: boolean;
  public active!: boolean;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

ClearanceReason.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    code: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    label: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    requiresNote: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    sequelize,
    tableName: 'clearance_reasons',
  }
);

export default ClearanceReason;
