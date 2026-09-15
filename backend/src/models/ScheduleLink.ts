import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';
import SchoolPeriod from './SchoolPeriod';

interface ScheduleLinkAttributes {
  id: number;
  name: string | null;
  schoolPeriodId: number;
}

interface ScheduleLinkCreationAttributes extends Optional<ScheduleLinkAttributes, 'id' | 'name'> {}

class ScheduleLink extends Model<ScheduleLinkAttributes, ScheduleLinkCreationAttributes> implements ScheduleLinkAttributes {
  public id!: number;
  public name!: string | null;
  public schoolPeriodId!: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

ScheduleLink.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    schoolPeriodId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'school_periods', key: 'id' },
      onDelete: 'CASCADE',
    },
  },
  {
    sequelize,
    tableName: 'schedule_links',
  }
);

export default ScheduleLink;
