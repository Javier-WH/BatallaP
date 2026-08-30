import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';
import RevisionPeriod from './RevisionPeriod';
import PeriodGradeSubject from './PeriodGradeSubject';
import Section from './Section';

interface RevisionThematicSelectionAttributes {
  id: number;
  revisionPeriodId: number;
  periodGradeSubjectId: number;
  sectionId: number;
  thematicComponentIds: number[] | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type RevisionThematicSelectionCreationAttributes = Optional<
  RevisionThematicSelectionAttributes,
  'id' | 'thematicComponentIds'
>;

class RevisionThematicSelection
  extends Model<RevisionThematicSelectionAttributes, RevisionThematicSelectionCreationAttributes>
  implements RevisionThematicSelectionAttributes
{
  public id!: number;
  public revisionPeriodId!: number;
  public periodGradeSubjectId!: number;
  public sectionId!: number;
  public thematicComponentIds!: number[] | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

RevisionThematicSelection.init(
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
      allowNull: false,
      references: { model: Section, key: 'id' },
    },
    thematicComponentIds: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: null,
    },
  },
  {
    sequelize,
    tableName: 'revision_thematic_selections',
    indexes: [
      {
        unique: true,
        fields: ['revisionPeriodId', 'periodGradeSubjectId', 'sectionId'],
        name: 'uq_revision_thematic_selection',
      },
    ],
  }
);

export default RevisionThematicSelection;
