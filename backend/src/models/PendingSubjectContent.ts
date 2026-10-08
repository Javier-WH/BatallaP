import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';
import PendingSubject from './PendingSubject';

interface PendingSubjectContentAttributes {
  id: number;
  pendingSubjectId: number;
  themeTitle: string;
  order: number;
  createdAt?: Date;
  updatedAt?: Date;
}

type PendingSubjectContentCreationAttributes = Optional<
  PendingSubjectContentAttributes,
  'id' | 'order' | 'createdAt' | 'updatedAt'
>;

class PendingSubjectContent
  extends Model<PendingSubjectContentAttributes, PendingSubjectContentCreationAttributes>
  implements PendingSubjectContentAttributes
{
  public id!: number;
  public pendingSubjectId!: number;
  public themeTitle!: string;
  public order!: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

PendingSubjectContent.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    pendingSubjectId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: PendingSubject,
        key: 'id',
      },
    },
    themeTitle: {
      type: DataTypes.STRING(500),
      allowNull: false,
      defaultValue: '',
    },
    order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    sequelize,
    tableName: 'pending_subject_contents',
    indexes: [
      {
        fields: ['pendingSubjectId'],
      },
    ],
  }
);

export default PendingSubjectContent;
