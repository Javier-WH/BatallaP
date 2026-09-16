"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
const EvaluationCriteria_1 = __importDefault(require("./EvaluationCriteria"));
class EvaluationIndicator extends sequelize_1.Model {
}
EvaluationIndicator.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    evaluationCriteriaId: {
        type: sequelize_1.DataTypes.INTEGER,
        references: { model: EvaluationCriteria_1.default, key: 'id' },
        allowNull: false,
    },
    name: {
        type: sequelize_1.DataTypes.STRING(255),
        allowNull: false,
    },
    points: {
        type: sequelize_1.DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0,
    },
}, {
    sequelize: database_1.default,
    tableName: 'evaluation_indicators',
});
exports.default = EvaluationIndicator;
