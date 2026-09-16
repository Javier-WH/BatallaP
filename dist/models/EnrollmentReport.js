"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
const Matriculation_1 = __importDefault(require("./Matriculation"));
const Person_1 = __importDefault(require("./Person"));
class EnrollmentReport extends sequelize_1.Model {
}
EnrollmentReport.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    uuid: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false,
        unique: true,
        defaultValue: sequelize_1.DataTypes.UUIDV4,
    },
    matriculationId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: Matriculation_1.default,
            key: 'id',
        },
    },
    personId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: Person_1.default,
            key: 'id',
        },
    },
    snapshotData: {
        type: sequelize_1.DataTypes.JSON,
        allowNull: false,
    },
}, {
    sequelize: database_1.default,
    tableName: 'enrollment_reports',
    indexes: [
        { unique: true, fields: ['uuid'] },
        { fields: ['personId'] },
        { fields: ['matriculationId'] },
    ],
});
exports.default = EnrollmentReport;
