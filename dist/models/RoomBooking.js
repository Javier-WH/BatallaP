"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
class RoomBooking extends sequelize_1.Model {
}
RoomBooking.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    room: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
    },
    day: {
        type: sequelize_1.DataTypes.STRING(20),
        allowNull: false,
    },
    periodIds: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: false,
    },
    specificDate: {
        type: sequelize_1.DataTypes.DATEONLY,
        allowNull: true,
    },
    teacherName: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
    },
    subjectName: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
    },
    reason: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true,
    },
    status: {
        type: sequelize_1.DataTypes.ENUM('approved', 'pending', 'rejected'),
        allowNull: false,
        defaultValue: 'approved',
    },
    requestedBy: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
    },
    schoolPeriodId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
    },
}, {
    sequelize: database_1.default,
    tableName: 'room_bookings',
});
exports.default = RoomBooking;
