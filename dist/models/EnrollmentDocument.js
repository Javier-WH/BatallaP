"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
const Matriculation_1 = __importDefault(require("./Matriculation"));
class EnrollmentDocument extends sequelize_1.Model {
}
EnrollmentDocument.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    matriculationId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: Matriculation_1.default,
            key: 'id',
        },
        unique: true // One document record per matriculation
    },
    receivedCertificadoAprendizaje: {
        type: sequelize_1.DataTypes.BOOLEAN,
        defaultValue: false,
    },
    receivedCartaBuenaConducta: {
        type: sequelize_1.DataTypes.BOOLEAN,
        defaultValue: false,
    },
    receivedNotasCertificadas: {
        type: sequelize_1.DataTypes.BOOLEAN,
        defaultValue: false,
    },
    receivedPartidaNacimiento: {
        type: sequelize_1.DataTypes.BOOLEAN,
        defaultValue: false,
    },
    receivedCopiaCedulaEstudiante: {
        type: sequelize_1.DataTypes.BOOLEAN,
        defaultValue: false,
    },
    receivedInformesMedicos: {
        type: sequelize_1.DataTypes.BOOLEAN,
        defaultValue: false,
    },
    receivedFotoCarnetEstudiante: {
        type: sequelize_1.DataTypes.BOOLEAN,
        defaultValue: false,
    },
    pathCedulaRepresentante: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true,
    },
    pathFotoRepresentante: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true,
    },
    pathFotoEstudiante: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true,
    },
    pathInformesMedicos: {
        type: sequelize_1.DataTypes.JSON,
        allowNull: true,
    },
}, {
    sequelize: database_1.default,
    tableName: 'enrollment_documents',
});
exports.default = EnrollmentDocument;
