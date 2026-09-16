"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
const Person_1 = __importDefault(require("./Person"));
const Role_1 = __importDefault(require("./Role"));
class PersonRole extends sequelize_1.Model {
}
PersonRole.init({
    personId: {
        type: sequelize_1.DataTypes.INTEGER,
        references: {
            model: Person_1.default,
            key: 'id',
        },
    },
    roleId: {
        type: sequelize_1.DataTypes.INTEGER,
        references: {
            model: Role_1.default,
            key: 'id',
        },
    },
}, {
    sequelize: database_1.default,
    tableName: 'person_roles',
    timestamps: false,
});
exports.default = PersonRole;
