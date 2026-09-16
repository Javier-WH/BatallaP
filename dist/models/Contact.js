"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
const Person_1 = __importDefault(require("./Person"));
class Contact extends sequelize_1.Model {
}
Contact.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    phone1: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true,
    },
    phone2: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true,
    },
    email: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true,
        validate: {
            isEmail: true
        }
    },
    address: {
        type: sequelize_1.DataTypes.TEXT, // Could be long
        allowNull: true,
    },
    whatsapp: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true,
    },
    socialMedia: {
        type: sequelize_1.DataTypes.JSON, // Use JSON for flexibility
        allowNull: true,
    },
    personId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: Person_1.default,
            key: 'id'
        },
        unique: true // One-to-One
    }
}, {
    sequelize: database_1.default,
    tableName: 'contacts',
});
exports.default = Contact;
