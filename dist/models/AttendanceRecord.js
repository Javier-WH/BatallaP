"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
const AttendanceSession_1 = __importDefault(require("./AttendanceSession"));
const Inscription_1 = __importDefault(require("./Inscription"));
const Person_1 = __importDefault(require("./Person"));
/**
 * Attendance of one student in one session. Upserted by (sessionId, inscriptionId).
 * Every status change is mirrored in AttendanceAuditLog (append-only).
 */
class AttendanceRecord extends sequelize_1.Model {
}
AttendanceRecord.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    sessionId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: { model: AttendanceSession_1.default, key: 'id' },
        onDelete: 'CASCADE',
    },
    inscriptionId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: { model: Inscription_1.default, key: 'id' },
        onDelete: 'CASCADE',
    },
    teacherId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
        references: { model: Person_1.default, key: 'id' },
        onDelete: 'SET NULL',
    },
    status: {
        type: sequelize_1.DataTypes.ENUM('present', 'absent', 'late', 'excused', 'kicked'),
        allowNull: false,
        defaultValue: 'present',
    },
    reason: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true,
    },
    blocked: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    },
    clearedBy: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
        references: { model: Person_1.default, key: 'id' },
        onDelete: 'SET NULL',
    },
    clearedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
    },
    clearanceReasonCode: {
        type: sequelize_1.DataTypes.STRING(50),
        allowNull: true,
    },
    clearanceReasonNote: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true,
    },
    markedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize_1.DataTypes.NOW,
    },
    recordedOffline: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    },
    syncedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
    },
    clientRecordId: {
        type: sequelize_1.UUID,
        allowNull: true,
        unique: true,
    },
}, {
    sequelize: database_1.default,
    tableName: 'attendance_records',
    indexes: [
        {
            unique: true,
            fields: ['sessionId', 'inscriptionId'],
            name: 'uq_attendance_records_session_inscription',
        },
        {
            fields: ['inscriptionId'],
        },
    ],
});
exports.default = AttendanceRecord;
