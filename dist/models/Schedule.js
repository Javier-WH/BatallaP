"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
class Schedule extends sequelize_1.Model {
}
Schedule.init({
    id: { type: sequelize_1.DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    schoolPeriodId: {
        type: sequelize_1.DataTypes.INTEGER, allowNull: false,
        references: { model: 'school_periods', key: 'id' }, onDelete: 'CASCADE',
    },
    periodGradeSectionId: {
        type: sequelize_1.DataTypes.INTEGER, allowNull: false,
        references: { model: 'period_grade_sections', key: 'id' }, onDelete: 'CASCADE',
    },
    status: {
        type: sequelize_1.DataTypes.ENUM('draft', 'published'), allowNull: false, defaultValue: 'draft',
    },
}, {
    sequelize: database_1.default,
    tableName: 'schedules',
    indexes: [
        { unique: true, fields: ['schoolPeriodId', 'periodGradeSectionId'] },
    ],
});
exports.default = Schedule;
