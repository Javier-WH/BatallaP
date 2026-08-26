import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';

export type EnrollmentPlanItemType = 'fee' | 'sellable_item';

export const ENROLLMENT_PLAN_ITEM_TYPES: EnrollmentPlanItemType[] = ['fee', 'sellable_item'];

interface EnrollmentPlanItemAttributes {
  id: number;
  enrollmentPlanId: number;
  itemType: EnrollmentPlanItemType;
  feeId: number | null;
  sellableItemId: number | null;
  quantity: number;
}

interface EnrollmentPlanItemCreationAttributes
  extends Optional<EnrollmentPlanItemAttributes, 'id' | 'quantity'> {}

class EnrollmentPlanItem extends Model<EnrollmentPlanItemAttributes, EnrollmentPlanItemCreationAttributes>
  implements EnrollmentPlanItemAttributes {
  public id!: number;
  public enrollmentPlanId!: number;
  public itemType!: EnrollmentPlanItemType;
  public feeId!: number | null;
  public sellableItemId!: number | null;
  public quantity!: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

EnrollmentPlanItem.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    enrollmentPlanId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'enrollment_plans', key: 'id' },
      onDelete: 'CASCADE',
    },
    itemType: {
      type: DataTypes.ENUM(...ENROLLMENT_PLAN_ITEM_TYPES),
      allowNull: false,
    },
    feeId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'fees', key: 'id' },
    },
    sellableItemId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'sellable_items', key: 'id' },
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
  },
  {
    sequelize,
    tableName: 'enrollment_plan_items',
    indexes: [
      { fields: ['enrollmentPlanId'] },
      { fields: ['feeId'] },
      { fields: ['sellableItemId'] },
    ],
  }
);

export default EnrollmentPlanItem;
