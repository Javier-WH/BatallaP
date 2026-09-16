"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
const Term_1 = __importDefault(require("./Term"));
const Section_1 = __importDefault(require("./Section"));
const Grade_1 = __importDefault(require("./Grade"));
const User_1 = __importDefault(require("./User"));
class TermSectionClosure extends sequelize_1.Model {
}
TermSectionClosure.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    termId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: Term_1.default,
            key: 'id',
        },
    },
    sectionId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: Section_1.default,
            key: 'id',
        },
    },
    gradeId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: Grade_1.default,
            key: 'id',
        },
    },
    closedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize_1.DataTypes.NOW,
    },
    closedBy: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: User_1.default,
            key: 'id',
        },
    },
}, {
    sequelize: database_1.default,
    tableName: 'term_section_closures',
    indexes: [
        {
            unique: true,
            fields: ['termId', 'sectionId', 'gradeId'],
            name: 'uq_term_section_closures_scope',
        },
        {
            fields: ['termId'],
        },
    ],
});
exports.default = TermSectionClosure;
