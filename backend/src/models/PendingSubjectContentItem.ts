import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';
import PendingSubjectContent from './PendingSubjectContent';

interface PendingSubjectContentItemAttributes {
  id: number;
  contentId: number;
  text: string;
  order: number;
  createdAt?: Date;
  updatedAt?: Date;
}

type PendingSubjectContentItemCreationAttributes = Optional<
  PendingSubjectContentItemAttributes,
  'id' | 'order' | 'createdAt' | 'updatedAt'
>;

class PendingSubjectContentItem
  extends Model<PendingSubjectContentItemAttributes, PendingSubjectContentItemCreationAttributes>
  implements PendingSubjectContentItemAttributes
{
  public id!: number;
  public contentId!: number;
  public text!: string;
  public order!: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

PendingSubjectContentItem.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    contentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: PendingSubjectContent,
        key: 'id',
      },
    },
    text: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    sequelize,
    tableName: 'pending_subject_content_items',
  }
);

export default PendingSubjectContentItem;
