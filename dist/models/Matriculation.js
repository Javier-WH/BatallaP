"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
const Person_1 = __importDefault(require("./Person"));
const SchoolPeriod_1 = __importDefault(require("./SchoolPeriod"));
const Grade_1 = __importDefault(require("./Grade"));
const Section_1 = __importDefault(require("./Section"));
const Inscription_1 = __importDefault(require("./Inscription"));
class Matriculation extends sequelize_1.Model {
}
Matriculation.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    personId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: { model: Person_1.default, key: 'id' }
    },
    schoolPeriodId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: { model: SchoolPeriod_1.default, key: 'id' }
    },
    gradeId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: { model: Grade_1.default, key: 'id' }
    },
    sectionId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
        references: { model: Section_1.default, key: 'id' }
    },
    escolaridad: {
        type: sequelize_1.DataTypes.ENUM('regular', 'repitiente', 'materia_pendiente'),
        allowNull: false,
        defaultValue: 'regular'
    },
    status: {
        type: sequelize_1.DataTypes.ENUM('pending', 'completed', 'withdrawn'),
        allowNull: false,
        defaultValue: 'pending'
    },
    inscriptionId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
        references: { model: Inscription_1.default, key: 'id' }
    },
    hiddenFromControlEstudios: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    }
}, {
    sequelize: database_1.default,
    tableName: 'matriculations',
    indexes: [
        {
            unique: true,
            fields: ['schoolPeriodId', 'personId']
        }
    ]
});
exports.default = Matriculation;
