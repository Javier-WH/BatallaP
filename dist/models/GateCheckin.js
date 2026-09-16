"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
const Person_1 = __importDefault(require("./Person"));
const GateDevice_1 = __importDefault(require("./GateDevice"));
/**
 * Gate check-in event from an RFID reader. Foundation for the future gate
 * check-in system — hardware not deployed yet. The endpoint applies the
 * debounce/toggle logic from the spec so readers can be integrated later
 * without schema changes.
 */
class GateCheckin extends sequelize_1.Model {
}
GateCheckin.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    personId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
        references: { model: Person_1.default, key: 'id' },
        onDelete: 'SET NULL',
    },
    cardUid: {
        type: sequelize_1.DataTypes.STRING(64),
        allowNull: false,
    },
    deviceId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
        references: { model: GateDevice_1.default, key: 'id' },
        onDelete: 'SET NULL',
    },
    eventType: {
        type: sequelize_1.DataTypes.ENUM('entry', 'exit'),
        allowNull: false,
        defaultValue: 'entry',
    },
    timestamp: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize_1.DataTypes.NOW,
    },
    flaggedDuplicate: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    },
}, {
    sequelize: database_1.default,
    tableName: 'gate_checkins',
    indexes: [
        {
            fields: ['personId', 'timestamp'],
        },
        {
            fields: ['cardUid'],
        },
    ],
});
exports.default = GateCheckin;
