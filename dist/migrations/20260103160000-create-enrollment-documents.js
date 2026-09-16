"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
exports.default = {
    up: (queryInterface) => __awaiter(void 0, void 0, void 0, function* () {
        yield queryInterface.createTable('enrollment_documents', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: sequelize_1.DataTypes.INTEGER
            },
            matriculationId: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'matriculations',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            receivedCertificadoAprendizaje: {
                type: sequelize_1.DataTypes.BOOLEAN,
                defaultValue: false
            },
            receivedCartaBuenaConducta: {
                type: sequelize_1.DataTypes.BOOLEAN,
                defaultValue: false
            },
            receivedNotasCertificadas: {
                type: sequelize_1.DataTypes.BOOLEAN,
                defaultValue: false
            },
            receivedPartidaNacimiento: {
                type: sequelize_1.DataTypes.BOOLEAN,
                defaultValue: false
            },
            receivedCopiaCedulaEstudiante: {
                type: sequelize_1.DataTypes.BOOLEAN,
                defaultValue: false
            },
            receivedInformesMedicos: {
                type: sequelize_1.DataTypes.BOOLEAN,
                defaultValue: false
            },
            receivedFotoCarnetEstudiante: {
                type: sequelize_1.DataTypes.BOOLEAN,
                defaultValue: false
            },
            pathCedulaRepresentante: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: true
            },
            pathFotoRepresentante: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: true
            },
            pathFotoEstudiante: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: true
            },
            createdAt: {
                allowNull: false,
                type: sequelize_1.DataTypes.DATE
            },
            updatedAt: {
                allowNull: false,
                type: sequelize_1.DataTypes.DATE
            }
        });
    }),
    down: (queryInterface) => __awaiter(void 0, void 0, void 0, function* () {
        yield queryInterface.dropTable('enrollment_documents');
    })
};
