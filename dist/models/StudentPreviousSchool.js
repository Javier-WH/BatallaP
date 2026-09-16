"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
const Person_1 = __importDefault(require("./Person"));
class StudentPreviousSchool extends sequelize_1.Model {
}
StudentPreviousSchool.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    personId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: Person_1.default,
            key: 'id'
        },
        onDelete: 'CASCADE'
    },
    plantelCode: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true
    },
    plantelName: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false
    },
    state: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true
    },
    municipality: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true
    },
    parish: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true
    },
    dependency: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true
    },
    gradeFrom: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true
    },
    gradeTo: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true
    },
    notes: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true
    }
}, {
    sequelize: database_1.default,
    tableName: 'student_previous_schools',
    indexes: [
        {
            fields: ['personId']
        },
        {
            fields: ['plantelCode']
        }
    ]
});
exports.default = StudentPreviousSchool;
