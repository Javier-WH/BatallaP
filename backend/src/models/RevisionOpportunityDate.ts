import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';
import RevisionPeriod from './RevisionPeriod';
import PeriodGradeSubject from './PeriodGradeSubject';
import Section from './Section';

interface RevisionOpportunityDateAttributes {
  id: number;
  revisionPeriodId: number;
  periodGradeSubjectId: number;
  sectionId?: number | null;
  opportunity: number;
  date?: string | null; // DATEONLY (YYYY-MM-DD)
  createdAt?: Date;
  updatedAt?: Date;
}

type RevisionOpportunityDateCreationAttributes = Optional<
  RevisionOpportunityDateAttributes,
  'id' | 'date' | 'sectionId'
>;

class RevisionOpportunityDate
  extends Model<RevisionOpportunityDateAttributes, RevisionOpportunityDateCreationAttributes>
  implements RevisionOpportunityDateAttributes
{
  public id!: number;
  public revisionPeriodId!: number;
  public periodGradeSubjectId!: number;
  public sectionId!: number | null;
  public opportunity!: number;
  public date!: string | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

RevisionOpportunityDate.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    revisionPeriodId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: RevisionPeriod, key: 'id' },
    },
    periodGradeSubjectId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: PeriodGradeSubject, key: 'id' },
    },
    sectionId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: Section, key: 'id' },
    },
    opportunity: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'revision_opportunity_dates',
    indexes: [
      {
        unique: true,
        fields: ['revisionPeriodId', 'periodGradeSubjectId', 'opportunity'],
        name: 'uq_revision_opportunity_date',
      },
    ],
  }
);

export default RevisionOpportunityDate;
