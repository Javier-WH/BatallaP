import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';
import SchoolPeriod from './SchoolPeriod';
import Grade from './Grade';
import Section from './Section';
import Term from './Term';
import User from './User';

export type CouncilChecklistStatus = 'open' | 'in_review' | 'done';

interface CouncilChecklistAttributes {
  id: number;
  schoolPeriodId: number;
  gradeId: number;
  sectionId: number;
  termId: number;
  status: CouncilChecklistStatus;
  completedBy?: number | null;
  completedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type CouncilChecklistCreationAttributes = Optional<
  CouncilChecklistAttributes,
  'id' | 'status' | 'completedBy' | 'completedAt'
>;

class CouncilChecklist
  extends Model<CouncilChecklistAttributes, CouncilChecklistCreationAttributes>
  implements CouncilChecklistAttributes
{
  public id!: number;
  public schoolPeriodId!: number;
  public gradeId!: number;
  public sectionId!: number;
  public termId!: number;
  public status!: CouncilChecklistStatus;
  public completedBy?: number | null;
  public completedAt?: Date | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

CouncilChecklist.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    schoolPeriodId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: SchoolPeriod,
        key: 'id'
      }
    },
    gradeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Grade,
        key: 'id'
      }
    },
    sectionId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Section,
        key: 'id'
      }
    },
    termId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Term,
        key: 'id'
      }
    },
    status: {
      type: DataTypes.ENUM('open', 'in_review', 'done'),
      allowNull: false,
      defaultValue: 'open'
    },
    completedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: User,
        key: 'id'
      }
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true
    }
  },
  {
    sequelize,
    tableName: 'council_checklists',
    indexes: [
      {
        unique: true,
        fields: ['schoolPeriodId', 'gradeId', 'sectionId', 'termId'],
        name: 'uq_council_checklists_scope'
      }
    ]
  }
);

export default CouncilChecklist;
