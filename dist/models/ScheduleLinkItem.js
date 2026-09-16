"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
class ScheduleLinkItem extends sequelize_1.Model {
}
ScheduleLinkItem.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    linkId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'schedule_links', key: 'id' },
        onDelete: 'CASCADE',
    },
    subjectId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'subjects', key: 'id' },
    },
    periodGradeId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'period_grades', key: 'id' },
    },
}, {
    sequelize: database_1.default,
    tableName: 'schedule_link_items',
    indexes: [
        // A (subjectId, periodGradeId) pair can only be in one link
        { unique: true, fields: ['subjectId', 'periodGradeId'] },
    ],
});
exports.default = ScheduleLinkItem;
