"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
const ScheduleEntry_1 = __importDefault(require("./ScheduleEntry"));
const SchoolPeriod_1 = __importDefault(require("./SchoolPeriod"));
/**
 * A concrete attendance session: one scheduled class (ScheduleEntry) on a
 * specific calendar date. Created on demand when a teacher opens the module
 * for a date (today or a past date for paper backfill).
 */
class AttendanceSession extends sequelize_1.Model {
}
AttendanceSession.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    scheduleEntryId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: { model: ScheduleEntry_1.default, key: 'id' },
        onDelete: 'CASCADE',
    },
    schoolPeriodId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: { model: SchoolPeriod_1.default, key: 'id' },
        onDelete: 'CASCADE',
    },
    sessionDate: {
        type: sequelize_1.DataTypes.DATEONLY,
        allowNull: false,
    },
    status: {
        type: sequelize_1.DataTypes.ENUM('pending', 'completed', 'cancelled'),
        allowNull: false,
        defaultValue: 'pending',
    },
}, {
    sequelize: database_1.default,
    tableName: 'attendance_sessions',
    indexes: [
        {
            unique: true,
            fields: ['scheduleEntryId', 'sessionDate'],
            name: 'uq_attendance_sessions_entry_date',
        },
        {
            fields: ['schoolPeriodId', 'sessionDate'],
        },
    ],
});
exports.default = AttendanceSession;
