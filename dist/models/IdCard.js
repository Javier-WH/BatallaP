"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
const Person_1 = __importDefault(require("./Person"));
/**
 * RFID card assigned to a person. Foundation for the future gate check-in
 * system (hardware not deployed yet). 125kHz cards broadcast a static UID —
 * this is for attendance/notification purposes, not a security control.
 */
class IdCard extends sequelize_1.Model {
}
IdCard.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    personId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: { model: Person_1.default, key: 'id' },
        onDelete: 'CASCADE',
    },
    cardUid: {
        type: sequelize_1.DataTypes.STRING(64),
        allowNull: false,
        unique: true,
    },
    issuedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize_1.DataTypes.NOW,
    },
    revokedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
    },
    active: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
    },
}, {
    sequelize: database_1.default,
    tableName: 'id_cards',
    indexes: [
        {
            fields: ['personId'],
        },
    ],
});
exports.default = IdCard;
