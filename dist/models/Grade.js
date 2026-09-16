"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
class Grade extends sequelize_1.Model {
}
Grade.init({
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
    isDiversified: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    },
    order: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
    },
}, {
    sequelize: database_1.default,
    tableName: 'grades',
    hooks: {
        beforeCreate: (instance) => {
            if (instance.name)
                instance.name = instance.name.toUpperCase().trim();
        },
        beforeUpdate: (instance) => {
            if (instance.changed('name') && instance.name)
                instance.name = instance.name.toUpperCase().trim();
        }
    }
});
exports.default = Grade;
