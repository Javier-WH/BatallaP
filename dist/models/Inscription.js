"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
const SchoolPeriod_1 = __importDefault(require("./SchoolPeriod"));
const Grade_1 = __importDefault(require("./Grade"));
const Section_1 = __importDefault(require("./Section"));
const Person_1 = __importDefault(require("./Person"));
class Inscription extends sequelize_1.Model {
}
Inscription.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    schoolPeriodId: {
        type: sequelize_1.DataTypes.INTEGER,
        references: { model: SchoolPeriod_1.default, key: 'id' },
        allowNull: false
    },
    gradeId: {
        type: sequelize_1.DataTypes.INTEGER,
        references: { model: Grade_1.default, key: 'id' },
        allowNull: false
    },
    sectionId: {
        type: sequelize_1.DataTypes.INTEGER,
        references: { model: Section_1.default, key: 'id' },
        allowNull: true
    },
    personId: {
        type: sequelize_1.DataTypes.INTEGER,
        references: { model: Person_1.default, key: 'id' },
        allowNull: false
    },
    escolaridad: {
        type: sequelize_1.DataTypes.ENUM('regular', 'repitiente', 'materia_pendiente', 'transferencia'),
        allowNull: false,
        defaultValue: 'regular'
    },
    originPeriodId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: SchoolPeriod_1.default,
            key: 'id'
        }
    },
    isRepeater: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    withdrawnAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
        defaultValue: null
    }
}, {
    sequelize: database_1.default,
    tableName: 'inscriptions',
    indexes: [
        {
            unique: false,
            fields: ['schoolPeriodId', 'personId']
        }
    ]
});
exports.default = Inscription;
