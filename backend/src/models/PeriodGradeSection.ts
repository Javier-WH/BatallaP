import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';
import PeriodGrade from './PeriodGrade';
import Section from './Section';

interface PeriodGradeSectionAttributes {
  id: number;
  periodGradeId: number;
  sectionId: number;
}

interface PeriodGradeSectionCreationAttributes extends Optional<PeriodGradeSectionAttributes, 'id'> { }

class PeriodGradeSection extends Model<PeriodGradeSectionAttributes, PeriodGradeSectionCreationAttributes> implements PeriodGradeSectionAttributes {
  public id!: number;
  public periodGradeId!: number;
  public sectionId!: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

PeriodGradeSection.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    periodGradeId: {
      type: DataTypes.INTEGER,
      references: { model: PeriodGrade, key: 'id' },
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
    tableName: 'period_grade_sections',
    indexes: [
      {
        unique: true,
        fields: ['periodGradeId', 'sectionId']
      }
    ]
  }
);

export default PeriodGradeSection;
