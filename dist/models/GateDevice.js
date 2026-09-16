"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
/**
 * Physical reader device at a gate (or a mobile device). Foundation for the
 * future gate check-in system — hardware not deployed yet.
 */
class GateDevice extends sequelize_1.Model {
}
GateDevice.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    type: {
        type: sequelize_1.DataTypes.ENUM('gate_reader', 'mobile'),
        allowNull: false,
        defaultValue: 'gate_reader',
    },
    identifier: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: false,
        unique: true,
    },
    location: {
        type: sequelize_1.DataTypes.STRING(150),
        allowNull: true,
    },
    active: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
    },
}, {
    sequelize: database_1.default,
    tableName: 'gate_devices',
});
exports.default = GateDevice;
