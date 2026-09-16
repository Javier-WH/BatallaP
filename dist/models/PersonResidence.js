"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
const Person_1 = __importDefault(require("./Person"));
class PersonResidence extends sequelize_1.Model {
}
PersonResidence.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    personId: {
        field: 'people_id',
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        unique: true,
        references: {
            model: Person_1.default,
            key: 'id'
        }
    },
    birthState: {
        field: 'birth_state',
        type: sequelize_1.DataTypes.STRING,
        allowNull: false
    },
    birthMunicipality: {
        field: 'birth_municipality',
        type: sequelize_1.DataTypes.STRING,
        allowNull: false
    },
    birthParish: {
        field: 'birth_parish',
        type: sequelize_1.DataTypes.STRING,
        allowNull: false
    },
    residenceState: {
        field: 'residence_state',
        type: sequelize_1.DataTypes.STRING,
        allowNull: false
    },
    residenceMunicipality: {
        field: 'residence_municipality',
        type: sequelize_1.DataTypes.STRING,
        allowNull: false
    },
    residenceParish: {
        field: 'residence_parish',
        type: sequelize_1.DataTypes.STRING,
        allowNull: false
    },
    address: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true
    }
}, {
    sequelize: database_1.default,
    tableName: 'person_residences'
});
exports.default = PersonResidence;
