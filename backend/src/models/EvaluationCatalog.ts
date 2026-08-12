import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';

interface EvaluationCatalogAttributes {
  id: number;
  type: 'tecnica' | 'instrumento' | 'estrategia';
  name: string;
}

type EvaluationCatalogCreationAttributes = Optional<EvaluationCatalogAttributes, 'id'>;

class EvaluationCatalog extends Model<EvaluationCatalogAttributes, EvaluationCatalogCreationAttributes> implements EvaluationCatalogAttributes {
  public id!: number;
  public type!: 'tecnica' | 'instrumento' | 'estrategia';
  public name!: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

EvaluationCatalog.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    type: {
      type: DataTypes.ENUM('tecnica', 'instrumento', 'estrategia'),
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'evaluation_catalogs',
  }
);

export default EvaluationCatalog;
