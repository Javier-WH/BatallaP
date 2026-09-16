"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
const ThematicComponent_1 = __importDefault(require("./ThematicComponent"));
class ThematicContent extends sequelize_1.Model {
}
ThematicContent.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    thematicComponentId: {
        type: sequelize_1.DataTypes.INTEGER,
        references: { model: ThematicComponent_1.default, key: 'id' },
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
    tableName: 'thematic_contents',
});
exports.default = ThematicContent;
