import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';
import Person from './Person';
import Grade from './Grade';
import Section from './Section';
import SchoolPeriod from './SchoolPeriod';

interface SectionGuideAttributes {
  id: number;
  teacherId: number;
  gradeId: number;
  sectionId: number;
  schoolPeriodId: number;
  createdAt?: Date;
  updatedAt?: Date;
}

interface SectionGuideCreationAttributes extends Optional<SectionGuideAttributes, 'id'> {}

class SectionGuide extends Model<SectionGuideAttributes, SectionGuideCreationAttributes> implements SectionGuideAttributes {
  public id!: number;
  public teacherId!: number;
  public gradeId!: number;
  public sectionId!: number;
  public schoolPeriodId!: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

SectionGuide.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    teacherId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: Person, key: 'id' },
    },
    gradeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: Grade, key: 'id' },
    },
    sectionId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: Section, key: 'id' },
    },
    schoolPeriodId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: SchoolPeriod, key: 'id' },
    },
  },
  {
    sequelize,
    tableName: 'section_guides',
    indexes: [
      {
        unique: true,
        fields: ['gradeId', 'sectionId', 'schoolPeriodId'],
        name: 'unique_guide_per_grade_section_period',
      },
    ],
  }
);

export default SectionGuide;
