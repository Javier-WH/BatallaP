import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';

interface ScheduleAttributes {
  id: number;
  schoolPeriodId: number;
  periodGradeSectionId: number; // the section this schedule belongs to
  status: 'draft' | 'published';
}

interface ScheduleCreationAttributes extends Optional<ScheduleAttributes, 'id' | 'status'> {}

class Schedule extends Model<ScheduleAttributes, ScheduleCreationAttributes> implements ScheduleAttributes {
  public id!: number;
  public schoolPeriodId!: number;
  public periodGradeSectionId!: number;
  public status!: 'draft' | 'published';

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Schedule.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  schoolPeriodId: {
    type: DataTypes.INTEGER, allowNull: false,
    references: { model: 'school_periods', key: 'id' }, onDelete: 'CASCADE',
  },
  periodGradeSectionId: {
    type: DataTypes.INTEGER, allowNull: false,
    references: { model: 'period_grade_sections', key: 'id' }, onDelete: 'CASCADE',
  },
  status: {
    type: DataTypes.ENUM('draft', 'published'), allowNull: false, defaultValue: 'draft',
  },
}, {
  sequelize,
  tableName: 'schedules',
  indexes: [
    { unique: true, fields: ['schoolPeriodId', 'periodGradeSectionId'] },
  ],
});

export default Schedule;
