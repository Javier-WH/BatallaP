import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';
import Grade from './Grade';

interface SchoolPeriodTransitionRuleAttributes {
  id: number;
  gradeFromId: number;
  gradeToId?: number | null;
  minAverage: number;
  maxPendingSubjects: number;
  autoGraduate: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

type SchoolPeriodTransitionRuleCreationAttributes = Optional<
  SchoolPeriodTransitionRuleAttributes,
  'id' | 'gradeToId' | 'minAverage' | 'maxPendingSubjects' | 'autoGraduate'
>;

class SchoolPeriodTransitionRule
  extends Model<
    SchoolPeriodTransitionRuleAttributes,
    SchoolPeriodTransitionRuleCreationAttributes
  >
  implements SchoolPeriodTransitionRuleAttributes
{
  public id!: number;
  public gradeFromId!: number;
  public gradeToId!: number | null;
  public minAverage!: number;
  public maxPendingSubjects!: number;
  public autoGraduate!: boolean;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

SchoolPeriodTransitionRule.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    gradeFromId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Grade,
        key: 'id'
      }
    },
    gradeToId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: Grade,
        key: 'id'
      }
    },
    minAverage: {
      type: DataTypes.DECIMAL(4, 2),
      allowNull: false,
      defaultValue: 10
    },
    maxPendingSubjects: {
      type: DataTypes.TINYINT.UNSIGNED,
      allowNull: false,
      defaultValue: 0
    },
    autoGraduate: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    }
  },
  {
    sequelize,
    tableName: 'school_period_transition_rules',
    indexes: [
      {
        unique: true,
        fields: ['gradeFromId']
      }
    ]
  }
);

export default SchoolPeriodTransitionRule;
