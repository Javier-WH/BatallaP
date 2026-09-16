"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
const User_1 = __importDefault(require("./User"));
class Person extends sequelize_1.Model {
}
Person.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    firstName: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
    },
    lastName: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
    },
    documentType: {
        type: sequelize_1.DataTypes.ENUM('Venezolano', 'Extranjero', 'Pasaporte', 'Cedula Escolar'),
        allowNull: false,
    },
    document: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true,
        unique: true, // Assuming document numbers are unique when provided
    },
    gender: {
        type: sequelize_1.DataTypes.ENUM('M', 'F'),
        allowNull: false,
    },
    birthdate: {
        type: sequelize_1.DataTypes.DATEONLY, // Use DATEONLY for birthdates usually
        allowNull: false,
    },
    pathology: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true
    },
    livingWith: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true
    },
    hireDate: {
        type: sequelize_1.DataTypes.DATEONLY,
        allowNull: true,
    },
    userId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: User_1.default,
            key: 'id',
        },
        unique: true, // One user per person, if assigned
    },
}, {
    sequelize: database_1.default,
    tableName: 'people',
    hooks: {
        beforeCreate: (instance) => {
            if (instance.firstName)
                instance.firstName = instance.firstName.toUpperCase().trim();
            if (instance.lastName)
                instance.lastName = instance.lastName.toUpperCase().trim();
            if (instance.pathology)
                instance.pathology = instance.pathology.toUpperCase().trim();
            if (instance.livingWith)
                instance.livingWith = instance.livingWith.toUpperCase().trim();
        },
        beforeUpdate: (instance) => {
            if (instance.changed('firstName') && instance.firstName)
                instance.firstName = instance.firstName.toUpperCase().trim();
            if (instance.changed('lastName') && instance.lastName)
                instance.lastName = instance.lastName.toUpperCase().trim();
            if (instance.changed('pathology') && instance.pathology)
                instance.pathology = instance.pathology.toUpperCase().trim();
            if (instance.changed('livingWith') && instance.livingWith)
                instance.livingWith = instance.livingWith.toUpperCase().trim();
        }
    }
});
exports.default = Person;
