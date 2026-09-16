"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
const Person_1 = __importDefault(require("./Person"));
const Plantel_1 = __importDefault(require("./Plantel"));
class PersonPlantel extends sequelize_1.Model {
}
PersonPlantel.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    personId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: { model: Person_1.default, key: 'id' },
    },
    plantelId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true, // null for the system plantel (isSystem=true)
        references: { model: Plantel_1.default, key: 'id' },
    },
    order: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
    },
    isSystem: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    },
}, {
    sequelize: database_1.default,
    tableName: 'person_planteles',
    indexes: [
        {
            unique: true,
            fields: ['personId', 'plantelId'],
            name: 'uq_person_plantel',
        },
        {
            fields: ['personId'],
        },
    ],
});
exports.default = PersonPlantel;
