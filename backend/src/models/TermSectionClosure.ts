import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';
import Term from './Term';
import Section from './Section';
import Grade from './Grade';
import User from './User';

interface TermSectionClosureAttributes {
  id: number;
  termId: number;
  sectionId: number;
  gradeId: number;
  closedAt: Date;
  closedBy?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type TermSectionClosureCreationAttributes = Optional<
  TermSectionClosureAttributes,
  'id' | 'closedBy' | 'createdAt' | 'updatedAt'
>;

class TermSectionClosure
  extends Model<TermSectionClosureAttributes, TermSectionClosureCreationAttributes>
  implements TermSectionClosureAttributes
{
  public id!: number;
  public termId!: number;
  public sectionId!: number;
  public gradeId!: number;
  public closedAt!: Date;
  public closedBy?: number | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

TermSectionClosure.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    termId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Term,
        key: 'id',
      },
    },
    sectionId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Section,
        key: 'id',
      },
    },
    gradeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Grade,
        key: 'id',
      },
    },
    closedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    closedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: User,
        key: 'id',
      },
    },
  },
  {
    sequelize,
    tableName: 'term_section_closures',
    indexes: [
      {
        unique: true,
        fields: ['termId', 'sectionId', 'gradeId'],
        name: 'uq_term_section_closures_scope',
      },
      {
        fields: ['termId'],
      },
    ],
  }
);

export default TermSectionClosure;
