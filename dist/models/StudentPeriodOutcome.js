"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
const Inscription_1 = __importDefault(require("./Inscription"));
const Grade_1 = __importDefault(require("./Grade"));
class StudentPeriodOutcome extends sequelize_1.Model {
}
StudentPeriodOutcome.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    inscriptionId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: Inscription_1.default,
            key: 'id'
        }
    },
    finalAverage: {
        type: sequelize_1.DataTypes.DECIMAL(5, 2),
        allowNull: true
    },
    failedSubjects: {
        type: sequelize_1.DataTypes.TINYINT.UNSIGNED,
        allowNull: false,
        defaultValue: 0
    },
    status: {
        type: sequelize_1.DataTypes.ENUM('aprobado', 'materias_pendientes', 'reprobado'),
        allowNull: false,
        defaultValue: 'aprobado'
    },
    promotionGradeId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: Grade_1.default,
            key: 'id'
        }
    },
    graduatedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true
    },
    metadata: {
        type: sequelize_1.DataTypes.JSON,
        allowNull: true
    }
}, {
    sequelize: database_1.default,
    tableName: 'student_period_outcomes',
    indexes: [
        {
            unique: true,
            fields: ['inscriptionId']
        }
    ]
});
exports.default = StudentPeriodOutcome;
