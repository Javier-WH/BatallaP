"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
const Grade_1 = __importDefault(require("./Grade"));
class SchoolPeriodTransitionRule extends sequelize_1.Model {
}
SchoolPeriodTransitionRule.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    gradeFromId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: Grade_1.default,
            key: 'id'
        }
    },
    gradeToId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: Grade_1.default,
            key: 'id'
        }
    },
    minAverage: {
        type: sequelize_1.DataTypes.DECIMAL(4, 2),
        allowNull: false,
        defaultValue: 10
    },
    maxPendingSubjects: {
        type: sequelize_1.DataTypes.TINYINT.UNSIGNED,
        allowNull: false,
        defaultValue: 0
    },
    autoGraduate: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    }
}, {
    sequelize: database_1.default,
    tableName: 'school_period_transition_rules',
    indexes: [
        {
            unique: true,
            fields: ['gradeFromId']
        }
    ]
});
exports.default = SchoolPeriodTransitionRule;
