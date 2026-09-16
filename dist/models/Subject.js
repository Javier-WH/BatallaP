"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
class Subject extends sequelize_1.Model {
}
Subject.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    name: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    subjectGroupId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
    },
    usesLiteralGrades: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    },
    abbreviation: {
        type: sequelize_1.DataTypes.STRING(10),
        allowNull: true,
    },
    icon: {
        type: sequelize_1.DataTypes.STRING(50),
        allowNull: true,
    },
    color: {
        type: sequelize_1.DataTypes.STRING(7),
        allowNull: true,
    },
    allowConsecutiveBlocks: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
    },
    maxHoursPerDay: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
    },
}, {
    sequelize: database_1.default,
    tableName: 'subjects',
    hooks: {
        beforeCreate: (instance) => {
            if (instance.name)
                instance.name = instance.name.toUpperCase().trim();
            if (instance.abbreviation)
                instance.abbreviation = instance.abbreviation.toUpperCase().trim();
        },
        beforeUpdate: (instance) => {
            if (instance.changed('name') && instance.name)
                instance.name = instance.name.toUpperCase().trim();
            if (instance.changed('abbreviation') && instance.abbreviation)
                instance.abbreviation = instance.abbreviation.toUpperCase().trim();
        }
    }
});
exports.default = Subject;
