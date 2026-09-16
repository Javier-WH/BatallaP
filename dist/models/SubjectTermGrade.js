"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
const InscriptionSubject_1 = __importDefault(require("./InscriptionSubject"));
const Term_1 = __importDefault(require("./Term"));
class SubjectTermGrade extends sequelize_1.Model {
}
SubjectTermGrade.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    inscriptionSubjectId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: InscriptionSubject_1.default,
            key: 'id',
        },
    },
    termId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: Term_1.default,
            key: 'id',
        },
    },
    score: {
        type: sequelize_1.DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0,
    },
    calculatedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize_1.DataTypes.NOW,
    },
}, {
    sequelize: database_1.default,
    tableName: 'subject_term_grades',
    indexes: [
        {
            unique: true,
            fields: ['inscriptionSubjectId', 'termId'],
        },
    ],
});
exports.default = SubjectTermGrade;
