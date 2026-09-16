"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
class EnrollmentAnswer extends sequelize_1.Model {
}
EnrollmentAnswer.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    questionId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'enrollment_questions',
            key: 'id'
        },
        onDelete: 'CASCADE'
    },
    personId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'people',
            key: 'id'
        },
        onDelete: 'CASCADE'
    },
    answer: {
        type: sequelize_1.DataTypes.JSON,
        allowNull: false
    }
}, {
    sequelize: database_1.default,
    tableName: 'enrollment_answers',
    indexes: [
        {
            fields: ['questionId']
        },
        {
            fields: ['personId']
        },
        {
            unique: true,
            fields: ['questionId', 'personId']
        }
    ]
});
exports.default = EnrollmentAnswer;
