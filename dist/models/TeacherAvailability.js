"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
class TeacherAvailability extends sequelize_1.Model {
}
TeacherAvailability.init({
    id: { type: sequelize_1.DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    personId: { type: sequelize_1.DataTypes.INTEGER, allowNull: false, field: 'person_id' },
    day: { type: sequelize_1.DataTypes.STRING(20), allowNull: false },
    periodId: { type: sequelize_1.DataTypes.STRING(20), allowNull: false, field: 'period_id' },
    status: { type: sequelize_1.DataTypes.STRING(20), allowNull: false },
}, {
    sequelize: database_1.default,
    tableName: 'teacher_availability',
    timestamps: true,
    indexes: [
        { unique: true, fields: ['person_id', 'day', 'period_id'] },
    ],
});
exports.default = TeacherAvailability;
