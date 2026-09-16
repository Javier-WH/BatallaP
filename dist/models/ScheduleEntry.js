"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
class ScheduleEntry extends sequelize_1.Model {
}
ScheduleEntry.init({
    id: { type: sequelize_1.DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    scheduleId: {
        type: sequelize_1.DataTypes.INTEGER, allowNull: false,
        references: { model: 'schedules', key: 'id' }, onDelete: 'CASCADE',
    },
    day: { type: sequelize_1.DataTypes.STRING(20), allowNull: false },
    periodId: { type: sequelize_1.DataTypes.STRING(20), allowNull: false, field: 'period_id' },
    subjectId: {
        type: sequelize_1.DataTypes.INTEGER, allowNull: true,
        references: { model: 'subjects', key: 'id' }, onDelete: 'SET NULL',
    },
    teacherId: {
        type: sequelize_1.DataTypes.INTEGER, allowNull: true,
        references: { model: 'people', key: 'id' }, onDelete: 'SET NULL',
    },
    isGroupSubject: {
        type: sequelize_1.DataTypes.BOOLEAN, allowNull: false, defaultValue: false,
    },
}, {
    sequelize: database_1.default,
    tableName: 'schedule_entries',
    indexes: [
        // Prevent exact duplicate (same subject in same slot) but allow multiple group subjects
        { unique: true, fields: ['scheduleId', 'day', 'period_id', 'subjectId'] },
    ],
});
exports.default = ScheduleEntry;
