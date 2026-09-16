"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
const Person_1 = __importDefault(require("./Person"));
const GuardianProfile_1 = __importDefault(require("./GuardianProfile"));
class StudentGuardian extends sequelize_1.Model {
}
StudentGuardian.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    studentId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: Person_1.default,
            key: 'id'
        }
    },
    guardianId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: GuardianProfile_1.default,
            key: 'id'
        },
        onDelete: 'CASCADE'
    },
    relationship: {
        type: sequelize_1.DataTypes.ENUM('mother', 'father', 'sibling', 'grandparent', 'uncle_aunt', 'representative'),
        allowNull: false
    },
    isRepresentative: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    }
}, {
    sequelize: database_1.default,
    tableName: 'student_guardians',
    indexes: [
        {
            unique: true,
            fields: ['studentId', 'relationship']
        }
    ]
});
exports.default = StudentGuardian;
