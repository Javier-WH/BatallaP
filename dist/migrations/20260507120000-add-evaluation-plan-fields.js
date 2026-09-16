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
exports.up = up;
exports.down = down;
const sequelize_1 = require("sequelize");
function up(queryInterface) {
    return __awaiter(this, void 0, void 0, function* () {
        yield queryInterface.addColumn('evaluation_plans', 'temaGenerador', {
            type: sequelize_1.DataTypes.TEXT,
            allowNull: true,
            comment: 'Tema generador de la evaluacion',
        });
        yield queryInterface.addColumn('evaluation_plans', 'referentesTeoricos', {
            type: sequelize_1.DataTypes.TEXT,
            allowNull: true,
            comment: 'Referentes teoricos de la evaluacion',
        });
        yield queryInterface.addColumn('evaluation_plans', 'referentesEticos', {
            type: sequelize_1.DataTypes.TEXT,
            allowNull: true,
            comment: 'Referentes eticos e indispensables',
        });
        yield queryInterface.addColumn('evaluation_plans', 'estrategiaEvaluacion', {
            type: sequelize_1.DataTypes.TEXT,
            allowNull: true,
            comment: 'Estrategia de evaluacion',
        });
        yield queryInterface.addColumn('evaluation_plans', 'tipoEvaluacion', {
            type: sequelize_1.DataTypes.STRING(100),
            allowNull: true,
            comment: 'Tipo de evaluacion',
        });
        yield queryInterface.addColumn('evaluation_plans', 'formaEvaluacion', {
            type: sequelize_1.DataTypes.STRING(100),
            allowNull: true,
            comment: 'Forma de evaluacion',
        });
        yield queryInterface.addColumn('evaluation_plans', 'indicador', {
            type: sequelize_1.DataTypes.TEXT,
            allowNull: true,
            comment: 'Indicador de desempeño',
        });
    });
}
function down(queryInterface) {
    return __awaiter(this, void 0, void 0, function* () {
        yield queryInterface.removeColumn('evaluation_plans', 'temaGenerador');
        yield queryInterface.removeColumn('evaluation_plans', 'referentesTeoricos');
        yield queryInterface.removeColumn('evaluation_plans', 'referentesEticos');
        yield queryInterface.removeColumn('evaluation_plans', 'estrategiaEvaluacion');
        yield queryInterface.removeColumn('evaluation_plans', 'tipoEvaluacion');
        yield queryInterface.removeColumn('evaluation_plans', 'formaEvaluacion');
        yield queryInterface.removeColumn('evaluation_plans', 'indicador');
    });
}
