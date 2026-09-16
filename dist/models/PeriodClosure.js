"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
const SchoolPeriod_1 = __importDefault(require("./SchoolPeriod"));
const User_1 = __importDefault(require("./User"));
class PeriodClosure extends sequelize_1.Model {
}
PeriodClosure.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    schoolPeriodId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: SchoolPeriod_1.default,
            key: 'id'
        }
    },
    status: {
        type: sequelize_1.DataTypes.ENUM('draft', 'validating', 'closed', 'failed'),
        allowNull: false,
        defaultValue: 'draft'
    },
    initiatedBy: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: User_1.default,
            key: 'id'
        }
    },
    startedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true
    },
    finishedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true
    },
    log: {
        type: sequelize_1.DataTypes.JSON,
        allowNull: true
    },
    snapshot: {
        type: sequelize_1.DataTypes.JSON,
        allowNull: true
    }
}, {
    sequelize: database_1.default,
    tableName: 'period_closures'
});
exports.default = PeriodClosure;
