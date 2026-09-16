"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
const PeriodGradeSubject_1 = __importDefault(require("./PeriodGradeSubject"));
const Term_1 = __importDefault(require("./Term"));
const ThematicComponent_1 = __importDefault(require("./ThematicComponent"));
class EvaluationPlan extends sequelize_1.Model {
}
EvaluationPlan.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    periodGradeSubjectId: {
        type: sequelize_1.DataTypes.INTEGER,
        references: { model: PeriodGradeSubject_1.default, key: 'id' },
        allowNull: false
    },
    sectionId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false
    },
    termId: {
        type: sequelize_1.DataTypes.INTEGER,
        references: { model: Term_1.default, key: 'id' },
        allowNull: false
    },
    description: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false
    },
    percentage: {
        type: sequelize_1.DataTypes.DECIMAL(5, 2),
        allowNull: false,
        validate: {
            min: 0,
            max: 100
        }
    },
    date: {
        type: sequelize_1.DataTypes.DATEONLY,
        allowNull: false
    },
    thematicComponentId: {
        type: sequelize_1.DataTypes.INTEGER,
        references: { model: ThematicComponent_1.default, key: 'id' },
        allowNull: true
    },
    thematicContentIds: {
        type: sequelize_1.DataTypes.JSON,
        allowNull: true,
        defaultValue: null,
    },
    evaluationType: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true,
        defaultValue: null
    },
    tecnica: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true,
        defaultValue: null
    },
    instrumento: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true,
        defaultValue: null
    },
    shortDescription: {
        type: sequelize_1.DataTypes.STRING(40),
        allowNull: true,
        defaultValue: null
    },
    tecnicaId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null
    },
    instrumentoId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null
    },
    estrategiaId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null
    }
}, {
    sequelize: database_1.default,
    tableName: 'evaluation_plans',
});
exports.default = EvaluationPlan;
