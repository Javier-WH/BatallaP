import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';
import Person from './Person';
import PeriodGradeSubject from './PeriodGradeSubject';
import Section from './Section';

interface TeacherAssignmentAttributes {
  id: number;
  teacherId: number; // Person ID with Teacher role
  periodGradeSubjectId: number; // Links to Period, Grade and Subject
  sectionId: number; // The specific section
}

interface TeacherAssignmentCreationAttributes extends Optional<TeacherAssignmentAttributes, 'id'> { }

class TeacherAssignment extends Model<TeacherAssignmentAttributes, TeacherAssignmentCreationAttributes> implements TeacherAssignmentAttributes {
  public id!: number;
  public teacherId!: number;
  public periodGradeSubjectId!: number;
  public sectionId!: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

TeacherAssignment.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    teacherId: {
      type: DataTypes.INTEGER,
      references: { model: Person, key: 'id' },
      allowNull: false
    },
    periodGradeSubjectId: {
      type: DataTypes.INTEGER,
      references: { model: PeriodGradeSubject, key: 'id' },
      allowNull: false
    },
    sectionId: {
      type: DataTypes.INTEGER,
      references: { model: Section, key: 'id' },
      allowNull: false
    }
  },
  {
    sequelize,
    tableName: 'teacher_assignments',
    indexes: [
      {
        unique: true,
        fields: ['periodGradeSubjectId', 'sectionId'],
        name: 'unique_subject_section_per_period' // A subject in a section can only have one teacher
      }
    ]
  }
);

export default TeacherAssignment;
