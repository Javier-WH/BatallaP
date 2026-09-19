import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';

interface TermAttributes {
  id: number;
  name: string;
  isBlocked: boolean;
  isActive: boolean;
  openDate?: Date;
  closeDate?: Date;
  schoolPeriodId: number;
  order: number; // Para mantener el orden de los lapsos
  councilCompletedAtOverride?: string | null;
}

interface TermCreationAttributes extends Optional<TermAttributes, 'id'> {}

class Term extends Model<TermAttributes, TermCreationAttributes> implements TermAttributes {
  public id!: number;
  public name!: string;
  public isBlocked!: boolean;
  public isActive!: boolean;
  public openDate?: Date;
  public closeDate?: Date;
  public schoolPeriodId!: number;
  public order!: number;
  public councilCompletedAtOverride?: string | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Term.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    isBlocked: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    // openDate/closeDate are the date window reserved for the "Bloqueo
    // Inteligente" feature (settings key: grade_lock_mode): automatically
    // restrict grade entry/editing outside this window. NOT enforced today —
    // the UI switch was hidden in AcademicSettings and the actual lock gates
    // are term.isBlocked (manual) + TermSectionClosureService (per section).
    // Hook point if the feature is enabled: every `term.isBlocked` read in
    // evaluationController.
    openDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    closeDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    schoolPeriodId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'school_periods',
        key: 'id',
      },
    },
    order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    councilCompletedAtOverride: {
      // Calendar date (YYYY-MM-DD) set by Master to override the council
      // completion date of every section in this term. DATEONLY avoids
      // timezone conversions: the stored string is the date shown everywhere.
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'terms',
    indexes: [
      {
        unique: true,
        fields: ['schoolPeriodId', 'order'],
      },
    ],
  }
);

export default Term;
