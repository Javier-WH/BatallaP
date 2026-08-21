import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';
import PeriodGradeSubject from './PeriodGradeSubject';
import Term from './Term';

interface ThematicComponentAttributes {
  id: number;
  periodGradeSubjectId: number;
  termId: number;
  title: string;
  order: number;
}

type ThematicComponentCreationAttributes = Optional<ThematicComponentAttributes, 'id' | 'order'>;

class ThematicComponent extends Model<ThematicComponentAttributes, ThematicComponentCreationAttributes> implements ThematicComponentAttributes {
  public id!: number;
  public periodGradeSubjectId!: number;
  public termId!: number;
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
  }
);

export default ThematicComponent;
