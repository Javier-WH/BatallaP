"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ENROLLMENT_PLAN_ITEM_TYPES = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
exports.ENROLLMENT_PLAN_ITEM_TYPES = ['fee', 'sellable_item'];
class EnrollmentPlanItem extends sequelize_1.Model {
}
EnrollmentPlanItem.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    enrollmentPlanId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'enrollment_plans', key: 'id' },
        onDelete: 'CASCADE',
    },
    itemType: {
        type: sequelize_1.DataTypes.ENUM(...exports.ENROLLMENT_PLAN_ITEM_TYPES),
        allowNull: false,
    },
    feeId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'fees', key: 'id' },
    },
    sellableItemId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'sellable_items', key: 'id' },
    },
    quantity: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
    },
}, {
    sequelize: database_1.default,
    tableName: 'enrollment_plan_items',
    indexes: [
        { fields: ['enrollmentPlanId'] },
        { fields: ['feeId'] },
        { fields: ['sellableItemId'] },
    ],
});
exports.default = EnrollmentPlanItem;
