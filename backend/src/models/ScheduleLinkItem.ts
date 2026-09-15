import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';
import ScheduleLink from './ScheduleLink';
import Subject from './Subject';
import PeriodGrade from './PeriodGrade';

interface ScheduleLinkItemAttributes {
  id: number;
  linkId: number;
  subjectId: number;
  periodGradeId: number;
}

interface ScheduleLinkItemCreationAttributes extends Optional<ScheduleLinkItemAttributes, 'id'> {}

class ScheduleLinkItem extends Model<ScheduleLinkItemAttributes, ScheduleLinkItemCreationAttributes> implements ScheduleLinkItemAttributes {
  public id!: number;
  public linkId!: number;
  public subjectId!: number;
  public periodGradeId!: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

ScheduleLinkItem.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    linkId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'schedule_links', key: 'id' },
      onDelete: 'CASCADE',
    },
    subjectId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'subjects', key: 'id' },
    },
    periodGradeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'period_grades', key: 'id' },
    },
  },
  {
    sequelize,
    tableName: 'schedule_link_items',
    indexes: [
      // A (subjectId, periodGradeId) pair can only be in one link
      { unique: true, fields: ['subjectId', 'periodGradeId'] },
    ],
  }
);

export default ScheduleLinkItem;
