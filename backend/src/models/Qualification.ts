import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';
import EvaluationPlan from './EvaluationPlan';
import InscriptionSubject from './InscriptionSubject';

interface QualificationAttributes {
  id: number;
  evaluationPlanId: number;
  inscriptionSubjectId: number;
  score: number;
  observations?: string;
}

interface QualificationCreationAttributes extends Optional<QualificationAttributes, 'id' | 'observations'> { }

class Qualification extends Model<QualificationAttributes, QualificationCreationAttributes> implements QualificationAttributes {
  public id!: number;
  public evaluationPlanId!: number;
  public inscriptionSubjectId!: number;
  public score!: number;
  public observations!: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Qualification.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    evaluationPlanId: {
      type: DataTypes.INTEGER,
      references: { model: EvaluationPlan, key: 'id' },
      allowNull: false
    },
    inscriptionSubjectId: {
      type: DataTypes.INTEGER,
      references: { model: InscriptionSubject, key: 'id' },
      allowNull: false
    },
    score: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      validate: {
        min: 0
      }
    },
    observations: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  },
  {
    sequelize,
    tableName: 'qualifications',
    indexes: [
      {
        unique: true,
        fields: ['evaluationPlanId', 'inscriptionSubjectId'] // A student gets one score per evaluation item
      }
    ]
  }
);

export default Qualification;
