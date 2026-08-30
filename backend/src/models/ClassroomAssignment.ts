import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';

interface ClassroomAssignmentAttributes {
  id: number;
  room: string;          // e.g. "Aula 1", "Cancha"
  targetType: 'section' | 'subject' | 'group'; // section = always in this room; subject = always in this room; group = group subject in this room for a specific grade
  sectionKey: string | null;  // "gradeId-sectionId" when targetType=section
  subjectId: number | null;   // when targetType=subject or group
  gradeId: number | null;     // when targetType=group
}

interface ClassroomAssignmentCreationAttributes extends Optional<ClassroomAssignmentAttributes, 'id'> { }

class ClassroomAssignment extends Model<ClassroomAssignmentAttributes, ClassroomAssignmentCreationAttributes> implements ClassroomAssignmentAttributes {
  public id!: number;
  public room!: string;
  public targetType!: 'section' | 'subject' | 'group';
  public sectionKey!: string | null;
  public subjectId!: number | null;
  public gradeId!: number | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

ClassroomAssignment.init(
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
    targetType: {
      type: DataTypes.ENUM('section', 'subject', 'group'),
      allowNull: false,
    },
    sectionKey: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    subjectId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    gradeId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'classroom_assignments',
    indexes: [
      { name: 'ca_uniq', unique: true, fields: ['room', 'targetType', 'sectionKey', 'subjectId', 'gradeId'] },
    ],
  }
);

export default ClassroomAssignment;
