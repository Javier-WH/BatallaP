import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';

interface TermAttributes {
  id: number;
  name: string;
  isBlocked: boolean;
  openDate?: Date;
  closeDate?: Date;
  schoolPeriodId: number;
  order: number; // Para mantener el orden de los lapsos
}

interface TermCreationAttributes extends Optional<TermAttributes, 'id'> {}

class Term extends Model<TermAttributes, TermCreationAttributes> implements TermAttributes {
  public id!: number;
  public name!: string;
  public isBlocked!: boolean;
  public openDate?: Date;
  public closeDate?: Date;
  public schoolPeriodId!: number;
  public order!: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Term.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    isBlocked: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    openDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    closeDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    schoolPeriodId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'school_periods',
        key: 'id',
      },
    },
    order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
  },
  {
    sequelize,
    tableName: 'terms',
    indexes: [
      {
        unique: true,
        fields: ['schoolPeriodId', 'order'],
      },
    ],
  }
);

export default Term;
