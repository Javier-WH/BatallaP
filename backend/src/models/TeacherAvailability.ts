import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';

export interface TeacherAvailabilityAttributes {
  id: number;
  personId: number;
  day: string;       // Lunes, Martes, etc.
  periodId: string;  // e.g. "m1", "t3"
  status: string;    // 'available' | 'busy' | 'preferred'
}

interface TeacherAvailabilityCreationAttributes extends Optional<TeacherAvailabilityAttributes, 'id'> {}

class TeacherAvailability extends Model<TeacherAvailabilityAttributes, TeacherAvailabilityCreationAttributes>
  implements TeacherAvailabilityAttributes {
  public id!: number;
  public personId!: number;
  public day!: string;
  public periodId!: string;
  public status!: string;
}

TeacherAvailability.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  personId: { type: DataTypes.INTEGER, allowNull: false, field: 'person_id' },
  day: { type: DataTypes.STRING(20), allowNull: false },
  periodId: { type: DataTypes.STRING(20), allowNull: false, field: 'period_id' },
  status: { type: DataTypes.STRING(20), allowNull: false },
}, {
  sequelize,
  tableName: 'teacher_availability',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['person_id', 'day', 'period_id'] },
  ],
});

export default TeacherAvailability;
