"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
const Subject_1 = __importDefault(require("./Subject"));
class ScheduleException extends sequelize_1.Model {
}
ScheduleException.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    subjectId: {
        type: sequelize_1.DataTypes.INTEGER,
        references: { model: Subject_1.default, key: 'id' },
        allowNull: false,
        unique: true,
    },
    allowConsecutiveBlocks: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
    },
    weeklyBlocks: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
    },
    maxHoursPerDay: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
    },
}, {
    sequelize: database_1.default,
    tableName: 'schedule_exceptions',
});
exports.default = ScheduleException;
