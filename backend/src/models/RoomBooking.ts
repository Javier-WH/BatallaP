import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';

interface RoomBookingAttributes {
  id: number;
  room: string;
  day: string;              // Lunes, Martes, etc.
  periodIds: string;        // JSON array of period IDs: ["m1","m2","m3"]
  specificDate: string | null;  // YYYY-MM-DD for one-time bookings
  teacherName: string;      // who needs the room
  subjectName: string;      // what subject/activity
  reason: string;           // why they need it
  status: 'approved' | 'pending' | 'rejected';
  requestedBy: number | null;  // Person.id of the teacher (if requested by teacher)
  schoolPeriodId: number;
}

interface RoomBookingCreationAttributes extends Optional<RoomBookingAttributes, 'id' | 'specificDate' | 'requestedBy' | 'reason'> { }

class RoomBooking extends Model<RoomBookingAttributes, RoomBookingCreationAttributes> implements RoomBookingAttributes {
  public id!: number;
  public room!: string;
  public day!: string;
  public periodIds!: string;
  public specificDate!: string | null;
  public teacherName!: string;
  public subjectName!: string;
  public reason!: string;
  public status!: 'approved' | 'pending' | 'rejected';
  public requestedBy!: number | null;
  public schoolPeriodId!: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

RoomBooking.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    room: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    day: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    periodIds: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    specificDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    teacherName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    subjectName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('approved', 'pending', 'rejected'),
      allowNull: false,
      defaultValue: 'approved',
    },
    requestedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    schoolPeriodId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'room_bookings',
  }
);

export default RoomBooking;
