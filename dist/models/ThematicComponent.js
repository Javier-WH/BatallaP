"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
const PeriodGradeSubject_1 = __importDefault(require("./PeriodGradeSubject"));
const Term_1 = __importDefault(require("./Term"));
class ThematicComponent extends sequelize_1.Model {
}
ThematicComponent.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    periodGradeSubjectId: {
        type: sequelize_1.DataTypes.INTEGER,
        references: { model: PeriodGradeSubject_1.default, key: 'id' },
        allowNull: false,
    },
    termId: {
        type: sequelize_1.DataTypes.INTEGER,
        references: { model: Term_1.default, key: 'id' },
        allowNull: false,
    },
    title: {
        type: sequelize_1.DataTypes.STRING(500),
        allowNull: false,
    },
    order: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
    },
}, {
    sequelize: database_1.default,
    tableName: 'thematic_components',
});
exports.default = ThematicComponent;
