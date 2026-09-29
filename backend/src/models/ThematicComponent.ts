import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';
import PeriodGradeSubject from './PeriodGradeSubject';
import Term from './Term';

import Person from './Person';

// Content is scoped per teacher within a PeriodGradeSubject + term: shared by
// all sections of that year/subject taught by the same teacher, but invisible
// to other teachers of the same subject in other sections.
interface ThematicComponentAttributes {
  id: number;
  periodGradeSubjectId: number;
  termId: number;
  teacherId?: number | null;
  title: string;
  order: number;
  createdAt?: Date;
  updatedAt?: Date;
}

type ThematicComponentCreationAttributes = Optional<ThematicComponentAttributes, 'id' | 'order' | 'teacherId' | 'createdAt' | 'updatedAt'>;

class ThematicComponent extends Model<ThematicComponentAttributes, ThematicComponentCreationAttributes> implements ThematicComponentAttributes {
  public id!: number;
  public periodGradeSubjectId!: number;
  public termId!: number;
  public teacherId!: number | null;
  public title!: string;
  public order!: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

ThematicComponent.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    periodGradeSubjectId: {
      type: DataTypes.INTEGER,
      references: { model: PeriodGradeSubject, key: 'id' },
      allowNull: false,
    },
    termId: {
      type: DataTypes.INTEGER,
      references: { model: Term, key: 'id' },
      allowNull: false,
    },
    teacherId: {
      type: DataTypes.INTEGER,
      references: { model: Person, key: 'id' },
      allowNull: true,
      defaultValue: null,
    },
    title: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    sequelize,
    tableName: 'thematic_components',
    indexes: [
      { fields: ['periodGradeSubjectId', 'termId', 'teacherId'], name: 'idx_thematic_components_scope' },
    ],
  }
);

export default ThematicComponent;
