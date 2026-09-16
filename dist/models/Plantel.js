"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
class Plantel extends sequelize_1.Model {
}
Plantel.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    code: {
        type: sequelize_1.DataTypes.STRING(50),
        allowNull: false,
        unique: true,
    },
    name: {
        type: sequelize_1.DataTypes.STRING(500),
        allowNull: false,
    },
    state: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: false,
    },
    stateCode: {
        type: sequelize_1.DataTypes.STRING(5),
        allowNull: true,
    },
    dependency: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: true,
    },
    municipality: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: true,
    },
    parish: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: true,
    },
}, {
    sequelize: database_1.default,
    tableName: 'planteles',
    indexes: [
        {
            fields: ['code']
        },
        {
            fields: ['name']
        },
        {
            fields: ['state']
        },
        {
            fields: ['name', 'state']
        }
    ],
    hooks: {
        beforeCreate: (instance) => {
            if (instance.name)
                instance.name = instance.name.toUpperCase().trim();
            if (instance.state)
                instance.state = instance.state.toUpperCase().trim();
            if (instance.dependency)
                instance.dependency = instance.dependency.toUpperCase().trim();
            if (instance.municipality)
                instance.municipality = instance.municipality.toUpperCase().trim();
            if (instance.parish)
                instance.parish = instance.parish.toUpperCase().trim();
            // Auto-generate stateCode from first 2 letters of state if not provided
            if (instance.state && !instance.stateCode) {
                instance.stateCode = instance.state.substring(0, 2).toUpperCase();
            }
        },
        beforeUpdate: (instance) => {
            if (instance.changed('name') && instance.name)
                instance.name = instance.name.toUpperCase().trim();
            if (instance.changed('state') && instance.state)
                instance.state = instance.state.toUpperCase().trim();
            if (instance.changed('dependency') && instance.dependency)
                instance.dependency = instance.dependency.toUpperCase().trim();
            if (instance.changed('municipality') && instance.municipality)
                instance.municipality = instance.municipality.toUpperCase().trim();
            if (instance.changed('parish') && instance.parish)
                instance.parish = instance.parish.toUpperCase().trim();
            // Auto-regenerate stateCode when state changes
            if (instance.changed('state') && instance.state) {
                instance.stateCode = instance.state.substring(0, 2).toUpperCase();
            }
        }
    }
});
exports.default = Plantel;
