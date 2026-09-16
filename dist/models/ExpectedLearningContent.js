"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
class ExpectedLearningContent extends sequelize_1.Model {
}
ExpectedLearningContent.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    learningId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
    },
    contentId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
    },
}, {
    sequelize: database_1.default,
    tableName: 'expected_learning_contents',
});
exports.default = ExpectedLearningContent;
