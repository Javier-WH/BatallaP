"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
class EnrollmentQuestion extends sequelize_1.Model {
}
EnrollmentQuestion.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    prompt: {
        type: sequelize_1.DataTypes.STRING(255),
        allowNull: false
    },
    description: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true
    },
    type: {
        type: sequelize_1.DataTypes.ENUM('text', 'select', 'checkbox'),
        allowNull: false
    },
    options: {
        type: sequelize_1.DataTypes.JSON,
        allowNull: true,
        validate: {
            isArrayOfStrings(value) {
                if (value === null || value === undefined)
                    return;
                if (!Array.isArray(value) || !value.every((v) => typeof v === 'string')) {
                    throw new Error('Options must be an array of strings');
                }
            }
        }
    },
    isActive: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    },
    required: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    order: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    }
}, {
    sequelize: database_1.default,
    tableName: 'enrollment_questions',
    indexes: [
        {
            fields: ['isActive']
        },
        {
            fields: ['order']
        }
    ]
});
exports.default = EnrollmentQuestion;
