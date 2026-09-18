import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';
import Person from './Person';
import SchoolPeriod from './SchoolPeriod';

export interface TeacherAdminHourAttributes {
  id: number;
  teacherId: number;       // Person.id of the teacher
  schoolPeriodId: number;
  day: string;             // Lunes, Martes, etc.
  periodId: string;        // e.g. "m1", "t3" (same ids as teacher_availability / schedule_entries)
}

interface TeacherAdminHourCreationAttributes extends Optional<TeacherAdminHourAttributes, 'id'> {}

class TeacherAdminHour extends Model<TeacherAdminHourAttributes, TeacherAdminHourCreationAttributes>
  implements TeacherAdminHourAttributes {
  public id!: number;
  public teacherId!: number;
  public schoolPeriodId!: number;
  public day!: string;
  public periodId!: string;
}

TeacherAdminHour.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  teacherId: {
    type: DataTypes.INTEGER, allowNull: false,
    references: { model: Person, key: 'id' }, onDelete: 'CASCADE',
  },
  schoolPeriodId: {
    type: DataTypes.INTEGER, allowNull: false,
    references: { model: SchoolPeriod, key: 'id' }, onDelete: 'CASCADE',
  },
  day: { type: DataTypes.STRING(20), allowNull: false },
  periodId: { type: DataTypes.STRING(20), allowNull: false, field: 'period_id' },
}, {
  sequelize,
  tableName: 'teacher_admin_hours',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['teacherId', 'schoolPeriodId', 'day', 'period_id'] },
  ],
});

export default TeacherAdminHour;
