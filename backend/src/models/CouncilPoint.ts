import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';
import InscriptionSubject from './InscriptionSubject';
import Term from './Term';

interface CouncilPointAttributes {
  id: number;
  inscriptionSubjectId: number;
  termId: number;
  points: number;
  observations?: string;
}

interface CouncilPointCreationAttributes extends Optional<CouncilPointAttributes, 'id' | 'observations'> { }

class CouncilPoint extends Model<CouncilPointAttributes, CouncilPointCreationAttributes> implements CouncilPointAttributes {
  public id!: number;
  public inscriptionSubjectId!: number;
  public termId!: number;
  public points!: number;
  public observations?: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

CouncilPoint.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    inscriptionSubjectId: {
      type: DataTypes.INTEGER,
      references: { model: InscriptionSubject, key: 'id' },
      allowNull: false
    },
    termId: {
      type: DataTypes.INTEGER,
      references: { model: Term, key: 'id' },
      allowNull: false
    },
    points: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    observations: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  },
  {
    sequelize,
    tableName: 'council_points',
    indexes: [
      {
        unique: true,
        fields: ['inscriptionSubjectId', 'termId']
      }
    ]
  }
);

export default CouncilPoint;
