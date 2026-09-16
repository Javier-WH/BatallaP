"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
const Inscription_1 = __importDefault(require("./Inscription"));
const Subject_1 = __importDefault(require("./Subject"));
class InscriptionSubject extends sequelize_1.Model {
}
InscriptionSubject.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    inscriptionId: {
        type: sequelize_1.DataTypes.INTEGER,
        references: { model: Inscription_1.default, key: 'id' },
        allowNull: false
    },
    subjectId: {
        type: sequelize_1.DataTypes.INTEGER,
        references: { model: Subject_1.default, key: 'id' },
        allowNull: false
    },
    schoolPeriodId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
        comment: 'Denormalizado desde Inscription.schoolPeriodId',
    },
    gradeId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
        comment: 'Denormalizado desde Inscription.gradeId',
    },
    sectionId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
        comment: 'Denormalizado desde Inscription.sectionId',
    }
}, {
    sequelize: database_1.default,
    tableName: 'inscription_subjects',
    indexes: [
        {
            unique: true,
            fields: ['inscriptionId', 'subjectId']
        },
        {
            fields: ['schoolPeriodId', 'gradeId', 'subjectId'],
            name: 'idx_inscription_subjects_context',
        }
    ]
});
exports.default = InscriptionSubject;
