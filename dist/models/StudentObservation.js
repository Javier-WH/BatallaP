"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
const Inscription_1 = __importDefault(require("./Inscription"));
const Term_1 = __importDefault(require("./Term"));
const SchoolPeriod_1 = __importDefault(require("./SchoolPeriod"));
const Person_1 = __importDefault(require("./Person"));
class StudentObservation extends sequelize_1.Model {
}
StudentObservation.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    inscriptionId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: { model: Inscription_1.default, key: 'id' },
    },
    termId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: { model: Term_1.default, key: 'id' },
    },
    schoolPeriodId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: { model: SchoolPeriod_1.default, key: 'id' },
    },
    teacherId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: { model: Person_1.default, key: 'id' },
    },
    text: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: false,
        defaultValue: '',
    },
}, {
    sequelize: database_1.default,
    tableName: 'student_observations',
    indexes: [
        {
            unique: true,
            fields: ['inscriptionId', 'termId'],
            name: 'unique_observation_per_inscription_term',
        },
    ],
});
exports.default = StudentObservation;
