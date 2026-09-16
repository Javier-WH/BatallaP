"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
const AttendanceRecord_1 = __importDefault(require("./AttendanceRecord"));
const Person_1 = __importDefault(require("./Person"));
/**
 * Append-only audit trail for attendance changes. Rows are never updated or
 * deleted — every mark, block, clear and status change inserts a new row so
 * the school can review patterns and make decisions later.
 */
class AttendanceAuditLog extends sequelize_1.Model {
}
AttendanceAuditLog.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    attendanceRecordId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: { model: AttendanceRecord_1.default, key: 'id' },
        onDelete: 'CASCADE',
    },
    action: {
        type: sequelize_1.DataTypes.ENUM('marked', 'blocked', 'cleared', 'status_changed'),
        allowNull: false,
    },
    performedBy: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
        references: { model: Person_1.default, key: 'id' },
        onDelete: 'SET NULL',
    },
    reasonCode: {
        type: sequelize_1.DataTypes.STRING(50),
        allowNull: true,
    },
    reasonNote: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true,
    },
    previousValue: {
        type: sequelize_1.DataTypes.JSON,
        allowNull: true,
    },
    newValue: {
        type: sequelize_1.DataTypes.JSON,
        allowNull: true,
    },
    timestamp: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize_1.DataTypes.NOW,
    },
    clientRecordId: {
        type: sequelize_1.UUID,
        allowNull: true,
        unique: true,
    },
}, {
    sequelize: database_1.default,
    tableName: 'attendance_audit_log',
    indexes: [
        {
            fields: ['attendanceRecordId'],
        },
        {
            fields: ['performedBy'],
        },
    ],
});
exports.default = AttendanceAuditLog;
